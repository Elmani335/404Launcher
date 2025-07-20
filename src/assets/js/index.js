/**
 * @author SentryXSystems
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { ipcRenderer, shell } = require('electron');
const pkg = require('../package.json');
const os = require('os');
import { config, database } from './utils.js';
const nodeFetch = require("node-fetch");


class Splash {
    constructor() {
        this.splash = document.querySelector(".splash");
        this.splashMessage = document.querySelector(".splash-message");
        this.splashAuthor = document.querySelector(".splash-author");
        this.message = document.querySelector(".message");
        this.progress = document.querySelector(".progress");
        
        // Show splash immediately for debugging
        document.querySelector("#splash").style.display = "block";
        console.log('[Splash] Starting splash screen initialization...');
        
        document.addEventListener('DOMContentLoaded', async () => {
            console.log('[Splash] DOM Content Loaded');
            try {
                let databaseLauncher = new database();
                let configClient = await databaseLauncher.readData('configClient');
                let theme = configClient?.launcher_config?.theme || "auto"
                let isDarkTheme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res)
                document.body.className = isDarkTheme ? 'dark global' : 'light global';
                if (process.platform == 'win32') ipcRenderer.send('update-window-progress-load')
                this.startAnimation()
            } catch (error) {
                console.error('[Splash] Error during initialization:', error);
                // Fallback to show something
                document.body.className = 'dark global';
                this.startAnimation()
            }
        });
    }

    async startAnimation() {
        let splashes = [
            { "message": "Je... vie...", "author": "SentryXSystems" },
            { "message": "Salut je suis du code.", "author": "SentryXSystems" },
            { "message": "Linux n'est pas un os, mais un kernel.", "author": "SentryXSystems" }
        ];
        let splash = splashes[Math.floor(Math.random() * splashes.length)];
        this.splashMessage.textContent = splash.message;
        this.splashAuthor.children[0].textContent = "@" + splash.author;
        await sleep(100);
        document.querySelector("#splash").style.display = "block";
        await sleep(500);
        this.splash.classList.add("opacity");
        await sleep(500);
        this.splash.classList.add("translate");
        this.splashMessage.classList.add("opacity");
        this.splashAuthor.classList.add("opacity");
        this.message.classList.add("opacity");
        await sleep(1000);
        this.checkUpdate();
    }

    async checkUpdate() {
        this.setStatus(`Recherche de mise à jour...`);

        try {
            console.log('[Splash] Checking for updates...');
            // Skip update check for now and go directly to maintenance check
            setTimeout(() => {
                console.log('[Splash] Skipping update check, proceeding to maintenance check...');
                this.maintenanceCheck();
            }, 2000); // Show update message for 2 seconds
            
        } catch (error) {
            console.error('[Splash] Update check failed:', error);
            this.maintenanceCheck();
        }

        // Original update code (commented out for now)
        /*
        ipcRenderer.invoke('update-app').then().catch(err => {
            return this.shutdown(`erreur lors de la recherche de mise à jour :<br>${err.message}`);
        });

        ipcRenderer.on('updateAvailable', () => {
            this.setStatus(`Mise à jour disponible !`);
            if (os.platform() == 'win32') {
                this.toggleProgress();
                ipcRenderer.send('start-update');
            }
            else return this.dowloadUpdate();
        })

        ipcRenderer.on('error', (event, err) => {
            if (err) return this.shutdown(`${err.message}`);
        })

        ipcRenderer.on('download-progress', (event, progress) => {
            ipcRenderer.send('update-window-progress', { progress: progress.transferred, size: progress.total })
            this.setProgress(progress.transferred, progress.total);
        })

        ipcRenderer.on('update-not-available', () => {
            console.error("Mise à jour non disponible");
            this.maintenanceCheck();
        })
        */
    }

    getLatestReleaseForOS(os, preferredFormat, asset) {
        return asset.filter(asset => {
            const name = asset.name.toLowerCase();
            const isOSMatch = name.includes(os);
            const isFormatMatch = name.endsWith(preferredFormat);
            return isOSMatch && isFormatMatch;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    }

    async dowloadUpdate() {
        try {
            const repoURL = pkg.repository.url.replace("git+", "").replace(".git", "").replace("https://github.com/", "").split("/");
            
            const githubAPI = await nodeFetch('https://api.github.com').then(res => {
                if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
                return res.json();
            }).catch(err => {
                console.error('GitHub API fetch error:', err);
                return null;
            });
            
            if (!githubAPI) return;

            const githubAPIRepoURL = githubAPI.repository_url.replace("{owner}", repoURL[0]).replace("{repo}", repoURL[1]);
            const githubAPIRepo = await nodeFetch(githubAPIRepoURL).then(res => {
                if (!res.ok) throw new Error(`GitHub repo API error: ${res.status}`);
                return res.json();
            }).catch(err => {
                console.error('GitHub repo API fetch error:', err);
                return null;
            });
            
            if (!githubAPIRepo) return;

            const releases_url = await nodeFetch(githubAPIRepo.releases_url.replace("{/id}", '')).then(res => {
                if (!res.ok) throw new Error(`GitHub releases API error: ${res.status}`);
                return res.json();
            }).catch(err => {
                console.error('GitHub releases API fetch error:', err);
                return null;
            });
            
            if (!releases_url || !releases_url.length) return;
            
            const latestRelease = releases_url[0].assets;
            let latest;

            if (os.platform() == 'darwin') latest = this.getLatestReleaseForOS('mac', '.dmg', latestRelease);
            else if (os == 'linux') latest = this.getLatestReleaseForOS('linux', '.appimage', latestRelease);

            this.setStatus(`Mise à jour disponible !<br><div class="download-update">Télécharger</div>`);
            document.querySelector(".download-update").addEventListener("click", () => {
                shell.openExternal(latest.browser_download_url);
                return this.shutdown("Téléchargement en cours...");
            });
        } catch (updateError) {
            console.error('Update check failed:', updateError);
        }
    }


    async maintenanceCheck() {
        try {
            console.log('[Splash] Checking maintenance status...');
            let res = await config.GetConfig();
            if (res.maintenance) return this.shutdown(res.maintenance_message);
            this.startLauncher();
        } catch (e) {
            console.error('[Splash] Maintenance check failed:', e);
            // Skip maintenance check and start launcher anyway
            console.log('[Splash] Skipping maintenance check, starting launcher directly...');
            this.startLauncher();
        }
    }

    startLauncher() {
        this.setStatus(`Démarrage du launcher`);
        ipcRenderer.send('main-window-open');
        ipcRenderer.send('update-window-close');
    }

    shutdown(text) {
        this.setStatus(`${text}<br>Arrêt dans 5s`);
        let i = 4;
        setInterval(() => {
            this.setStatus(`${text}<br>Arrêt dans ${i--}s`);
            if (i < 0) ipcRenderer.send('update-window-close');
        }, 1000);
    }

    setStatus(text) {
        this.message.innerHTML = text;
    }

    toggleProgress() {
        if (this.progress.classList.toggle("show")) this.setProgress(0, 1);
    }

    setProgress(value, max) {
        this.progress.value = value;
        this.progress.max = max;
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.keyCode == 73 || e.keyCode == 123) {
        ipcRenderer.send("update-window-dev-tools");
    }
})
new Splash();