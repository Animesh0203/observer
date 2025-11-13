from load_dataset import load_dataset
from load_model import load_model
from loss import loss
from train import train
import torch

def save_model(model, path):
    torch.save(model.state_dict(), path)

if __name__ == "__main__":
    train_loader, val_loader, test_dataset = load_dataset()
    num_attributes = 40
    model = load_model(num_attributes)
    criterion, optimizer = loss(model)
    model = train(model, train_loader, criterion, optimizer, val_loader)
    save_model(model, "multiTag_MobilenetV2.pth")