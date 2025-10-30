import torch
import torch.nn as nn

def loss():
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)

    return criterion, optimizer