import onnxruntime as ort
from PIL import Image
import numpy as np
import json
import os

# ----------------------------------------
# MODEL + LABEL LOADING (only once)
# ----------------------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), "Python/Python/efficientnet-lite4-11.onnx")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "Python/Python/labels_map.txt")

# load labels once
labels_json = json.load(open(LABELS_PATH))
labels = [labels_json[str(i)] for i in range(len(labels_json))]

# ----------------------------------------
# PROVIDER SELECTION (GPU -> CPU fallback)
# ----------------------------------------

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

# ----------------------------------------
# IMAGE PREPROCESSING
# ----------------------------------------

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
    arr = (arr - 127.0) / 128.0  # EfficientNet-lite normalization
    arr = arr[np.newaxis, :, :, :]
    return arr

# ----------------------------------------
# MAIN PREDICT FUNCTION (called by Go)
# ----------------------------------------

def predict(image_path: str):
    inp = preprocess(image_path)
    output = SESSION.run([output_name], {input_name: inp})[0].flatten()

    top5 = output.argsort()[-5:][::-1]
    return [labels[i] for i in top5]
