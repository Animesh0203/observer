from torchvision import datasets, transforms
from torch.utils.data import DataLoader

def load_dataset():
    root = 'data'   # ✅ not '/data/celeba'

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225])
    ])

    # Load CelebA dataset
    train_dataset = datasets.CelebA(root=root, split='train', target_type='attr',
                                    transform=transform, download=False)
    val_dataset = datasets.CelebA(root=root, split='valid', target_type='attr',
                                  transform=transform, download=False)
    test_dataset = datasets.CelebA(root=root, split='test', target_type='attr',
                                   transform=transform, download=False)

    train_loader = DataLoader(train_dataset, batch_size=4, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=4, shuffle=False, num_workers=4)
    test_loader = DataLoader(test_dataset, batch_size=4, shuffle=False, num_workers=4)

    print(f"Train: {len(train_dataset)} | Val: {len(val_dataset)} | Test: {len(test_dataset)}")

    return train_loader, val_loader, test_loader
