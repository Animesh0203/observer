import sys
import onnxruntime as ort
from PIL import Image
import numpy as np
import json

model = "python/efficientnet-lite4-11.onnx"
labels_json = json.load(open("python/labels_map.txt"))
labels = [labels_json[str(i)] for i in range(len(labels_json))]

session = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

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
    right = left + out_width
    bottom = top + out_height
    return img.crop((left, top, right, bottom))

def preprocess(path):
    img = Image.open(path).convert("RGB")
    img = resize_with_aspectratio(img, 224, 224)
    img = center_crop(img, 224, 224)

    arr = np.asarray(img).astype(np.float32)

    # EfficientNet-Lite4 normalization
    arr = (arr - 127.0) / 128.0

    # NHWC
    arr = arr[np.newaxis, :, :, :]
    return arr

image_path = sys.argv[1]
inp = preprocess(image_path)

outputs = session.run([output_name], {input_name: inp})
scores = outputs[0].flatten()

top5 = scores.argsort()[-5:][::-1]
tags = [labels[i] for i in top5]

print(",".join(tags))