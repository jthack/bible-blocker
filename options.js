/* global chrome */

(function () {
  'use strict';

  const DEFAULT_SITES = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
    'youtube.com', 'tiktok.com', 'reddit.com', 'snapchat.com',
    'threads.net', 'linkedin.com'
  ];

  const siteList      = document.getElementById('site-list');
  const newSiteInput  = document.getElementById('new-site-input');
  const addSiteBtn    = document.getElementById('add-site-btn');
  const resetBtn      = document.getElementById('reset-btn');
  const statusText    = document.getElementById('current-status');
  const themeToggle   = document.getElementById('theme-toggle');

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', async () => {
    const state = await chrome.storage.local.get([
      'blockedSites', 'currentBook', 'currentChapter', 'darkMode'
    ]);

    if (state.darkMode) document.body.classList.add('dark');

    const sites = state.blockedSites || DEFAULT_SITES;
    renderSiteList(sites);

    if (state.currentBook) {
      statusText.textContent = `Currently reading: ${state.currentBook}, Chapter ${state.currentChapter || 1}`;
    } else {
      statusText.textContent = 'No book selected yet.';
    }
  });

  // ---- Render Sites ----
  function renderSiteList(sites) {
    siteList.innerHTML = '';
    sites.forEach(site => {
      const li = document.createElement('li');
      li.className = 'site-item';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = site;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeSite(site));

      li.appendChild(nameSpan);
      li.appendChild(removeBtn);
      siteList.appendChild(li);
    });
  }

  // ---- Add Site ----
  async function addSite() {
    const raw = newSiteInput.value.trim().toLowerCase();
    if (!raw) return;

    // Strip protocol and trailing slash
    const site = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');

    if (!site.includes('.')) {
      alert('Please enter a valid domain (e.g., example.com)');
      return;
    }

    const { blockedSites } = await chrome.storage.local.get('blockedSites');
    const current = blockedSites || [...DEFAULT_SITES];

    if (current.includes(site)) {
      newSiteInput.value = '';
      return;
    }

    current.push(site);
    await chrome.storage.local.set({ blockedSites: current });
    renderSiteList(current);
    chrome.runtime.sendMessage({ action: 'sitesUpdated' });
    newSiteInput.value = '';
  }

  addSiteBtn.addEventListener('click', addSite);
  newSiteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSite();
  });

  // ---- Remove Site ----
  async function removeSite(site) {
    const { blockedSites } = await chrome.storage.local.get('blockedSites');
    const updated = (blockedSites || []).filter(s => s !== site);
    await chrome.storage.local.set({ blockedSites: updated });
    renderSiteList(updated);
    chrome.runtime.sendMessage({ action: 'sitesUpdated' });
  }

  // ---- Reset Progress ----
  resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset all reading progress? You will need to pick a new book.')) return;

    await chrome.storage.local.set({
      needsBookSelection: true,
      currentBook: null,
      currentChapter: 1,
      lastReadDate: null
    });

    chrome.runtime.sendMessage({ action: 'sitesUpdated' });
    statusText.textContent = 'Progress reset. Pick a new book on your next blocked visit.';
  });

  // ---- Theme Toggle ----
  themeToggle.addEventListener('click', async () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    await chrome.storage.local.set({ darkMode: isDark });
  });

})();
