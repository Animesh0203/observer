import os
from phash import phash_image, phash_to_64d_vector
from tag import predict
from faiss_engine import FaissEngine

engine = FaissEngine()

def handle_action(action: str, image_path: str | None) -> dict:

    if action == "close":
        engine._save()
        return {"message": "Worker shutting down"}

    if action == "health_check":
        return {"message": "healthy"}

    if not image_path or not os.path.exists(image_path):
        return {"error": "Image not found"}

    if action == "add_image":
        tags = predict(image_path)

        phash_str = phash_image(image_path)
        phash_vector = phash_to_64d_vector(phash_str)

        engine.add_vector(phash_vector, image_path)

        return {
            "tags": tags,
            "message": "Image added to FAISS index successfully"
        }

    elif action == "search_similar":
        phash_str = phash_image(image_path)
        phash_vector = phash_to_64d_vector(phash_str)

        paths, distances = engine.search(phash_vector, k=10)

        return {
            "similar_images": paths,
            "similar_image_distances": distances
        }

    return {"error": "Invalid action specified"}