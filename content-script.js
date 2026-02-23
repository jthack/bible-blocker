/* Runs at document_start on all http/https pages.
   If the domain is blocked and the user hasn't read today, redirect to blocked.html. */
(async () => {
  const hostname = window.location.hostname;

  const DEFAULT_SITES = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
    'youtube.com', 'tiktok.com', 'reddit.com', 'snapchat.com',
    'threads.net', 'linkedin.com'
  ];

  try {
    const { lastReadDate, blockedSites } = await chrome.storage.local.get([
      'lastReadDate', 'blockedSites'
    ]);

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (lastReadDate === today) return;

    const sites = blockedSites || DEFAULT_SITES;
    const isBlocked = sites.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (isBlocked) {
      window.location.replace(chrome.runtime.getURL('blocked.html'));
    }
  } catch (e) {
    // Extension context invalidated or storage error — ignore
  }
})();
