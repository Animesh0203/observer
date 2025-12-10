from PIL import Image
import imagehash

def phash_image(image_path: str) -> str:
    """Compute the perceptual hash of an image."""
    img = Image.open(image_path)
    phash = imagehash.phash(img)
    return str(phash)

def phash_to_64d_vector(phash_str: str) -> list:
    """Convert a perceptual hash string to a 64-dimensional vector."""
    hash_int = int(phash_str, 16)
    vector = [(hash_int >> i) & 1 for i in range(64)]
    return vector