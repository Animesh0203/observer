package inference

import (
	"encoding/json"
	"fmt"
)


func DecodeCaptionResult(msg WorkerMessage) (*CaptionResult, error) {
	// Print the raw bytes we're attempting to decode
	fmt.Println("DECODE: raw msg.Result bytes:", string(msg.Result))

	var res CaptionResult
	if len(msg.Result) == 0 {
		fmt.Println("DECODE: msg.Result is empty ([]).")
		return &res, nil // returns zero-value CaptionResult (empty tags)
	}

	if err := json.Unmarshal(msg.Result, &res); err != nil {
		fmt.Println("DECODE: json.Unmarshal error:", err)
		return nil, err
	}

	fmt.Println("DECODE: parsed caption result:", res)
	return &res, nil
}

func DecodeSearchResult(msg WorkerMessage) (*SearchResult, error) {
	var res SearchResult
	if err := json.Unmarshal(msg.Result, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func DecodeStatusResult(msg WorkerMessage) (*StatusResult, error) {
	var res StatusResult
	if err := json.Unmarshal(msg.Result, &res); err != nil {
		return nil, err
	}
	return &res, nil
}
