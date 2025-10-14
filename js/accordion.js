// Accordion Component for OG Card Generator Settings
// Provides reusable accordion UI with state persistence

const AccordionIcons = {
  // Section icons
  palette: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 2c5.498 0 10 4.002 10 9c0 1.351 -.6 2.64 -1.654 3.576c-1.03 .914 -2.412 1.424 -3.846 1.424h-2.516a1 1 0 0 0 -.5 1.875a1 1 0 0 1 .194 .14a2.3 2.3 0 0 1 -1.597 3.99l-.156 -.009l.068 .004l-.273 -.004c-5.3 -.146 -9.57 -4.416 -9.716 -9.716l-.004 -.28c0 -5.523 4.477 -10 10 -10m-3.5 6.5a2 2 0 0 0 -1.995 1.85l-.005 .15a2 2 0 1 0 2 -2m8 0a2 2 0 0 0 -1.995 1.85l-.005 .15a2 2 0 1 0 2 -2m-4 -3a2 2 0 0 0 -1.995 1.85l-.005 .15a2 2 0 1 0 2 -2"/>`,

  typography: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20l3 0" /><path d="M14 20l7 0" /><path d="M6.9 15l6.9 0" /><path d="M10.2 6.3l5.8 13.7" /><path d="M5 20l6 -16l2 0l7 16" />`,

  letterCase: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17.5 15.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0" /><path d="M3 19v-10.5a3.5 3.5 0 0 1 7 0v10.5" /><path d="M3 13h7" /><path d="M21 12v7" />`,

  borderStyle: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 18v.01" /><path d="M8 18v.01" /><path d="M12 18v.01" /><path d="M16 18v.01" /><path d="M20 18v.01" /><path d="M18 12h2" /><path d="M11 12h2" /><path d="M4 12h2" /><path d="M4 6h16" />`,

  cards: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.348 3.169l-7.15 3.113a2 2 0 0 0 -1.03 2.608l4.92 11.895a1.96 1.96 0 0 0 2.59 1.063l7.142 -3.11a2.002 2.002 0 0 0 1.036 -2.611l-4.92 -11.894a1.96 1.96 0 0 0 -2.588 -1.064z" /><path d="M16 3a2 2 0 0 1 1.995 1.85l.005 .15v3.5a1 1 0 0 1 -1.993 .117l-.007 -.117v-3.5h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" /><path d="M19.08 5.61a1 1 0 0 1 1.31 -.53c.257 .108 .505 .21 .769 .314a2 2 0 0 1 1.114 2.479l-.056 .146l-2.298 5.374a1 1 0 0 1 -1.878 -.676l.04 -.11l2.296 -5.371l-.366 -.148l-.402 -.167a1 1 0 0 1 -.53 -1.312z" />`,

  clock: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-5 2.66a1 1 0 0 0 -.993 .883l-.007 .117v5l.009 .131a1 1 0 0 0 .197 .477l.087 .1l3 3l.094 .082a1 1 0 0 0 1.226 0l.094 -.083l.083 -.094a1 1 0 0 0 0 -1.226l-.083 -.094l-2.707 -2.708v-4.585l-.007 -.117a1 1 0 0 0 -.993 -.883z"/>`,

  code: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" />`,

  // Chevron icons
  chevronRight: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 2a3 3 0 0 1 3 3v14a3 3 0 0 1 -3 3h-14a3 3 0 0 1 -3 -3v-14a3 3 0 0 1 3 -3zm-7.387 6.21a1 1 0 0 0 -1.32 .083l-.083 .094a1 1 0 0 0 .083 1.32l2.292 2.293l-2.292 2.293l-.083 .094a1 1 0 0 0 1.497 1.32l3 -3l.083 -.094a1 1 0 0 0 -.083 -1.32l-3 -3z" />`,

  chevronDown: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 2a3 3 0 0 1 3 3v14a3 3 0 0 1 -3 3h-14a3 3 0 0 1 -3 -3v-14a3 3 0 0 1 3 -3zm-9.387 8.21a1 1 0 0 0 -1.32 1.497l3 3l.094 .083a1 1 0 0 0 1.32 -.083l3 -3l.083 -.094a1 1 0 0 0 -.083 -1.32l-.094 -.083a1 1 0 0 0 -1.32 .083l-2.293 2.292l-2.293 -2.292z" />`,

  chevronsDown: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 2a3 3 0 0 1 3 3v14a3 3 0 0 1 -3 3h-14a3 3 0 0 1 -3 -3v-14a3 3 0 0 1 3 -3zm-9.387 10.21a1 1 0 0 0 -1.32 1.497l3 3l.094 .083a1 1 0 0 0 1.32 -.083l3 -3l.083 -.094a1 1 0 0 0 -.083 -1.32l-.094 -.083a1 1 0 0 0 -1.32 .083l-2.293 2.292l-2.293 -2.292zm0 -5a1 1 0 0 0 -1.32 1.497l3 3l.094 .083a1 1 0 0 0 1.32 -.083l3 -3l.083 -.094a1 1 0 0 0 -.083 -1.32l-.094 -.083a1 1 0 0 0 -1.32 .083l-2.293 2.292l-2.293 -2.292z"/>`,

  chevronsUp: `<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 2a3 3 0 0 1 3 3v14a3 3 0 0 1 -3 3h-14a3 3 0 0 1 -3 -3v-14a3 3 0 0 1 3 -3zm-6.387 10.21a1 1 0 0 0 -1.32 .083l-3 3l-.083 .094a1 1 0 0 0 .083 1.32l.094 .083a1 1 0 0 0 1.32 -.083l2.293 -2.292l2.293 2.292l.094 .083a1 1 0 0 0 1.32 -1.497l-3 -3zm0 -5a1 1 0 0 0 -1.32 .083l-3 3l-.083 .094a1 1 0 0 0 .083 1.32l.094 .083a1 1 0 0 0 1.32 -.083l2.293 -2.292l2.293 2.292l.094 .083a1 1 0 0 0 1.32 -1.497l-3 -3z"/>`
};

