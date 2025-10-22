// ======================================
// Brand Card Generator Module
// ======================================
// Functions for creating branded cards using favicons and logos:
// - Fetch favicon from Google API
// - Analyze logo colors (background, primary logo color)
// - Generate branded cards with proper color schemes
// - Sample edge pixels for background detection
// - Calculate luminance for contrast decisions

import { hexToRGB } from './utils.js';
import { getBorderColor } from './border-renderer.js';

// Debug logger (injected from main.js)
let debugLog = () => {};

// Initialize debugLog function (called from main.js)
export function setDebugLogger(loggerFn) {
  debugLog = loggerFn;
}

// Sample edge pixels from an image to detect background color
// ======================================

export function sampleEdgePixels(img) {
  // Create temporary canvas to analyze image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);

  const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
  const pixels = imageData.data;

  // Sample pixels from edges
  const samples = [];
  const sampleCount = 20; // Sample 20 pixels per edge

  // Top edge
  for (let i = 0; i < sampleCount; i++) {
    const x = Math.floor((img.width / sampleCount) * i);
    const idx = (0 * img.width + x) * 4;
    samples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2], a: pixels[idx + 3] });
  }

  // Bottom edge
  for (let i = 0; i < sampleCount; i++) {
    const x = Math.floor((img.width / sampleCount) * i);
    const idx = ((img.height - 1) * img.width + x) * 4;
    samples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2], a: pixels[idx + 3] });
  }

  // Left edge
  for (let i = 0; i < sampleCount; i++) {
    const y = Math.floor((img.height / sampleCount) * i);
    const idx = (y * img.width + 0) * 4;
    samples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2], a: pixels[idx + 3] });
  }

  // Right edge
  for (let i = 0; i < sampleCount; i++) {
    const y = Math.floor((img.height / sampleCount) * i);
    const idx = (y * img.width + (img.width - 1)) * 4;
    samples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2], a: pixels[idx + 3] });
  }

  // Find most common color (simple averaging for now - could be improved with clustering)
  let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
  let opaqueCount = 0;

  samples.forEach(sample => {
    if (sample.a > 200) { // Only count opaque pixels
      totalR += sample.r;
      totalG += sample.g;
      totalB += sample.b;
      totalA += sample.a;
      opaqueCount++;
    }
  });

  if (opaqueCount === 0) {
    // All transparent - return white as default
    return { r: 255, g: 255, b: 255, a: 255 };
  }

  return {
    r: Math.round(totalR / opaqueCount),
    g: Math.round(totalG / opaqueCount),
    b: Math.round(totalB / opaqueCount),
    a: Math.round(totalA / opaqueCount)
  };
}

// Calculate relative luminance (perceived brightness) using WCAG 2.0 formula
// ======================================

