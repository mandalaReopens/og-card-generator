// ======================================
// HTML Generators Module
// ======================================
// Functions for generating different output formats
// - Preview HTML (with CSS classes)
// - Email HTML (fully inlined styles)
// - Document HTML (Google Docs/Word compatible)
// - Markdown (Chat/WhatsApp format)
// - PNG Image (Canvas-based)

import { escapeHTML } from './utils.js';

// Generate card HTML for preview (uses CSS classes, rendered with styles.css)
// ======================================

export function generateCardHTML(title, description, imageUrl, domain, linkUrl, settings) {
  // Fallbacks if OG missing
  title = title || 'Untitled Page';
  description = description || 'Check out this link for more details.';
  domain = domain || new URL(linkUrl).hostname.replace('www.', '') || 'unknown.com';

  // Sanitize user-controlled content to prevent XSS
  const safeTitle = escapeHTML(title);
  const safeDescription = escapeHTML(description).replace(/\n/g, '<br>');
  const safeDomain = escapeHTML(domain).toUpperCase();
  const safeLinkUrl = escapeHTML(linkUrl);
  const safeImageUrl = escapeHTML(imageUrl);

  // Apply user settings
  const titleSize = settings.titleFontSize;
  const descSize = settings.descFontSize;
  const titleFont = settings.titleFont;
  const descFont = settings.descFont;
  const titleColor = settings.titleColor;
  const descColor = settings.descColor;
  const domainColor = settings.domainColor;
  const borderColor = settings.borderColor;
  const borderStyle = settings.borderStyle;
  const borderWeight = settings.borderWeight;
  const borderRadius = settings.borderRadius;

  return `
<table border="0" cellpadding="0" cellspacing="0" class="og-card-outer">
  <tr>
    <td class="og-card-border" style="border:${borderWeight} ${borderStyle} ${borderColor};border-radius:${borderRadius}">
      <table border="0" cellpadding="0" cellspacing="0" class="og-card-inner">
        <tr>
          <td class="og-card-content-row">
            <table border="0" cellpadding="0" cellspacing="0" class="og-card-content-table">
              <tr>
                <th rowspan="2" class="og-card-image-cell">
                  <a href="${safeLinkUrl}" target="_blank"><img src="${safeImageUrl}" width="120" class="og-card-image" alt="${safeTitle}"></a>
                </th>
                <th class="og-card-text-cell" style="color:${titleColor}">
                  <p class="og-card-title" style="font-family:${titleFont};font-size:${titleSize}"><a href="${safeLinkUrl}" target="_blank" style="color:${titleColor}">${safeTitle}</a></p>
                  <p class="og-card-description" style="font-family:${descFont};font-size:${descSize}"><a href="${safeLinkUrl}" target="_blank" style="color:${descColor}">${safeDescription}</a></p>
                </th>
              </tr>
              <tr>
                <td class="og-card-domain-cell" style="font-family:${descFont}">
                  <a class="og-card-domain" style="color:${domainColor}" href="${safeLinkUrl}" target="_blank">${safeDomain}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="og-card-footer">Powered by 5th.Place | It starts with me...</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// Generate email HTML (fully inlined styles for email clients)
// ======================================

export function generateEmailHTML(title, description, imageUrl, domain, linkUrl, settings) {
  // Fallbacks if OG missing
  title = title || 'Untitled Page';
  description = description || 'Check out this link for more details.';
  domain = domain || new URL(linkUrl).hostname.replace('www.', '') || 'unknown.com';

  // Sanitize user-controlled content to prevent XSS
  const safeTitle = escapeHTML(title);
  const safeDescription = escapeHTML(description).replace(/\n/g, '<br>');
  const safeDomain = escapeHTML(domain).toUpperCase();
  const safeLinkUrl = escapeHTML(linkUrl);
  const safeImageUrl = escapeHTML(imageUrl);

  // Apply user settings
  const titleSize = settings.titleFontSize;
  const descSize = settings.descFontSize;
  const titleFont = settings.titleFont;
  const descFont = settings.descFont;
  const titleColor = settings.titleColor;
  const descColor = settings.descColor;
  const domainColor = settings.domainColor;
  const borderColor = settings.borderColor;
  const borderStyle = settings.borderStyle;
  const borderWeight = settings.borderWeight;
  const borderRadius = settings.borderRadius;

  return `
<table border="0" cellpadding="0" cellspacing="0" style="width:580px">
  <tr>
    <td style="border:${borderWeight} ${borderStyle} ${borderColor};border-radius:${borderRadius};padding:8px">
      <table border="0" cellpadding="0" cellspacing="0" style="width:100%">
        <tr>
          <td style="padding-bottom:8px">
            <table border="0" cellpadding="0" cellspacing="0" style="width:100%">
              <tr>
                <th rowspan="2" style="width:134px;vertical-align:middle;text-align:left;font-weight:400">
                  <a href="${safeLinkUrl}" target="_blank"><img src="${safeImageUrl}" width="120" style="width:120px;max-width:100%;display:block" alt="${safeTitle}"></a>
                </th>
                <th style="font-weight:400;text-align:left;vertical-align:top">
                  <p style="font-family:${titleFont};margin:0 0 2px 0;line-height:22px;font-weight:600;font-size:${titleSize}"><a href="${safeLinkUrl}" target="_blank" style="color:${titleColor};text-decoration:none">${safeTitle}</a></p>
                  <p style="font-family:${descFont};margin:0 0 2px 0;line-height:17px;font-size:${descSize}"><a href="${safeLinkUrl}" target="_blank" style="color:${descColor};text-decoration:none">${safeDescription}</a></p>
                </th>
              </tr>
              <tr>
                <td style="vertical-align:bottom;font-family:${descFont};line-height:11px;text-align:left;padding-top:8px">
                  <a style="font-size:11px;letter-spacing:1px;text-decoration:none;text-transform:uppercase;font-weight:normal;color:${domainColor}" href="${safeLinkUrl}" target="_blank">${safeDomain}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top:6px;border-top:1px solid #dde;font-family:${descFont};font-size:11px;color:#666">Powered by 5th.Place | It starts with me...</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// Generate document HTML (simple table for Google Docs/Word compatibility)
// ======================================

export function generateDocumentHTML(title, description, imageUrl, domain, linkUrl, settings) {
  // Fallbacks if OG missing
  title = title || 'Untitled Page';
  description = description || 'Check out this link for more details.';
  domain = domain || new URL(linkUrl).hostname.replace('www.', '') || 'unknown.com';

  // Sanitize user-controlled content to prevent XSS
  const safeTitle = escapeHTML(title);
  const safeDescription = escapeHTML(description).replace(/\n/g, '<br>');
  const safeDomain = escapeHTML(domain).toUpperCase();
  const safeLinkUrl = escapeHTML(linkUrl);
  const safeImageUrl = escapeHTML(imageUrl);

  // Apply user settings
  const titleSize = settings.titleFontSize;
  const descSize = settings.descFontSize;
  const titleFont = settings.titleFont;
  const descFont = settings.descFont;
  const titleColor = settings.titleColor;
  const descColor = settings.descColor;
  const domainColor = settings.domainColor;
  const borderColor = settings.borderColor;
  const borderStyle = settings.borderStyle;
  const borderWeight = settings.borderWeight;
  const borderRadius = settings.borderRadius;

  return `
<table border="0" cellpadding="0" cellspacing="0" style="width:580px;border:${borderWeight} ${borderStyle} ${borderColor};border-radius:${borderRadius};border-collapse:collapse">
  <tr>
    <td style="width:134px;padding:8px;vertical-align:middle;border:none">
      <a href="${safeLinkUrl}" target="_blank"><img src="${safeImageUrl}" width="120" style="width:120px;display:block" alt="${safeTitle}"></a>
    </td>
    <td style="padding:8px;vertical-align:top;border:none">
      <div>
        <p style="font-family:${titleFont};margin:0 0 2px 0;line-height:1.2;font-weight:600;font-size:${titleSize}"><a href="${safeLinkUrl}" target="_blank" style="color:${titleColor};text-decoration:none">${safeTitle}</a></p>
        <p style="font-family:${descFont};margin:0;line-height:17px;font-size:${descSize}"><a href="${safeLinkUrl}" target="_blank" style="color:${descColor};text-decoration:none">${safeDescription}</a></p>
      </div>
      <div style="font-family:${descFont};line-height:11px;padding-top:8px">
        <a style="font-size:11px;letter-spacing:1px;text-decoration:none;text-transform:uppercase;font-weight:normal;color:${domainColor}" href="${safeLinkUrl}" target="_blank">${safeDomain}</a>
      </div>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding-top:6px;border-top:1px solid #dde;font-family:${descFont};font-size:11px;color:#666;border:none">Powered by 5th.Place | It starts with me...</td>
  </tr>
</table>`;
}

// Generate Markdown (Chat/WhatsApp format)
// ======================================

export function generateMarkdown(title, description, domain, linkUrl) {
  // Fallbacks if missing
  title = title || 'Untitled Page';
  description = description || 'Check out this link for more details.';
  domain = domain || new URL(linkUrl).hostname.replace('www.', '') || 'unknown.com';

  // Clean up description (convert <br> back to newlines if present)
  description = description.replace(/<br\s*\/?>/gi, '\n');

  // WhatsApp-compatible format:
  // - Single asterisks for bold (*text*)
  // - Underscores for italic (_text_)
  // - Link emoji + full URL (no domain repetition)
  // Using Unicode escape for emoji to avoid encoding issues
  const linkEmoji = '\u{1F517}'; // 🔗 link emoji
  const markdown = `*${title}*\n_${description}_\n${linkEmoji} ${linkUrl}`;

  return markdown;
}

// Generate card as PNG image using canvas
// ======================================

export async function generateCardImage(title, description, imageDataURL, domain, settings) {
  // Fallbacks if missing
  title = title || 'Untitled Page';
  description = description || 'Check out this link for more details.';
  domain = domain || 'unknown.com';

  // Apply user settings
  const titleSize = parseInt(settings.titleFontSize);
  const descSize = parseInt(settings.descFontSize);
  const titleColor = settings.titleColor;
  const descColor = settings.descColor;
  const domainColor = settings.domainColor;
  const borderColor = settings.borderColor;
  const borderWeight = parseInt(settings.borderWeight);
  const borderRadius = parseInt(settings.borderRadius);

  // Card dimensions (matching HTML version)
  const cardWidth = 580;
  const imageWidth = 120;
  const padding = 8;
  const footerHeight = 30;

  // Calculate dynamic heights
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Set canvas size (will adjust height based on content)
  canvas.width = cardWidth;
  let currentY = padding + borderWeight;

  // Load image
  const img = new Image();
  img.src = imageDataURL;
  await new Promise((resolve) => { img.onload = resolve; });

  const imageHeight = (img.height / img.width) * imageWidth;
  const textAreaWidth = cardWidth - imageWidth - (padding * 4) - (borderWeight * 2);

  // Measure text heights
  ctx.font = `600 ${titleSize}px 'Outfit', sans-serif`;
  const titleLines = wrapText(ctx, title, textAreaWidth);
  const titleHeight = titleLines.length * (titleSize * 1.2);

  ctx.font = `400 ${descSize}px 'Open Sans', sans-serif`;
  const descLines = wrapText(ctx, description, textAreaWidth);
  const descHeight = descLines.length * (descSize * 1.4);

  const domainHeight = 15; // 11px font + small buffer
  const spacingBetweenElements = 8; // Space between desc and domain
  const textBlockHeight = titleHeight + 2 + descHeight + spacingBetweenElements + domainHeight;

  // Calculate image position - center vertically relative to text block
  const imageCenterY = currentY + (textBlockHeight / 2) - (imageHeight / 2);

  // Calculate positions (don't draw yet)
  let textX = padding + borderWeight + imageWidth + padding;
  let titleY = currentY;
  let descY = titleY + titleHeight + 2;
  let domainY = descY + descHeight + spacingBetweenElements;

  // Calculate footer position (6px padding-top after domain, like HTML)
  const footerY = domainY + 15 + 6; // domain height + padding

  // NOW calculate final canvas height based on actual footer position
  // Footer text at footerY + 12, text is 11px, need 8px bottom padding + borderWeight
  canvas.height = footerY + 12 + 11 + 8 + borderWeight;

  // Fill background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWeight;
  if (borderRadius > 0) {
    drawRoundedRect(ctx, borderWeight/2, borderWeight/2, cardWidth - borderWeight, canvas.height - borderWeight, borderRadius);
    ctx.stroke();
  } else {
    ctx.strokeRect(borderWeight/2, borderWeight/2, cardWidth - borderWeight, canvas.height - borderWeight);
  }

  // Draw image (centered vertically)
  ctx.drawImage(img, padding + borderWeight, imageCenterY, imageWidth, imageHeight);

  // Draw title
  ctx.fillStyle = titleColor;
  ctx.font = `600 ${titleSize}px 'Outfit', sans-serif`;
  ctx.textBaseline = 'top';
  titleLines.forEach((line, i) => {
    ctx.fillText(line, textX, titleY + (i * titleSize * 1.2));
  });

  // Draw description
  ctx.fillStyle = descColor;
  ctx.font = `400 ${descSize}px 'Open Sans', sans-serif`;
  descLines.forEach((line, i) => {
    ctx.fillText(line, textX, descY + (i * descSize * 1.4));
  });

  // Draw domain
  ctx.fillStyle = domainColor;
  ctx.font = `400 11px 'Open Sans', sans-serif`;
  ctx.fillText(domain.toUpperCase(), textX, domainY);

  // Draw footer border
  ctx.strokeStyle = '#dde';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding + borderWeight, footerY);
  ctx.lineTo(cardWidth - padding - borderWeight, footerY);
  ctx.stroke();

  ctx.fillStyle = '#666';
  ctx.font = '400 11px \'Open Sans\', sans-serif';
  ctx.fillText('Powered by 5th.Place | It starts with me...', padding + borderWeight, footerY + 12);

  // Convert canvas to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

// Helper Functions
// ======================================

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}
