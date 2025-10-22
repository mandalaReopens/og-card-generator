// ======================================
// Utility Functions Module
// ======================================
// Pure utility functions with no external dependencies
// Used across the OG Card Generator extension

// URL Utilities
// ======================================

export function normalizeURL(input) {
  let url = input.trim();

  // If already has protocol, return as-is
  if (url.match(/^https?:\/\//i)) {
    return url;
  }

  // Add https:// prefix for bare domains
  return 'https://' + url;
}

export function toAbsoluteURL(imageSrc, pageUrl) {
  // Already absolute? Use as-is
  if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
    return imageSrc;
  }

  try {
    const base = new URL(pageUrl);

    // Protocol-relative: //cdn.example.com/image.png
    if (imageSrc.startsWith('//')) {
      return base.protocol + imageSrc;
    }

    // Absolute path: /images/logo.png
    if (imageSrc.startsWith('/')) {
      return base.origin + imageSrc;
    }

    // Relative path: images/logo.png
    return new URL(imageSrc, pageUrl).href;
  } catch (e) {
    console.error(`[ERROR] Failed to convert relative URL: ${imageSrc}`);
    return null;
  }
}

// Data Conversion Utilities
// ======================================

export async function dataURLToBlob(dataURL) {
  try {
    const parts = dataURL.split(',');
    if (parts.length !== 2) return null;

    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch) return null;

    const mime = mimeMatch[1];
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error(`[ERROR] Failed to decode data URL: ${e.message}`);
    return null;
  }
}

export async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Image Utilities
// ======================================

export async function getImageDimensionsFromBlob(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve({ src: url, width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

export async function getImageDimensions(src) {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => resolve(null), 5000);

    img.onload = () => {
      clearTimeout(timeout);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    img.src = src;
  });
}

export function isSvgUrl(url) {
  return url.toLowerCase().endsWith('.svg') || url.toLowerCase().includes('.svg?');
}

export async function rasterizeSvg(svgUrl, standardSize = 1200) {
  try {
    console.log(`[INFO] Attempting to rasterize SVG: ${svgUrl.split('/').pop()}`);

    const response = await fetch(svgUrl);
    if (!response.ok) {
      console.log(`[FAIL] Could not fetch SVG (status ${response.status})`);
      return null;
    }

    const svgText = await response.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log(`[FAIL] SVG rasterization timeout`);
        resolve(null);
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);

        // Create canvas and draw SVG at standard high resolution
        const canvas = document.createElement('canvas');

        // Use intrinsic dimensions if available and larger than standard, otherwise use standard size
        const naturalWidth = img.naturalWidth || img.width || standardSize;
        const naturalHeight = img.naturalHeight || img.height || standardSize;

        canvas.width = Math.max(naturalWidth, standardSize);
        canvas.height = Math.max(naturalHeight, standardSize);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);

        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            console.log(`[OK] SVG rasterized to PNG (${canvas.width}x${canvas.height})`);
            resolve(pngBlob);
          } else {
            console.log(`[FAIL] Could not convert SVG to PNG blob`);
            resolve(null);
          }
        }, 'image/png');
      };

      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        console.log(`[FAIL] Could not load SVG image`);
        resolve(null);
      };

      img.src = url;
    });
  } catch (err) {
    console.error(`[ERROR] SVG rasterization failed: ${err.message}`);
    return null;
  }
}

// Color Utilities
// ======================================

export function hexToRGB(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return { r, g, b };
}

export function getLuminance(hexColor) {
  // Extract RGB components from hex color
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Calculate relative luminance (perceived brightness) - WCAG formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance;
}

export function calculateContrast(color1, color2) {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  // WCAG contrast ratio formula
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Text Utilities
// ======================================

export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function extractPlainText(html) {
  // Simple plain text extractor for fallback
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
}
