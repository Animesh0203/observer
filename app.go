package main

import (
	"context"
	"database/sql"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"net/http"
	"observer/inference"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	// goruntime "runtime"
	"sync"

	"github.com/disintegration/imaging"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"fmt"

	_ "modernc.org/sqlite"
)

// App struct
type App struct {
	ctx context.Context
	db  *sql.DB

	labels []string

	tagJobs chan string
	wg      sync.WaitGroup
}

type ActivityEvent struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Label   string `json:"label"`
	Detail  string `json:"detail"`
	Percent int    `json:"percent"`
}

type ImageData struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Path          string    `json:"path"`
	ThumbnailPath string    `json:"thumbnailPath"`
	FolderID      string    `json:"folderId"`
	Folder        string    `json:"folder"`
	Size          int64     `json:"size"`
	Created       time.Time `json:"created"`
	Modified      time.Time `json:"modified"`
	Width         int       `json:"width"`
	Height        int       `json:"height"`
	Tags          []string  `json:"tags,omitempty"`
}

type FolderData struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}

type Prediction struct {
	Label string
	Prob  float32
}

var (
	shell32       = syscall.NewLazyDLL("shell32.dll")
	shellExecuteW = shell32.NewProc("ShellExecuteW")
)

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// Image Metadata retrieves metadata for an image file
func fileMetadata(path string) (name string, size int64, created, modified time.Time, width, height int, err error) {
	fi, err := os.Stat(path)
	if err != nil {
		return "", 0, time.Time{}, time.Time{}, 0, 0, err
	}

	name = filepath.Base(path)
	size = fi.Size()
	created = fi.ModTime() // Go doesn’t always have creation time on Unix, only ModTime reliably

	// Decode image dimensions
	f, err := os.Open(path)
	if err != nil {
		return "", size, created, created, 0, 0, err
	}
	defer f.Close()

	imgCfg, _, err := image.DecodeConfig(f)
	if err == nil {
		width, height = imgCfg.Width, imgCfg.Height
	}

	return name, size, created, fi.ModTime(), width, height, nil
}

func GenerateThumbnail(srcPath, thumbDir string, width int) (string, error) {
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		return "", err
	}

	filename := strings.TrimSuffix(filepath.Base(srcPath), filepath.Ext(srcPath)) + ".jpg"
	thumbPath := filepath.Join(thumbDir, filename)

	if _, err := os.Stat(thumbPath); err == nil {
		return thumbPath, nil
	}

	img, err := imaging.Open(srcPath)
	if err != nil {
		return "", err
	}

	thumb := imaging.Resize(img, width, 0, imaging.Lanczos)

	if err := imaging.Save(thumb, thumbPath, imaging.JPEGQuality(70)); err != nil {
		return "", err
	}

	return thumbPath, nil
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	go func() {
		time.Sleep(3 * time.Second)
		runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
			ID:      "startup-test",
			Status:  "start",
			Label:   "Startup Event",
			Detail:  "Program is starting up",
			Percent: 0,
		})
	}()

	// DB
	if _, err := os.Stat("./"); os.IsNotExist(err) {
		os.MkdirAll("./", 0755)
	}
	db, err := sql.Open("sqlite", "./data.db")
	if err != nil {
		log.Fatal(err)
	}
	a.db = db
	a.initDB()

	workerCount := 1
	a.tagJobs = make(chan string, 256)

	for i := 0; i < workerCount; i++ {
		a.wg.Add(1)
		go a.tagWorker(i)
	}

	go a.startImageServer()
	go func() {
		time.Sleep(3 * time.Second)
		runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
			ID:      "startup-test",
			Status:  "finish",
			Label:   "Startup Event",
			Detail:  "Program has started successfully",
			Percent: 0,
		})
	}()
}

// tagWorker processes images from the tagJobs channel
func (a *App) tagWorker(workerID int) {
	defer a.wg.Done()
	for {
		select {
		case <-a.ctx.Done():
			runtime.LogInfo(a.ctx, fmt.Sprintf("Tag worker %d shutting down", workerID))
			return

		case imgPath, ok := <-a.tagJobs:
			if !ok {
				runtime.LogInfo(a.ctx, fmt.Sprintf("Tag worker %d channel closed", workerID))
				return
			}

			runtime.LogInfo(a.ctx, fmt.Sprintf("Tag worker %d processing: %s", workerID, imgPath))

			activityID := fmt.Sprintf("caption-%s", filepath.Base(imgPath))

			// Start activity
			runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
				ID:      activityID,
				Status:  "start",
				Label:   "Captioning image",
				Detail:  filepath.Base(imgPath),
				Percent: 0,
			})

			tags := a.CaptionImage(imgPath, activityID)

			// Finish or error is now handled inside CaptionImage (we’ll fix that next)
			runtime.LogInfo(a.ctx, fmt.Sprintf("Tag worker %d finished: %s with tags %v", workerID, imgPath, tags))
		}
	}
}

