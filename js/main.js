document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const statusIcon = document.getElementById('statusIcon');
  const preview = document.getElementById('preview');
  const copyEmailBtn = document.getElementById('copyEmailBtn');
  const copyDocumentsBtn = document.getElementById('copyDocumentsBtn');
  const copyChatBtn = document.getElementById('copyChatBtn');
  const copyImageBtn = document.getElementById('copyImageBtn');
  const copyHtmlCodeBtn = document.getElementById('copyHtmlCodeBtn');
  const copyToolbar = document.getElementById('copyToolbar');
  const useCurrentTabBtn = document.getElementById('useCurrentTabBtn');
  const generateNewBtn = document.getElementById('generateNewBtn');
  const debugDiv = document.getElementById('debug');
  const smartSelectToggle = document.getElementById('smartSelectToggle');
  const debugToggle = document.getElementById('debugToggle');
  const generatingSpinner = document.getElementById('generatingSpinner');
  const persistCardToggle = document.getElementById('persistCardToggle');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const useBrandCardsToggle = document.getElementById('useBrandCardsToggle');
  const brandCardsWrapper = document.getElementById('brandCardsWrapper');

  // Debug enabled flag (loaded from storage)
  let debugEnabled = false;

  // Card persistence flag (loaded from storage)
  let persistCardEnabled = true;

  // Use brand cards flag (loaded from storage)
  let useBrandCardsEnabled = false;

  // Store last generated card data for re-rendering with new settings
  let lastCardData = null;

  // Debug logging function
  function debugLog(message) {
    if (!debugEnabled || !debugDiv) return; // Only log if debug is enabled
    const debugContainer = document.getElementById('debugContainer');
    if (debugContainer) debugContainer.style.display = 'block';
    debugDiv.style.display = 'block';
    const timestamp = new Date().toLocaleTimeString();
    debugDiv.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
  }

  function clearDebug() {
    if (!debugDiv) return;
    debugDiv.innerHTML = '';
    const debugContainer = document.getElementById('debugContainer');
    if (!debugEnabled) {
      debugDiv.style.display = 'none';
      if (debugContainer) debugContainer.style.display = 'none';
    }
  }
  const settingsBtn = document.getElementById('settingsBtn');

  // Configuration constants
  const THUMB_WIDTH = 200;
  const THUMB_HEIGHT = 112;
  const FETCH_TIMEOUT = 10000; // 10 seconds
  const MAX_DESCRIPTION_LENGTH = 130;
  const MIN_IMAGE_WIDTH = 400;
  const MIN_IMAGE_HEIGHT = 200;
  const MIN_ASPECT_RATIO = 0.8;
  const MAX_ASPECT_RATIO = 3;
  const IDEAL_ASPECT_RATIO = 1.91; // ~16:9, ideal for card layouts
  const SVG_RASTER_SIZE = 1200; // Standard size for SVG rasterization
  const IMAGE_QUALITY = 0.9;
  const IMAGE_EXCLUDED_KEYWORDS = [
    'icon', 'avatar', 'logo', 'badge', 'button', 'sprite',
    'pixel', 'tracking', 'ad', 'banner', 'widget', 'thumb',
    'nav', 'social', 'comment', 'sidebar', 'footer', 'header',
    'menu', 'spacer', 'dot', 'arrow', 'bullet', 'bg', 'background'
  ];
  const COPY_FEEDBACK_DURATION = 2000; // ms

  // State flag to prevent concurrent generations
  let isGenerating = false;

  // Default settings
  const DEFAULT_SETTINGS = {
    titleFontSize: '18px',
    descFontSize: '12px',
    titleFont: "'Outfit', sans-serif",
    descFont: "'Open Sans', sans-serif",
    titleColor: '#225560',
    descColor: '#225560',
    domainColor: '#225560',
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
    borderWeight: '1px',
    borderRadius: '5px'
  };

  // Current settings (loaded from storage)
  let currentSettings = { ...DEFAULT_SETTINGS };

  // Load settings and preferences from chrome.storage on init
  chrome.storage.sync.get(['cardSettings', 'debugEnabled', 'persistCardEnabled', 'sessionTimeoutMinutes'], (data) => {
    if (data.cardSettings) {
      currentSettings = { ...DEFAULT_SETTINGS, ...data.cardSettings };
    }

    // Load session timeout preference (default: 30 minutes)
    const sessionTimeoutMinutes = data.sessionTimeoutMinutes !== undefined ? data.sessionTimeoutMinutes : 30;
    const sessionTimeoutMs = sessionTimeoutMinutes * 60 * 1000;

    // Load smart select AND brand cards state from session storage with timeout check
    chrome.storage.session.get(['smartSelectEnabled', 'useBrandCardsEnabled', 'lastUsedTimestamp'], (sessionData) => {
      const now = Date.now();
      const lastUsed = sessionData.lastUsedTimestamp || 0;
      const timeSinceLastUse = now - lastUsed;

      // Reset to default (OFF) if: no timestamp OR timeout exceeded OR browser closed (session storage cleared)
      const shouldReset = !sessionData.lastUsedTimestamp || timeSinceLastUse > sessionTimeoutMs;

      if (smartSelectToggle) {
        // Use saved state if within session, otherwise reset to OFF (OG Image)
        smartSelectToggle.checked = shouldReset ? false : (sessionData.smartSelectEnabled || false);
        updateSmartSelectUI();

        // Load brand cards state (also respects session timeout)
        useBrandCardsEnabled = shouldReset ? false : (sessionData.useBrandCardsEnabled || false);
        if (useBrandCardsToggle) {
          useBrandCardsToggle.checked = useBrandCardsEnabled;
        }

        // Initialize brand cards wrapper visibility based on loaded state
        if (brandCardsWrapper) {
          brandCardsWrapper.style.display = smartSelectToggle.checked ? 'block' : 'none';
        }
      }
    });
    // Load debug preference
    if (data.debugEnabled) {
      debugEnabled = true;
      if (debugToggle) debugToggle.checked = true;
    }
    // Load persist card preference (default true)
    if (data.persistCardEnabled !== undefined) {
      persistCardEnabled = data.persistCardEnabled;
    }
    if (persistCardToggle) {
      persistCardToggle.checked = persistCardEnabled;
    }

    // Try to restore card - double test logic:
    // 1. Check if we have a card for the CURRENT tab URL
    // 2. If not, fall back to lastCard
    if (persistCardEnabled) {
      // Get current tab URL first
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTabUrl = tabs[0]?.url;

        chrome.storage.local.get(['cardHistory', 'lastCard'], (localData) => {
          let cardToLoad = null;
          let matchedCurrentUrl = false; // Track if we matched the current URL

          // Check if we have a card for the current URL
          if (currentTabUrl && localData.cardHistory) {
            const matchingCard = localData.cardHistory.find(card => card.url === currentTabUrl);
            if (matchingCard) {
              cardToLoad = matchingCard;
              matchedCurrentUrl = true; // Set to true only when we found a match
            }
          }

          // If no match, show example card instead of unrelated lastCard
          if (!cardToLoad) {
            loadExampleCard();
            return;
          }

          if (cardToLoad) {
            // Restore the selected card
            lastCardData = cardToLoad;

            // Regenerate pre-rendered formats if missing (for backwards compatibility)
            if (!lastCardData.emailHtml) {
              lastCardData.emailHtml = generateEmailHTML(
                lastCardData.title,
                lastCardData.desc,
                lastCardData.embeddedImageUrl,
                lastCardData.domain,
                lastCardData.url
              );
            }
            if (!lastCardData.documentHtml) {
              lastCardData.documentHtml = generateDocumentHTML(
                lastCardData.title,
                lastCardData.desc,
                lastCardData.embeddedImageUrl,
                lastCardData.domain,
                lastCardData.url
              );
            }
            if (!lastCardData.chatMarkdown) {
              lastCardData.chatMarkdown = generateMarkdown(
                lastCardData.title,
                lastCardData.desc,
                lastCardData.domain,
                lastCardData.url
              );
            }
            if (!lastCardData.htmlCode) {
              lastCardData.htmlCode = generateCardHTML(
                lastCardData.title,
                lastCardData.desc,
                'og-card-thumbnail.png',
                lastCardData.domain,
                lastCardData.url
              );
            }

            const restoredHtml = generateCardHTML(
              lastCardData.title,
              lastCardData.desc,
              lastCardData.embeddedImageUrl,
              lastCardData.domain,
              lastCardData.url
            );
            preview.innerHTML = restoredHtml;
            copyToolbar.classList.add('visible');

            // Show freshness indicator ONLY if timestamp exists AND we matched current URL
            if (lastCardData.timestamp && matchedCurrentUrl) {
              showFreshnessIndicator(lastCardData.timestamp);
            }
          } else {
            // Load example card if no history
            loadExampleCard();
          }
        });
      });
    } else {
      // Load example card if persistence disabled
      loadExampleCard();
    }
  });

  // Check if we should clear the preview (set by reset buttons in settings pages)
  chrome.storage.local.get(['shouldClearPreview'], (data) => {
    if (data.shouldClearPreview) {
      // Clear the preview
      preview.innerHTML = '';
      copyToolbar.classList.remove('visible');

      // Load example card instead
      loadExampleCard();

      // Clear the flag
      chrome.storage.local.set({ shouldClearPreview: false });
    }
  });

  // Update icon and text based on toggle state
  function updateSmartSelectUI() {
    const icon = document.getElementById('smartSelectIcon');
    const label = document.getElementById('smartSelectLabel');

    if (smartSelectToggle.checked) {
      // Smart selection ON - show Photo Star icon (green)
      label.textContent = 'Use Smart Image Selection';
      icon.style.stroke = '#179355';
      icon.innerHTML = `
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M15 8h.01" />
        <path d="M11 20h-4a3 3 0 0 1 -3 -3v-10a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v4" />
        <path d="M4 15l4 -4c.928 -.893 2.072 -.893 3 0l3 3" />
        <path d="M14 14l1 -1c.617 -.593 1.328 -.793 2.009 -.598" />
        <path d="M17.8 20.817l-2.172 1.138a.392 .392 0 0 1 -.568 -.41l.415 -2.411l-1.757 -1.707a.389 .389 0 0 1 .217 -.665l2.428 -.352l1.086 -2.193a.392 .392 0 0 1 .702 0l1.086 2.193l2.428 .352a.39 .39 0 0 1 .217 .665l-1.757 1.707l.414 2.41a.39 .39 0 0 1 -.567 .411l-2.172 -1.138z" />
      `;
    } else {
      // Smart selection OFF - show Photo Search icon (blue)
      label.textContent = 'Use OG Image Selection';
      icon.style.stroke = '#4169E1';
      icon.innerHTML = `
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M15 8h.01" />
        <path d="M11 20h-4a3 3 0 0 1 -3 -3v-10a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v4" />
        <path d="M4 15l4 -4c.928 -.893 2.072 -.893 3 0l3 3" />
        <path d="M14 14l1 -1c.617 -.593 1.328 -.793 2.009 -.598" />
        <path d="M16 19h6" />
        <path d="M19 16v6" />
      `;
    }
  }

  // Update UI when smart select toggle changes
  if (smartSelectToggle) {
    smartSelectToggle.addEventListener('change', () => {
      updateSmartSelectUI();
      // Show/hide brand cards checkbox based on smart select state
      if (brandCardsWrapper) {
        brandCardsWrapper.style.display = smartSelectToggle.checked ? 'block' : 'none';
      }
      // Save state and timestamp to session storage
      chrome.storage.session.set({
        smartSelectEnabled: smartSelectToggle.checked,
        useBrandCardsEnabled: useBrandCardsEnabled, // Preserve current brand cards state
        lastUsedTimestamp: Date.now()
      });
    });
  }

  // Update setting when brand cards toggle changes
  if (useBrandCardsToggle) {
    useBrandCardsToggle.addEventListener('change', () => {
      useBrandCardsEnabled = useBrandCardsToggle.checked;
      // Save to session storage (respects session timeout like Smart Select)
      chrome.storage.session.set({
        useBrandCardsEnabled: useBrandCardsEnabled,
        lastUsedTimestamp: Date.now()
      });
      debugLog(`Brand cards ${useBrandCardsEnabled ? 'enabled' : 'disabled'}`);
    });
  }

  // Debug toggle change handler (only updates state, doesn't save - that happens on Save Settings)
  if (debugToggle) {
    debugToggle.addEventListener('change', () => {
      if (!debugToggle.checked && debugEnabled) {
        clearDebug(); // Hide debug panel when disabled
      }
    });
  }

  // Persist card toggle change handler
  if (persistCardToggle) {
    persistCardToggle.addEventListener('change', () => {
      persistCardEnabled = persistCardToggle.checked;
      chrome.storage.sync.set({ persistCardEnabled: persistCardEnabled });

      // If disabled, clear the stored card
      if (!persistCardEnabled) {
        chrome.storage.local.remove('lastCard');
      }
    });
  }

  // Clear history button handler
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      chrome.storage.local.remove('lastCard', () => {
        // Visual feedback
        const originalText = clearHistoryBtn.textContent;
        clearHistoryBtn.textContent = 'History Cleared!';
        clearHistoryBtn.style.background = '#28a745';
        clearHistoryBtn.style.color = 'white';
        setTimeout(() => {
          clearHistoryBtn.textContent = originalText;
          clearHistoryBtn.style.background = '';
          clearHistoryBtn.style.color = '';
        }, 2000);
      });
    });
  }

  // Helper functions for freshness indicator with battery metaphor
  function formatCardDate(timestamp) {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.toLocaleString('en', {month: 'short'}).toUpperCase();
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return {
      date: `${day} ${month}`,
      time: `${hours}:${mins}`
    };
  }

  function getBatteryState(timestamp) {
    const ageMs = Date.now() - timestamp;
    const ageHours = ageMs / (1000 * 60 * 60);
    const ageDays = ageHours / 24;

    // Battery icons from Tabler
    const batteryIcons = {
      full: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" /><path d="M7 10l0 4" /><path d="M10 10l0 4" /><path d="M13 10l0 4" /><path d="M16 10l0 4" />`,
      battery1: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" /><path d="M7 10l0 4" /><path d="M10 10l0 4" /><path d="M13 10l0 4" />`,
      battery2: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" /><path d="M7 10l0 4" /><path d="M10 10l0 4" />`,
      battery3: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" /><path d="M7 10l0 4" />`,
      battery4: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" />`
    };

    // Determine state based on age
    if (ageHours < 1) {
      return {
        icon: batteryIcons.full,
        backgroundColor: '#7ec11f', // Yellow Green (bright)
        iconColor: '#ffffff',
        tooltip: 'Card Status: Fresh',
        level: 'full'
      };
    } else if (ageHours < 6) {
      return {
        icon: batteryIcons.battery1,
        backgroundColor: '#026c0f', // Office Green (darker)
        iconColor: '#ffffff',
        tooltip: 'Card Status: Crisp',
        level: 'high'
      };
    } else if (ageHours < 24) {
      return {
        icon: batteryIcons.battery2,
        backgroundColor: '#f4e932', // Aureolin
        iconColor: '#1d1d1f', // Dark icon for contrast on yellow
        tooltip: 'Card Status: Fading',
        level: 'medium'
      };
    } else if (ageDays < 7) {
      return {
        icon: batteryIcons.battery3,
        backgroundColor: '#f5a729', // Orange Web
        iconColor: '#ffffff',
        tooltip: 'Card Status: Tired',
        level: 'low'
      };
    } else {
      return {
        icon: batteryIcons.battery4,
        backgroundColor: '#ea3437', // Imperial Red
        iconColor: '#ffffff',
        tooltip: 'Card Status: Stale',
        level: 'empty'
      };
    }
  }

  function showFreshnessIndicator(timestamp) {
    const indicator = document.getElementById('freshnessIndicator');
    const dateSpan = document.getElementById('cardDate');
    const timeSpan = document.getElementById('cardTime');
    const batteryIcon = document.getElementById('batteryIcon');

    if (indicator && dateSpan && timeSpan && batteryIcon && timestamp) {
      const {date, time} = formatCardDate(timestamp);
      const batteryState = getBatteryState(timestamp);

      dateSpan.textContent = date;
      timeSpan.textContent = time;
      batteryIcon.innerHTML = batteryState.icon;
      batteryIcon.style.background = batteryState.backgroundColor;
      batteryIcon.style.stroke = batteryState.iconColor;

      // Set tooltip on wrapper, not SVG (for better browser compatibility)
      const batteryWrapper = batteryIcon.parentElement;
      if (batteryWrapper) {
        batteryWrapper.setAttribute('data-tooltip', batteryState.tooltip);
      }

      indicator.style.display = 'flex';
    }
  }

  function hideFreshnessIndicator() {
    const indicator = document.getElementById('freshnessIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  // Load example card on startup
  function loadExampleCard() {
    const title = 'Example Card';
    const desc = 'This is an example of what your OG card will look like.\nTry it with any URL...';
    const imageUrl = 'images/og-card-default-thumb.png';
    const domain = 'examplecard.com';
    const url = 'https://5th.place/og-card';

    const exampleHtml = generateCardHTML(title, desc, imageUrl, domain, url);

    // Store example card data with all pre-rendered formats
    lastCardData = {
      title: title,
      desc: desc,
      embeddedImageUrl: imageUrl,
      domain: domain,
      url: url,
      timestamp: Date.now(),
      // Pre-rendered formats
      emailHtml: generateEmailHTML(title, desc, imageUrl, domain, url),
      documentHtml: generateDocumentHTML(title, desc, imageUrl, domain, url),
      chatMarkdown: generateMarkdown(title, desc, domain, url),
      htmlCode: generateCardHTML(title, desc, 'og-card-thumbnail.png', domain, url)
    };

    preview.innerHTML = exampleHtml;
    copyToolbar.classList.add('visible');
  }


  // Settings button - navigate to formatting page (first settings tab)
  settingsBtn.addEventListener('click', () => {
    window.location.href = 'formatting.html';
  });

  // Use Current Tab button handler
  useCurrentTabBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        const currentUrl = tabs[0].url;
        if (currentUrl.startsWith('http://') || currentUrl.startsWith('https://')) {
          urlInput.value = currentUrl;
          updateClearButton();
          generateCard();
        } else {
          statusIcon.innerHTML = '&times; Invalid URL';
          statusIcon.className = 'icon error';
        }
      }
    });
  });

  // Helper: Normalize URL input
  function normalizeURL(input) {
    let url = input.trim();

    // If already has protocol, return as-is
    if (url.match(/^https?:\/\//i)) {
      return url;
    }

    // Add https:// prefix for bare domains
    return 'https://' + url;
  }

  // Show/hide clear button based on input content
  function updateClearButton() {
    if (urlInput.value.trim()) {
      clearInputBtn.classList.add('visible');
    } else {
      clearInputBtn.classList.remove('visible');
    }
  }

  // Reset icon on input change
  urlInput.addEventListener('input', () => {
    statusIcon.className = 'icon';
    statusIcon.innerHTML = ''; // Clear HTML content
    updateClearButton();
  });

  // Clear input button
  clearInputBtn.addEventListener('click', () => {
    urlInput.value = '';
    urlInput.focus();
    updateClearButton();
    statusIcon.className = 'icon';
    statusIcon.innerHTML = '';
    // Keep the preview and card data visible - just clear input for easy new URL entry
  });

  // Allow Enter key to trigger card generation
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      generateCard();
    }
  });

  // Generate from new URL button
  generateNewBtn.addEventListener('click', () => {
    const currentValue = urlInput.value.trim();

    // If empty, focus the input
    if (!currentValue) {
      urlInput.focus();
      return;
    }

    // Otherwise generate the card
    generateCard();
  });

  // Helper: Decode data URL to blob for processing
  async function dataURLToBlob(dataURL) {
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
      debugLog(`[ERROR] Failed to decode data URL: ${e.message}`);
      return null;
    }
  }

  // Helper: Convert relative URLs to absolute URLs
  function toAbsoluteURL(imageSrc, pageUrl) {
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
      debugLog(`[ERROR] Failed to convert relative URL: ${imageSrc}`);
      return null;
    }
  }

  // Helper: Get image dimensions from blob
  async function getImageDimensionsFromBlob(blob) {
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

  // Helper: Load image to get dimensions
  async function getImageDimensions(src) {
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

  // Helper: Check if URL is an SVG
  function isSvgUrl(url) {
    return url.toLowerCase().endsWith('.svg') || url.toLowerCase().includes('.svg?');
  }

  // Helper: Rasterize SVG to PNG blob
  async function rasterizeSvg(svgUrl) {
    try {
      debugLog(`[INFO] Attempting to rasterize SVG: ${svgUrl.split('/').pop()}`);

      const response = await fetch(svgUrl);
      if (!response.ok) {
        debugLog(`[FAIL] Could not fetch SVG (status ${response.status})`);
        return null;
      }

      const svgText = await response.text();
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      return new Promise((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(url);
          debugLog(`[FAIL] SVG rasterization timeout`);
          resolve(null);
        }, 5000);

        img.onload = () => {
          clearTimeout(timeout);

          // Create canvas and draw SVG at standard high resolution
          const canvas = document.createElement('canvas');

          // Use intrinsic dimensions if available and larger than standard, otherwise use standard size
          const naturalWidth = img.naturalWidth || img.width || SVG_RASTER_SIZE;
          const naturalHeight = img.naturalHeight || img.height || SVG_RASTER_SIZE;

          canvas.width = Math.max(naturalWidth, SVG_RASTER_SIZE);
          canvas.height = Math.max(naturalHeight, SVG_RASTER_SIZE);

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          URL.revokeObjectURL(url);

          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              debugLog(`[OK] SVG rasterized to PNG (${canvas.width}x${canvas.height})`);
              resolve(pngBlob);
            } else {
              debugLog(`[FAIL] Could not convert SVG to PNG blob`);
              resolve(null);
            }
          }, 'image/png');
        };

        img.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          debugLog(`[FAIL] Could not load SVG image`);
          resolve(null);
        };

        img.src = url;
      });
    } catch (err) {
      debugLog(`[ERROR] SVG rasterization failed: ${err.message}`);
      return null;
    }
  }

  // Helper: Convert blob to data URL
  async function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Helper: Generate branded domain card as fallback
  async function generateDomainCard(domain) {
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

  // Helper: Sample edge pixels from image to detect dominant background color
  function sampleEdgePixels(img) {
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

  // Helper: Calculate relative luminance (perceived brightness)
  function calculateLuminance(r, g, b) {
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

  // Helper: Generate branded card with logo (for known brands)
  async function generateBrandedCard(logoDataUrl, domain, brandName) {
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

  // Helper: Validate an image URL (dimensions, aspect ratio, etc.)
  async function validateImage(src) {
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

  // Helper: Score an image candidate based on multiple factors
  function scoreImage(candidate, allCandidates = []) {
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

  // Helper: Select image by domain name matching (returns array of candidates)
  async function selectImageByDomainMatch(doc, url, minWidth = MIN_IMAGE_WIDTH, minHeight = MIN_IMAGE_HEIGHT) {
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

  // Helper: Select best fallback image using intelligent filtering (returns array of candidates)
  async function selectBestFallbackImage(doc, baseUrl, minWidth = MIN_IMAGE_WIDTH, minHeight = MIN_IMAGE_HEIGHT) {
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

  // Re-render existing card with current settings (no fetch)
  function refreshCardDisplay() {
    if (!lastCardData) return false;

    const generatedHtml = generateCardHTML(
      lastCardData.title,
      lastCardData.desc,
      lastCardData.embeddedImageUrl,
      lastCardData.domain,
      lastCardData.url
    );

    // Re-generate all pre-rendered formats with updated settings
    lastCardData.emailHtml = generateEmailHTML(
      lastCardData.title,
      lastCardData.desc,
      lastCardData.embeddedImageUrl,
      lastCardData.domain,
      lastCardData.url
    );
    lastCardData.documentHtml = generateDocumentHTML(
      lastCardData.title,
      lastCardData.desc,
      lastCardData.embeddedImageUrl,
      lastCardData.domain,
      lastCardData.url
    );
    lastCardData.chatMarkdown = generateMarkdown(
      lastCardData.title,
      lastCardData.desc,
      lastCardData.domain,
      lastCardData.url
    );
    lastCardData.htmlCode = generateCardHTML(
      lastCardData.title,
      lastCardData.desc,
      'og-card-thumbnail.png',
      lastCardData.domain,
      lastCardData.url
    );

    preview.innerHTML = generatedHtml;
    copyToolbar.classList.add('visible');
    return true;
  }

  async function generateCard() {
    // Prevent concurrent generations
    if (isGenerating) {
      return;
    }

    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      statusIcon.innerHTML = '&times; Error: Enter a URL';
      statusIcon.className = 'icon error';
      return;
    }

    // Normalize URL (add https:// if missing)
    const url = normalizeURL(rawUrl);

    const controller = new AbortController(); // For timeout
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    isGenerating = true;
    generateNewBtn.disabled = true;
    statusIcon.className = 'icon'; // Clear icon during process
    statusIcon.innerHTML = ''; // Clear status (spinner shows loading state)
    clearDebug(); // Clear previous debug output
    if (generatingSpinner) generatingSpinner.style.display = 'inline-block'; // Show spinner

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
      let title = ogTitle ? ogTitle.content : doc.querySelector('title')?.textContent?.trim() || '';

      const ogDesc = doc.querySelector('meta[property="og:description"]');
      let desc = ogDesc ? ogDesc.content : doc.querySelector('meta[name="description"]')?.content?.trim() || '';
      
      const ogImage = doc.querySelector('meta[property="og:image"]');
      let imageUrl = ogImage ? ogImage.content : '';
      
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');

      // Truncate description for better formatting
      if (desc.length > MAX_DESCRIPTION_LENGTH) {
        desc = desc.substring(0, MAX_DESCRIPTION_LENGTH) + '...';
      }

      // Image logic: Smart select or OG first
      statusIcon.innerHTML = '⏳ Fetching image...';
      let embeddedImageUrl = createPlaceholder(); // Scaled placeholder

      const useSmartSelect = smartSelectToggle && smartSelectToggle.checked;
      let finalImageUrl = null;
      let isSvg = false;
      let generatedCardBlob = null; // For generated domain cards and favicon brand cards

      // Check for developer override FIRST (highest priority, works regardless of toggle state)
      const { forceGeneratedCard } = await chrome.storage.sync.get(['forceGeneratedCard']);

      if (forceGeneratedCard) {
        debugLog(`[DEV] Force generated card enabled - skipping image search`);
        const urlObj = new URL(url);
        generatedCardBlob = await generateDomainCard(urlObj.hostname);

        if (generatedCardBlob) {
          embeddedImageUrl = await cropToThumbnail(generatedCardBlob);
          debugLog(`[OK] Using generated domain card`);
        }
      } else if (useSmartSelect) {
        debugLog(`[INFO] Smart selection enabled`);

        // Check if user wants to use brand cards INSTEAD of page scanning
        if (useBrandCardsEnabled) {
          debugLog(`[INFO] Brand cards enabled - skipping page scan, using favicon approach`);
          const urlObj = new URL(url);

          // Generate favicon brand card (returns blob and borderColor)
          const brandCardResult = await generateFaviconBrandCard(urlObj.hostname, url);

          if (brandCardResult) {
            const { blob: borderlessBlob, borderColor } = brandCardResult;

            // Fork border process into two independent paths:

            // Path A: Add border to full-size (1200x630) for PNG export
            generatedCardBlob = await addBorderToBlob(borderlessBlob, 1200, 630, borderColor, 18, 4);

            // Path B: Crop to thumbnail (200x112) and add proportional border
            embeddedImageUrl = await cropToThumbnail(borderlessBlob, borderColor);

            debugLog(`[OK] Using favicon brand card image (borders applied independently)`);
          } else {
            debugLog(`[FAIL] Favicon brand card generation failed, falling back to domain card`);
            generatedCardBlob = await generateDomainCard(urlObj.hostname);

            if (generatedCardBlob) {
              embeddedImageUrl = await cropToThumbnail(generatedCardBlob);
              debugLog(`[OK] Using generated domain card as fallback`);
            }
          }
        } else {
          // Brand cards disabled - use normal page scanning flow
          debugLog(`[INFO] Brand cards disabled - evaluating all image options via page scan`);
          // Progressive relaxation: 5-pass system with context-aware filtering
          const qualityTiers = [
            { minWidth: 400, minHeight: 200, name: 'Pass 1: Ideal Content (400x200, strict)', strict: true },
            { minWidth: 400, minHeight: 200, name: 'Pass 2: Brand Images (400x200, lenient)', strict: false },
            { minWidth: 200, minHeight: 80, name: 'Pass 3: Minimal Sites (200x80)', strict: false },
            { minWidth: 100, minHeight: 50, name: 'Pass 4: Last Resort (100x50)', strict: false },
            { minWidth: 0, minHeight: 0, name: 'Pass 5: Any Size', strict: false }
          ];

          let allCandidates = [];

          for (const tier of qualityTiers) {
            debugLog(`[INFO] Trying ${tier.name} threshold...`);

            // Get domain-matched images (array)
            const domainMatches = await selectImageByDomainMatch(doc, url, tier.minWidth, tier.minHeight);
            allCandidates = allCandidates.concat(domainMatches);

            // Get page scan images (array)
            const pageMatches = await selectBestFallbackImage(doc, url, tier.minWidth, tier.minHeight);
            allCandidates = allCandidates.concat(pageMatches);

            // If we found candidates at this tier, stop trying lower tiers
            if (allCandidates.length > 0) {
              debugLog(`[INFO] Found ${allCandidates.length} candidates at ${tier.name}`);
              break;
            }
          }

          // Validate and add OG image if present (as fallback)
          if (imageUrl) {
            debugLog(`[INFO] Evaluating OG:image: ${imageUrl.split('/').pop()}`);
            const validated = await validateImage(imageUrl);
            if (validated) {
              const format = isSvgUrl(imageUrl) ? 'svg' : (imageUrl.toLowerCase().endsWith('.png') ? 'png' : 'jpg');
              allCandidates.push({
                ...validated,
                format,
                source: 'OG',
                semanticLocation: null
              });
              debugLog(`  + OG image is valid candidate`);
            } else {
              debugLog(`  - OG image failed validation`);
            }
          }

          // Score all candidates
          if (allCandidates.length > 0) {
            debugLog(`[INFO] Scoring ${allCandidates.length} total candidates:`);

            const scoredCandidates = allCandidates.map(candidate => {
              const score = scoreImage(candidate, allCandidates);
              return { ...candidate, score };
            });

            // Sort by score (highest first)
            scoredCandidates.sort((a, b) => b.score - a.score);

            // Pick the winner
            const best = scoredCandidates[0];
            finalImageUrl = best.src;
            isSvg = isSvgUrl(finalImageUrl);
            debugLog(`[OK] WINNER: ${finalImageUrl.split('/').pop()} (${best.source}, score: ${best.score.toFixed(0)})`);
          } else {
            // No images found after scanning - fallback to domain card
            debugLog(`[INFO] No valid images found after page scan - generating domain card fallback`);
            const urlObj = new URL(url);
            generatedCardBlob = await generateDomainCard(urlObj.hostname);

            if (generatedCardBlob) {
              embeddedImageUrl = await cropToThumbnail(generatedCardBlob);
              debugLog(`[OK] Using generated domain card as fallback`);
            } else {
              debugLog(`[FAIL] Domain card generation failed, using placeholder`);
            }
          }
        }
      } else {
        // Smart select disabled: use OG image directly without validation
        if (imageUrl) {
          finalImageUrl = imageUrl;
          isSvg = isSvgUrl(finalImageUrl);
          debugLog(`[OK] Using OG:image from meta tag: ${imageUrl.split('/').pop()}`);
        } else {
          debugLog(`[INFO] No OG:image found`);
        }
      }

      // Fetch and process the final image
      if (finalImageUrl) {
        try {
          if (isSvg) {
            // Rasterize SVG to PNG blob
            const pngBlob = await rasterizeSvg(finalImageUrl);
            if (pngBlob) {
              embeddedImageUrl = await cropToThumbnail(pngBlob);
            } else {
              debugLog(`[FAIL] Could not rasterize SVG, using placeholder`);
            }
          } else {
            // Normal image processing
            const imageResponse = await fetch(finalImageUrl, {
              method: 'GET',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OG Card Generator)' }
            });
            if (imageResponse.ok) {
              const blob = await imageResponse.blob();
              embeddedImageUrl = await cropToThumbnail(blob);
            }
          }
        } catch (imgErr) {
          console.error('Image fetch/crop failed:', imgErr);
          debugLog(`[ERROR] Image processing failed: ${imgErr.message}`);
        }
      }

      // Convert generatedCardBlob to data URL for storage (if exists)
      let fullSizeBlobDataUrl = null;
      if (generatedCardBlob) {
        fullSizeBlobDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(generatedCardBlob);
        });
      }

      // Store card data with all pre-rendered formats
      lastCardData = {
        title: title,
        desc: desc,
        embeddedImageUrl: embeddedImageUrl,
        domain: domain,
        url: url,
        timestamp: Date.now(), // Add timestamp for cache indicator
        // Pre-rendered formats (generated once, used by copy buttons)
        emailHtml: generateEmailHTML(title, desc, embeddedImageUrl, domain, url),
        documentHtml: generateDocumentHTML(title, desc, embeddedImageUrl, domain, url),
        chatMarkdown: generateMarkdown(title, desc, domain, url),
        htmlCode: generateCardHTML(title, desc, 'og-card-thumbnail.png', domain, url),
        // Full-size blob for PNG export (only for generated cards: favicon brand, domain)
        fullSizeBlob: fullSizeBlobDataUrl
      };

      // Save to storage for persistence across popup opens (if enabled)
      if (persistCardEnabled) {
        chrome.storage.local.set({ lastCard: lastCardData });
      }

      // Add to card history for quick access on revisit
      chrome.storage.sync.get(['historyLength'], (histSettings) => {
        const maxSize = histSettings.historyLength || 5; // Default: 5 cards

        chrome.storage.local.get(['cardHistory'], (histData) => {
          let history = histData.cardHistory || [];

          // Remove if URL already exists (update, not duplicate)
          history = history.filter(card => card.url !== url);

          // Add new card to end
          history.push(lastCardData);

          // Evict oldest if over limit (FIFO)
          if (history.length > maxSize) {
            history = history.slice(-maxSize); // Keep last N
          }

          chrome.storage.local.set({ cardHistory: history });
        });
      });

      // Generate HTML template with embedded image
      const generatedHtml = generateCardHTML(
        title,
        desc,
        embeddedImageUrl,
        domain,
        url
      );

      preview.innerHTML = generatedHtml;
      copyToolbar.classList.add('visible');
      hideFreshnessIndicator(); // Hide freshness indicator since this is a fresh card
      statusIcon.innerHTML = '&check; Card generated'; // Success with text
      statusIcon.className = 'icon success';
    } catch (err) {
      clearTimeout(timeoutId); // Clear timeout on error
      console.error('Error:', err);
      let errorMsg = 'Unknown error';

      // Categorize errors for better user feedback
      if (err.name === 'AbortError') {
        errorMsg = 'Request timed out';
      } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        errorMsg = 'Network error - check connection';
      } else if (err.message.includes('CORS')) {
        errorMsg = 'Access blocked by CORS policy';
      } else if (err.message.includes('404')) {
        errorMsg = '404: Page not found';
      } else if (err.message.includes('403')) {
        errorMsg = '403: Access denied';
      } else if (err.message.includes('500') || err.message.includes('Server error')) {
        errorMsg = 'Server error - try again later';
      } else if (err.message) {
        errorMsg = err.message;
      }

      statusIcon.innerHTML = `&times; ${errorMsg}`;
      statusIcon.className = 'icon error';
      preview.innerHTML = '';
      copyToolbar.classList.remove('visible');
    } finally {
      isGenerating = false;
      generateNewBtn.disabled = false;
      if (generatingSpinner) generatingSpinner.style.display = 'none'; // Hide spinner
    }
  }

  // Helper: Crop/scale image to thumbnail via Canvas (fixed center crop)
  async function cropToThumbnail(blob, borderColor = null) {
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

  // Helper: Create placeholder SVG (scaled) with 5th.Place branding
  function createPlaceholder() {
    return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjExMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjExMiIgZmlsbD0iI2Y1ZjVmNyIvPgogIDx0ZXh0IHg9IjEwMCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJPcGVuIFNhbnMsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPjV0aC5QbGFjZTwvdGV4dD4KICA8dGV4dCB4PSIxMDAiIHk9IjY4IiBmb250LWZhbWlseT0iT3BlbiBTYW5zLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjYmJiIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JdCBzdGFydHMgd2l0aCBtZS4uLjwvdGV4dD4KPC9zdmc+Cg==`;
  }

  copyEmailBtn.addEventListener('click', async () => {
    if (!lastCardData) return;

    // Use pre-rendered email HTML
    const success = await copyRenderedToClipboard(lastCardData.emailHtml);
    const originalBg = copyEmailBtn.style.background;
    if (success) {
      copyEmailBtn.style.background = '#28a745';
      setTimeout(() => {
        copyEmailBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    } else {
      copyEmailBtn.style.background = '#dc3545';
      setTimeout(() => {
        copyEmailBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    }
  });

  copyDocumentsBtn.addEventListener('click', async () => {
    if (!lastCardData) return;

    const originalBg = copyDocumentsBtn.style.background;
    try {
      // Use pre-rendered document HTML (div-based, no tables)
      // Convert base64 image to blob
      const imageBlob = await dataURLToBlob(lastCardData.embeddedImageUrl);

      // Copy all three formats using modern Clipboard API
      const clipboardItems = [];

      if (imageBlob) {
        clipboardItems.push(new ClipboardItem({
          'text/plain': new Blob([lastCardData.htmlCode], { type: 'text/plain' }),
          'text/html': new Blob([lastCardData.documentHtml], { type: 'text/html' }),
          'image/png': imageBlob
        }));
      } else {
        // Fallback if image conversion fails
        clipboardItems.push(new ClipboardItem({
          'text/plain': new Blob([lastCardData.htmlCode], { type: 'text/plain' }),
          'text/html': new Blob([lastCardData.documentHtml], { type: 'text/html' })
        }));
      }

      await navigator.clipboard.write(clipboardItems);

      copyDocumentsBtn.style.background = '#28a745';
      setTimeout(() => {
        copyDocumentsBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    } catch (err) {
      console.error('Multi-format copy failed:', err);
      copyDocumentsBtn.style.background = '#dc3545';
      setTimeout(() => {
        copyDocumentsBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    }
  });

  copyChatBtn.addEventListener('click', async () => {
    if (!lastCardData) return;

    const originalBg = copyChatBtn.style.background;
    try {
      // Use pre-rendered WhatsApp-compatible markdown
      await copyToClipboard(lastCardData.chatMarkdown);
      copyChatBtn.style.background = '#28a745';
      setTimeout(() => {
        copyChatBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    } catch {
      copyChatBtn.style.background = '#dc3545';
      setTimeout(() => {
        copyChatBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    }
  });

  copyImageBtn.addEventListener('click', async () => {
    if (!lastCardData) return;

    const originalBg = copyImageBtn.style.background;
    try {
      let imageBlob;

      // Use cached full-size blob if available (favicon brand cards, domain cards)
      if (lastCardData.fullSizeBlob) {
        debugLog('[PNG Export] Using cached full-size blob');
        // Convert data URL back to blob
        const response = await fetch(lastCardData.fullSizeBlob);
        imageBlob = await response.blob();
      } else {
        // Generate card as PNG image (text overlay card for regular web images)
        debugLog('[PNG Export] Generating card with text overlay');
        imageBlob = await generateCardImage(
          lastCardData.title,
          lastCardData.desc,
          lastCardData.embeddedImageUrl,
          lastCardData.domain
        );
      }

      if (!imageBlob) {
        throw new Error('Failed to generate image');
      }

      // Copy PNG blob to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': imageBlob
        })
      ]);

      copyImageBtn.style.background = '#28a745';
      setTimeout(() => {
        copyImageBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    } catch (err) {
      console.error('Image copy failed:', err);
      copyImageBtn.style.background = '#dc3545';
      setTimeout(() => {
        copyImageBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    }
  });

  copyHtmlCodeBtn.addEventListener('click', async () => {
    if (!lastCardData) return;

    const originalBg = copyHtmlCodeBtn.style.background;
    try {
      // Use pre-rendered HTML code (clean, with simple image reference)
      await copyToClipboard(lastCardData.htmlCode);

      copyHtmlCodeBtn.style.background = '#28a745';
      setTimeout(() => {
        copyHtmlCodeBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    } catch (err) {
      console.error('HTML code copy failed:', err);
      copyHtmlCodeBtn.style.background = '#dc3545';
      setTimeout(() => {
        copyHtmlCodeBtn.style.background = originalBg;
      }, COPY_FEEDBACK_DURATION);
    }
  });

  // Debug copy functionality
  const copyDebugBtn = document.getElementById('copyDebugBtn');

  // Copy debug output via button
  if (copyDebugBtn) {
    copyDebugBtn.addEventListener('click', async () => {
      const debugText = debugDiv.innerText || '';
      const originalBg = copyDebugBtn.style.background;
      try {
        await copyToClipboard(debugText);
        copyDebugBtn.style.background = '#28a745';
        setTimeout(() => {
          copyDebugBtn.style.background = '';
        }, COPY_FEEDBACK_DURATION);
      } catch {
        copyDebugBtn.style.background = '#dc3545';
        setTimeout(() => {
          copyDebugBtn.style.background = '';
        }, COPY_FEEDBACK_DURATION);
      }
    });
  }

  // Copy debug output by clicking inside debug div
  if (debugDiv) {
    debugDiv.addEventListener('click', async () => {
      const debugText = debugDiv.innerText || '';
      if (!debugText) return; // Don't copy if empty

      // Visual feedback
      const originalBg = debugDiv.style.background;
      try {
        await copyToClipboard(debugText);
        debugDiv.style.background = '#d4edda'; // Light green
        setTimeout(() => {
          debugDiv.style.background = originalBg;
        }, 500);
      } catch {
        debugDiv.style.background = '#f8d7da'; // Light red
        setTimeout(() => {
          debugDiv.style.background = originalBg;
        }, 500);
      }
    });
  }

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

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Helper: Convert hex color to RGB object
  function hexToRGB(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return { r, g, b };
  }

  // Helper: Calculate relative luminance of a hex color
  function getLuminance(hexColor) {
    // Extract RGB components from hex color
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Calculate relative luminance (perceived brightness) - WCAG formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance;
  }

  // Helper: Calculate contrast ratio between two colors
  function calculateContrast(color1, color2) {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);

    // WCAG contrast ratio formula
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Helper: Get border color based on background and logo colors
  function getBorderColor(bgColor, logoColor) {
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

  // Helper: Add border to full-size card (1200x630) with mat effect
  function addBorderToFullSizeCard(ctx, width, height, borderColor) {
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

  // Helper: Add border to thumbnail (200x112) with mat effect
  function addBorderToThumbnail(ctx, width, height, borderColor) {
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

  // Helper: Add border to a blob (used for full-size favicon brand cards)
  async function addBorderToBlob(blob, width, height, borderColor, inset, borderWidth) {
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

  // Fetch favicon using Google's favicon API
  async function fetchFavicon(domain) {
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
  async function analyzeLogoColors(faviconDataUrl) {
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
  async function generateFaviconBrandCard(domain, linkUrl) {
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

  // Generate card HTML for preview (uses CSS classes, rendered with styles.css)
  function generateCardHTML(title, description, imageUrl, domain, linkUrl) {
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
    const titleSize = currentSettings.titleFontSize;
    const descSize = currentSettings.descFontSize;
    const titleFont = currentSettings.titleFont;
    const descFont = currentSettings.descFont;
    const titleColor = currentSettings.titleColor;
    const descColor = currentSettings.descColor;
    const domainColor = currentSettings.domainColor;
    const borderColor = currentSettings.borderColor;
    const borderStyle = currentSettings.borderStyle;
    const borderWeight = currentSettings.borderWeight;
    const borderRadius = currentSettings.borderRadius;

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
  function generateEmailHTML(title, description, imageUrl, domain, linkUrl) {
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
    const titleSize = currentSettings.titleFontSize;
    const descSize = currentSettings.descFontSize;
    const titleFont = currentSettings.titleFont;
    const descFont = currentSettings.descFont;
    const titleColor = currentSettings.titleColor;
    const descColor = currentSettings.descColor;
    const domainColor = currentSettings.domainColor;
    const borderColor = currentSettings.borderColor;
    const borderStyle = currentSettings.borderStyle;
    const borderWeight = currentSettings.borderWeight;
    const borderRadius = currentSettings.borderRadius;

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
  function generateDocumentHTML(title, description, imageUrl, domain, linkUrl) {
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
    const titleSize = currentSettings.titleFontSize;
    const descSize = currentSettings.descFontSize;
    const titleFont = currentSettings.titleFont;
    const descFont = currentSettings.descFont;
    const titleColor = currentSettings.titleColor;
    const descColor = currentSettings.descColor;
    const domainColor = currentSettings.domainColor;
    const borderColor = currentSettings.borderColor;
    const borderStyle = currentSettings.borderStyle;
    const borderWeight = currentSettings.borderWeight;
    const borderRadius = currentSettings.borderRadius;

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

  function generateMarkdown(title, description, domain, linkUrl) {
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
  async function generateCardImage(title, description, imageDataURL, domain) {
    // Fallbacks if missing
    title = title || 'Untitled Page';
    description = description || 'Check out this link for more details.';
    domain = domain || 'unknown.com';

    // Apply user settings
    const titleSize = parseInt(currentSettings.titleFontSize);
    const descSize = parseInt(currentSettings.descFontSize);
    const titleColor = currentSettings.titleColor;
    const descColor = currentSettings.descColor;
    const domainColor = currentSettings.domainColor;
    const borderColor = currentSettings.borderColor;
    const borderWeight = parseInt(currentSettings.borderWeight);
    const borderRadius = parseInt(currentSettings.borderRadius);

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

  // Helper: Draw rounded rectangle
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

  // Helper: Wrap text to fit width
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
});