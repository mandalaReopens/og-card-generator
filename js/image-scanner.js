// ======================================
// Image Scanner Module
// ======================================
// Functions for finding and scoring images on web pages:
// - Validate image dimensions and aspect ratios
// - Score images based on size, format, location, semantics
// - Select images by domain name matching
// - Select best fallback images with intelligent filtering

import {
  getImageDimensions,
  getImageDimensionsFromBlob,
  toAbsoluteURL,
  dataURLToBlob,
  isSvgUrl
} from './utils.js';

// Image validation constants
const MIN_IMAGE_WIDTH = 400;
const MIN_IMAGE_HEIGHT = 200;
const MAX_ASPECT_RATIO = 3;
const IDEAL_ASPECT_RATIO = 1.91; // ~16:9, ideal for card layouts

// Keyword filtering for page scan
const IMAGE_EXCLUDED_KEYWORDS = [
  'icon', 'avatar', 'logo', 'badge', 'button', 'sprite',
  'pixel', 'tracking', 'ad', 'banner', 'widget', 'thumb',
  'nav', 'social', 'comment', 'sidebar', 'footer', 'header',
  'menu', 'spacer', 'dot', 'arrow', 'bullet', 'bg', 'background'
];

// Import debugLog from main.js (will be exported there)
// For now, we'll assume it's available globally or will be passed
let debugLog = () => {}; // Placeholder

// Initialize debugLog function (called from main.js after DOMContentLoaded)
export function setDebugLogger(loggerFn) {
  debugLog = loggerFn;
}

// Validate an image URL (dimensions, aspect ratio, etc.)
// ======================================

export async function validateImage(src) {
  debugLog(`[INFO] Validating image: ${src.split('/').pop()}`);

  const dims = await getImageDimensions(src);
  if (!dims) {
    debugLog(`  - Failed to load or get dimensions`);
    return null;
  }

  const { width, height } = dims;
  const aspectRatio = width / height;
  const area = width * height;

  debugLog(`  > Dimensions: ${width}x${height}, aspect: ${aspectRatio.toFixed(2)}, area: ${area}`);

  // Check minimum dimensions
  if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
    debugLog(`  - Too small (min ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT})`);
    return null;
  }

  // Check aspect ratio
  if (aspectRatio > MAX_ASPECT_RATIO || aspectRatio < (1 / MAX_ASPECT_RATIO)) {
    debugLog(`  - Aspect ratio out of range`);
    return null;
  }

  debugLog(`  + VALID!`);
  return { src, width, height, area, aspectRatio };
}

// Score an image candidate based on multiple factors
// ======================================

