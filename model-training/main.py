from load_dataset import load_dataset
from load_model import load_model
from loss import loss
from train import train

def save_model(model, path):
    torch.save(model.state_dict(), "./models/" + path)

if __name__ == "__main__":
    train_loader, val_loader, test_dataset = load_dataset()
    num_attributes = len(test_dataset.attr_names)
    model = load_model(num_attributes)
    criterion, optimizer = loss()
    model = train(model, train_loader, criterion, optimizer, val_loader)
    save_model(model, "celeba_mobilenetv2.pth")