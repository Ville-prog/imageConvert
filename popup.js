/**
 * popup.js
 * Handles the ImageConvert extension popup. Loads the saved output format
 * from chrome.storage.sync on open, and persists any changes the user makes.
 */

const sel = document.getElementById('format');
const saved = document.getElementById('saved');

// Restore the previously saved format, defaulting to PNG
chrome.storage.sync.get(['format'], ({ format = 'png' }) => { sel.value = format; });

// Persist the new format and briefly show a confirmation message
sel.addEventListener('change', () => {
  chrome.storage.sync.set({ format: sel.value });
  saved.textContent = '✓ Saved';
  setTimeout(() => saved.textContent = '', 1500);
});
