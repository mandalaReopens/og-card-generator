// ======================================
// Card Generator Module
// ======================================
// Functions for generating and processing cards:
// - Generate domain cards (fallback cards with domain name)
// - Crop images to thumbnail size
// - Create placeholder images

import { addBorderToThumbnail } from './border-renderer.js';

// Configuration constants
const THUMB_WIDTH = 200;
const THUMB_HEIGHT = 112;
const IMAGE_QUALITY = 0.9;

// Debug logger (injected from main.js)
let debugLog = () => {};

// Initialize debugLog function (called from main.js)
export function setDebugLogger(loggerFn) {
  debugLog = loggerFn;
}

// Generate domain card (fallback card with domain name)
// ======================================

export async function generateDomainCard(domain) {
  try {
    debugLog(`[INFO] Generating domain card for: ${domain}`);

    // Strip common prefixes (www, www2, etc.)
    const cleanDomain = domain.replace(/^(www\d*\.|m\.|mobile\.)/i, '');

    // Create canvas (standard OG image size)
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 630;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Colors
    const teal = '#225560';
    const yellow = '#FDCA40';
    const green = '#179355';
    const white = '#FFFFFF';

    // Fill background
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, width, height);

    // Draw border (much thicker - must be visible after crop to 200x112)
    ctx.strokeStyle = teal;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    // Draw photo icon (top-left, much larger)
    const iconX = 60;
    const iconY = 60;
    const iconSize = 140;

    // Create SVG icon with thicker stroke
    const photoIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${teal}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 8h.01" />
      <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" />
      <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
      <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
    </svg>`;

    const iconBlob = new Blob([photoIconSvg], { type: 'image/svg+xml' });
    const iconUrl = URL.createObjectURL(iconBlob);

    // Load and draw icon
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
        URL.revokeObjectURL(iconUrl);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(iconUrl);
        resolve(); // Continue even if icon fails
      };
      img.src = iconUrl;
    });

    // Draw "OG" branding (top-right, much larger)
    const ogY = 60;
    const ogFontSize = 110;
    ctx.font = `bold ${ogFontSize}px Outfit, sans-serif`;
    ctx.textBaseline = 'top';

    // Draw "O" in yellow (measure first to position correctly)
    ctx.fillStyle = yellow;
    const oText = 'O';
    const oWidth = ctx.measureText(oText).width;
    const gText = 'G';
    const gWidth = ctx.measureText(gText).width;
    const totalWidth = oWidth + gWidth;

    // Position from right edge
    const ogX = width - 60;
    ctx.textAlign = 'left';
    ctx.fillText(oText, ogX - totalWidth, ogY);

    // Draw "G" in green (right after "O")
    ctx.fillStyle = green;
    ctx.fillText(gText, ogX - totalWidth + oWidth, ogY);

    // Draw domain name (bottom-center, moved up)
    const domainUpper = cleanDomain.toUpperCase();
    const domainY = 470; // Moved up from 560
    const domainLen = domainUpper.length;

    // Graded font sizes based on domain length
    let fontSize;
    if (domainLen <= 10) {
      fontSize = 120; // Large for short domains
    } else if (domainLen <= 15) {
      fontSize = 100; // Medium for medium domains
    } else if (domainLen <= 20) {
      fontSize = 80; // Smaller for longer domains
    } else {
      fontSize = 64; // Smallest for very long domains
    }

    const maxWidth = 1080; // Leave margins

    // Calculate optimal font size
    ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let textWidth = ctx.measureText(domainUpper).width;

    // Scale down if still too wide
    if (textWidth > maxWidth) {
      fontSize = Math.max(48, Math.floor(fontSize * (maxWidth / textWidth)));
      ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
    }

    // Draw domain text in teal
    ctx.fillStyle = teal;
    ctx.fillText(domainUpper, width / 2, domainY);

    // Convert canvas to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          debugLog(`[OK] Domain card generated (${width}x${height})`);
          resolve(blob);
        } else {
          debugLog(`[FAIL] Could not convert canvas to blob`);
          resolve(null);
        }
      }, 'image/png');
    });

  } catch (err) {
    debugLog(`[ERROR] Domain card generation failed: ${err.message}`);
    return null;
  }
}

// Crop image blob to thumbnail size (200x112)
// ======================================

export async function cropToThumbnail(blob, borderColor = null) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      const sourceWidth = img.naturalWidth;
      const sourceHeight = img.naturalHeight;

      // Add light gray background for transparent images
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

      // Scale to cover canvas (max of width/height ratios)
      const scale = Math.max(THUMB_WIDTH / sourceWidth, THUMB_HEIGHT / sourceHeight);
      const cropWidth = THUMB_WIDTH / scale;
      const cropHeight = THUMB_HEIGHT / scale;

      // Center crop coordinates in source image
      const cropX = (sourceWidth - cropWidth) / 2;
      const cropY = (sourceHeight - cropHeight) / 2;

      // Draw cropped source to full canvas
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);

      // Add border if borderColor provided (for favicon brand cards)
      if (borderColor) {
        addBorderToThumbnail(ctx, THUMB_WIDTH, THUMB_HEIGHT, borderColor);
      }

      // Output base64 as PNG to preserve transparency
      canvas.toBlob((croppedBlob) => {
        const reader = new FileReader();
        reader.readAsDataURL(croppedBlob);
        reader.onloadend = () => resolve(reader.result);
      }, 'image/png', IMAGE_QUALITY);
    };
    img.onerror = () => resolve(createPlaceholder());
    img.src = URL.createObjectURL(blob);
  });
}

// Create placeholder SVG (scaled) with 5th.Place branding
// ======================================

export function createPlaceholder() {
  return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjExMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjExMiIgZmlsbD0iI2Y1ZjVmNyIvPgogIDx0ZXh0IHg9IjEwMCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJPcGVuIFNhbnMsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPjV0aC5QbGFjZTwvdGV4dD4KICA8dGV4dCB4PSIxMDAiIHk9IjY4IiBmb250LWZhbWlseT0iT3BlbiBTYW5zLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjYmJiIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JdCBzdGFydHMgd2l0aCBtZS4uLjwvdGV4dD4KPC9zdmc+Cg==`;
}
