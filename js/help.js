document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  document.querySelectorAll('.settings-tab[data-page]').forEach(tab => {
    tab.addEventListener('click', () => {
      window.location.href = tab.getAttribute('data-page');
    });
  });

  const closeSettingsBtn = document.getElementById('closeSettingsBtn');

  // Modal elements
  const modal = document.getElementById('unsavedModal');
  const modalSaveBtn = document.getElementById('modalSaveBtn');
  const modalDiscardBtn = document.getElementById('modalDiscardBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');

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
      if (data.formattingDirty || data.advancedDirty) {
        showModal();
      } else {
        window.location.href = 'main.html';
      }
    });
  });

  // Modal button handlers
  modalSaveBtn.addEventListener('click', () => {
    hideModal();
    // Read temp settings and save them permanently
    chrome.storage.local.get(['tempCardSettings'], (data) => {
      if (data.tempCardSettings) {
        chrome.storage.sync.set({ cardSettings: data.tempCardSettings }, () => {
          // Clear dirty state and temp values
          chrome.storage.local.set({ formattingDirty: false, tempCardSettings: null }, () => {
            window.location.href = 'main.html';
          });
        });
      } else {
        // No temp settings, just close
        chrome.storage.local.set({ formattingDirty: false }, () => {
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

  // Initialize accordion using the simple accordion module
  const accordion = initAccordions({
    exclusive: false,                // Allow multiple accordions open simultaneously
    persistState: true,              // Save/load accordion state
    storageKey: 'accordionState_help' // Storage key for this page
  });

  // Save button - check for unsaved changes and save/close
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // Trigger the same logic as modal Save button
      chrome.storage.local.get(['formattingDirty', 'advancedDirty', 'tempCardSettings'], (data) => {
        if (data.formattingDirty || data.advancedDirty) {
          // Has unsaved changes - save them
          if (data.tempCardSettings) {
            chrome.storage.sync.set({ cardSettings: data.tempCardSettings });
          }
          chrome.storage.local.set({
            formattingDirty: false,
            advancedDirty: false,
            tempCardSettings: null
          }, () => {
            window.location.href = 'main.html';
          });
        } else {
          // No unsaved changes - just close
          window.location.href = 'main.html';
        }
      });
    });
  }

  // Reset button - navigate to formatting page to reset
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
      window.location.href = 'formatting.html';
    });
  }
});
