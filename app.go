package main

import (
	"context"
	"fmt"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.design/x/hotkey"
	"golang.design/x/hotkey/mainthread"
)

// App struct
type App struct {
	ctx context.Context
}

var isVisible = true

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	go func() {
        time.Sleep(120 * time.Millisecond) // tweak if needed
        runtime.WindowShow(ctx)
    }()

	mainthread.Init(a.RegisterHotKey)
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) RegisterHotKey() {
	registerHotkey(a)
}

func registerHotkey(a *App) {
    hk := hotkey.New([]hotkey.Modifier{
        hotkey.ModCtrl,
        hotkey.ModShift,
    }, hotkey.KeySpace)

    if err := hk.Register(); err != nil {
        println("Failed to register hotkey:", err.Error())
        return
    }

    go func() {
        for range hk.Keydown() {
            toggleWindow(a.ctx)
        }
    }()
}

func toggleWindow(ctx context.Context) {
    if isVisible {
        fmt.Println("Key Pressed - Hiding Window")
		runtime.EventsEmit(ctx, "spotlight:hide")
        time.Sleep(180 * time.Millisecond)
        runtime.WindowHide(ctx)
    } else {
        fmt.Println("Key Pressed - Showing Window")
        runtime.WindowShow(ctx)
		runtime.EventsEmit(ctx, "spotlight:show")
    }

    isVisible = !isVisible
}
