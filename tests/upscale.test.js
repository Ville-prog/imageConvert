/**
 * upscale.test.js
 *
 * Unit tests for lanczosKernel and lanczosResize in upscale.js.
 * Loads the file into an isolated VM context to extract the pure functions
 * without requiring browser globals.
 */

const fs = require('fs');
const vm = require('vm');

// Load upscale.js into a sandboxed context.
// Browser-only globals used by the async functions are stubbed so the file
// parses without errors; only the pure functions are actually called.
const code = fs.readFileSync('./extension/upscale.js', 'utf-8');
const context = {
    OffscreenCanvas: class {},
    createImageBitmap: () => {},
    FileReader: class {},
    fetch: () => {},
    ImageData: class {},
    Uint8Array,
    Blob: class {},
    atob: () => {},
};
vm.runInNewContext(code, context);

const { lanczosKernel, lanczosResize } = context;

// --- lanczosKernel ---

describe('lanczosKernel', () => {
    test('returns 1 when x is 0', () => {
        expect(lanczosKernel(0, 3)).toBe(1);
    });

    test('returns 0 when x equals window size a', () => {
        expect(lanczosKernel(3, 3)).toBe(0);
    });

    test('returns 0 when x exceeds window size a', () => {
        expect(lanczosKernel(4, 3)).toBe(0);
        expect(lanczosKernel(-5, 3)).toBe(0);
    });

    test('returns a value between -1 and 1 for values inside the window', () => {
        const w = lanczosKernel(1.5, 3);
        expect(w).toBeGreaterThan(-1);
        expect(w).toBeLessThan(1);
    });

    test('is symmetric: kernel(-x, a) === kernel(x, a)', () => {
        expect(lanczosKernel(-1, 3)).toBeCloseTo(lanczosKernel(1, 3));
        expect(lanczosKernel(-2, 3)).toBeCloseTo(lanczosKernel(2, 3));
    });
});

// --- lanczosResize ---

describe('lanczosResize', () => {
    // Helper: create a solid-colour RGBA pixel array
    function solidImage(w, h, r, g, b, a = 255) {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) {
            data[i * 4]     = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = a;
        }
        return data;
    }

    test('output array has correct length', () => {
        const src = solidImage(4, 4, 128, 64, 32);
        const dst = lanczosResize(src, 4, 4, 8, 8);
        expect(dst.length).toBe(8 * 8 * 4);
    });

    test('all output pixel values are in the range [0, 255]', () => {
        const src = solidImage(4, 4, 200, 100, 50);
        const dst = lanczosResize(src, 4, 4, 8, 8);
        for (const v of dst) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(255);
        }
    });

    test('upscaling a solid colour image preserves the colour', () => {
        const src = solidImage(2, 2, 255, 0, 128);
        const dst = lanczosResize(src, 2, 2, 4, 4);
        // Centre pixels should be close to the source colour
        const cx = 2, cy = 2;
        const idx = (cy * 4 + cx) * 4;
        expect(dst[idx]).toBeCloseTo(255, -1);
        expect(dst[idx + 1]).toBeCloseTo(0, -1);
        expect(dst[idx + 2]).toBeCloseTo(128, -1);
    });

    test('1×1 source upscaled to 2×2 fills all pixels', () => {
        const src = solidImage(1, 1, 42, 84, 168);
        const dst = lanczosResize(src, 1, 1, 2, 2);
        expect(dst.length).toBe(2 * 2 * 4);
        for (let i = 0; i < 4; i++) {
            expect(dst[i * 4]).toBeCloseTo(42, -1);
        }
    });

    test('downscaling produces output of correct size', () => {
        const src = solidImage(8, 8, 10, 20, 30);
        const dst = lanczosResize(src, 8, 8, 4, 4);
        expect(dst.length).toBe(4 * 4 * 4);
    });
});
