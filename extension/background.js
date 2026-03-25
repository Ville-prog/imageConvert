/**
 * background.js
 *
 * Service worker for ImageConvert. Registers context menu items and handles
 * image fetching, conversion, and download on menu click.
 * Requires: upscale.js (loaded via importScripts).
 *
 * @author Ville Laaksoaho
 */

importScripts('upscale.js');

// Supported output formats with their MIME type and file extension
const mimeMap = {
    jpeg: { mime: 'image/jpeg', ext: 'jpg' },
    png:  { mime: 'image/png',  ext: 'png' },
    webp: { mime: 'image/webp', ext: 'webp' }
};

chrome.runtime.onInstalled.addListener(() => {
    // Regular download
    chrome.contextMenus.create({
        id: 'imageConvert', title: 'ImageConvert: Save image', contexts: ['image']
    });

    // Upscaled download (scale and method set in popup)
    chrome.contextMenus.create({
        id: 'imageConvertUpscale', title: 'ImageConvert: Save image (upscaled)', contexts: ['image']
    });

    // Set default format, quality, scale and upscale method if not already saved
    chrome.storage.sync.get(['format', 'quality', 'scale', 'upscaleMethod'], (data) => {
        if (!data.format) {
            chrome.storage.sync.set({ format: 'png', quality: 92, scale: 2, upscaleMethod: 'bicubic' });
        }
    });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
    const isUpscale = info.menuItemId === 'imageConvertUpscale';
    if (info.menuItemId !== 'imageConvert' && !isUpscale) return;
    if (!info.srcUrl) return;

    // Load user preferences
    const { format = 'png', quality = 92, scale = 2, upscaleMethod = 'bicubic' } =
        await chrome.storage.sync.get(['format', 'quality', 'scale', 'upscaleMethod']);
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

        const bitmap = await createImageBitmap(blob);
        const factor = isUpscale ? scale : 1;
        const dstW = bitmap.width * factor;
        const dstH = bitmap.height * factor;

        let outBlob;
        if (isUpscale && upscaleMethod === 'ai') {
            outBlob = await upscaleAI(bitmap, scale, fmt.mime, quality / 100);
        } else if (isUpscale && upscaleMethod === 'lanczos') {
            outBlob = await upscaleLanczos(bitmap, dstW, dstH, fmt.mime, quality / 100);
        } else {
            outBlob = await upscaleBicubic(bitmap, dstW, dstH, fmt.mime, quality / 100);
        }

        // Encode to data URL and trigger a download
        const reader = new FileReader();
        const dataUrl = await new Promise(r => {
            reader.onload = () => r(reader.result);
            reader.readAsDataURL(outBlob);
        });

        chrome.downloads.download({ url: dataUrl, filename, saveAs: true });

    } catch (err) {
        console.error('ImageConvert:', err);
    }
});
