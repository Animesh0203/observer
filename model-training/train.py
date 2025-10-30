import torch
import torch.nn as nn

def train(model, train_loader, criterion, optimizer, val_loader):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    for epoch in range(20):  # increase for full training
        model.train()
        total_loss = 0.0

        for imgs, attrs in train_loader:
            imgs, attrs = imgs.to(device), attrs.to(device).float()

            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, attrs)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        print(f"Epoch [{epoch+1}/5] - Loss: {total_loss/len(train_loader):.4f}")


    model.eval()
    with torch.no_grad():
        for imgs, attrs in val_loader:
            imgs, attrs = imgs.to(device), attrs.to(device).float()
            outputs = model(imgs)
            preds = (outputs > 0.5).float()
            acc = (preds == attrs).float().mean()
            print(f"Validation accuracy: {acc:.4f}")
            break

    return model
