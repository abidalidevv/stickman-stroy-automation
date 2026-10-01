import './assets/index.ts-BNvXgTH3.js';

// Configure Chrome Side Panel Drawer behavior (Native side drawer, NO separate tab!)
const setupSidePanel = async () => {
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (e) {
    console.warn('[ServiceWorker] setPanelBehavior error:', e);
  }
};

chrome.runtime.onStartup.addListener(setupSidePanel);
chrome.runtime.onInstalled.addListener(setupSidePanel);
setupSidePanel();

// Automatically open the native side panel drawer when a new window is created
if (typeof chrome.windows !== 'undefined' && chrome.windows.onCreated) {
  chrome.windows.onCreated.addListener(async (win) => {
    try {
      if (chrome.sidePanel && chrome.sidePanel.open && win && win.id) {
        setTimeout(async () => {
          try {
            await chrome.sidePanel.open({ windowId: win.id });
          } catch (err) {}
        }, 1200);
      }
    } catch (e) {}
  });
}