// initDB initializes the database schema
func (a *App) initDB() {

	a.db.Exec("PRAGMA journal_mode=WAL;")
	a.db.Exec("PRAGMA synchronous=NORMAL;")
	a.db.Exec("PRAGMA busy_timeout = 2000;")

	_, _ = a.db.Exec(`
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            path TEXT UNIQUE
        );

        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE,
			thumbnail_path TEXT,
            caption TEXT,
            folder_id INTEGER,
            FOREIGN KEY (folder_id) REFERENCES folders(id)
        );

		CREATE TABLE IF NOT EXISTS FAVORITES (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			image_id INTEGER,
			FOREIGN KEY (image_id) REFERENCES images(id)
		);

		CREATE INDEX IF NOT EXISTS idx_images_caption ON images(caption);
		CREATE INDEX IF NOT EXISTS idx_images_folder_id ON images(folder_id);

    `)
}

func (a *App) UnTaggedImages() ([]ImageData, error) {
	rows, err := a.db.Query(`
        SELECT images.id, images.path, images.thumbnail_path
        FROM images
        WHERE caption IS NULL
    `)
	if err != nil {
		runtime.LogError(a.ctx, fmt.Sprintf("Error querying untagged images: %v", err))
		return nil, err
	}
	defer rows.Close()

	var images []ImageData

	for rows.Next() {
		var id int
		var path, thumbPath string

		// ✔ First scan values
		if err := rows.Scan(&id, &path, &thumbPath); err != nil {
			runtime.LogError(a.ctx, fmt.Sprintf("Error scanning row: %v", err))
			continue
		}

		// ✔ Now fetch metadata using correct path
		name, size, created, modified, width, height, _ := fileMetadata(path)

		images = append(images, ImageData{
			ID:            fmt.Sprint(id),
			Path:          path,
			ThumbnailPath: thumbPath,
			Name:          name,
			Size:          size,
			Created:       created,
			Modified:      modified,
			Width:         width,
			Height:        height,
		})
	}

	return images, nil
}

// THE OG FUNCTION
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) AddFolder(name string, path string) error {
	if name == "" || path == "" {
		return errors.New("folder name and path cannot be empty")
	}

	_, err := a.db.Exec("INSERT INTO folders (name, path) VALUES (?, ?)", name, path)
	if err != nil {
		runtime.LogError(a.ctx, fmt.Sprintf("Failed to add folder: %v", err))
		return err
	}

	runtime.LogInfo(a.ctx, fmt.Sprintf("Added folder: %s (%s)", name, path))
	return nil
}

// SelectFolder opens a folder picker dialog and returns the selected path.
func (a *App) SelectFolder() (string, error) {
	options := runtime.OpenDialogOptions{
		Title: "Select a folder",
	}

	folderPath, err := runtime.OpenDirectoryDialog(a.ctx, options)
	if err != nil {
		runtime.LogError(a.ctx, fmt.Sprintf("Error selecting folder: %v", err))
		return "", err
	}

	if folderPath == "" {
		return "", nil // caller checks for empty string
	}

	runtime.LogInfo(a.ctx, fmt.Sprintf("Selected folder: %s", folderPath))
	return folderPath, nil
}

func (a *App) RemoveFolder(path string) error {
	// Placeholder for future implementation
	_, err := a.db.Exec("DELETE FROM folders WHERE path = ?", path)
	return err
}

func (a *App) OpenImage(path string) error {
	p, _ := syscall.UTF16PtrFromString(path)

	// ShellExecuteW(0, "open", filepath, "", "", SW_SHOWNORMAL)
	shellExecuteW.Call(
		0,
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr("open"))),
		uintptr(unsafe.Pointer(p)),
		0,
		0,
		1, // SW_SHOWNORMAL
	)
	return nil
}

func (a *App) ScanFolder() error {
	rows, err := a.db.Query("SELECT id, path FROM folders")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var folderPath string
		rows.Scan(&id, &folderPath)
		a.ScanFolders(folderPath)
	}
	return nil
}

func (a *App) startImageServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/image", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("path")
		if q == "" {
			http.Error(w, "Missing path", http.StatusBadRequest)
			return
		}

		// Normalize Windows paths safely
		q = strings.ReplaceAll(q, "\\", "/")
		absPath, err := filepath.Abs(q)
		if err != nil {
			http.Error(w, "Invalid path", http.StatusBadRequest)
			return
		}

		http.ServeFile(w, r, absPath)
	})

	// Start HTTP server on localhost, random free port (or fixed, like 127.0.0.1:5178)
	if err := http.ListenAndServe("127.0.0.1:5178", mux); err != nil {
		runtime.LogError(a.ctx, "Image server failed: "+err.Error())
	}
}

