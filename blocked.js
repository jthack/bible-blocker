/* global BIBLE_BOOKS, chrome */

(function () {
  'use strict';

  // ---- ESV API ----
  const ESV_API_TOKEN = 'YOUR_API_KEY_HERE';
  const ESV_API_BASE  = 'https://api.esv.org/v3/passage/html/';

  // ---- State ----
  let currentBook = null;
  let currentChapter = 1;

  // ---- DOM refs ----
  const bookPickerView  = document.getElementById('book-picker');
  const readingView     = document.getElementById('reading-view');
  const successView     = document.getElementById('success-view');
  const otBooksGrid     = document.getElementById('ot-books');
  const ntBooksGrid     = document.getElementById('nt-books');
  const chapterRef      = document.getElementById('chapter-reference');
  const chapterContent  = document.getElementById('chapter-content');
  const progressLabel   = document.getElementById('progress');
  const readBtn         = document.getElementById('read-btn');
  const switchBookBtn   = document.getElementById('switch-book-btn');
  const prevChapterBtn  = document.getElementById('prev-chapter-btn');
  const nextChapterBtn  = document.getElementById('next-chapter-btn');
  const themeToggle     = document.getElementById('theme-toggle');
  const settingsLink    = document.getElementById('settings-link');

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', async () => {
    const state = await chrome.storage.local.get([
      'currentBook', 'currentChapter', 'lastReadDate',
      'needsBookSelection', 'darkMode'
    ]);

    // Apply saved theme
    if (state.darkMode) {
      document.body.classList.add('dark');
    }

    // Check if already read today — show success
    const today = getTodayString();
    if (state.lastReadDate === today) {
      showView('success');
      return;
    }

    // Need to pick a book?
    if (state.needsBookSelection || !state.currentBook) {
      showBookPicker();
    } else {
      currentBook = state.currentBook;
      currentChapter = state.currentChapter || 1;
      showReadingView();
    }
  });

  // ---- Helpers ----

  function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function showView(name) {
    bookPickerView.classList.add('hidden');
    readingView.classList.add('hidden');
    successView.classList.add('hidden');

    if (name === 'picker')  bookPickerView.classList.remove('hidden');
    if (name === 'reading') readingView.classList.remove('hidden');
    if (name === 'success') successView.classList.remove('hidden');
  }

  // ---- Book Picker ----

  function showBookPicker() {
    showView('picker');
    renderBookGrid(otBooksGrid, BIBLE_BOOKS.filter(b => b.testament === 'OT'));
    renderBookGrid(ntBooksGrid, BIBLE_BOOKS.filter(b => b.testament === 'NT'));
  }

  function renderBookGrid(container, books) {
    container.innerHTML = '';
    books.forEach(book => {
      const btn = document.createElement('button');
      btn.className = 'book-card';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = book.name;

      const countSpan = document.createElement('span');
      countSpan.className = 'chapter-count';
      countSpan.textContent = book.chapters === 1
        ? '1 chapter'
        : `${book.chapters} chapters`;

      btn.appendChild(nameSpan);
      btn.appendChild(countSpan);
      btn.addEventListener('click', () => selectBook(book.name));
      container.appendChild(btn);
    });
  }

  async function selectBook(bookName) {
    currentBook = bookName;
    currentChapter = 1;

    await chrome.storage.local.set({
      currentBook: bookName,
      currentChapter: 1,
      needsBookSelection: false
    });

    chrome.runtime.sendMessage({ action: 'bookSelected' });
    showReadingView();
  }

  // ---- Reading View ----

  function getMaxChapters() {
    const bookInfo = BIBLE_BOOKS.find(b => b.name === currentBook);
    return bookInfo ? bookInfo.chapters : 1;
  }

  function updateNavButtons() {
    const max = getMaxChapters();
    prevChapterBtn.disabled = currentChapter <= 1;
    nextChapterBtn.disabled = currentChapter >= max;
  }

  async function showReadingView() {
    showView('reading');

    const total = getMaxChapters();

    chapterRef.textContent = `${currentBook} ${currentChapter}`;
    progressLabel.textContent = `Chapter ${currentChapter} of ${total}`;
    updateNavButtons();

    await loadChapter(currentBook, currentChapter);
  }

  async function navigateToChapter(chapter) {
    currentChapter = chapter;

    // Save position so "I Read It" uses whatever chapter you're viewing
    await chrome.storage.local.set({ currentChapter: chapter });

    chapterRef.textContent = `${currentBook} ${currentChapter}`;
    progressLabel.textContent = `Chapter ${currentChapter} of ${getMaxChapters()}`;
    updateNavButtons();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    await loadChapter(currentBook, currentChapter);
  }

  async function loadChapter(book, chapter) {
    // Show loading
    chapterContent.innerHTML =
      '<div class="loading-spinner"><div class="spinner"></div><p>Loading chapter...</p></div>';

    // Check local cache first
    const cacheKey = `cache_${book}_${chapter}`;
    const cached = await chrome.storage.local.get(cacheKey);

    if (cached[cacheKey]) {
      chapterContent.innerHTML = cached[cacheKey];
      return;
    }

    // Fetch from ESV API (HTML endpoint)
    try {
      const query = encodeURIComponent(`${book} ${chapter}`);
      const params = new URLSearchParams({
        q: `${book} ${chapter}`,
        'include-passage-references': 'false',
        'include-verse-numbers': 'true',
        'include-footnotes': 'false',
        'include-headings': 'true',
        'include-short-copyright': 'true',
        'include-css-link': 'false'
      });

      const res = await fetch(`${ESV_API_BASE}?${params}`, {
        headers: { 'Authorization': `Token ${ESV_API_TOKEN}` }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const html = (data.passages && data.passages[0]) || '';

      if (!html) throw new Error('Empty passage');

      // Cache the rendered HTML
      await chrome.storage.local.set({ [cacheKey]: html });

      chapterContent.innerHTML = html;
    } catch (err) {
      chapterContent.innerHTML = '';

      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';

      const msg = document.createElement('p');
      msg.textContent = 'Could not load chapter. Please check your internet connection.';

      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-btn';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => loadChapter(book, chapter));

      errorDiv.appendChild(msg);
      errorDiv.appendChild(retryBtn);
      chapterContent.appendChild(errorDiv);
    }
  }

  // ---- "I Read It" ----
  readBtn.addEventListener('click', async () => {
    readBtn.disabled = true;
    readBtn.textContent = 'Saving...';

    try {
      await chrome.runtime.sendMessage({ action: 'markAsRead' });
      showView('success');
    } catch (err) {
      readBtn.disabled = false;
      readBtn.textContent = 'I Read It';
    }
  });

  // ---- Chapter Navigation ----
  prevChapterBtn.addEventListener('click', () => {
    if (currentChapter > 1) navigateToChapter(currentChapter - 1);
  });

  nextChapterBtn.addEventListener('click', () => {
    if (currentChapter < getMaxChapters()) navigateToChapter(currentChapter + 1);
  });

  // ---- Switch Book ----
  switchBookBtn.addEventListener('click', () => showBookPicker());

  // ---- Theme Toggle ----
  themeToggle.addEventListener('click', async () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    await chrome.storage.local.set({ darkMode: isDark });
  });

  // ---- Settings ----
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

})();
