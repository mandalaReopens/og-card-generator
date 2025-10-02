document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const generateBtn = document.getElementById('generateBtn');
  const statusIcon = document.getElementById('statusIcon');
  const preview = document.getElementById('preview');
  const copyRenderedBtn = document.getElementById('copyRenderedBtn');
  const copyHtmlBtn = document.getElementById('copyHtmlBtn');
  const copyButtons = document.getElementById('copyButtons');

  // Canvas constants for consistent thumbnail (scaled for 1/3 column)
  const THUMB_WIDTH = 200;
  const THUMB_HEIGHT = 112;
  const FETCH_TIMEOUT = 10000; // 10 seconds

  // Reset icon on input change
  urlInput.addEventListener('input', () => {
    statusIcon.className = 'icon';
    statusIcon.innerHTML = ''; // Clear HTML content
    preview.innerHTML = '';
    copyButtons.style.display = 'none';
  });

  generateBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      statusIcon.innerHTML = '&times; Error: Enter a URL';
      statusIcon.className = 'icon error';
      return;
    }

    const controller = new AbortController(); // For timeout
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    statusIcon.className = 'icon'; // Clear icon during process
    statusIcon.innerHTML = '⏳ Loading...'; // Unicode spinner + text

    try {
      // Fetch HTML directly in popup (DOMParser available here)
      const response = await fetch(url, { 
        method: 'GET', 
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OG Card Generator)' },
        signal: controller.signal // Abort on timeout
      });
      clearTimeout(timeoutId); // Clear timeout on success

      if (!response.ok) {
        let errorMsg = 'Fetch failed';
        if (response.status === 404) errorMsg = '404: Page not found';
        else if (response.status === 403) errorMsg = '403: Access denied';
        else if (response.status >= 500) errorMsg = `${response.status}: Server error`;
        else if (response.status >= 400) errorMsg = `${response.status}: Invalid response`;
        throw new Error(errorMsg);
      }

      const html = await response.text();

      // Parse with DOMParser (now safe in popup context)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract OG tags with fallbacks
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      const title = ogTitle ? ogTitle.content : doc.querySelector('title')?.textContent?.trim() || '';
      
      const ogDesc = doc.querySelector('meta[property="og:description"]');
      let desc = ogDesc ? ogDesc.content : doc.querySelector('meta[name="description"]')?.content?.trim() || '';
      
      const ogImage = doc.querySelector('meta[property="og:image"]');
      let imageUrl = ogImage ? ogImage.content : '';
      
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');

      // Truncate description for better formatting
      if (desc.length > 150) {
        desc = desc.substring(0, 150) + '...';
      }

      // Image logic: OG first, then capture from page
      statusIcon.innerHTML = '⏳ Fetching image...';
      let embeddedImageUrl = createPlaceholder(); // Scaled placeholder
      
      let finalImageUrl = imageUrl;
      if (!imageUrl) {
        // No OG: Select best image from page DOM (parallel checks)
        const imgElements = Array.from(doc.querySelectorAll('img[src]'));
        let bestImg = null;
        let maxArea = 0;

        const checkPromises = imgElements.map(async (img) => {
          const src = img.src;
          if (src.includes('svg') || src.includes('icon') || src.includes('logo') || src.includes('avatar')) return null;

          try {
            const tempImg = new Image();
            await new Promise((resolve, reject) => {
              tempImg.onload = () => {
                const area = tempImg.naturalWidth * tempImg.naturalHeight;
                const aspect = tempImg.naturalWidth / tempImg.naturalHeight;
                if (tempImg.naturalWidth > 200 && tempImg.naturalHeight > 100 && aspect > 1.2 && aspect < 3 && area > maxArea) {
                  maxArea = area;
                  bestImg = { src: src, naturalWidth: tempImg.naturalWidth, naturalHeight: tempImg.naturalHeight };
                }
                resolve(null);
              };
              tempImg.onerror = reject;
              tempImg.src = src;
            });
          } catch {
            // Skip invalid
          }
        });

        await Promise.all(checkPromises);

        if (bestImg) {
          finalImageUrl = bestImg.src;
        }
      }

      if (finalImageUrl) {
        try {
          const imageResponse = await fetch(finalImageUrl, { 
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OG Card Generator)' }
          });
          if (imageResponse.ok) {
            const blob = await imageResponse.blob();
            embeddedImageUrl = await cropToThumbnail(blob);
          }
        } catch (imgErr) {
          console.error('Image fetch/crop failed:', imgErr);
        }
      }

      // Generate HTML template with embedded image
      const generatedHtml = generateCardHTML(
        title, 
        desc, 
        embeddedImageUrl, 
        domain, 
        url
      );
      
      preview.innerHTML = generatedHtml;
      copyButtons.style.display = 'flex';
      statusIcon.innerHTML = '&check; Card generated'; // Success with text
      statusIcon.className = 'icon success';
    } catch (err) {
      clearTimeout(timeoutId); // Clear timeout on error
      console.error('Error:', err);
      let errorMsg = err.message || 'Unknown error';
      if (err.name === 'AbortError') errorMsg = 'Request timed out';
      statusIcon.innerHTML = `&times; ${errorMsg}`;
      statusIcon.className = 'icon error';
      preview.innerHTML = '';
      copyButtons.style.display = 'none';
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Card';
    }
  });

  // Helper: Crop/scale image to thumbnail via Canvas (fixed center crop)
  async function cropToThumbnail(blob) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_WIDTH;
      canvas.height = THUMB_HEIGHT;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.onload = () => {
        const sourceWidth = img.naturalWidth;
        const sourceHeight = img.naturalHeight;

        // Scale to cover canvas (max of width/height ratios)
        const scale = Math.max(THUMB_WIDTH / sourceWidth, THUMB_HEIGHT / sourceHeight);
        const cropWidth = THUMB_WIDTH / scale;
        const cropHeight = THUMB_HEIGHT / scale;

        // Center crop coordinates in source image
        const cropX = (sourceWidth - cropWidth) / 2;
        const cropY = (sourceHeight - cropHeight) / 2;

        // Draw cropped source to full canvas
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
        
        // Output base64 as JPEG for efficiency
        canvas.toBlob((croppedBlob) => {
          const reader = new FileReader();
          reader.readAsDataURL(croppedBlob);
          reader.onloadend = () => resolve(reader.result);
        }, 'image/jpeg', 0.9);
      };
      img.onerror = () => resolve(createPlaceholder());
      img.src = URL.createObjectURL(blob);
    });
  }

  // Helper: Create placeholder SVG (scaled)
  function createPlaceholder() {
    return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjExMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=`;
  }

  copyRenderedBtn.addEventListener('click', async () => {
    const html = preview.innerHTML;
    const success = await copyRenderedToClipboard(html);
    if (success) {
      copyRenderedBtn.textContent = 'Copied!';
      setTimeout(() => { 
        copyRenderedBtn.textContent = 'Copy Rendered'; 
      }, 2000);
    } else {
      statusIcon.innerHTML = '&times; Copy failed';
      statusIcon.className = 'icon error';
    }
  });

  copyHtmlBtn.addEventListener('click', async () => {
    const html = preview.innerHTML;
    await copyToClipboard(html);
    copyHtmlBtn.textContent = 'Copied!';
    setTimeout(() => { 
      copyHtmlBtn.textContent = 'Copy HTML'; 
    }, 2000);
  });

  async function copyRenderedToClipboard(html) {
    try {
      // Modern Clipboard API for rich HTML (includes base64 images)
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const plainText = extractPlainText(html);
      const plainBlob = new Blob([plainText], { type: 'text/plain' });
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': plainBlob
      });
      await navigator.clipboard.write([clipboardItem]);
      return true;
    } catch (modernErr) {
      console.error('Modern clipboard failed:', modernErr);
      // Fallback to enhanced execCommand with full document rendering
      return await fallbackCopyRendered(html);
    }
  }

  async function fallbackCopyRendered(html) {
    // Create a temporary iframe for full rendering (better for complex HTML like base64 imgs)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    document.body.appendChild(iframe);

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html><html><body>${html}</body></html>`);
      iframeDoc.close();

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Select and copy from iframe
      const body = iframeDoc.body;
      const range = iframeDoc.createRange();
      range.selectNodeContents(body);
      const selection = iframeDoc.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      const success = iframeDoc.execCommand('copy');
      selection.removeAllRanges();

      return success;
    } catch (err) {
      console.error('Fallback copy error:', err);
      return false;
    } finally {
      document.body.removeChild(iframe);
    }
  }

  function extractPlainText(html) {
    // Simple plain text extractor for fallback
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Clipboard fallback:', err);
      // Fallback for older browsers or permissions
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  function generateCardHTML(title, description, imageUrl, domain, linkUrl) {
    // Fallbacks if OG missing
    title = title || 'Untitled Page';
    description = description || 'Check out this link for more details.';
    domain = domain || new URL(linkUrl).hostname.replace('www.', '') || 'unknown.com';

    return `
<table border="0" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden; table-layout: fixed;">
  <tr>
    <td style="width: 33%; vertical-align: middle; padding: 10px;">
      <a href="${linkUrl}" target="_blank" style="display: block;">
        <img src="${imageUrl}" alt="${title}" style="width: 100%; height: auto; display: block; object-fit: cover;">
      </a>
    </td>
    <td style="width: 67%; vertical-align: top; padding: 15px;">
      <a href="${linkUrl}" target="_blank" style="text-decoration: none; color: #000;">
        <h3 style="margin: 0 0 10px 0; font-size: 18px; font-family: 'Outfit', sans-serif; font-weight: 600; line-height: 1.2; color: #225560;">${title}</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px; font-family: 'Open Sans', sans-serif; color: rgba(34, 85, 96, 0.8); line-height: 1.4; word-break: break-word;">${description}</p>
        <p style="margin: 0; font-size: 14px; font-family: 'Open Sans', sans-serif; color: #225560;">${domain}</p>
      </a>
    </td>
  </tr>
</table>`;
  }
});