func (a *App) walkFolderAndInsertImages(folderPath string, folderID int, stmt *sql.Stmt) error {
	return filepath.Walk(folderPath, func(filePath string, info os.FileInfo, err error) error {
		if err != nil {
			if !os.IsNotExist(err) && !os.IsPermission(err) {
				runtime.LogError(a.ctx, fmt.Sprintf("Error accessing %s: %v", filePath, err))
			}
			return nil
		}
		if !info.IsDir() && isImage(filePath) {
			_, err := stmt.Exec(filePath, folderID)
			if err != nil {
				runtime.LogError(a.ctx, fmt.Sprintf("Failed to insert image: %v", err))
			}
		}
		return nil
	})
}

func (a *App) ScanFolders(path string) error {
	// Find folder ID
	var folderID int
	err := a.db.QueryRow("SELECT id FROM folders WHERE path = ?", path).Scan(&folderID)
	if err != nil {
		return fmt.Errorf("folder not found in database: %v", err)
	}

	tx, err := a.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %v", err)
	}
	stmt, err := tx.Prepare("INSERT OR IGNORE INTO images (path, folder_id) VALUES (?, ?)")
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to prepare insert: %v", err)
	}
	defer stmt.Close()

	err = a.walkFolderAndInsertImages(path, folderID, stmt)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("error walking folder: %v", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	runtime.LogInfo(a.ctx, fmt.Sprintf("Finished scanning folder: %s", path))
	return nil
}

func isImage(p string) bool {
	ext := strings.ToLower(filepath.Ext(p))
	return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp"
}

func (a *App) CaptionImage(imagePath string, activityID string) []string {
	// Predict
	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      activityID,
		Status:  "progress",
		Label:   "Captioning image",
		Detail:  "Running model…",
		Percent: 20,
	})

	tags, err := inference.Predict(imagePath)
	if err != nil {
		time.Sleep(5)
		runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
			ID:     activityID,
			Status: "error",
			Label:  "Captioning failed",
			Detail: err.Error(),
		})
		return []string{}
	}

	// Save to DB
	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      activityID,
		Status:  "progress",
		Label:   "Captioning image",
		Detail:  "Saving caption…",
		Percent: 70,
	})

	caption := strings.Join(tags, ",")
	if _, err := a.db.Exec(`UPDATE images SET caption=? WHERE path=?`, caption, imagePath); err != nil {
		runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
			ID:     activityID,
			Status: "error",
			Label:  "Failed to save caption",
			Detail: err.Error(),
		})
		return tags
	}

	// Finish
	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      activityID,
		Status:  "finish",
		Label:   "Captioned image",
		Detail:  filepath.Base(imagePath),
		Percent: 100,
	})

	return tags
}

func (a *App) QueueAllUntaggedForTagging() error {
	runtime.LogInfo(a.ctx, "Queueing all untagged images for tagging")
	images, err := a.UnTaggedImages()
	if err != nil {
		// Emit activity error
		runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
			ID:     "tag-all-untagged",
			Status: "error",
			Label:  "Failed to fetch untagged images",
			Detail: err.Error(),
		})
		return err
	}

	total := len(images)
	if total == 0 {
		runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
			ID:      "tag-all-untagged",
			Status:  "finish",
			Label:   "No untagged images found",
			Detail:  "",
			Percent: 100,
		})
		return nil
	}

	// Emit start event
	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      "tag-all-untagged",
		Status:  "start",
		Label:   "Tagging all untagged images",
		Detail:  fmt.Sprintf("Found %d images", total),
		Percent: 0,
	})

	go func() {
		for i, img := range images {
			select {
			case <-a.ctx.Done():
				runtime.LogInfo(a.ctx, "QueueAllUntaggedForTagging cancelled via context")
				return
			case a.tagJobs <- img.Path:
				percent := int(float64(i+1) / float64(total) * 100)
				runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
					ID:      "tag-all-untagged",
					Status:  "progress",
					Label:   "Tagging all untagged images",
					Detail:  fmt.Sprintf("Queued %d/%d", i+1, total),
					Percent: percent,
				})
			}
		}

		runtime.LogInfo(a.ctx, "Finished queueing all untagged images")
		runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
			ID:      "tag-all-untagged",
			Status:  "finish",
			Label:   "Finished queuing untagged images",
			Detail:  "Workers are processing them",
			Percent: 100,
		})
	}()

	return nil
}

func (a *App) TagAllUntagged() {

	// Queue work
	if err := a.QueueAllUntaggedForTagging(); err != nil {
		runtime.LogError(a.ctx, "Failed to queue untagged images: "+err.Error())
		return
	}
}

