/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')

class Home {
    static id = "home";
    
    async init(config) {
        this.config = config;
        this.db = new database();
        await this.setupUserProfile()
        this.news()
        this.socialLinks()
        this.instancesSelect()
        
        // Setup settings button
        const settingsBtn = document.querySelector('.settings-btn')
        if (settingsBtn) {
            settingsBtn.addEventListener('click', e => changePanel('settings'))
        }

        // Start periodic server status updates
        this.startPeriodicStatusUpdate()
    }

    startPeriodicStatusUpdate() {
        // Update server status every 30 seconds
        this.statusUpdateInterval = setInterval(async () => {
            try {
                let configClient = await this.db.readData('configClient')
                let instancesList = await config.getInstanceList()
                
                if (instancesList && instancesList.length > 0) {
                    let currentInstance = instancesList.find(i => i.name === configClient.instance_selct)
                    if (currentInstance && currentInstance.status) {
                        await this.updateServerStatus(currentInstance.status)
                    }
                }
            } catch (error) {
                console.error('Error in periodic status update:', error)
            }
        }, 10000) // 10 seconds
    }

    stopPeriodicStatusUpdate() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval)
            this.statusUpdateInterval = null
        }
    }

    async setupUserProfile() {
        try {
            let configClient = await this.db.readData('configClient')
            let auth = await this.db.readData('accounts', configClient.account_selected)
            
            if (auth) {
                let userNameElement = document.querySelector('.user-name')
                let userStatusElement = document.querySelector('.user-status')
                
                if (userNameElement) userNameElement.textContent = auth.name || 'Player'
                if (userStatusElement) userStatusElement.textContent = 'Ready to Play'
                
                // Set player head if skin data is available
                if (auth?.profile?.skins?.[0]?.base64) {
                    try {
                        await this.setPlayerHead(auth.profile.skins[0].base64)
                    } catch (error) {
                        console.warn('Could not set player head:', error)
                    }
                }
            }
        } catch (error) {
            console.error('Error setting up user profile:', error)
        }
    }

    async setPlayerHead(skinBase64) {
        try {
            const { skin2D } = require('minecraft-java-core')
            
            // Try different approaches for better quality
            let skin;
            try {
                // First try with size parameter for higher resolution
                skin = await new skin2D().creatHeadTexture(skinBase64, 128);
            } catch (error) {
                // Fallback to default if size parameter not supported
                skin = await new skin2D().creatHeadTexture(skinBase64);
            }
            
            let playerHeadElement = document.querySelector(".player-head")
            if (playerHeadElement) {
                playerHeadElement.style.backgroundImage = `url(${skin})`;
                // Ensure crisp rendering for pixel art
                playerHeadElement.style.imageRendering = 'pixelated';
                playerHeadElement.style.backgroundSize = 'cover';
                playerHeadElement.style.backgroundPosition = 'center';
                playerHeadElement.style.backgroundRepeat = 'no-repeat';
            }
        } catch (error) {
            console.warn('Error setting player head:', error)
        }
    }

    async news() {
        let newsElement = document.querySelector('.news-container');
        if (!newsElement) return;
        
        let news = await config.getNews().then(res => res).catch(err => false);
        
        if (news && news.length > 0) {
            for (let newsItem of news) {
                // Validate news item data
                if (!newsItem || typeof newsItem !== 'object') continue;
                
                let date = this.getdate(newsItem.publish_date)
                let title = newsItem.title || 'Untitled';
                let author = newsItem.author || 'Unknown';
                let content = newsItem.content || 'No content available.';
                
                let newsCard = document.createElement('div');
                newsCard.classList.add('news-card');
                newsCard.innerHTML = `
                    <div class="news-card-header">
                        <div class="news-meta">
                            <span class="news-date">${date.day} ${date.month}</span>
                            <span class="news-author">by ${author}</span>
                        </div>
                        <h4 class="news-title">${title}</h4>
                    </div>
                    <div class="news-content">
                        <p>${content.replace(/\n/g, '<br>')}</p>
                    </div>
                `;
                newsElement.appendChild(newsCard);
            }
        } else {
            let placeholderCard = document.createElement('div');
            placeholderCard.classList.add('news-card', 'placeholder');
            placeholderCard.innerHTML = `
                <div class="news-card-header">
                    <div class="news-meta">
                        <span class="news-date">Today</span>
                        <span class="news-author">by System</span>
                    </div>
                    <h4 class="news-title">Welcome to 404 Launcher!</h4>
                </div>
                <div class="news-content">
                    <p>No news available at the moment. Check back later for updates and announcements!</p>
                </div>
            `;
            newsElement.appendChild(placeholderCard);
        }
    }

    socialLinks() {
        let linkCards = document.querySelectorAll('.link-card')
        console.log('Found link cards:', linkCards.length)

        linkCards.forEach((card, index) => {
            let url = card.getAttribute('data-url')
            console.log(`Link card ${index}: ${url}`)
            
            card.addEventListener('click', e => {
                e.preventDefault()
                console.log('Clicked link card with URL:', url)
                if (url) {
                    shell.openExternal(url)
                } else {
                    console.error('No URL found for link card')
                }
            })
        });
    }

    async instancesSelect() {
        try {
            let configClient = await this.db.readData('configClient')
            let auth = await this.db.readData('accounts', configClient.account_selected)
            let instancesList = await config.getInstanceList()
            
            // Handle case where no instances are available
            if (!instancesList || instancesList.length === 0) {
                console.error('No instances available')
                let playButton = document.querySelector('.play-button')
                if (playButton) {
                    playButton.disabled = true
                    let playText = playButton.querySelector('.play-text')
                    if (playText) playText.textContent = 'No Instance Available'
                }
                return
            }
            
            let instanceSelect = instancesList.find(i => i.name == configClient?.instance_selct) ? configClient?.instance_selct : null

            let playButton = document.querySelector('.play-button')
            let instanceBtn = document.querySelector('.instance-btn')
            let instanceNameSpan = document.querySelector('.instance-name')
            let instancePopup = document.querySelector('.instance-popup')
            let instancesListPopup = document.querySelector('.instances-List')

            // Update instance name display
            if (instanceSelect && instanceNameSpan) {
                instanceNameSpan.textContent = instanceSelect
            }

            if (!instanceSelect) {
                let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                if (newInstanceSelect) {
                    let configClient = await this.db.readData('configClient')
                    configClient.instance_selct = newInstanceSelect.name
                    instanceSelect = newInstanceSelect.name
                    await this.db.updateData('configClient', configClient)
                    if (instanceNameSpan) instanceNameSpan.textContent = instanceSelect
                }
            }

            // Handle whitelist logic and set status
            for (let instance of instancesList) {
                if (instance.whitelistActive) {
                    let whitelist = instance.whitelist.find(whitelist => whitelist == auth?.name)
                    if (whitelist !== auth?.name) {
                        if (instance.name == instanceSelect) {
                            let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                            if (newInstanceSelect) {
                                let configClient = await this.db.readData('configClient')
                                configClient.instance_selct = newInstanceSelect.name
                                instanceSelect = newInstanceSelect.name
                                await this.updateServerStatus(newInstanceSelect.status)
                                await this.db.updateData('configClient', configClient)
                                if (instanceNameSpan) instanceNameSpan.textContent = instanceSelect
                            }
                        }
                    }
                }
                if (instance.name == instanceSelect) {
                    await this.updateServerStatus(instance.status)
                }
            }

            // Setup instance dropdown
            if (instanceBtn) {
                instanceBtn.addEventListener('click', async () => {
                    if (instancesListPopup) {
                        instancesListPopup.innerHTML = ''
                        for (let instance of instancesList) {
                            if (instance.whitelistActive) {
                                instance.whitelist.map(whitelist => {
                                    if (whitelist == auth?.name) {
                                        let instanceElement = document.createElement('div')
                                        instanceElement.className = 'instance-item'
                                        instanceElement.textContent = instance.name
                                        instanceElement.addEventListener('click', () => {
                                            this.selectInstance(instance.name)
                                        })
                                        instancesListPopup.appendChild(instanceElement)
                                    }
                                })
                            } else {
                                let instanceElement = document.createElement('div')
                                instanceElement.className = 'instance-item'
                                instanceElement.textContent = instance.name
                                instanceElement.addEventListener('click', () => {
                                    this.selectInstance(instance.name)
                                })
                                instancesListPopup.appendChild(instanceElement)
                            }
                        }
                        if (instancePopup) {
                            instancePopup.style.display = instancePopup.style.display === 'block' ? 'none' : 'block'
                        }
                    }
                })
            }

            // Setup play button
            if (playButton) {
                playButton.addEventListener('click', async () => {
                    await this.startGame()
                })
            }
        } catch (error) {
            console.error('Error in instancesSelect:', error)
        }
    }

    async updateServerStatus(statusConfig) {
        if (!statusConfig) {
            this.setOfflineStatus()
            return
        }

        try {
            const { Status } = require('minecraft-java-core')
            const { ip, port, nameServer } = statusConfig
            
            // Update header server status
            let serverStatusName = document.querySelector('.server-status-name')
            if (serverStatusName) serverStatusName.textContent = nameServer
            
            // Update server card status
            let serverName = document.querySelector('.server-name')
            if (serverName) serverName.textContent = nameServer
            
            // Show updating status
            let headerStatusText = document.querySelector('.server-status-text')
            let statusText = document.querySelector('.status-text')
            if (headerStatusText) headerStatusText.textContent = 'Checking...'
            if (statusText) statusText.textContent = 'Checking server...'
            
            let status = new Status(ip, port);
            let statusServer = await status.getStatus().then(res => res).catch(err => {
                console.error('Server status error:', err)
                return { error: true }
            });

            if (!statusServer.error) {
                this.setOnlineStatus(statusServer)
                console.log(`Server status updated: ${nameServer} - ${statusServer.ms}ms, ${statusServer.playersConnect} players`)
            } else {
                this.setOfflineStatus()
                console.log(`Server offline: ${nameServer}`)
            }
        } catch (error) {
            console.error('Error updating server status:', error)
            this.setOfflineStatus()
        }
    }

    setOnlineStatus(statusServer) {
        // Update header elements
        let headerStatusText = document.querySelector('.server-status-text')
        let headerPlayerCount = document.querySelector('.status-player-count .player-count')
        
        if (headerStatusText) {
            headerStatusText.textContent = `Online - ${statusServer.ms || 0} ms`
            headerStatusText.classList.remove('red')
        }
        if (headerPlayerCount) {
            headerPlayerCount.textContent = statusServer.playersConnect || '0'
        }
        
        // Update server card elements
        let statusIndicator = document.querySelector('.status-indicator')
        let statusText = document.querySelector('.status-text')
        let playerCount = document.querySelector('.player-count')
        
        if (statusIndicator) {
            statusIndicator.classList.remove('offline')
            statusIndicator.classList.add('online')
        }
        if (statusText) {
            statusText.textContent = `Online • ${statusServer.ms || 0}ms`
        }
        if (playerCount) {
            playerCount.textContent = `${statusServer.playersConnect || 0} players`
        }
    }

    setOfflineStatus() {
        // Update header elements
        let headerStatusText = document.querySelector('.server-status-text')
        let headerPlayerCount = document.querySelector('.status-player-count .player-count')
        
        if (headerStatusText) {
            headerStatusText.textContent = 'Offline - 0 ms'
            headerStatusText.classList.add('red')
        }
        if (headerPlayerCount) {
            headerPlayerCount.textContent = '0'
        }
        
        // Update server card elements
        let statusIndicator = document.querySelector('.status-indicator')
        let statusText = document.querySelector('.status-text')
        let playerCount = document.querySelector('.player-count')
        
        if (statusIndicator) {
            statusIndicator.classList.remove('online')
            statusIndicator.classList.add('offline')
        }
        if (statusText) {
            statusText.textContent = 'Offline • 0ms'
        }
        if (playerCount) {
            playerCount.textContent = '0 players'
        }
    }

    async selectInstance(instanceName) {
        try {
            let configClient = await this.db.readData('configClient')
            configClient.instance_selct = instanceName
            await this.db.updateData('configClient', configClient)
            
            let instanceNameSpan = document.querySelector('.instance-name')
            if (instanceNameSpan) instanceNameSpan.textContent = instanceName
            
            let instancePopup = document.querySelector('.instance-popup')
            if (instancePopup) instancePopup.style.display = 'none'
            
            // Update server status
            let instancesList = await config.getInstanceList()
            let instance = instancesList.find(i => i.name === instanceName)
            if (instance) {
                await this.updateServerStatus(instance.status)
            }
        } catch (error) {
            console.error('Error selecting instance:', error)
        }
    }

    async startGame() {
        try {
            let playButton = document.querySelector('.play-button')
            let progressText = document.querySelector('.progress-text')
            let progressBar = document.querySelector('.progress-bar')
            
            if (playButton) playButton.disabled = true
            if (progressText) progressText.textContent = 'Starting game...'
            
            let configClient = await this.db.readData('configClient')
            let auth = await this.db.readData('accounts', configClient.account_selected)
            let instancesList = await config.getInstanceList()
            
            if (!auth) {
                console.error('No account selected')
                changePanel('login')
                return
            }
            
            if (!instancesList || instancesList.length === 0) {
                console.error('No instances available')
                if (progressText) progressText.textContent = 'No instances available'
                if (playButton) playButton.disabled = false
                return
            }
            
            let options = instancesList.find(i => i.name === configClient.instance_selct)
            if (!options) {
                console.error('Selected instance not found')
                if (progressText) progressText.textContent = 'Instance not found'
                if (playButton) playButton.disabled = false
                return
            }

            console.log('Game launch configuration:', {
                instance: options.name,
                authenticator: auth?.name || 'No auth',
                version: options.loadder?.minecraft_version
            });

            let launchOptions = {
                url: options.url,
                authenticator: auth,
                timeout: 10000,
                path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
                instance: options.name,
                version: options.loadder.minecraft_version,
                detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
                downloadFileMultiple: configClient.launcher_config.download_multi,
                intelEnabledMac: configClient.launcher_config.intelEnabledMac,
                loader: {
                    type: options.loadder.loadder_type,
                    build: options.loadder.loadder_version,
                    enable: options.loadder.loadder_type == 'none' ? false : true
                },
                verify: options.verify,
                ignored: [...options.ignored],
                java: {
                    path: configClient.java_config.java_path,
                    version: configClient.java_config.java_version,
                    type: 'jre'
                },
                screen: {
                    width: configClient.game_config.screen_size.width,
                    height: configClient.game_config.screen_size.height
                },
                memory: {
                    min: `${configClient.java_config.java_memory.min * 1024}M`,
                    max: `${configClient.java_config.java_memory.max * 1024}M`
                }
            }

            let launch = new Launch()
            
            launch.on('progress', (progress, size) => {
                if (progressBar) {
                    progressBar.value = progress
                    progressBar.max = size
                }
                if (progressText) {
                    progressText.textContent = `Downloading... ${Math.round((progress/size)*100)}%`
                }
            })

            launch.on('close', () => {
                if (playButton) playButton.disabled = false
                if (progressText) progressText.textContent = 'Ready to launch'
                if (progressBar) progressBar.value = 0
                console.log('Game closed')
            })

            launch.on('error', (err) => {
                console.error('Launch error:', err)
                if (playButton) playButton.disabled = false
                if (progressText) progressText.textContent = 'Launch failed'
                
                let popupManager = new popup()
                popupManager.openPopup({
                    title: 'Launch Error',
                    content: `Failed to launch game: ${err.message || err}`,
                    options: true
                })
            })

            await launch.Launch(launchOptions)

        } catch (error) {
            console.error('Start game error:', error)
            let playButton = document.querySelector('.play-button')
            let progressText = document.querySelector('.progress-text')
            
            if (playButton) playButton.disabled = false
            if (progressText) progressText.textContent = 'Launch failed'
        }
    }

    // Cleanup method called when leaving this panel
    onDestroy() {
        this.stopPeriodicStatusUpdate()
    }

    // Optional: Manual refresh button functionality
    async refreshServerStatus() {
        try {
            let configClient = await this.db.readData('configClient')
            let instancesList = await config.getInstanceList()
            
            if (instancesList && instancesList.length > 0) {
                let currentInstance = instancesList.find(i => i.name === configClient.instance_selct)
                if (currentInstance && currentInstance.status) {
                    await this.updateServerStatus(currentInstance.status)
                }
            }
        } catch (error) {
            console.error('Error refreshing server status:', error)
        }
    }

    getdate(e) {
        // Handle invalid or missing dates
        if (!e) {
            let today = new Date();
            return { 
                year: today.getFullYear(), 
                month: "Today", 
                day: today.getDate() 
            };
        }

        let date;
        
        // Try to parse different date formats
        if (typeof e === 'string') {
            // Handle DD/MM/YYYY format (like "14/07/2025")
            if (e.includes('/')) {
                let parts = e.split('/');
                if (parts.length === 3) {
                    // Convert DD/MM/YYYY to MM/DD/YYYY for JavaScript Date
                    date = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
                } else {
                    date = new Date(e);
                }
            } else {
                date = new Date(e);
            }
        } else {
            date = new Date(e);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            let today = new Date();
            return { 
                year: today.getFullYear(), 
                month: "Today", 
                day: today.getDate() 
            };
        }

        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        return { 
            year: year, 
            month: monthNames[month - 1] || "Unknown", 
            day: day || 1 
        };
    }
}

export default Home;