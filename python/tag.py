import os, sys, json, onnxruntime as ort
from PIL import Image
import numpy as np

APPDATA_DIR = os.path.join(os.getenv("LOCALAPPDATA"), "ObserverAI")
MODEL_PATH = os.path.join(APPDATA_DIR, "models", "efficientnet-lite4-11.onnx")
LABELS_PATH = os.path.join(APPDATA_DIR, "models", "labels_map.txt")

# fallback to bundled if not found
if not os.path.exists(MODEL_PATH):
    if hasattr(sys, "_MEIPASS"):
        BASE = sys._MEIPASS
    else:
        BASE = os.path.dirname(__file__)

    MODEL_PATH = os.path.join(BASE, "models", "efficientnet-lite4-11.onnx")
    LABELS_PATH = os.path.join(BASE, "models", "labels_map.txt")

def resource_path(relative_path):
    """
    Resolve file path for PyInstaller or normal execution.
    """
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath(os.path.dirname(__file__)), relative_path)

# PyInstaller-safe model/label paths
MODEL_PATH  = resource_path("efficientnet-lite4-11.onnx")
LABELS_PATH = resource_path("labels_map.txt")

# Load labels
with open(LABELS_PATH, "r", encoding="utf-8") as f:
    labels_json = json.load(f)

labels = [labels_json[str(i)] for i in range(len(labels_json))]

def available_provider():
    providers = ort.get_available_providers()
    if "DmlExecutionProvider" in providers:
        return ["DmlExecutionProvider"]
    return ["CPUExecutionProvider"]

SESSION = ort.InferenceSession(
    MODEL_PATH,
    providers=available_provider()
)

input_name = SESSION.get_inputs()[0].name
output_name = SESSION.get_outputs()[0].name

def resize_with_aspectratio(img, target_height, target_width, scale=87.5):
    width, height = img.size
    new_height = int(100 * target_height / scale)
    new_width = int(100 * target_width / scale)

    if height > width:
        w = new_width
        h = int(new_height * height / width)
    else:
        h = new_height
        w = int(new_height * width / height)

    return img.resize((w, h), Image.BILINEAR)

def center_crop(img, out_height, out_width):
    width, height = img.size
    left = (width - out_width) // 2
    top = (height - out_height) // 2
    return img.crop((left, top, left + out_width, top + out_height))

def preprocess(path):
    img = Image.open(path).convert("RGB")
    img = resize_with_aspectratio(img, 224, 224)
    img = center_crop(img, 224, 224)

    arr = np.asarray(img).astype(np.float32)
    arr = (arr - 127.0) / 128.0 
    arr = arr[np.newaxis, :, :, :]
    return arr

def predict(image_path: str):
    inp = preprocess(image_path)
    output = SESSION.run([output_name], {input_name: inp})[0].flatten()
    top5 = output.argsort()[-5:][::-1]
    return [labels[i] for i in top5]
