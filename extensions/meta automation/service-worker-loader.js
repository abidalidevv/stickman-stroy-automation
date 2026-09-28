import './assets/index.ts-BqblPwcc.js';

const openSidePanelTab = async (retries = 0) => {
  try {
    const url = chrome.runtime.getURL('src/ui/side-panel/index.html');
    if (typeof chrome.windows !== 'undefined') {
      const windows = await chrome.windows.getAll();
      if (!windows || windows.length === 0) {
        if (retries < 15) setTimeout(() => openSidePanelTab(retries + 1), 1000);
        return;
      }
    }
    const existing = await chrome.tabs.query({ url });
    if (existing.length === 0) {
      await chrome.tabs.create({ url, active: false });
      console.log('[ServiceWorker] Opened background side-panel bridge tab:', url);
    }
  } catch (e) {
    if (retries < 15) setTimeout(() => openSidePanelTab(retries + 1), 1000);
  }
};

chrome.runtime.onStartup.addListener(() => openSidePanelTab(0));
chrome.runtime.onInstalled.addListener(() => openSidePanelTab(0));
if (typeof chrome.windows !== 'undefined' && chrome.windows.onCreated) {
  chrome.windows.onCreated.addListener(() => openSidePanelTab(0));
}
openSidePanelTab(0);
