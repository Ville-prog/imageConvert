
/**
 * upscale.js
 *
 * Lanczos and bicubic image upscaling algorithms for OffscreenCanvas.
 * Requires: loaded by background.js via importScripts().
 *
 * @author Ville Laaksoaho
 */

/**
 * @brief Computes the Lanczos kernel weight for a given distance.
 *
 * @param {number} x Distance from the source pixel to the sample point
 * @param {number} a Window size (number of lobes); typically 3
 * @returns {number} Kernel weight in the range [0, 1]
 */
function lanczosKernel(x, a) {
  
  if (x === 0) return 1;
  if (Math.abs(x) >= a) return 0;
  const px = Math.PI * x;
  return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
}

/**
 * @brief Resamples a raw RGBA pixel array to new dimensions using Lanczos.
 *
 * @param {Uint8ClampedArray} srcData Source pixel data in RGBA order
 * @param {number} srcW Source image width in pixels
 * @param {number} srcH Source image height in pixels
 * @param {number} dstW Target image width in pixels
 * @param {number} dstH Target image height in pixels
 * @param {number} [a=3] Lanczos window size
 * @returns {Uint8ClampedArray} Resampled pixel data in RGBA order
 */
function lanczosResize(srcData, srcW, srcH, dstW, dstH, a = 3) {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      // Position in source space that this destination pixel maps to
      const srcX = x * xRatio;
      const srcY = y * yRatio;

      let r = 0, g = 0, b = 0, alpha = 0, totalWeight = 0;

      // Sum weighted contributions from all source pixels within the kernel window
      for (let ky = Math.floor(srcY) - a + 1; ky <= Math.floor(srcY) + a; ky++) {
        for (let kx = Math.floor(srcX) - a + 1; kx <= Math.floor(srcX) + a; kx++) {

          // Clamp out-of-bounds kernel positions to the image edge
          const px = Math.min(Math.max(kx, 0), srcW - 1);
          const py = Math.min(Math.max(ky, 0), srcH - 1);

          // 2D kernel weight = product of the two 1D kernel weights
          const w = lanczosKernel(srcX - kx, a) * lanczosKernel(srcY - ky, a);
          const idx = (py * srcW + px) * 4;

          r     += srcData[idx]     * w;
          g     += srcData[idx + 1] * w;
          b     += srcData[idx + 2] * w;
          alpha += srcData[idx + 3] * w;
          totalWeight += w;
        }
      }

      // Normalise by total weight and write to output array
      const dstIdx = (y * dstW + x) * 4;
      dst[dstIdx]     = Math.round(r     / totalWeight);
      dst[dstIdx + 1] = Math.round(g     / totalWeight);
      dst[dstIdx + 2] = Math.round(b     / totalWeight);
      dst[dstIdx + 3] = Math.round(alpha / totalWeight);
    }
  }

  return dst;
}

/**
 * @brief Upscales an ImageBitmap to the given dimensions using Lanczos resampling.
 *
 * @param {ImageBitmap} bitmap Source image bitmap (will be closed after use)
 * @param {number} dstW Target width in pixels
 * @param {number} dstH Target height in pixels
 * @param {string} mime Output MIME type (e.g. 'image/png')
 * @param {number} quality Encoding quality from 0 to 1 (ignored for PNG)
 * @returns {Promise<Blob>} Encoded image blob in the requested format
 */
async function upscaleLanczos(bitmap, dstW, dstH, mime, quality) {

  // Draw the bitmap at its original size so we can read the raw pixel data
  const srcCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const srcPixels = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;

  const dstPixels = lanczosResize(srcPixels, srcCanvas.width, srcCanvas.height, dstW, dstH);

  const dstCanvas = new OffscreenCanvas(dstW, dstH);
  const dstCtx = dstCanvas.getContext('2d');

  // JPEG has no alpha channel — fill white so transparent areas don't go black
  if (mime === 'image/jpeg') {
    dstCtx.fillStyle = '#fff';
    dstCtx.fillRect(0, 0, dstW, dstH);
  }
  dstCtx.putImageData(new ImageData(dstPixels, dstW, dstH), 0, 0);

  return dstCanvas.convertToBlob({ type: mime, quality });
}

/**
 * @brief Upscales an ImageBitmap to the given dimensions using bicubic interpolation.
 *
 * @param {ImageBitmap} bitmap Source image bitmap (will be closed after use)
 * @param {number} dstW Target width in pixels
 * @param {number} dstH Target height in pixels
 * @param {string} mime Output MIME type (e.g. 'image/png')
 * @param {number} quality Encoding quality from 0 to 1 (ignored for PNG)
 * @returns {Promise<Blob>} Encoded image blob in the requested format
 */
async function upscaleBicubic(bitmap, dstW, dstH, mime, quality) {

  const canvas = new OffscreenCanvas(dstW, dstH);
  const ctx = canvas.getContext('2d');

  // Request the highest quality interpolation the browser offers
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // JPEG has no alpha channel — fill white so transparent areas don't go black
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, dstW, dstH);
  }

  ctx.drawImage(bitmap, 0, 0, dstW, dstH);
  bitmap.close();

  return canvas.convertToBlob({ type: mime, quality });
}
