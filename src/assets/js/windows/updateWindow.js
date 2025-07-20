/**
 * @author SentryXSystems
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

"use strict";
const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
let dev = process.env.DEV_TOOL === 'open';
let updateWindow = undefined;

function getWindow() {
    return updateWindow;
}

function destroyWindow() {
    if (!updateWindow) return;
    updateWindow.close();
    updateWindow = undefined;
}

function createWindow() {
    destroyWindow();
    
    // Determine correct base path for development vs production
    let dev = process.env.NODE_ENV === 'dev';
    let basePath = dev ? 'src' : 'app';
    
    updateWindow = new BrowserWindow({
        title: "Mise à jour",
        width: 400,
        height: 500,
        resizable: false,
        icon: `./${basePath}/assets/images/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    updateWindow.setMenuBarVisibility(false);
    updateWindow.loadFile(path.join(`${app.getAppPath()}/${basePath}/index.html`));
    updateWindow.once('ready-to-show', () => {
        if (updateWindow) {
            if (process.env.DEV_TOOL === 'open') updateWindow.webContents.openDevTools({ mode: 'detach' })
            updateWindow.show();
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};