export function scoreImage(candidate, allCandidates = []) {
  const { src, width, height, area, aspectRatio, format, semanticLocation, source } = candidate;

  // Base score from area (normalized, max ~1000 points for 2MP image)
  const areaScore = Math.min(area / 2000, 1000);

  // Aspect ratio score (prefer landscape ~1.91:1, penalize extreme ratios)
  const aspectDiff = Math.abs(aspectRatio - IDEAL_ASPECT_RATIO);
  const aspectScore = Math.max(0, 1000 - (aspectDiff * 500));

  // Format score (SVG > PNG > JPG)
  let formatScore = 0;
  if (format === 'svg') formatScore = 2000;
  else if (format === 'png') formatScore = 1000;
  else if (format === 'jpg' || format === 'jpeg') formatScore = 500;

  // Semantic location score (HEAVILY boosted to favor editorial content)
  let locationScore = 0;
  if (semanticLocation === 'article' || semanticLocation === 'main') {
    locationScore = 3000; // Triple boost for main content areas
    debugLog(`    + Location boost: In main content area (${semanticLocation})`);
  } else if (semanticLocation === 'content') {
    locationScore = 2000;
    debugLog(`    + Location boost: In content area`);
  }

  // Source bonus (REDUCED - domain match often favors branding over content)
  let sourceScore = 0;
  if (source === 'Domain Match') sourceScore = 200; // Reduced from 500
  else if (source === 'OG') sourceScore = 0; // No special bonus for OG

  // Filename-based semantic penalties (ONLY for page scan images, not OG images)
  let semanticPenalty = 0;
  if (src && source !== 'OG') {
    const srcLower = src.toLowerCase();
    const filename = srcLower.split('/').pop().split('?')[0]; // Get filename without query params
    const fullPath = srcLower; // Also check full path

    // Heavy penalties for obvious non-editorial images
    if (filename.match(/icon|newsletter|subscribe|author|avatar|profile|logo|-rev\b|albumart|album-art|thumblarge/i)) {
      semanticPenalty = -2000;
      debugLog(`    - Semantic penalty: Non-editorial image detected (${filename.substring(0, 30)}...)`);
    }
    // Medium penalty for UI/navigation elements
    else if (filename.match(/button|badge|widget|ad-|banner|thumb|square\d+/i)) {
      semanticPenalty = -1000;
      debugLog(`    - Semantic penalty: UI element detected (${filename.substring(0, 30)}...)`);
    }
    // Check path for section branding directories
    else if (fullPath.match(/\/newsletters\/|\/sections\/|\/podcasts?\/|\/shows?\/|\/series\//i)) {
      semanticPenalty = -1500;
      debugLog(`    - Semantic penalty: Section branding path detected`);
    }
  }

  // Prominence bonuses (context-aware scoring)
  let prominenceScore = 0;

  // Few images = higher prominence (minimal site boost)
  if (allCandidates.length > 0 && allCandidates.length <= 3) {
    prominenceScore += 1500; // Significant boost for minimal sites
    debugLog(`    + Prominence boost: Minimal site (${allCandidates.length} images)`);
  }

  // Largest image boost (REDUCED from 1000 to 300 - size isn't everything)
  if (allCandidates.length > 0) {
    const maxArea = Math.max(...allCandidates.map(c => c.area || 0));
    if (area === maxArea) {
      prominenceScore += 300;
      debugLog(`    + Prominence boost: Largest image (${width}x${height})`);
    }
  }

  const totalScore = areaScore + aspectScore + formatScore + locationScore + sourceScore + prominenceScore + semanticPenalty;

  debugLog(`    Scoring: area=${areaScore.toFixed(0)}, aspect=${aspectScore.toFixed(0)}, format=${formatScore}, location=${locationScore}, source=${sourceScore}, prominence=${prominenceScore}, semantic=${semanticPenalty} -> TOTAL=${totalScore.toFixed(0)}`);

  return totalScore;
}

// Select image by domain name matching (returns array of candidates)
// ======================================

export async function selectImageByDomainMatch(doc, url, minWidth = MIN_IMAGE_WIDTH, minHeight = MIN_IMAGE_HEIGHT) {
  // Extract domain name from URL
  const urlObj = new URL(url);
  let domain = urlObj.hostname
    .replace(/^www\./, '')           // Remove www.
    .replace(/\.[a-z]{2,}$/i, '')    // Remove TLD (.com, .co.uk, etc.)
    .toLowerCase();

  debugLog(`[INFO] Domain matching: extracted domain "${domain}" from ${url}`);

  // Minimum 3 chars to avoid false matches
  if (domain.length < 3) {
    debugLog(`[FAIL] Domain too short (${domain.length} chars)`);
    return [];
  }

  const allImages = Array.from(doc.querySelectorAll('img[src]'));
  debugLog(`[INFO] Found ${allImages.length} total images on page`);

  const allMatches = [];

  // Try progressively longer prefixes: start at 3 chars, go up to full domain
  for (let prefixLen = 3; prefixLen <= domain.length; prefixLen++) {
    const prefix = domain.substring(0, prefixLen);
    debugLog(`[INFO] Trying prefix: "${prefix}"`);

    for (const img of allImages) {
      let src = img.getAttribute('src');
      if (!src) continue;

      // Convert to absolute URL using helper
      src = toAbsoluteURL(src, url);
      if (!src) continue;

      // Skip if already processed
      if (allMatches.some(m => m.src === src)) continue;

      // Extract filename from URL (last part after /)
      const filename = src.split('/').pop().toLowerCase();

      // Check if filename contains domain prefix
      if (filename.includes(prefix)) {
        debugLog(`  + Match found: ${filename.substring(0, 50)}...`);

        // Validate dimensions
        const dims = await getImageDimensions(src);
        if (!dims) {
          debugLog(`    - Failed to load dimensions`);
          continue;
        }

        const { width, height } = dims;
        const aspectRatio = width / height;
        debugLog(`    > Dimensions: ${width}x${height}, aspect ratio: ${aspectRatio.toFixed(2)}`);

        // Check minimum dimensions
        if (width < minWidth || height < minHeight) {
          debugLog(`    - Too small (min ${minWidth}x${minHeight})`);
          continue;
        }

        // Check aspect ratio
        if (aspectRatio > MAX_ASPECT_RATIO || aspectRatio < (1 / MAX_ASPECT_RATIO)) {
          debugLog(`    - Aspect ratio out of range`);
          continue;
        }

        debugLog(`    + VALID! Area: ${width * height}`);

        // Detect format
        const format = isSvgUrl(src) ? 'svg' : (src.toLowerCase().endsWith('.png') ? 'png' : 'jpg');

        allMatches.push({
          src,
          width,
          height,
          area: width * height,
          aspectRatio,
          format,
          source: 'Domain Match',
          semanticLocation: null // Could enhance this later
        });
      }
    }
  }

  if (allMatches.length > 0) {
    debugLog(`[OK] Found ${allMatches.length} domain-matched candidates`);
  } else {
    debugLog(`[FAIL] No domain matches found`);
  }

  return allMatches;
}

// Select best fallback image using intelligent filtering (returns array of candidates)
// ======================================

export async function selectBestFallbackImage(doc, baseUrl, minWidth = MIN_IMAGE_WIDTH, minHeight = MIN_IMAGE_HEIGHT) {
  const EXCLUDE_TAGS = ['NAV', 'HEADER', 'FOOTER', 'ASIDE'];

  const imgElements = Array.from(doc.querySelectorAll('img[src]'));
  const totalImageCount = imgElements.length;
  const candidates = [];

  debugLog(`[INFO] Found ${totalImageCount} total images - ${totalImageCount <= 3 ? 'MINIMAL SITE (lenient filtering)' : 'CONTENT-RICH SITE (strict filtering)'}`);

  for (const img of imgElements) {
    let src = img.getAttribute('src');
    if (!src) {
      debugLog(`  - Skipped: no src attribute`);
      continue;
    }

    debugLog(`  > Evaluating: ${src.split('/').pop()}`);

    // Handle data URLs with context-aware filtering
    let isDataURL = false;
    let dataURLBlob = null;

    if (src.startsWith('data:')) {
      isDataURL = true;

      // Skip data URLs on content-rich sites (likely tracking pixels/icons)
      if (totalImageCount > 3) {
        debugLog(`    - Skipped: data URL (content-rich site, ${totalImageCount} images)`);
        continue;
      }

      // Only process PNG/JPEG data URLs
      if (!src.startsWith('data:image/png') && !src.startsWith('data:image/jpeg')) {
        debugLog(`    - Skipped: data URL (not PNG/JPEG)`);
        continue;
      }

      // Skip if too small (likely a tracking pixel or tiny icon)
      const estimatedSize = src.length / 1.37; // base64 is ~1.37x original size
      if (estimatedSize < 1000) { // < 1KB
        debugLog(`    - Skipped: data URL too small (~${Math.round(estimatedSize)} bytes)`);
        continue;
      }

      debugLog(`    + Data URL detected on minimal site (~${(estimatedSize/1024).toFixed(1)}KB, processing...)`);

      // Decode data URL to blob for dimension checking
      dataURLBlob = await dataURLToBlob(src);
      if (!dataURLBlob) {
        debugLog(`    - Skipped: failed to decode data URL`);
        continue;
      }
    } else {
      // Convert regular URLs to absolute
      src = toAbsoluteURL(src, baseUrl);
      if (!src) {
        debugLog(`    - Skipped: failed URL conversion`);
        continue;
      }
    }

    // Context-aware keyword filtering (filename only, not full path)
    const filename = src.split('/').pop().split('?')[0].toLowerCase();
    if (totalImageCount > 3) {
      // Strict filtering for content-rich sites
      if (IMAGE_EXCLUDED_KEYWORDS.some(kw => filename.includes(kw))) {
        debugLog(`    - Skipped: keyword excluded (${filename})`);
        continue;
      }
    } else {
      debugLog(`    + Lenient mode: allowing all keywords`);
    }
    // For minimal sites (≤3 images), allow ALL images including logos

    // Detect semantic location (check parent elements)
    let inExcludedZone = false;
    let semanticLocation = null;
    let parent = img.parentElement;
    let depth = 0;

    while (parent && depth < 5) {
      const tagName = parent.tagName;

      // Check for excluded zones
      if (EXCLUDE_TAGS.includes(tagName)) {
        inExcludedZone = true;
        debugLog(`    - Skipped: in excluded tag <${tagName}>`);
        break;
      }

      // Check for content zones
      if (tagName === 'ARTICLE') semanticLocation = 'article';
      else if (tagName === 'MAIN') semanticLocation = 'main';
      else if (!semanticLocation) {
        const parentIdClass = ((parent.id || '') + ' ' + (parent.className || '')).toLowerCase();
        if (parentIdClass.match(/sidebar|comment|widget|footer|header|nav/)) {
          inExcludedZone = true;
          debugLog(`    - Skipped: in excluded zone (id/class: ${parentIdClass.substring(0, 30)}...)`);
          break;
        }
        if (parentIdClass.match(/content|post|entry/)) {
          semanticLocation = 'content';
        }
      }

      parent = parent.parentElement;
      depth++;
    }

    if (inExcludedZone) continue;

    // Load image to check dimensions
    debugLog(`    + Checking dimensions...`);
    let dims;

    if (isDataURL && dataURLBlob) {
      // Get dimensions from blob
      dims = await getImageDimensionsFromBlob(dataURLBlob);
    } else {
      // Get dimensions from URL
      dims = await getImageDimensions(src);
    }

    if (!dims) {
      debugLog(`    - Skipped: failed to load image`);
      continue;
    }

    const { width, height } = dims;
    const aspectRatio = width / height;
    debugLog(`    + Loaded: ${width}x${height}, aspect ratio: ${aspectRatio.toFixed(2)}`);

    // Filter by dimensions
    if (width < minWidth || height < minHeight) {
      debugLog(`    - Skipped: too small (min ${minWidth}x${minHeight})`);
      continue;
    }
    if (aspectRatio > MAX_ASPECT_RATIO || aspectRatio < (1 / MAX_ASPECT_RATIO)) {
      debugLog(`    - Skipped: aspect ratio out of range (${aspectRatio.toFixed(2)} not in ${(1/MAX_ASPECT_RATIO).toFixed(2)}-${MAX_ASPECT_RATIO})`);
      continue;
    }

    // Detect format
    let format;
    if (isDataURL) {
      // For data URLs, extract format from MIME type
      format = src.startsWith('data:image/png') ? 'png' : 'jpg';
    } else {
      format = isSvgUrl(src) ? 'svg' : (src.toLowerCase().endsWith('.png') ? 'png' : 'jpg');
    }

    debugLog(`    + VALID CANDIDATE! Adding to list.`);

    candidates.push({
      src: isDataURL ? src : src, // Keep original data URL or converted absolute URL
      width,
      height,
      area: width * height,
      aspectRatio,
      format,
      source: 'Page Scan',
      semanticLocation,
      isDataURL: isDataURL,
      dataURLBlob: isDataURL ? dataURLBlob : null
    });

    // Stop after finding 10 good candidates (performance limit)
    if (candidates.length >= 10) break;
  }

  if (candidates.length > 0) {
    debugLog(`[OK] Found ${candidates.length} page scan candidates`);
  } else {
    debugLog(`[FAIL] No valid page images found`);
  }

  return candidates;
}
