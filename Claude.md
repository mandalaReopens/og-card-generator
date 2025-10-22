# OG Card Generator - Project Overview

## What is this?
A Chrome/Chromium extension that fetches Open Graph metadata from websites and transforms it into beautifully formatted preview cards for email sharing.

## Tech Stack
- Manifest V3 Chrome Extension
- Vanilla JavaScript (no frameworks)
- CSS Grid & Flexbox
- Coloris (color picker)
- Tabler Icons
- Chrome Storage API

## Project Structure

```
og-card-generator/
├── css/
│   ├── coloris.min.css
│   └── styles.css
├── js/
│   ├── main.js              # Core: OG fetching, card rendering, brand cards
│   ├── background.js        # Service worker for tab monitoring
│   ├── formatting.js        # Settings: appearance customization
│   ├── advanced.js          # Settings: advanced configs
│   ├── about.js, help.js, credits.js
│   ├── accordion.js
│   └── coloris.min.js
├── images/
│   ├── screenshots/
│   └── icon.png
├── main.html               # Primary popup interface
├── formatting.html         # Formatting settings
├── advanced.html           # Advanced settings
├── help.html, about.html, credits.html
├── manifest.json
└── README.md
```

## Key Files
- **manifest.json** - Extension configuration
- **main.html / js/main.js** - Primary UI and core logic (includes favicon brand cards)
- **js/background.js** - Tab monitoring service worker
- **js/formatting.js** - Appearance settings
- **js/advanced.js** - Advanced settings
- **css/styles.css** - All styles

## Key Features
1. Intelligent image selection with scoring algorithm
2. **Favicon Brand Cards** - Universal brand cards using Google's favicon API with automatic color detection
3. Extensive customization (colors, fonts, borders)
4. Card history with persistence
5. Multiple export formats (Email, Chat, PNG, HTML)
6. Settings management (save color schemes, font pairings)
7. Debug mode

## Version
Current: 3.2.0

## Repository
https://github.com/mandalaReopens/og-card-generator

## Favicon Brand Cards (NEW)

### What is it?
When Smart Image Selection is enabled, users can optionally skip page scanning and create brand cards using the site's favicon instead. This provides a clean, branded alternative to domain cards.

### How it works:
1. **Universal Favicon API** - Uses Google's favicon service (`https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://{domain}&size=256`)
2. **Color Analysis** - Automatically detects the brand's background color by sampling favicon edge pixels
3. **Canvas Generation** - Creates a 1200x630 canvas with:
   - Brand color fills entire canvas
   - Centered favicon scaled proportionally (65% of canvas)
   - Thin white border (18px lineWidth to survive crop)
4. **Template Integration** - Returns PNG blob that flows through normal card generation pipeline (cropToThumbnail → card template)

### Architecture:
- **fetchFavicon()** in main.js - Fetches favicon from Google's API as base64
- **analyzeFaviconColor()** in main.js - Samples 8 edge positions to detect brand color
- **generateFaviconBrandCard()** in main.js - Creates canvas with favicon and brand color
- **UI Toggle** - "Create Brand Card" checkbox under Smart Image Selection (OFF by default)

### UX Flow (4 Modes):
1. **Default (Smart Select OFF)** - Use OG:image, show placeholder if missing
2. **Smart Select ON + Brand Cards OFF** - Scan page for best image using scoring algorithm
3. **Smart Select ON + Brand Cards ON** - Skip page scanning, use favicon brand card
4. **Developer Override** - Force domain card (advanced setting)

### Key Functions:
- **main.js:2169-2190** - `fetchFavicon()` - Fetches from Google API
- **main.js:2193-2281** - `analyzeFaviconColor()` - Edge pixel sampling for brand color
- **main.js:2283-2370** - `generateFaviconBrandCard()` - Canvas generation with proportional scaling

### Testing:
- Enable Smart Image Selection toggle
- Check "Create Brand Card" checkbox
- Visit any website (e.g., google.com, github.com)
- Extension should generate card with site's favicon on brand-colored background

## Notes
- Uses vanilla JavaScript throughout
- No build process required
- Lightweight and maintainable
- Favicon brand cards work with any website (universal approach via Google's favicon API)
