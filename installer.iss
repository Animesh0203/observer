[Setup]
AppName=Observer
AppVersion=1.0.0
DefaultDirName={pf}\Observer
DefaultGroupName=Observer
OutputDir=installer
OutputBaseFilename=ObserverSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardResizable=no
BackColor=$1A1A1A
BackColor2=$101010
BackColorDirection=topbottom
LabelFontName=Segoe UI

[Code]
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel1.Font.Color := clWhite;
  WizardForm.WelcomeLabel2.Font.Color := $CCCCCC;
end;

[Files]
; Main application (Wails)
Source: "build\bin\Observer.exe"; DestDir: "{app}"; Flags: ignoreversion

; Worker runtime — goes into AppData\Local
Source: "dist\worker.exe"; DestDir: "{localappdata}\ObserverAI"; Flags: ignoreversion

; Model files
Source: "models\efficientnet-lite4-11.onnx"; DestDir: "{localappdata}\ObserverAI\models"; Flags: ignoreversion
Source: "models\labels_map.txt"; DestDir: "{localappdata}\ObserverAI\models"; Flags: ignoreversion

; Initial empty FAISS files (optional)
Source: "python\empty_faiss_index.bin"; DestDir: "{localappdata}\ObserverAI"; Flags: ignoreversion skipifsourcedoesntexist
Source: "python\empty_map.json"; DestDir: "{localappdata}\ObserverAI"; Flags: ignoreversion skipifsourcedoesntexist

[Dirs]
; Ensure runtime directories exist
Name: "{localappdata}\ObserverAI"
Name: "{localappdata}\ObserverAI\models"
Name: "{localappdata}\ObserverAI\logs"

[Run]
; Launch the app after installation
Filename: "{app}\Observer.exe"; Description: "Start Observer"; Flags: postinstall nowait
