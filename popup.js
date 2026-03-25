/**
 * popup.js
 * Handles the ImageConvert extension popup. Persists output format,
 * upscale method, and scale factor via chrome.storage.sync.
 *
 * @author Ville Laaksoaho
 */

const sel = document.getElementById('format');
const methodSel = document.getElementById('upscaleMethod');
const scaleSel = document.getElementById('scale');
const saved = document.getElementById('saved');

/**
 * @brief Briefly displays a confirmation message then clears it.
 */
function flashSaved() {
    saved.textContent = '✓ Saved';
    setTimeout(() => saved.textContent = '', 1500);
}

// Restore previously saved values
chrome.storage.sync.get(
    ['format', 'upscaleMethod', 'scale'],
    ({ format = 'png', upscaleMethod = 'bicubic', scale = 2 }) => {
        sel.value = format;
        methodSel.value = upscaleMethod;
        scaleSel.value = scale;
    }
);

// Persist format changes
sel.addEventListener('change', () => {
    chrome.storage.sync.set({ format: sel.value });
    flashSaved();
});

// Persist upscale method changes
methodSel.addEventListener('change', () => {
    chrome.storage.sync.set({ upscaleMethod: methodSel.value });
    flashSaved();
});

// Persist scale changes
scaleSel.addEventListener('change', () => {
    chrome.storage.sync.set({ scale: Number(scaleSel.value) });
    flashSaved();
});
