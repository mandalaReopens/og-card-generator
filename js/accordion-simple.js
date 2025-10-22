// Simple Accordion Module - No DOM destruction, just add event listeners
// Works with existing HTML structure
//
// Expected HTML structure:
//   <div class="accordion-item">
//     <div class="accordion-header" data-accordion="section-id">
//       <svg class="accordion-icon">...</svg>           <!-- Optional: Section icon -->
//       <span class="accordion-title">Title</span>      <!-- Section title/description -->
//       <svg class="accordion-chevron">...</svg>        <!-- Optional: Expand/collapse indicator -->
//     </div>
//     <div class="accordion-content" id="section-id">
//       <!-- Content here -->
//     </div>
//   </div>
//
// Icons and descriptions:
// - The module preserves all HTML elements including icons and descriptions
// - Icons (.accordion-icon) and titles (.accordion-title) are automatically supported
// - Chevron rotation is handled by CSS when the 'active' class is added to the header

function initAccordions(options = {}) {
  const {
    exclusive = true,      // Only one accordion open at a time
    defaultOpen = null,    // ID of accordion to open by default (overridden by saved state)
    persistState = true,   // Save/load accordion state from chrome.storage
    storageKey = 'accordionState' // Key for storing state in chrome.storage.local
  } = options;

  // Get all accordion headers
  const headers = document.querySelectorAll('.accordion-header');

  if (headers.length === 0) {
    console.warn('initAccordions: No accordion headers found');
    return null;
  }

  // State management
  let loadedState = null;

  // Helper: Open an accordion by ID
  function open(accordionId) {
    const header = document.querySelector(`[data-accordion="${accordionId}"]`);
    const content = document.getElementById(accordionId);

    if (!header || !content) {
      console.warn(`initAccordions: Accordion "${accordionId}" not found`);
      return;
    }

    header.classList.add('active');
    content.classList.add('active');
  }

  // Helper: Close an accordion by ID
  function close(accordionId) {
    const header = document.querySelector(`[data-accordion="${accordionId}"]`);
    const content = document.getElementById(accordionId);

    if (!header || !content) {
      console.warn(`initAccordions: Accordion "${accordionId}" not found`);
      return;
    }

    header.classList.remove('active');
    content.classList.remove('active');
  }

  // Helper: Toggle an accordion by ID
  function toggle(accordionId) {
    const header = document.querySelector(`[data-accordion="${accordionId}"]`);

    if (!header) {
      console.warn(`initAccordions: Accordion "${accordionId}" not found`);
      return;
    }

    const isActive = header.classList.contains('active');

    if (isActive) {
      close(accordionId);
    } else {
      open(accordionId);
    }
  }

  // Helper: Close all accordions
  function closeAll() {
    headers.forEach(header => {
      const accordionId = header.getAttribute('data-accordion');
      if (accordionId) {
        close(accordionId);
      }
    });
  }

  // Helper: Update accordion title/description
  function updateTitle(accordionId, newTitle) {
    const header = document.querySelector(`[data-accordion="${accordionId}"]`);

    if (!header) {
      console.warn(`initAccordions: Accordion "${accordionId}" not found`);
      return;
    }

    const titleElement = header.querySelector('.accordion-title');
    if (titleElement) {
      titleElement.textContent = newTitle;
    } else {
      console.warn(`initAccordions: No .accordion-title found in "${accordionId}"`);
    }
  }

  // Helper: Get current state of an accordion
  function isOpen(accordionId) {
    const header = document.querySelector(`[data-accordion="${accordionId}"]`);
    return header ? header.classList.contains('active') : false;
  }

  // Helper: Save current accordion state to chrome.storage
  function saveState() {
    if (!persistState || typeof chrome === 'undefined') return;

    const openAccordions = [];
    headers.forEach(header => {
      const accordionId = header.getAttribute('data-accordion');
      if (accordionId && header.classList.contains('active')) {
        openAccordions.push(accordionId);
      }
    });

    chrome.storage.local.set({ [storageKey]: openAccordions });
  }

  // Helper: Clear saved accordion state from chrome.storage
  function clearState() {
    if (!persistState || typeof chrome === 'undefined') return;

    chrome.storage.local.remove(storageKey);
    closeAll();
  }

  // Attach click handlers to all headers
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const accordionId = header.getAttribute('data-accordion');

      if (!accordionId) {
        console.warn('initAccordions: Header missing data-accordion attribute');
        return;
      }

      const isActive = header.classList.contains('active');

      if (exclusive) {
        // Close all first
        closeAll();

        // Open clicked accordion if it wasn't already active
        if (!isActive) {
          open(accordionId);
        }
      } else {
        // Non-exclusive: just toggle this one
        toggle(accordionId);
      }

      // Save state after any interaction
      saveState();
    });
  });

  // Load saved state and initialize accordions
  if (persistState && typeof chrome !== 'undefined') {
    chrome.storage.local.get([storageKey], (data) => {
      const savedState = data[storageKey];

      if (savedState && Array.isArray(savedState)) {
        // Restore saved state
        savedState.forEach(accordionId => {
          open(accordionId);
        });
      } else if (defaultOpen) {
        // No saved state, use defaultOpen
        open(defaultOpen);
      }
    });
  } else if (defaultOpen) {
    // No persistence, just use defaultOpen
    open(defaultOpen);
  }

  // Return public API
  return {
    open,
    close,
    toggle,
    closeAll,
    updateTitle,  // Update accordion title/description
    isOpen,       // Check if accordion is open
    clearState    // Clear saved accordion state
  };
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initAccordions };
}
