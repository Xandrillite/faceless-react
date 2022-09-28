const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow () {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
            // nodeIntegration: true
        }
    })

    // win.loadURL('http://localhost:3000');
    win.loadFile('build/index.html').then(
        () => win.webContents.openDevTools()
    );
    return win;
}

app.whenReady().then(() => {
    const win = createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })

    window.addEventListener('resize', () => {
        win.webContents.send('update-window-size', window.innerHeight, window.innerWidth);
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
