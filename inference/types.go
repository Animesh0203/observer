package inference

import "encoding/json"

type CaptionResult struct {
	Tags    []string `json:"tags"`
	Message string   `json:"message"`
}

type SearchResult struct {
	SimilarImages    []string  `json:"similar_images"`
	SimilarDistances []float64 `json:"similar_image_distances"`
}

type StatusResult struct {
	Message string `json:"message"`
}

type WorkerMessage struct {
	ID     int             `json:"id"`
	Action string          `json:"action"`
	Params json.RawMessage `json:"params,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
}
