"""
test_server.py

pytest tests for the Flask server in server.py.
All heavy dependencies (basicsr, realesrgan, torch, torchvision) are mocked
so the tests run without a GPU or model weights.
"""

import sys
import os
import types
import base64
from unittest.mock import MagicMock, patch
import numpy as np
import cv2
import pytest

# Add server/ to path so 'import server' resolves correctly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))

# Mock all heavy imports before server.py is loaded.
# This prevents basicsr/realesrgan/torch from being imported at all.
_MOCKED = [
    'torch', 'torchvision', 'torchvision.transforms',
    'torchvision.transforms.functional',
    'basicsr', 'basicsr.archs', 'basicsr.archs.rrdbnet_arch',
    'realesrgan',
]
for mod in _MOCKED:
    sys.modules.setdefault(mod, MagicMock())

import server as srv


def make_png(width=4, height=4):
    """Return a base64-encoded PNG of a solid green image."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = (0, 200, 0)  # solid green in BGR
    _, buf = cv2.imencode('.png', img)
    return base64.b64encode(buf).decode('utf-8')


@pytest.fixture
def client():
    """Flask test client with testing mode enabled."""
    srv.app.config['TESTING'] = True
    with srv.app.test_client() as c:
        yield c


@pytest.fixture(autouse=True)
def mock_upsampler():
    """
    Replace the global upsampler with a mock that returns a blank 4×4 image.
    Resets to None after each test.
    """
    mock = MagicMock()
    mock.enhance.return_value = (np.zeros((4, 4, 3), dtype=np.uint8), None)
    srv.upsampler = mock
    yield mock
    srv.upsampler = None


# --- /upscale endpoint ---

class TestUpscaleEndpoint:
    def test_missing_body_returns_400(self, client):
        res = client.post('/upscale', content_type='application/json')
        assert res.status_code == 400

    def test_missing_image_field_returns_400(self, client):
        res = client.post('/upscale', json={'scale': 2})
        assert res.status_code == 400

    def test_valid_image_returns_200(self, client):
        res = client.post('/upscale', json={'image': make_png(), 'scale': 2})
        assert res.status_code == 200

    def test_response_contains_image_field(self, client):
        res = client.post('/upscale', json={'image': make_png(), 'scale': 2})
        data = res.get_json()
        assert 'image' in data

    def test_response_image_is_valid_base64(self, client):
        res = client.post('/upscale', json={'image': make_png(), 'scale': 2})
        data = res.get_json()
        # Should not raise
        decoded = base64.b64decode(data['image'])
        assert len(decoded) > 0

    def test_scale_is_passed_to_enhance(self, client, mock_upsampler):
        client.post('/upscale', json={'image': make_png(), 'scale': 3})
        mock_upsampler.enhance.assert_called_once()
        _, kwargs = mock_upsampler.enhance.call_args
        assert kwargs.get('outscale') == 3

    def test_default_scale_is_4(self, client, mock_upsampler):
        client.post('/upscale', json={'image': make_png()})
        _, kwargs = mock_upsampler.enhance.call_args
        assert kwargs.get('outscale') == 4

    def test_invalid_base64_returns_400(self, client):
        res = client.post('/upscale', json={'image': 'not-valid-base64!!!'})
        assert res.status_code == 400
