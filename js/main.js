// Import utility functions
import {
  normalizeURL,
  toAbsoluteURL,
  dataURLToBlob,
  blobToDataURL,
  getImageDimensionsFromBlob,
  getImageDimensions,
  isSvgUrl,
  rasterizeSvg,
  hexToRGB,
  getLuminance,
  calculateContrast,
  escapeHTML,
  extractPlainText
} from './utils.js';

// Import border rendering functions
import {
  getBorderColor,
  addBorderToFullSizeCard,
  addBorderToThumbnail,
  addBorderToBlob
} from './border-renderer.js';

// Import image scanner functions
import {
  setDebugLogger as setImageScannerDebugLogger,
  validateImage,
  scoreImage,
  selectImageByDomainMatch,
  selectBestFallbackImage
} from './image-scanner.js';

// Import brand card generator functions
import {
  setDebugLogger as setBrandCardDebugLogger,
  sampleEdgePixels,
  calculateLuminance,
  generateBrandedCard,
  fetchFavicon,
  analyzeLogoColors,
  generateFaviconBrandCard
} from './brand-card-generator.js';

// Import card generator functions
import {
  setDebugLogger as setCardGeneratorDebugLogger,
  generateDomainCard,
  cropToThumbnail,
  createPlaceholder
} from './card-generator.js';

// Import HTML generator functions
import {
  generateCardHTML,
  generateEmailHTML,
  generateDocumentHTML,
  generateMarkdown,
  generateCardImage
} from './html-generators.js';

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

  // Initialize debugLog for image-scanner, brand-card-generator, and card-generator modules
  setImageScannerDebugLogger(debugLog);
  setBrandCardDebugLogger(debugLog);
  setCardGeneratorDebugLogger(debugLog);

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
  const FETCH_TIMEOUT = 10000; // 10 seconds
  const MAX_DESCRIPTION_LENGTH = 130;
  const MIN_ASPECT_RATIO = 0.8;
  const SVG_RASTER_SIZE = 1200; // Standard size for SVG rasterization
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
                lastCardData.url,
                currentSettings
              );
            }
            if (!lastCardData.documentHtml) {
              lastCardData.documentHtml = generateDocumentHTML(
                lastCardData.title,
                lastCardData.desc,
                lastCardData.embeddedImageUrl,
                lastCardData.domain,
                lastCardData.url,
                currentSettings
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
                lastCardData.url,
                currentSettings
              );
            }

            const restoredHtml = generateCardHTML(
              lastCardData.title,
              lastCardData.desc,
              lastCardData.embeddedImageUrl,
              lastCardData.domain,
              lastCardData.url,
              currentSettings
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

    const exampleHtml = generateCardHTML(title, desc, imageUrl, domain, url, currentSettings);

    // Store example card data with all pre-rendered formats
    lastCardData = {
      title: title,
      desc: desc,
      embeddedImageUrl: imageUrl,
      domain: domain,
      url: url,
      timestamp: Date.now(),
      // Pre-rendered formats
      emailHtml: generateEmailHTML(title, desc, imageUrl, domain, url, currentSettings),
      documentHtml: generateDocumentHTML(title, desc, imageUrl, domain, url, currentSettings),
      chatMarkdown: generateMarkdown(title, desc, domain, url),
      htmlCode: generateCardHTML(title, desc, 'og-card-thumbnail.png', domain, url, currentSettings)
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

  // Re-render existing card with current settings (no fetch)
  function refreshCardDisplay() {
    if (!lastCardData) return false;

    const generatedHtml = generateCardHTML(
      lastCardData.title,
      lastCardData.desc,
      lastCardData.embeddedImageUrl,
      lastCardData.domain,
      lastCardData.url,
      currentSettings
    );

    // Re-generate all pre-rendered formats with updated settings
    lastCardData.emailHtml = generateEmailHTML(
      lastCardData.title,
      lastCardData.desc,
      lastCardData.embeddedImageUrl,
      lastCardData.domain,
      lastCardData.url,
      currentSettings
    );
    lastCardData.documentHtml = generateDocumentHTML(
      lastCardData.title,
      lastCardData.desc,
      lastCardData.embeddedImageUrl,
      lastCardData.domain,
      lastCardData.url,
      currentSettings
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
      lastCardData.url,
      currentSettings
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
        emailHtml: generateEmailHTML(title, desc, embeddedImageUrl, domain, url, currentSettings),
        documentHtml: generateDocumentHTML(title, desc, embeddedImageUrl, domain, url, currentSettings),
        chatMarkdown: generateMarkdown(title, desc, domain, url),
        htmlCode: generateCardHTML(title, desc, 'og-card-thumbnail.png', domain, url, currentSettings),
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
        url,
        currentSettings
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
          lastCardData.domain,
          currentSettings
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

});