class AccordionManager {
  constructor(page) {
    this.page = page; // 'formatting' or 'advanced'
    this.accordions = new Map();
  }

  /**
   * Create an accordion section
   * @param {Object} config - Accordion configuration
   * @param {string} config.id - Unique identifier (e.g., 'colors', 'typography')
   * @param {string} config.iconKey - Key from AccordionIcons object
   * @param {string} config.heading - Section heading
   * @param {string} config.description - Short description text
   * @param {HTMLElement} config.contentElement - DOM element containing section content
   * @param {boolean} config.defaultOpen - Whether section should be open by default
   * @returns {HTMLElement} - The created accordion element
   */
  createAccordion(config) {
    const { id, iconKey, heading, description, contentElement, defaultOpen = false } = config;

    // Create accordion container
    const accordion = document.createElement('div');
    accordion.className = 'accordion-section';
    accordion.setAttribute('data-accordion-id', id);

    // Create header
    const header = document.createElement('div');
    header.className = 'accordion-header';
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', defaultOpen ? 'true' : 'false');
    header.setAttribute('tabindex', '0');

    // Icon
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('class', 'accordion-icon');
    iconSvg.setAttribute('width', '20');
    iconSvg.setAttribute('height', '20');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('stroke-linecap', 'round');
    iconSvg.setAttribute('stroke-linejoin', 'round');

    // Determine if icon uses fill or stroke based on icon type
    const strokeIcons = ['typography', 'letterCase', 'borderStyle', 'code'];
    if (strokeIcons.includes(iconKey)) {
      iconSvg.setAttribute('fill', 'none');
      iconSvg.setAttribute('stroke', 'currentColor');
      iconSvg.setAttribute('stroke-width', '2');
    } else {
      iconSvg.setAttribute('fill', 'currentColor');
      iconSvg.setAttribute('stroke', 'none');
    }

    iconSvg.innerHTML = AccordionIcons[iconKey] || '';

    // Text container
    const textContainer = document.createElement('div');
    textContainer.className = 'accordion-text';

    const headingEl = document.createElement('h4');
    headingEl.className = 'accordion-heading';
    headingEl.textContent = heading;

    const descEl = document.createElement('p');
    descEl.className = 'accordion-description';
    descEl.textContent = description;

    textContainer.appendChild(headingEl);
    textContainer.appendChild(descEl);

    // Chevron
    const chevronSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevronSvg.setAttribute('class', 'accordion-chevron');
    chevronSvg.setAttribute('width', '20');
    chevronSvg.setAttribute('height', '20');
    chevronSvg.setAttribute('viewBox', '0 0 24 24');
    chevronSvg.setAttribute('fill', 'currentColor');
    chevronSvg.innerHTML = AccordionIcons.chevronRight;

    header.appendChild(iconSvg);
    header.appendChild(textContainer);
    header.appendChild(chevronSvg);

    // Create content container
    const content = document.createElement('div');
    content.className = 'accordion-content';
    content.appendChild(contentElement);

    accordion.appendChild(header);
    accordion.appendChild(content);

    // Load saved state
    this.loadState(id).then(isOpen => {
      const shouldOpen = isOpen !== null ? isOpen : defaultOpen;
      if (shouldOpen) {
        this.open(accordion);
      } else {
        this.close(accordion);
      }
    });

    // Event listeners
    header.addEventListener('click', () => this.toggle(accordion));
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle(accordion);
      }
    });

    this.accordions.set(id, accordion);
    return accordion;
  }

  /**
   * Toggle accordion open/closed
   */
  toggle(accordion) {
    const header = accordion.querySelector('.accordion-header');
    const isOpen = header.getAttribute('aria-expanded') === 'true';

    if (isOpen) {
      this.close(accordion);
    } else {
      this.open(accordion);
    }
  }

  /**
   * Open accordion
   */
  open(accordion) {
    const header = accordion.querySelector('.accordion-header');
    const content = accordion.querySelector('.accordion-content');
    const chevron = accordion.querySelector('.accordion-chevron');

    header.setAttribute('aria-expanded', 'true');
    accordion.classList.add('open');

    // Temporarily remove max-height constraint to measure true content height
    content.style.maxHeight = 'none';
    const height = content.scrollHeight;
    content.style.maxHeight = '0';

    // Force reflow then animate to measured height
    content.offsetHeight; // Force reflow
    content.style.maxHeight = height + 'px';

    // Rotate chevron by changing to down icon
    chevron.innerHTML = AccordionIcons.chevronDown;

    // Save state
    const id = accordion.getAttribute('data-accordion-id');
    this.saveState(id, true);
  }

  /**
   * Close accordion
   */
  close(accordion) {
    const header = accordion.querySelector('.accordion-header');
    const content = accordion.querySelector('.accordion-content');
    const chevron = accordion.querySelector('.accordion-chevron');

    header.setAttribute('aria-expanded', 'false');
    accordion.classList.remove('open');
    content.style.maxHeight = '0';

    // Rotate chevron by changing to right icon
    chevron.innerHTML = AccordionIcons.chevronRight;

    // Save state
    const id = accordion.getAttribute('data-accordion-id');
    this.saveState(id, false);
  }

  /**
   * Expand all accordions
   */
  expandAll() {
    this.accordions.forEach((accordion, id) => this.open(accordion));
  }

  /**
   * Collapse all accordions
   */
  collapseAll() {
    this.accordions.forEach((accordion, id) => this.close(accordion));
  }

  /**
   * Save accordion state to chrome.storage.local
   */
  async saveState(id, isOpen) {
    const key = `accordionState_${this.page}_${id}`;
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: isOpen }, resolve);
    });
  }

  /**
   * Load accordion state from chrome.storage.local
   */
  async loadState(id) {
    const key = `accordionState_${this.page}_${id}`;
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (data) => {
        resolve(data[key] !== undefined ? data[key] : null);
      });
    });
  }

  /**
   * Create expand/collapse all toggle button
   */
  createToggleAllButton() {
    const button = document.createElement('button');
    button.className = 'accordion-toggle-all';
    button.setAttribute('aria-label', 'Expand all sections');

    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('width', '18');
    iconSvg.setAttribute('height', '18');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'currentColor');
    iconSvg.innerHTML = AccordionIcons.chevronsDown;

    const label = document.createElement('span');
    label.textContent = 'Expand All';

    button.appendChild(iconSvg);
    button.appendChild(label);

    let isAllExpanded = false;

    button.addEventListener('click', () => {
      if (isAllExpanded) {
        this.collapseAll();
        iconSvg.innerHTML = AccordionIcons.chevronsDown;
        label.textContent = 'Expand All';
        button.setAttribute('aria-label', 'Expand all sections');
        isAllExpanded = false;
      } else {
        this.expandAll();
        iconSvg.innerHTML = AccordionIcons.chevronsUp;
        label.textContent = 'Collapse All';
        button.setAttribute('aria-label', 'Collapse all sections');
        isAllExpanded = true;
      }
    });

    return button;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AccordionManager, AccordionIcons };
}
