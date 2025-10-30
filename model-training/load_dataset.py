from torchvision import datasets, transforms
form torch.utils.data import DataLoader


def load_dataset():

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])


    train_dataset = datasets.CelebA(root='data/celeba', split='train', target_type='attr', transform=transform, download=True)
    val_dataset = datasets.CelebA(root='data/celeba', split='valid', target_type='attr', transform=transform, download=True)    
    test_dataset = datasets.CelebA(root='data/celeba', split='test', target_type='attr', transform=transform, download=True)    

    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=64, shuffle=False, num_workers=4)

    return train_loader, val_loader, test_dataset


