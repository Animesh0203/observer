package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()
		// Create application with options
		err := wails.Run(&options.App{
		Title:      "Wails Template",
		Fullscreen: true,
		Width:      1024,
		Height:     768,

		StartHidden: true,  // ← prevents flicker on startup

		AssetServer: &assetserver.Options{
			Assets: assets,
		},

		Windows: &windows.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			BackdropType: windows.Auto,

			DisableWindowIcon: true,
			DisableFramelessWindowDecorations: true,
		},

		BackgroundColour: &options.RGBA{0, 0, 0, 0},
		Frameless:        true,
		OnStartup:        app.startup,
		Bind: []interface{}{app},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
