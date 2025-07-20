/**
 * @author SentryXSystems
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
const pkg = require("../../../../package.json");
let dev = process.env.DEV_TOOL === 'open';
let mainWindow = undefined;

function getWindow() {
    return mainWindow;
}

function destroyWindow() {
    if (!mainWindow) return;
    app.quit();
    mainWindow = undefined;
}

function createWindow() {
    destroyWindow();
    
    // Determine correct base path for development vs production
    let isDevMode = process.env.NODE_ENV === 'dev';
    let basePath = isDevMode ? 'src' : 'app';
    
    mainWindow = new BrowserWindow({
        title: pkg.productName || pkg.preductname,
        width: 1280,
        height: 720,
        minWidth: 980,
        minHeight: 552,
        resizable: true,
        icon: `./${basePath}/assets/images/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(`${app.getAppPath()}/${basePath}/launcher.html`));
    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            if (process.env.DEV_TOOL === 'open') mainWindow.webContents.openDevTools({ mode: 'detach' })
            mainWindow.show()
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};