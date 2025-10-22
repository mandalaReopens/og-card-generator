// ======================================
// Border Rendering Module
// ======================================
// Functions for adding borders to brand cards with mat effect
// Independent border rendering for full-size and thumbnail images

import { hexToRGB, getLuminance } from './utils.js';

// Determine border color based on background and logo colors
// ======================================

export function getBorderColor(bgColor, logoColor) {
  // Check if colors are too similar (nearly identical)
  const bgRGB = hexToRGB(bgColor);
  const logoRGB = hexToRGB(logoColor);

  // Calculate total RGB difference
  const rDiff = Math.abs(bgRGB.r - logoRGB.r);
  const gDiff = Math.abs(bgRGB.g - logoRGB.g);
  const bDiff = Math.abs(bgRGB.b - logoRGB.b);
  const totalDiff = rDiff + gDiff + bDiff;

  // If colors are very similar (difference < 50 out of 765 max)
  if (totalDiff < 50) {
    // Edge case: use subtle grey variation
    const bgLuminance = getLuminance(bgColor);

    if (bgLuminance > 0.5) {
      // Light background → slightly darker grey
      return '#cccccc';
    } else {
      // Dark background → slightly lighter grey
      return '#444444';
    }
  }

  // Normal case: use logo color as border
  return logoColor;
}

// Add border to full-size card (1200x630) with mat effect
// ======================================

export function addBorderToFullSizeCard(ctx, width, height, borderColor) {
  const inset = 18; // Inset from edge for brand color "mat" effect
  const borderWidth = 4; // Substantial but not heavy

  ctx.fillStyle = borderColor;

  // Draw 4 solid rectangles for each edge (no anti-aliasing artifacts)
  // Top border
  ctx.fillRect(inset, inset, width - (inset * 2), borderWidth);

  // Bottom border
  ctx.fillRect(inset, height - inset - borderWidth, width - (inset * 2), borderWidth);

  // Left border
  ctx.fillRect(inset, inset, borderWidth, height - (inset * 2));

  // Right border
  ctx.fillRect(width - inset - borderWidth, inset, borderWidth, height - (inset * 2));
}

// Add border to thumbnail (200x112) with mat effect
// ======================================

export function addBorderToThumbnail(ctx, width, height, borderColor) {
  const inset = 3; // Proportional inset for thumbnail
  const borderWidth = 1; // Crisp on small display

  ctx.fillStyle = borderColor;

  // Draw 4 solid rectangles for each edge (no anti-aliasing artifacts)
  // Top border
  ctx.fillRect(inset, inset, width - (inset * 2), borderWidth);

  // Bottom border
  ctx.fillRect(inset, height - inset - borderWidth, width - (inset * 2), borderWidth);

  // Left border
  ctx.fillRect(inset, inset, borderWidth, height - (inset * 2));

  // Right border
  ctx.fillRect(width - inset - borderWidth, inset, borderWidth, height - (inset * 2));
}

// Add border to a blob (used for full-size favicon brand cards)
// ======================================

export async function addBorderToBlob(blob, width, height, borderColor, inset, borderWidth) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Create canvas at target size
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Draw the source image
      ctx.drawImage(img, 0, 0, width, height);

      // Add border
      ctx.fillStyle = borderColor;

      // Top border
      ctx.fillRect(inset, inset, width - (inset * 2), borderWidth);

      // Bottom border
      ctx.fillRect(inset, height - inset - borderWidth, width - (inset * 2), borderWidth);

      // Left border
      ctx.fillRect(inset, inset, borderWidth, height - (inset * 2));

      // Right border
      ctx.fillRect(width - inset - borderWidth, inset, borderWidth, height - (inset * 2));

      // Convert to blob
      canvas.toBlob((newBlob) => {
        resolve(newBlob);
      }, 'image/png', 0.9);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(blob);
  });
}
