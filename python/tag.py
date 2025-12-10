import os, sys, json, onnxruntime as ort
from PIL import Image
import numpy as np

BASE = os.path.dirname(__file__)

MODEL_PATH = os.path.join(BASE, "efficientnet-lite4-11.onnx")
LABELS_PATH = os.path.join(BASE, "labels_map.txt")

if not os.path.exists(MODEL_PATH):
    ALT_BASE = os.path.dirname(BASE)
    ALT_MODEL_PATH = os.path.join(ALT_BASE, "efficientnet-lite4-11.onnx")
    ALT_LABELS_PATH = os.path.join(ALT_BASE, "labels_map.txt")

    if os.path.exists(ALT_MODEL_PATH):
        MODEL_PATH = ALT_MODEL_PATH
        LABELS_PATH = ALT_LABELS_PATH


# load labels once
labels_json = json.load(open(LABELS_PATH))
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
