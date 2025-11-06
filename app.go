package main

import (
	"context"
	"database/sql"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"fmt"

	_ "modernc.org/sqlite"
)

// App struct
type App struct {
	ctx context.Context
	db  *sql.DB
}

type ImageData struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Folder   string    `json:"folder"`
	Size     int64     `json:"size"`
	Created  time.Time `json:"created"`
	Modified time.Time `json:"modified"`
	Width    int       `json:"width"`
	Height   int       `json:"height"`
	Tags     []string  `json:"tags,omitempty"`
}

type FolderData struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}

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

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	db, err := sql.Open("sqlite", "./data.db")
	if err != nil {
		log.Fatal(err)
	}

	a.db = db
	a.initDB()
}

// initDB initializes the database schema
func (a *App) initDB() {
	_, _ = a.db.Exec(`
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE,
            path TEXT UNIQUE
        );
        CREATE TABLE IF NOT EXISTS images (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			path TEXT UNIQUE,
			caption TEXT
		);
    `)
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}


func (a *App) AddFolder(name string, path string) error {
	// Placeholder for future implementation
	_, err := a.db.Exec("INSERT OR IGNORE INTO folders (name, path) VALUES (?, ?)", name, path)
	return err
}

func (a *App) SelectFolder(name string) (string, error) {
	options := runtime.OpenDialogOptions{
		Title: "Select a folder",
	}

	folderPath, err := runtime.OpenDirectoryDialog(a.ctx, options)
	if err != nil {
		return "", err
	}

	if folderPath == "" {
		return "", fmt.Errorf("no folder selected")
	}

	fmt.Println("Selected folder:", folderPath)
	a.AddFolder(name, folderPath)
	return folderPath, nil
}

func (a *App) RemoveFolder(path string) error {
	// Placeholder for future implementation
	_, err := a.db.Exec("DELETE FROM folders WHERE path = ?", path)
	return err
}

func (a *App) ScanFolders() error {
	rows, err := a.db.Query("SELECT id, path FROM folders")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var folderPath string
		rows.Scan(&id, &folderPath)
		a.scanFolder(id, folderPath)
	}
	return nil
}

func (a *App) scanFolder(folderID int, folderPath string) {
	filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && isImage(path) {
			_, _ = a.db.Exec(
				"INSERT OR IGNORE INTO images (path, folder_id) VALUES (?, ?)",
				path, folderID,
			)
		}
		return nil
	})
}

func isImage(p string) bool {
	ext := strings.ToLower(filepath.Ext(p))
	return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp"
}

func (a *App) CaptionImage(imagePath string) {
	// Placeholder for future implementation
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
	for rows.Next() {
		var id int
		var path, caption, folder string
		rows.Scan(&id, &path, &caption, &folder)

		name, size, created, modified, width, height, _ := fileMetadata(path)

		out = append(out, ImageData{
			ID:       fmt.Sprint(id),
			Name:     name,
			Path:     path,
			Folder:   folder,
			Size:     size,
			Created:  created,
			Modified: modified,
			Width:    width,
			Height:   height,
		})
	}
	return out, nil
}

func (a *App) GetFolders() ([]FolderData, error) {
	rows, err := a.db.Query("SELECT id, name, path FROM folders")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []FolderData
	for rows.Next() {
		var id int
		var name, path string
		rows.Scan(&id, &name, &path)

		out = append(out, FolderData{
			ID:   fmt.Sprint(id),
			Name: name,
			Path: path,
		})
	}
	return out, nil
}