export function calculateLuminance(r, g, b) {
  // Convert RGB to relative luminance (0-1 scale)
  // Formula from WCAG 2.0
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

// Generate branded card with logo (for known brands)
// ======================================

export async function generateBrandedCard(logoDataUrl, domain, brandName) {
  try {
    debugLog(`[INFO] Generating branded logo showcase for: ${brandName} (${domain})`);

    // Create canvas (standard OG image size)
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 630;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Load logo first to analyze colors
    const logo = new Image();
    logo.crossOrigin = 'anonymous'; // Enable CORS for pixel sampling

    await new Promise((resolve, reject) => {
      logo.onload = () => {
        // Sample edge pixels to detect background color
        const bgColor = sampleEdgePixels(logo);
        const bgColorRgba = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${bgColor.a / 255})`;

        debugLog(`[INFO] Detected background color: ${bgColorRgba}`);

        // Calculate luminance to determine border color
        const luminance = calculateLuminance(bgColor.r, bgColor.g, bgColor.b);
        const isLightBackground = luminance > 0.5;
        const borderColor = isLightBackground ? '#333333' : '#FFFFFF';

        debugLog(`[INFO] Luminance: ${luminance.toFixed(2)}, using ${isLightBackground ? 'dark' : 'light'} borders`);

        // Fill background with detected color
        ctx.fillStyle = bgColorRgba;
        ctx.fillRect(0, 0, width, height);

        // Draw thin borders on top and bottom with calculated contrast color
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        // Top border
        ctx.beginPath();
        ctx.moveTo(0, 1.5);
        ctx.lineTo(width, 1.5);
        ctx.stroke();
        // Bottom border
        ctx.beginPath();
        ctx.moveTo(0, height - 1.5);
        ctx.lineTo(width, height - 1.5);
        ctx.stroke();

        // Logo showcase scaling - make it BIG (90% of canvas)
        const logoOriginalWidth = logo.width;
        const logoOriginalHeight = logo.height;
        const logoAspectRatio = logoOriginalWidth / logoOriginalHeight;

        // Max logo area - 90% of canvas with padding
        const maxLogoWidth = width * 0.9;
        const maxLogoHeight = height * 0.9;

        let logoDrawWidth, logoDrawHeight;

        // Calculate scaled dimensions maintaining aspect ratio
        if (logoAspectRatio > maxLogoWidth / maxLogoHeight) {
          // Logo is wider - constrain by width
          logoDrawWidth = Math.min(logoOriginalWidth, maxLogoWidth);
          logoDrawHeight = logoDrawWidth / logoAspectRatio;
        } else {
          // Logo is taller - constrain by height
          logoDrawHeight = Math.min(logoOriginalHeight, maxLogoHeight);
          logoDrawWidth = logoDrawHeight * logoAspectRatio;
        }

        // Center logo both horizontally AND vertically
        const logoX = (width - logoDrawWidth) / 2;
        const logoY = (height - logoDrawHeight) / 2;

        // Draw the logo
        ctx.drawImage(logo, logoX, logoY, logoDrawWidth, logoDrawHeight);

        debugLog(`[OK] Branded logo showcase created (${Math.round(logoDrawWidth)}x${Math.round(logoDrawHeight)}, BG: ${bgColorRgba}, Borders: ${borderColor})`);
        resolve();
      };

      logo.onerror = () => {
        debugLog(`[FAIL] Could not load brand logo`);
        resolve(); // Continue even if logo fails to load
      };

      logo.src = logoDataUrl;
    });

    // Convert canvas to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          debugLog(`[OK] Branded logo showcase generated (${width}x${height})`);
          resolve(blob);
        } else {
          debugLog(`[FAIL] Could not convert canvas to blob`);
          resolve(null);
        }
      }, 'image/png');
    });

  } catch (err) {
    debugLog(`[ERROR] Branded card generation failed: ${err.message}`);
    return null;
  }
}

// Fetch favicon from Google API
// ======================================

export async function fetchFavicon(domain) {
  try {
    const faviconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=256`;
    debugLog(`Fetching favicon for ${domain}`);

    const response = await fetch(faviconUrl);
    if (!response.ok) {
      throw new Error(`Favicon fetch failed: ${response.status}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    debugLog(`Favicon fetch error: ${error.message}`);
    return null;
  }
}

// Analyze favicon to extract background color (from edges) and logo color (from center)
// ======================================

export async function analyzeLogoColors(faviconDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Create canvas to analyze the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = fullImageData.data;

        const toHex = (n) => {
          const hex = n.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };

        // ===== 1. Edge sampling with histogram for background color =====
        // Sample 8 edge positions (corners + midpoints) to avoid logo anti-aliasing
        // while still handling gradients with histogram
        const bgColorFrequency = {};
        const samplePositions = [
          [0, 0], [canvas.width - 1, 0], // top corners
          [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1], // bottom corners
          [Math.floor(canvas.width / 2), 0], // top center
          [Math.floor(canvas.width / 2), canvas.height - 1], // bottom center
          [0, Math.floor(canvas.height / 2)], // left center
          [canvas.width - 1, Math.floor(canvas.height / 2)] // right center
        ];

        samplePositions.forEach(([x, y]) => {
          const index = (y * canvas.width + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const a = pixels[index + 3];

          // Only count opaque pixels
          if (a > 200) {
            // Use exact color values for background (no quantization)
            const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            bgColorFrequency[hexColor] = (bgColorFrequency[hexColor] || 0) + 1;
          }
        });

        // Find most dominant background color from histogram
        let bgColor = '#ffffff'; // Default if all transparent
        const bgFrequencies = Object.values(bgColorFrequency);

        if (bgFrequencies.length > 0) {
          const maxFrequency = Math.max(...bgFrequencies);
          const dominantBgColors = Object.keys(bgColorFrequency).filter(
            color => bgColorFrequency[color] === maxFrequency
          );

          // If multiple colors tie, pick the first one (most stable)
          bgColor = dominantBgColors[0];

          debugLog(`Background sampling: ${bgFrequencies.length} unique colors found, dominant: ${bgColor} (${maxFrequency}/8 samples)`);
        }

        // ===== 2. Sample CENTER for logo color =====
        const centerX = Math.floor(canvas.width * 0.25);
        const centerY = Math.floor(canvas.height * 0.25);
        const centerWidth = Math.floor(canvas.width * 0.5);
        const centerHeight = Math.floor(canvas.height * 0.5);

        const centerImageData = ctx.getImageData(centerX, centerY, centerWidth, centerHeight);
        const centerPixels = centerImageData.data;

        // Count color frequencies (with color quantization to group similar colors)
        const colorFrequency = {};

        // Get background RGB for exclusion check
        const bgRGB = hexToRGB(bgColor);

        // Sample every 4th pixel to reduce processing (still plenty of samples)
        for (let i = 0; i < centerPixels.length; i += 16) { // 4 pixels * 4 channels = 16
          const r = centerPixels[i];
          const g = centerPixels[i + 1];
          const b = centerPixels[i + 2];
          const a = centerPixels[i + 3];

          // Only count opaque pixels (logo, not background)
          if (a > 200) {
            // Skip pixels that are too similar to background color
            const rDiff = Math.abs(bgRGB.r - r);
            const gDiff = Math.abs(bgRGB.g - g);
            const bDiff = Math.abs(bgRGB.b - b);
            const totalDiff = rDiff + gDiff + bDiff;

            if (totalDiff < 50) {
              continue; // Skip background pixels, only count logo pixels
            }

            // Quantize colors to reduce noise (round to nearest 32, clamped to 0-255)
            const qR = Math.min(255, Math.round(r / 32) * 32);
            const qG = Math.min(255, Math.round(g / 32) * 32);
            const qB = Math.min(255, Math.round(b / 32) * 32);

            const hexColor = `#${toHex(qR)}${toHex(qG)}${toHex(qB)}`;
            colorFrequency[hexColor] = (colorFrequency[hexColor] || 0) + 1;
          }
        }

        // Find most common logo color(s)
        const frequencies = Object.values(colorFrequency);
        let logoColor = '#ffffff'; // Default if no opaque pixels

        if (frequencies.length > 0) {
          const maxFrequency = Math.max(...frequencies);

          // Get all colors that have the maximum frequency (handles ties)
          const dominantColors = Object.keys(colorFrequency).filter(
            color => colorFrequency[color] === maxFrequency
          );

          // Randomly pick one if multiple colors tie
          logoColor = dominantColors[Math.floor(Math.random() * dominantColors.length)];

          debugLog(`Background: ${bgColor}, Logo: ${logoColor} (${dominantColors.length} colors tied at ${maxFrequency} samples)`);
        } else {
          debugLog(`Background: ${bgColor}, Logo: ${logoColor} (no opaque center pixels)`);
        }

        resolve({ bgColor, logoColor });

      } catch (error) {
        debugLog(`Color analysis error: ${error.message}`);
        resolve({ bgColor: '#ffffff', logoColor: '#ffffff' }); // Default on error
      }
    };

    img.onerror = () => {
      debugLog('Failed to load favicon for color analysis');
      resolve({ bgColor: '#ffffff', logoColor: '#ffffff' });
    };

    img.src = faviconDataUrl;
  });
}

