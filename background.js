importScripts('bible-books.js');

const DEFAULT_BLOCKED_SITES = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'youtube.com',
  'tiktok.com',
  'reddit.com',
  'snapchat.com',
  'threads.net',
  'linkedin.com'
];

// ---- Blocking Rules ----

async function enableBlocking() {
  const { blockedSites } = await chrome.storage.local.get('blockedSites');
  const sites = blockedSites || DEFAULT_BLOCKED_SITES;

  // Clear existing dynamic rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  const addRules = sites.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: '/blocked.html' }
    },
    condition: {
      requestDomains: [domain],
      resourceTypes: ['main_frame']
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: addRules
  });
}

async function disableBlocking() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  if (removeIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
  }
}

// ---- Date Helpers ----

function getTodayString() {
  // Use local date so "today" matches the user's timezone
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ---- Core Logic ----

async function checkAndUpdateBlocking() {
  const { lastReadDate, needsBookSelection } = await chrome.storage.local.get([
    'lastReadDate',
    'needsBookSelection'
  ]);

  const today = getTodayString();

  if (lastReadDate === today) {
    // Already read today — sites are unblocked
    await disableBlocking();
  } else {
    // New day or never read — block sites
    await enableBlocking();
  }
}

async function handleMarkAsRead() {
  const today = getTodayString();
  const { currentBook, currentChapter } = await chrome.storage.local.get([
    'currentBook',
    'currentChapter'
  ]);

  const bookInfo = BIBLE_BOOKS.find(b => b.name === currentBook);
  const maxChapters = bookInfo ? bookInfo.chapters : 999;
  const nextChapter = (currentChapter || 1) + 1;

  if (nextChapter > maxChapters) {
    // Finished the book — prompt to pick a new one tomorrow
    await chrome.storage.local.set({
      lastReadDate: today,
      needsBookSelection: true,
      currentChapter: 1,
      currentBook: null
    });
  } else {
    await chrome.storage.local.set({
      lastReadDate: today,
      currentChapter: nextChapter
    });
  }

  await disableBlocking();
}

// ---- Message Handlers ----

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.action) {
    case 'markAsRead':
      handleMarkAsRead().then(() => sendResponse({ success: true }));
      return true; // async

    case 'getState':
      chrome.storage.local.get(null).then(state => sendResponse(state));
      return true;

    case 'bookSelected':
      // Rules already active; nothing extra needed
      sendResponse({ success: true });
      break;

    case 'sitesUpdated':
      checkAndUpdateBlocking().then(() => sendResponse({ success: true }));
      return true;

    default:
      sendResponse({ error: 'unknown action' });
  }
});

// ---- Lifecycle ----

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      blockedSites: DEFAULT_BLOCKED_SITES,
      needsBookSelection: true,
      currentBook: null,
      currentChapter: 1,
      lastReadDate: null,
      darkMode: false
    });
  }
  await checkAndUpdateBlocking();
});

chrome.runtime.onStartup.addListener(async () => {
  await checkAndUpdateBlocking();
});

// Periodic check to catch the midnight rollover
chrome.alarms.create('dayCheck', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dayCheck') {
    await checkAndUpdateBlocking();
  }
});

// ---- Fallback: tabs.onUpdated catch-all ----
// declarativeNetRequest can miss certain domains; this catches anything that slips through.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  try {
    const url = new URL(changeInfo.url);
    if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:') return;

    chrome.storage.local.get(['lastReadDate', 'blockedSites']).then(({ lastReadDate, blockedSites }) => {
      if (lastReadDate === getTodayString()) return;

      const sites = blockedSites || DEFAULT_BLOCKED_SITES;
      const hostname = url.hostname;
      const isBlocked = sites.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (isBlocked) {
        chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
      }
    });
  } catch (e) {
    // invalid URL, ignore
  }
});

// Also handle the toolbar icon click — open blocked.html directly
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('blocked.html') });
});