func (a *App) GetImages() ([]ImageData, error) {
	var rows *sql.Rows
	var err error

	rows, err = a.db.Query(`
        SELECT images.id, images.path, images.caption, folders.path AS folder
        FROM images JOIN folders ON images.folder_id = folders.id
    `)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ImageData
	thumbDir := "./thumbnails"

	for rows.Next() {
		var id int
		var path, caption, folder string
		rows.Scan(&id, &path, &caption, &folder)

		name, size, created, modified, width, height, _ := fileMetadata(path)

		var thumbPath string
		if _, err := os.Stat(path); err == nil {
			if thumbPath == "" {
				thumbPath, _ = GenerateThumbnail(path, thumbDir, 200)
				_, _ = a.db.Exec("UPDATE images SET thumbnail_path = ? WHERE id = ?", thumbPath, id)
			}
		}

		out = append(out, ImageData{
			ID:            fmt.Sprint(id),
			Name:          name,
			Path:          path,
			ThumbnailPath: thumbPath,
			Folder:        folder,
			Size:          size,
			Created:       created,
			Modified:      modified,
			Width:         width,
			Height:        height,
			Tags:          strings.Split(caption, ","),
		})
	}
	return out, nil
}

func (a *App) GetImageByFolders(folderIDs []string) ([]ImageData, error) {
	if len(folderIDs) == 0 {
		return a.GetImages()
	}

	// Generate placeholders for SQL (?,?,?,...)
	placeholders := strings.Repeat("?,", len(folderIDs))
	placeholders = strings.TrimRight(placeholders, ",")

	query := fmt.Sprintf(`
		SELECT 
			images.id, 
			images.path, 
			COALESCE(images.caption, ''),
			folders.id AS folder_id,
			folders.name AS folder_name,
			folders.path AS folder_path
		FROM images 
		JOIN folders ON images.folder_id = folders.id
		WHERE folders.id IN (%s)
	`, placeholders)

	// Convert []string to []interface{} for Query args
	args := make([]interface{}, len(folderIDs))
	for i, v := range folderIDs {
		args[i] = v
	}

	rows, err := a.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ImageData
	thumbDir := "./thumbnails"

	for rows.Next() {
		var id int
		var path, caption, folderPath, folderName string
		var folderID int

		err := rows.Scan(&id, &path, &caption, &folderID, &folderName, &folderPath)
		if err != nil {
			return nil, err
		}

		name, size, created, modified, width, height, _ := fileMetadata(path)

		var thumbPath string
		if _, err := os.Stat(path); err == nil {
			thumbPath, _ = GenerateThumbnail(path, thumbDir, 200)
		}

		out = append(out, ImageData{
			ID:            fmt.Sprint(id),
			Name:          name,
			Path:          path,
			ThumbnailPath: thumbPath,
			Folder:        folderName,
			FolderID:      fmt.Sprint(folderID),
			Size:          size,
			Created:       created,
			Modified:      modified,
			Width:         width,
			Height:        height,
		})
	}
	return out, nil
}

func (a *App) GetFolders() ([]FolderData, error) {
	rows, err := a.db.Query("SELECT id, name, path FROM folders;")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []FolderData
	for rows.Next() {
		var folder FolderData
		if err := rows.Scan(&folder.ID, &folder.Name, &folder.Path); err != nil {
			return nil, err
		}
		out = append(out, folder)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func (a *App) Shutdown(ctx context.Context) {
	if a.tagJobs != nil {
		close(a.tagJobs)
	}
	a.wg.Wait()

	if a.db != nil {
		a.db.Close()
	}
}

func (a *App) TestActivity() {
	runtime.LogInfo(a.ctx, "TestActivity fired!")
	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      "test-activity",
		Status:  "start",
		Label:   "Manual test event",
		Detail:  "If you see this in React, everything works!",
		Percent: 0,
	})

	// simulate progress
	time.Sleep(300 * time.Millisecond)
	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      "test-activity",
		Status:  "progress",
		Label:   "Manual test event",
		Detail:  "Halfway...",
		Percent: 50,
	})

	// simulate finish
	time.Sleep(300 * time.Millisecond)
	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      "test-activity",
		Status:  "finish",
		Label:   "Test event finished",
		Detail:  "Completed",
		Percent: 100,
	})
}

func (a *App) DelModel() error {
	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      "unload-model",
		Status:  "start",
		Label:   "Unloading model",
		Detail:  "Releasing resources…",
		Percent: 0,
	})

	time.Sleep(5)
	err := inference.UnloadModel()
	if err != nil {
		runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
			ID:     "unload-model",
			Status: "error",
			Label:  "Failed to unload model",
			Detail: err.Error(),
		})
		return err
	}

	runtime.EventsEmit(a.ctx, "activity", ActivityEvent{
		ID:      "unload-model",
		Status:  "finish",
		Label:   "Model unloaded",
		Detail:  "Resources released successfully",
		Percent: 100,
	})
	return nil
}
