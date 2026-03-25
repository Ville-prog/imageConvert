"""
server.py

Local Flask server for AI-based image upscaling using Real-ESRGAN x4plus.
The extension POSTs a base64-encoded PNG and receives a base64-encoded upscaled PNG.
Run with: python server.py

@author Ville Laaksoaho
"""

import sys
import types
import base64
import numpy as np
import cv2
from flask import Flask, request, jsonify

# basicsr references torchvision.transforms.functional_tensor which was removed
# in torchvision >= 0.16. Patch it in before basicsr is imported.
import torchvision.transforms.functional as _F
_stub = types.ModuleType('torchvision.transforms.functional_tensor')
_stub.rgb_to_grayscale = _F.rgb_to_grayscale
sys.modules['torchvision.transforms.functional_tensor'] = _stub

from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

app = Flask(__name__)

# Model is loaded once on startup
upsampler = None

def load_model():
    """Load the RealESRGAN_x4plus model. Downloads weights on first run (~64MB)."""
    model = RRDBNet(
        num_in_ch=3, num_out_ch=3,
        num_feat=64, num_block=23, num_grow_ch=32,
        scale=4
    )
    return RealESRGANer(
        scale=4,
        model_path='https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
        model=model,
        tile=400, # process in tiles to avoid running out of memory on large images
        tile_pad=10,
        pre_pad=0,
        half=False # use float32; set True if you have a CUDA GPU for faster inference
    )

@app.route('/upscale', methods=['POST'])
def upscale():
    """
    Accepts a base64-encoded PNG, upscales it 4× with Real-ESRGAN,
    and returns the result as a base64-encoded PNG.
    """
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({'error': 'Missing image field'}), 400
    scale = int(data.get('scale', 4))

    # Decode the incoming base64 PNG to a numpy array (BGR)
    img_bytes = base64.b64decode(data['image'])
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_UNCHANGED)

    if img is None:
        return jsonify({'error': 'Failed to decode image'}), 400

    # Run Real-ESRGAN
    output, _ = upsampler.enhance(img, outscale=scale)

    # Encode output back to PNG base64
    _, buffer = cv2.imencode('.png', output)
    result_b64 = base64.b64encode(buffer).decode('utf-8')

    return jsonify({'image': result_b64})

if __name__ == '__main__':
    print('Loading Real-ESRGAN model...')
    upsampler = load_model()
    print('Model ready. Server running on http://localhost:57842')
    app.run(port=57842)