// Generate branded card image using favicon (returns blob like generateDomainCard)
// ======================================

export async function generateFaviconBrandCard(domain, linkUrl) {
  debugLog(`Generating favicon brand card for ${domain}`);

  try {
    // Fetch favicon
    const faviconDataUrl = await fetchFavicon(domain);
    if (!faviconDataUrl) {
      debugLog('Favicon fetch failed, cannot generate brand card');
      return null;
    }

    // Analyze logo colors to get background and logo colors
    const { bgColor, logoColor } = await analyzeLogoColors(faviconDataUrl);

    // Calculate border color based on background and logo
    const borderColor = getBorderColor(bgColor, logoColor);
    debugLog(`Background: ${bgColor}, Logo: ${logoColor}, Border: ${borderColor}`);

    // Create canvas (standard OG image size)
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 630;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fill entire canvas with brand color
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Load and draw favicon centered
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Smart proportional scaling - logo should fill ~65% of canvas
        const targetWidthRatio = 0.65;
        const targetHeightRatio = 0.65;

        const maxDrawWidth = width * targetWidthRatio;   // ~780px
        const maxDrawHeight = height * targetHeightRatio; // ~410px

        // Scale to fit within bounds while maintaining aspect ratio
        const scale = Math.min(maxDrawWidth / img.width, maxDrawHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;

        // Center the logo
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;

        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        resolve();
      };
      img.onerror = () => {
        debugLog('Failed to load favicon for drawing');
        reject(new Error('Favicon load failed'));
      };
      img.src = faviconDataUrl;
    });

    // Convert canvas to blob (borderless) and return with borderColor
    // Borders will be added separately for full-size and thumbnail
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          debugLog('Favicon brand card blob generated successfully');
          resolve({ blob, borderColor });
        } else {
          debugLog('Failed to convert canvas to blob');
          resolve(null);
        }
      }, 'image/png', 0.9);
    });

  } catch (error) {
    debugLog(`Error generating favicon brand card: ${error.message}`);
    return null;
  }
}
