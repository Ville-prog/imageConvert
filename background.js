/**
 * background.js
 * Service worker for the app. Registers the right-click context menu,
 * initializes default storage values, and handles image conversion and download
 * when the menu item is clicked.
 */

// Supported output formats with their MIME type and file extension
const mimeMap = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png:  { mime: 'image/png',  ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' }
};

chrome.runtime.onInstalled.addListener(() => {
  // Add "ImageConvert: Save image" to the right-click menu on images
  chrome.contextMenus.create({
    id: 'imageConvert', title: 'ImageConvert: Save image', contexts: ['image']
  });

  // Set default format and quality if not already saved
  chrome.storage.sync.get(['format', 'quality'], (data) => {
    if (!data.format) chrome.storage.sync.set({ format: 'png', quality: 92 });
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'imageConvert' || !info.srcUrl) return;

  // Load user preferences
  const { format = 'png', quality = 92 } =
    await chrome.storage.sync.get(['format', 'quality']);
  const fmt = mimeMap[format];

  // Derive a clean filename from the source URL
  const srcName = info.srcUrl.split('/').pop().split('?')[0]
    .replace(/\.[^/.]+$/, '') || 'image';
  const filename = srcName + '.' + fmt.ext;

  try {
    // Fetch the original image
    const response = await fetch(info.srcUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    // Draw onto an OffscreenCanvas for format conversion
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');

    // Fill white background for JPEG (no transparency support)
    if (fmt.mime === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, bitmap.width, bitmap.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // Encode to the target format and trigger a download
    const outBlob = await canvas.convertToBlob({ type: fmt.mime, quality: quality / 100 });
    const reader = new FileReader();
    const dataUrl = await new Promise(r => {
      reader.onload = () => r(reader.result);
      reader.readAsDataURL(outBlob);
    });

    chrome.downloads.download({ url: dataUrl, filename, saveAs: true });

  } catch(err) {
    console.error('ImageConvert:', err);
  }
});
