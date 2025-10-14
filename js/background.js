// Background service worker for OG Card Generator
// Monitors tab URL changes and pre-loads cached cards from history

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only act when page is fully loaded
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Skip chrome:// and extension URLs
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }

  // Check if this URL exists in card history
  chrome.storage.local.get(['cardHistory'], (data) => {
    const history = data.cardHistory || [];
    const matchIndex = history.findIndex(card => card.url === tab.url);

    if (matchIndex !== -1) {
      // Pre-load card for instant display (preserve original timestamp)
      chrome.storage.local.set({
        lastCard: history[matchIndex]
      });
      // Note: Do NOT update history or timestamp - preserve original creation time for freshness indicator

      // TODO: Check if auto-refresh is enabled (Phase 2 enhancement)
      // chrome.storage.sync.get(['autoRefreshCached'], (settings) => {
      //   if (settings.autoRefreshCached) {
      //     // Trigger background fetch to update card
      //   }
      // });
    }
  });
});
