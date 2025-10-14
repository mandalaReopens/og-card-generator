document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  document.querySelectorAll('.settings-tab[data-page]').forEach(tab => {
    tab.addEventListener('click', () => {
      window.location.href = tab.getAttribute('data-page');
    });
  });

  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');

  // Modal elements
  const modal = document.getElementById('unsavedModal');
  const modalSaveBtn = document.getElementById('modalSaveBtn');
  const modalDiscardBtn = document.getElementById('modalDiscardBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');

  // Initialize Coloris color picker
  Coloris({
    theme: 'polaroid',
    themeMode: 'auto',
    format: 'mixed',
    alpha: false,
    swatches: [
      '#225560', '#FDCA40', '#179355', '#e0e0e0',  // Your brand colors
      '#2c3e50', '#34495e', '#7f8c8d', '#95a5a6',  // Muted blues/grays
      '#e74c3c', '#f39c12', '#27ae60', '#3498db'   // Muted red/orange/green/blue
    ]
  });

  // Dirty state tracking
  let isDirty = false;

  // Default settings
  const DEFAULT_SETTINGS = {
    titleFontSize: '18px',
    descFontSize: '14px',
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

  // Font size pairing map (title → description)
  const FONT_PAIRING = {
    '14px': '11px',
    '16px': '12px',
    '18px': '14px',
    '20px': '16px'
  };

  // Reverse font size pairing map (description → title)
  const DESCRIPTION_TO_TITLE = {
    '11px': '14px',
    '12px': '16px',
    '14px': '18px',
    '16px': '20px'
  };

  // Default color schemes
  const DEFAULT_COLOR_SCHEMES = [
    {
      name: "Ocean Breeze",
      titleColor: "#0077BE",
      descColor: "#2980b9",
      domainColor: "#5DADE2",
      borderColor: "#D6EAF8"
    },
    {
      name: "Forest Canopy",
      titleColor: "#179355",
      descColor: "#2d5c3f",
      domainColor: "#27ae60",
      borderColor: "#d5e8d4"
    },
    {
      name: "Sunset Glow",
      titleColor: "#e74c3c",
      descColor: "#d35400",
      domainColor: "#f39c12",
      borderColor: "#fdebd0"
    },
    {
      name: "Monochrome",
      titleColor: "#2c3e50",
      descColor: "#34495e",
      domainColor: "#7f8c8d",
      borderColor: "#e0e0e0"
    }
  ];

  // Current settings (loaded from storage)
  let currentSettings = { ...DEFAULT_SETTINGS };

  // Current color schemes (loaded from storage)
  let colorSchemes = [...DEFAULT_COLOR_SCHEMES];

  // Load settings and color schemes from chrome.storage on init
  chrome.storage.sync.get(['cardSettings', 'colorSchemes'], (data) => {
    if (data.cardSettings) {
      currentSettings = { ...DEFAULT_SETTINGS, ...data.cardSettings };
      loadSettingsToUI();
    }
    if (data.colorSchemes) {
      colorSchemes = data.colorSchemes;
    }
    renderSchemeSlots();
    highlightActiveScheme();
    // Clear dirty state on load
    chrome.storage.local.set({ formattingDirty: false });
    isDirty = false;
  });

  // Load settings into UI fields
  function loadSettingsToUI() {
    document.getElementById('titleFontSize').value = currentSettings.titleFontSize;
    document.getElementById('descFontSize').value = currentSettings.descFontSize;
    document.getElementById('titleFont').value = currentSettings.titleFont;
    document.getElementById('descFont').value = currentSettings.descFont;
    document.getElementById('borderStyle').value = currentSettings.borderStyle;
    document.getElementById('borderWeight').value = currentSettings.borderWeight;
    document.getElementById('borderRadius').value = currentSettings.borderRadius;

    // For color inputs, set value AND trigger input event to update Coloris preview
    const colorInputs = [
      { id: 'titleColor', value: currentSettings.titleColor },
      { id: 'descColor', value: currentSettings.descColor },
      { id: 'domainColor', value: currentSettings.domainColor },
      { id: 'borderColor', value: currentSettings.borderColor }
    ];

    colorInputs.forEach(({ id, value }) => {
      const input = document.getElementById(id);
      if (input) {
        input.value = value;
        // Trigger input event to update Coloris preview
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  // Mark dirty on any input change
  function markDirty() {
    isDirty = true;
    // Store temporary values for potential save from other pages
    const tempSettings = {
      titleFontSize: document.getElementById('titleFontSize').value,
      descFontSize: document.getElementById('descFontSize').value,
      titleColor: document.getElementById('titleColor').value,
      descColor: document.getElementById('descColor').value,
      domainColor: document.getElementById('domainColor').value,
      borderColor: document.getElementById('borderColor').value,
      borderStyle: document.getElementById('borderStyle').value,
      borderWeight: document.getElementById('borderWeight').value,
      borderRadius: document.getElementById('borderRadius').value
    };
    chrome.storage.local.set({
      formattingDirty: true,
      tempCardSettings: tempSettings
    });
  }

  // Add change listeners to all inputs
  ['titleFontSize', 'descFontSize', 'titleColor', 'descColor', 'domainColor', 'borderColor', 'borderStyle', 'borderWeight', 'borderRadius'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', () => {
        markDirty();
        // Highlight active scheme when colors change
        if (['titleColor', 'descColor', 'domainColor', 'borderColor'].includes(id)) {
          highlightActiveScheme();
        }
      });
      // For Coloris inputs, also listen to input events
      if (element.hasAttribute('data-coloris')) {
        element.addEventListener('input', () => {
          markDirty();
          highlightActiveScheme();
        });
      }
    }
  });

  // Smart font pairing: auto-adjust description size when title changes
  document.getElementById('titleFontSize').addEventListener('change', (e) => {
    const titleSize = e.target.value;
    if (FONT_PAIRING[titleSize]) {
      document.getElementById('descFontSize').value = FONT_PAIRING[titleSize];
      markDirty(); // Mark dirty when auto-adjusting
    }
  });

  // Bidirectional pairing: auto-adjust title size when description changes
  document.getElementById('descFontSize').addEventListener('change', (e) => {
    const descSize = e.target.value;
    if (DESCRIPTION_TO_TITLE[descSize]) {
      document.getElementById('titleFontSize').value = DESCRIPTION_TO_TITLE[descSize];
      markDirty(); // Mark dirty when auto-adjusting
    }
  });

  // Font family change listeners
  document.getElementById('titleFont').addEventListener('change', () => {
    markDirty();
  });

  document.getElementById('descFont').addEventListener('change', () => {
    markDirty();
  });

  // Save settings to chrome.storage
  function saveSettings() {
    // Force color inputs to commit their values (blur closes color picker)
    document.getElementById('titleColor').blur();
    document.getElementById('descColor').blur();
    document.getElementById('domainColor').blur();
    document.getElementById('borderColor').blur();

    currentSettings = {
      titleFontSize: document.getElementById('titleFontSize').value,
      descFontSize: document.getElementById('descFontSize').value,
      titleFont: document.getElementById('titleFont').value,
      descFont: document.getElementById('descFont').value,
      titleColor: document.getElementById('titleColor').value,
      descColor: document.getElementById('descColor').value,
      domainColor: document.getElementById('domainColor').value,
      borderColor: document.getElementById('borderColor').value,
      borderStyle: document.getElementById('borderStyle').value,
      borderWeight: document.getElementById('borderWeight').value,
      borderRadius: document.getElementById('borderRadius').value
    };

    chrome.storage.sync.set({
      cardSettings: currentSettings,
      colorSchemes: colorSchemes
    }, () => {
      // Clear dirty state and temp values
      isDirty = false;
      chrome.storage.local.set({
        formattingDirty: false,
        advancedDirty: false,
        tempCardSettings: null
      }, () => {
        // Navigate back to main page
        window.location.href = 'main.html';
      });
    });
  }

  // Reset settings to defaults
  function resetSettings() {
    currentSettings = { ...DEFAULT_SETTINGS };
    colorSchemes = [...DEFAULT_COLOR_SCHEMES];
    loadSettingsToUI();
    renderSchemeSlots();
    highlightActiveScheme();
    markDirty(); // Mark as dirty since settings changed

    // Clear accordion state (close all accordions)
    if (accordion) {
      accordion.clearState();
    }

    const originalTooltip = resetSettingsBtn.getAttribute('data-tooltip');
    resetSettingsBtn.setAttribute('data-tooltip', 'Reset!');
    setTimeout(() => {
      resetSettingsBtn.setAttribute('data-tooltip', originalTooltip);
    }, 2000);
  }

  // Show/hide modal
  function showModal() {
    modal.classList.add('active');
  }

  function hideModal() {
    modal.classList.remove('active');
  }

  // Color Scheme Functions
  function renderSchemeSlots() {
    const schemeSlotsContainer = document.getElementById('schemeSlots');
    if (!schemeSlotsContainer) return;

    schemeSlotsContainer.innerHTML = '';

    colorSchemes.forEach((scheme, index) => {
      const slot = document.createElement('div');
      slot.className = 'scheme-slot';
      slot.setAttribute('data-scheme-index', index);

      slot.innerHTML = `
        <div class="scheme-preview">
          <span class="color-block" style="background: ${scheme.titleColor}"></span>
          <span class="color-block" style="background: ${scheme.descColor}"></span>
          <span class="color-block" style="background: ${scheme.domainColor}"></span>
          <span class="color-block" style="background: ${scheme.borderColor}"></span>
        </div>
        <div class="scheme-name-wrapper">
          <svg class="scheme-edit-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
            <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
            <path d="M16 5l3 3" />
          </svg>
          <span class="scheme-name" contenteditable="false">${scheme.name}</span>
        </div>
        <div class="scheme-buttons">
          <button class="scheme-use-btn" aria-label="Apply this scheme to color inputs">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M11.293 7.293a1 1 0 0 1 1.32 -.083l.094 .083l6 6l.083 .094l.054 .077l.054 .096l.017 .036l.027 .067l.032 .108l.01 .053l.01 .06l.004 .057l.002 .059l-.002 .059l-.005 .058l-.009 .06l-.01 .052l-.032 .108l-.027 .067l-.07 .132l-.065 .09l-.073 .081l-.094 .083l-.077 .054l-.096 .054l-.036 .017l-.067 .027l-.108 .032l-.053 .01l-.06 .01l-.057 .004l-.059 .002h-12c-.852 0 -1.297 -.986 -.783 -1.623l.076 -.084l6 -6z"/>
            </svg>
            Use
          </button>
          <button class="scheme-save-btn" aria-label="Save current colors to this slot">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M18 9c.852 0 1.297.986.783 1.623l-.076.084l-6 6a1 1 0 0 1-1.32.083l-.094-.083l-6 -6l-.083-.094l-.054-.077l-.054-.096l-.017-.036l-.027-.067l-.032-.108l-.01-.053l-.01-.06l-.004-.057v-.118l.005-.058l.009-.06l.01-.052l.032-.108l.027-.067l.07-.132l.065-.09l.073-.081l.094-.083l.077-.054l.096-.054l.036-.017l.067-.027l.108-.032l.053-.01l.06-.01l.057-.004l12.059-.002z"/>
            </svg>
            Save
          </button>
        </div>
      `;

      // Button event handlers
      const useBtn = slot.querySelector('.scheme-use-btn');
      const saveBtn = slot.querySelector('.scheme-save-btn');

      useBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyScheme(index);
      });

      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveSchemeToSlot(index);
      });

      // Editable name handlers
      const nameSpan = slot.querySelector('.scheme-name');
      nameSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        nameSpan.contentEditable = 'true';
        nameSpan.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });

      nameSpan.addEventListener('blur', () => {
        nameSpan.contentEditable = 'false';
        updateSchemeName(index, nameSpan.textContent.trim());
      });

      nameSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameSpan.blur();
        }
        if (e.key === 'Escape') {
          nameSpan.textContent = colorSchemes[index].name;
          nameSpan.blur();
        }
      });

      schemeSlotsContainer.appendChild(slot);
    });
  }

  function applyScheme(index) {
    const scheme = colorSchemes[index];
    if (!scheme) return;

    // Apply colors to inputs and trigger Coloris update
    const colorInputs = [
      { id: 'titleColor', value: scheme.titleColor },
      { id: 'descColor', value: scheme.descColor },
      { id: 'domainColor', value: scheme.domainColor },
      { id: 'borderColor', value: scheme.borderColor }
    ];

    colorInputs.forEach(({ id, value }) => {
      const input = document.getElementById(id);
      if (input) {
        input.value = value;
        // Trigger input event to update Coloris preview
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Mark dirty since settings changed
    markDirty();

    // Highlight active scheme
    highlightActiveScheme();
  }

  function saveSchemeToSlot(index) {
    const newScheme = {
      name: colorSchemes[index].name, // Keep existing name
      titleColor: document.getElementById('titleColor').value,
      descColor: document.getElementById('descColor').value,
      domainColor: document.getElementById('domainColor').value,
      borderColor: document.getElementById('borderColor').value
    };

    colorSchemes[index] = newScheme;

    // Save to storage
    chrome.storage.sync.set({ colorSchemes: colorSchemes }, () => {
      // Re-render to show updated preview
      renderSchemeSlots();
      highlightActiveScheme();
    });
  }

  function updateSchemeName(index, newName) {
    if (newName && newName !== colorSchemes[index].name) {
      colorSchemes[index].name = newName;
      chrome.storage.sync.set({ colorSchemes: colorSchemes });
    } else {
      // Revert to original name if empty
      renderSchemeSlots();
    }
  }

  function highlightActiveScheme() {
    const currentColors = {
      titleColor: document.getElementById('titleColor').value.toLowerCase(),
      descColor: document.getElementById('descColor').value.toLowerCase(),
      domainColor: document.getElementById('domainColor').value.toLowerCase(),
      borderColor: document.getElementById('borderColor').value.toLowerCase()
    };

    document.querySelectorAll('.scheme-slot').forEach((slot, index) => {
      const scheme = colorSchemes[index];
      if (!scheme) return;

      const matches = (
        scheme.titleColor.toLowerCase() === currentColors.titleColor &&
        scheme.descColor.toLowerCase() === currentColors.descColor &&
        scheme.domainColor.toLowerCase() === currentColors.domainColor &&
        scheme.borderColor.toLowerCase() === currentColors.borderColor
      );

      if (matches) {
        slot.classList.add('active');
      } else {
        slot.classList.remove('active');
      }
    });
  }

  // Event listeners
  closeSettingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // Check if there are unsaved changes
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
    saveSettings(); // This will save and navigate to main
  });

  modalDiscardBtn.addEventListener('click', () => {
    // Discard changes and close
    isDirty = false;
    chrome.storage.local.set({
      formattingDirty: false,
      advancedDirty: false,
      tempCardSettings: null
    }, () => {
      window.location.href = 'main.html';
    });
  });

  modalCancelBtn.addEventListener('click', () => {
    hideModal(); // Stay on settings page
  });

  saveSettingsBtn.addEventListener('click', saveSettings);
  resetSettingsBtn.addEventListener('click', resetSettings);

  // ============================================
  // ACCORDION INITIALIZATION
  // ============================================

  // Initialize accordion using the simple accordion module
  const accordion = initAccordions({
    exclusive: true,                         // Only one accordion open at a time
    persistState: true,                      // Save/load accordion state
    storageKey: 'accordionState_formatting'  // Storage key for this page
  });
});
