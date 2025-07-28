const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: !isDev // Disable web security only in dev mode
    },
    title: 'MusicTagFlow Test Modules'
  });

  // Create menu
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Test Modules',
      submenu: [
        {
          label: 'Scanner Test',
          click: () => {
            launchScannerTest();
          }
        },
        { type: 'separator' },
        {
          label: 'Back to Launcher',
          click: () => {
            loadLauncher();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Load launcher page
  loadLauncher();

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadLauncher() {
  // Create a simple launcher HTML
  const launcherHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>MusicTagFlow Test Modules</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0f0f23 0%, #1e1e3c 100%);
          color: #e1e5e9;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }
        h1 {
          margin-bottom: 40px;
          font-size: 2.5em;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          max-width: 800px;
          width: 100%;
          padding: 20px;
        }
        .module-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .module-card:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .module-icon {
          font-size: 3em;
          margin-bottom: 20px;
        }
        .module-title {
          font-size: 1.3em;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .module-description {
          color: #9ca3af;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <h1>MusicTagFlow Test Modules</h1>
      <div class="modules-grid">
        <div class="module-card" onclick="require('electron').ipcRenderer.send('launch-scanner-test')">
          <div class="module-icon">🔍</div>
          <div class="module-title">Scanner Test</div>
          <div class="module-description">Test music library scanning and metadata extraction</div>
        </div>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
      </script>
    </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(launcherHTML)}`);
}

function launchScannerTest() {
  // Launch scanner-test as a separate Electron process
  const { spawn } = require('child_process');
  const electronPath = require('electron').app.getPath('exe');
  
  const scannerProcess = spawn(electronPath, [path.join(__dirname, 'scanner-test', 'main.js')], {
    cwd: path.join(__dirname, 'scanner-test'),
    stdio: 'inherit'
  });

  scannerProcess.on('error', (err) => {
    console.error('Failed to start scanner-test:', err);
    dialog.showErrorBox('Error', 'Failed to launch Scanner Test module');
  });
}

// IPC handlers
const { ipcMain } = require('electron');

ipcMain.on('launch-scanner-test', () => {
  launchScannerTest();
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});