document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  document.querySelectorAll('.settings-tab[data-page]').forEach(tab => {
    tab.addEventListener('click', () => {
      window.location.href = tab.getAttribute('data-page');
    });
  });

  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const debugToggle = document.getElementById('debugToggle');
  const forceGeneratedCardToggle = document.getElementById('forceGeneratedCardToggle');
  const persistCardToggle = document.getElementById('persistCardToggle');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const sessionTimeoutSelect = document.getElementById('sessionTimeoutSelect');
  const historyLengthSelect = document.getElementById('historyLengthSelect');
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');

  // Modal elements
  const modal = document.getElementById('unsavedModal');
  const modalSaveBtn = document.getElementById('modalSaveBtn');
  const modalDiscardBtn = document.getElementById('modalDiscardBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');

  let debugEnabled = false;
  let forceGeneratedCard = false;
  let persistCardEnabled = true;
  let sessionTimeoutMinutes = 30;
  let historyLength = 5;
  let autoRefreshCached = false;
  let isDirty = false;

  // Mark settings as dirty (unsaved)
  function markDirty() {
    isDirty = true;
    chrome.storage.local.set({ advancedDirty: true });
  }

  // Load preferences from chrome.storage on init
  chrome.storage.sync.get(['debugEnabled', 'forceGeneratedCard', 'persistCardEnabled', 'sessionTimeoutMinutes', 'historyLength', 'autoRefreshCached'], (data) => {
    // Load debug preference
    if (data.debugEnabled) {
      debugEnabled = true;
      if (debugToggle) debugToggle.checked = true;
    }
    // Load force generated card preference
    if (data.forceGeneratedCard) {
      forceGeneratedCard = true;
      if (forceGeneratedCardToggle) forceGeneratedCardToggle.checked = true;
    }
    // Load persist card preference
    if (data.persistCardEnabled !== undefined) {
      persistCardEnabled = data.persistCardEnabled;
      if (persistCardToggle) persistCardToggle.checked = persistCardEnabled;
    }
    // Load session timeout preference (default: 30 minutes)
    if (data.sessionTimeoutMinutes !== undefined) {
      sessionTimeoutMinutes = data.sessionTimeoutMinutes;
      if (sessionTimeoutSelect) sessionTimeoutSelect.value = sessionTimeoutMinutes;
    }
    // Load history length preference (default: 5)
    if (data.historyLength !== undefined) {
      historyLength = data.historyLength;
      if (historyLengthSelect) historyLengthSelect.value = historyLength;
    }
    // Load auto-refresh cached preference (default: false)
    if (data.autoRefreshCached) {
      autoRefreshCached = true;
      if (autoRefreshToggle) autoRefreshToggle.checked = true;
    }
    // Clear dirty state on load
    chrome.storage.local.set({ advancedDirty: false });
    isDirty = false;
  });

  // Debug toggle change handler
  if (debugToggle) {
    debugToggle.addEventListener('change', () => {
      debugEnabled = debugToggle.checked;
      markDirty();
    });
  }

  // Force generated card toggle change handler
  if (forceGeneratedCardToggle) {
    forceGeneratedCardToggle.addEventListener('change', () => {
      forceGeneratedCard = forceGeneratedCardToggle.checked;
      markDirty();
    });
  }

  // Persist card toggle change handler
  if (persistCardToggle) {
    persistCardToggle.addEventListener('change', () => {
      persistCardEnabled = persistCardToggle.checked;
      markDirty();
    });
  }

  // Session timeout select change handler
  if (sessionTimeoutSelect) {
    sessionTimeoutSelect.addEventListener('change', () => {
      sessionTimeoutMinutes = parseInt(sessionTimeoutSelect.value);
      markDirty();
    });
  }

  // History length select change handler
  if (historyLengthSelect) {
    historyLengthSelect.addEventListener('change', () => {
      historyLength = parseInt(historyLengthSelect.value);
      markDirty();
    });
  }

  // Auto-refresh toggle change handler
  if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', () => {
      autoRefreshCached = autoRefreshToggle.checked;
      markDirty();
    });
  }

  // Clear history button handler
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      chrome.storage.local.remove(['lastCard', 'cardHistory'], () => {
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

  // Show/hide modal
  function showModal() {
    modal.classList.add('active');
  }

  function hideModal() {
    modal.classList.remove('active');
  }

  // Close button - check for unsaved formatting OR advanced changes
  closeSettingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.storage.local.get(['formattingDirty', 'advancedDirty'], (data) => {
      if (data.formattingDirty || data.advancedDirty || isDirty) {
        showModal();
      } else {
        window.location.href = 'main.html';
      }
    });
  });

  // Modal button handlers
  modalSaveBtn.addEventListener('click', () => {
    hideModal();

    // Save advanced settings if dirty
    if (isDirty) {
      chrome.storage.sync.set({
        debugEnabled: debugEnabled,
        forceGeneratedCard: forceGeneratedCard,
        persistCardEnabled: persistCardEnabled,
        sessionTimeoutMinutes: sessionTimeoutMinutes,
        historyLength: historyLength,
        autoRefreshCached: autoRefreshCached
      });

      // Handle persist card logic
      if (!persistCardEnabled) {
        chrome.storage.local.remove('lastCard');
      }
    }

    // Read temp formatting settings and save them permanently
    chrome.storage.local.get(['tempCardSettings'], (data) => {
      if (data.tempCardSettings) {
        chrome.storage.sync.set({ cardSettings: data.tempCardSettings }, () => {
          // Clear all dirty states and temp values
          chrome.storage.local.set({
            formattingDirty: false,
            advancedDirty: false,
            tempCardSettings: null
          }, () => {
            window.location.href = 'main.html';
          });
        });
      } else {
        // No temp formatting settings, just clear dirty states
        chrome.storage.local.set({
          formattingDirty: false,
          advancedDirty: false
        }, () => {
          window.location.href = 'main.html';
        });
      }
    });
  });

  modalDiscardBtn.addEventListener('click', () => {
    // Discard changes and close
    chrome.storage.local.set({
      formattingDirty: false,
      advancedDirty: false,
      tempCardSettings: null
    }, () => {
      window.location.href = 'main.html';
    });
  });

  modalCancelBtn.addEventListener('click', () => {
    hideModal(); // Stay on current page
  });

  // Save button - save advanced settings and close
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // Save advanced settings
      chrome.storage.sync.set({
        debugEnabled: debugEnabled,
        forceGeneratedCard: forceGeneratedCard,
        persistCardEnabled: persistCardEnabled,
        sessionTimeoutMinutes: sessionTimeoutMinutes,
        historyLength: historyLength,
        autoRefreshCached: autoRefreshCached
      }, () => {
        // Handle persist card logic
        if (!persistCardEnabled) {
          chrome.storage.local.remove('lastCard');
        }
        // Clear dirty state and close
        chrome.storage.local.set({ advancedDirty: false }, () => {
          window.location.href = 'main.html';
        });
      });
    });
  }

  // Reset button - reset advanced settings to defaults
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
      // Reset to defaults
      debugEnabled = false;
      forceGeneratedCard = false;
      persistCardEnabled = true;
      sessionTimeoutMinutes = 30;
      historyLength = 5;
      autoRefreshCached = false;
      if (debugToggle) debugToggle.checked = false;
      if (forceGeneratedCardToggle) forceGeneratedCardToggle.checked = false;
      if (persistCardToggle) persistCardToggle.checked = true;
      if (sessionTimeoutSelect) sessionTimeoutSelect.value = 30;
      if (historyLengthSelect) historyLengthSelect.value = 5;
      if (autoRefreshToggle) autoRefreshToggle.checked = false;
      markDirty();

      // Clear accordion state (close all accordions)
      if (accordion) {
        accordion.clearState();
      }
    });
  }

  // Initialize accordion using the simple accordion module
  const accordion = initAccordions({
    exclusive: true,                      // Only one accordion open at a time
    persistState: true,                   // Save/load accordion state
    storageKey: 'accordionState_advanced' // Storage key for this page
  });
});
