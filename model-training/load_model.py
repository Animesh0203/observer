import torch
import torch.nn as nn
from torchvision import models  

def load_model(num_attributes):
    model = models.mobilenet_v2(pretrained=True)

    for param in model.features.parameters():
        param.requires_grad = False

    num_features = model.classifier[1].in_features
    model.classifier[1] = nn.Sequential(
        nn.Dropout(0.2),
        nn.Linear(num_features, num_attributes),
        nn.Sigmoid()
    )

    return model