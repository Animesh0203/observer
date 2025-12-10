import faiss
import numpy as np
import os
import json
from threading import Lock

INDEX_PATH = "faiss_index.index"
MAPPING_PATH = "faiss_mapping.json"

D = 64  # Dimension of the phash vectors
M = 16
EF_CONSTRUCTION = 200
EF_SEARCH = 50

class FaissEngine:
    def __init__(self):
        self.lock = Lock()
        self.index = None
        self.id_to_path = {}
        self.next_id = 0
        self._load_or_create()
        
        
    def _create_index(self):
        self.index = faiss.IndexHNSWFlat(D, M)
        self.index.hnsw.efConstruction = EF_CONSTRUCTION
        self.index.hnsw.efSearch = EF_SEARCH
        return self.index
    
    def _load_or_create(self):
        if os.path.exists(INDEX_PATH) and os.path.exists(MAPPING_PATH):
            self.index = faiss.read_index(INDEX_PATH)

            with open(MAPPING_PATH, "r", encoding="utf-8") as f:
                self.id_to_path = json.load(f)
                self.id_to_path = {int(k): v for k, v in self.id_to_path.items()}

            if self.id_to_path:
                self.next_id = max(self.id_to_path.keys()) + 1
            else:
                self.next_id = 0
        else:
            self.index = self._create_index()
            self.id_to_path = {}
            self.next_id = 0
            self._save()
            
    def _save(self):
        faiss.write_index(self.index, INDEX_PATH)

        with open(MAPPING_PATH, "w", encoding="utf-8") as f:
            json.dump(self.id_to_path, f, indent=2)

    def add_vector(self, vector, image_path):
        with self.lock:
            np_vec = np.array([vector], dtype=np.float32)
            self.index.add(np_vec)

            self.id_to_path[self.next_id] = image_path
            self.next_id += 1

            # ✅ SAVE AFTER EVERY INSERT
            self._save()

    # -------------------------
    # SEARCH
    # -------------------------

    def search(self, query_vector, k=10):
        if self.index.ntotal == 0:
            return [], []

        self.index.hnsw.efSearch = EF_SEARCH  # ✅ ALWAYS SET

        np_query = np.array([query_vector], dtype=np.float32)

        # ✅ CORRECT ORDER: distances, indices
        distances, indices = self.index.search(np_query, k)

        resolved_paths = []
        resolved_distances = []

        for idx, dist in zip(indices[0], distances[0]):
            if idx == -1:
                continue
            resolved_paths.append(self.id_to_path.get(int(idx)))
            resolved_distances.append(float(dist))

        return resolved_paths, resolved_distances