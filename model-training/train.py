import torch
import torch.nn as nn
import sys

stdout = sys.stderr

def train(model, train_loader, criterion, optimizer, val_loader):
    # Select device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\nUsing device: {device}")
    model = model.to(device)

    num_epochs = 1

    for epoch in range(num_epochs):
        print(f"\n===== Epoch {epoch+1}/{num_epochs} =====")
        model.train()
        total_loss = 0.0

        for batch_idx, (imgs, attrs) in enumerate(train_loader):
            print(f"\nBatch {batch_idx+1}/{len(train_loader)}")

            # Move data to device
            imgs, attrs = imgs.to(device), attrs.to(device).float()
            print(f"Image batch shape: {imgs.shape}")
            print(f"Attribute batch shape: {attrs.shape}")

            optimizer.zero_grad()

            # Forward pass
            outputs = model(imgs)
            print(f"Output shape: {outputs.shape}")
            print(f"Output sample (first 5 values): {outputs[0][:5].detach().cpu().numpy()}")

            # Compute loss
            loss = criterion(outputs, attrs)
            print(f"Loss (this batch): {loss.item():.6f}")

            # Backward pass and update
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

            # Print intermediate average loss
            if (batch_idx + 1) % 10 == 0 or (batch_idx + 1) == len(train_loader):
                avg_loss = total_loss / (batch_idx + 1)
                print(f"Average loss after {batch_idx+1} batches: {avg_loss:.6f}")

        # End of epoch summary
        avg_epoch_loss = total_loss / len(train_loader)
        print(f"\nEpoch {epoch+1} completed. Average training loss: {avg_epoch_loss:.6f}")

        # Validation phase
        print("\nRunning validation...")
        model.eval()
        with torch.no_grad():
            total_acc = 0.0
            batch_count = 0

            for imgs, attrs in val_loader:
                imgs, attrs = imgs.to(device), attrs.to(device).float()
                outputs = model(imgs)
                preds = (outputs > 0.5).float()
                acc = (preds == attrs).float().mean().item()

                total_acc += acc
                batch_count += 1

                print(f"Validation batch {batch_count} - Accuracy: {acc:.4f}")
                print(f"Output sample: {outputs[0][:5].detach().cpu().numpy()}")
                print(f"Prediction sample: {preds[0][:5].detach().cpu().numpy()}")

            avg_val_acc = total_acc / batch_count if batch_count > 0 else 0
            print(f"\nValidation accuracy (average): {avg_val_acc:.4f}")

    print("\nTraining complete.")
    return model
