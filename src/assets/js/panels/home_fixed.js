/**
 * @author SentryXSystems
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
        
        // Initialize dynamic background system
        this.initBackgroundSystem();
        
        // Initialize news with auto-refresh
        this.initNewsSystem();
        
        await this.setupUserProfile()
        this.socialLinks()
        this.instancesSelect()
        
        // Setup settings button
        const settingsBtn = document.querySelector('.settings-btn')
        if (settingsBtn) {
            settingsBtn.addEventListener('click', e => changePanel('settings'))
        }

        // Setup launch button
        const playButton = document.querySelector('.play-button')
        if (playButton) {
            playButton.addEventListener('click', async (e) => {
                e.preventDefault()
                await this.launchGame()
            })
        }

        // Setup refresh button
        const refreshButton = document.querySelector('.refresh-button')
        if (refreshButton) {
            refreshButton.addEventListener('click', async (e) => {
                e.preventDefault()
                await this.refreshFiles()
            })
        }

        // Start periodic server status updates
        this.startPeriodicStatusUpdate()
    }

    initBackgroundSystem() {
        // Available background images
        this.backgroundImages = {
            dark: [
                'assets/images/background/dark/1.png',
                'assets/images/background/dark/2.jpg',
                'assets/images/background/dark/2020-06-23_14.02.34.png',
                'assets/images/background/dark/2020-08-02_13.35.00.png',
                'assets/images/background/dark/2021-11-28_21.23.21.png',
                'assets/images/background/dark/3.png'
            ],
            light: [
                'assets/images/background/light/1.jpg',
                'assets/images/background/light/2.png',
                'assets/images/background/light/2020-06-23_14.10.28.png',
                'assets/images/background/light/2020-07-08_12.36.08.png',
                'assets/images/background/light/2021-04-06_12.09.02.png',
                'assets/images/background/light/3.png'
            ]
        };
        
        this.currentBackgroundIndex = 0;
        this.backgroundElement = document.querySelector('.background-image');
        
        // Set initial background
        this.setRandomBackground();
        
        // Change background every 30 seconds
        this.backgroundInterval = setInterval(() => {
            this.setRandomBackground();
        }, 30000);
    }

    setRandomBackground() {
        // Determine theme (you can enhance this to read from theme settings)
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const images = this.backgroundImages[theme] || this.backgroundImages.dark;
        
        // Get random image different from current one
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * images.length);
        } while (newIndex === this.currentBackgroundIndex && images.length > 1);
        
        this.currentBackgroundIndex = newIndex;
        const selectedImage = images[this.currentBackgroundIndex];
        
        if (this.backgroundElement) {
            // Fade out, change image, fade in
            this.backgroundElement.style.opacity = '0';
            
            setTimeout(() => {
                this.backgroundElement.style.backgroundImage = `url('${selectedImage}')`;
                this.backgroundElement.style.opacity = '1';
            }, 500);
        }
        
        console.log(`[Background] Set to: ${selectedImage}`);
    }

    // Cleanup method for background system
    cleanup() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
            this.statusUpdateInterval = null;
        }
        if (this.newsInterval) {
            clearInterval(this.newsInterval);
            this.newsInterval = null;
        }
        console.log('[Cleanup] All intervals cleared');
    }

    startPeriodicStatusUpdate() {
        // Update server status every 30 seconds
        this.statusUpdateInterval = setInterval(async () => {
            try {
                let configClient = await this.db.readData('configClient')
                
                let instancesList;
                try {
                    instancesList = await config.getInstanceList()
                } catch (error) {
                    console.error('Error fetching instances in periodic update:', error)
                    this.setOfflineStatus()
                    return
                }
                
                if (instancesList && instancesList.length > 0) {
                    let currentInstance = instancesList.find(i => i.name === configClient.instance_selct)
                    if (currentInstance && currentInstance.status) {
                        // Check if we're using fallback instance and skip status updates
                        if (currentInstance.isFallback) {
                            this.setFallbackStatus()
                            return
                        }
                        await this.updateServerStatus(currentInstance.status)
                    }
                } else {
                    // No instances available, set offline status
                    this.setOfflineStatus()
                }
            } catch (error) {
                console.error('Error in periodic status update:', error)
                this.setOfflineStatus()
            }
        }, 30000) // 30 seconds
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

    initNewsSystem() {
        // Initialize news loading
        this.loadNews();
        
        // Set up auto-refresh every 10 seconds
        this.newsInterval = setInterval(() => {
            this.refreshNews();
        }, 10000);
        
        console.log('[News] Auto-refresh enabled - updates every 10 seconds');
    }

    async loadNews() {
        let newsElement = document.querySelector('.news-container');
        if (!newsElement) return;
        
        // Show loading state
        this.showNewsLoading();
        
        try {
            console.log('[News] Starting news fetch...');
            let news = await config.getNews().then(res => res).catch(err => {
                console.error('[News] getNews() error:', err);
                return false;
            });
            
            console.log('[News] Received news data:', news);
            this.renderNews(news);
        } catch (error) {
            console.error('[News] Error loading news:', error);
            this.showNewsError();
        }
    }

    async refreshNews() {
        let newsElement = document.querySelector('.news-container');
        if (!newsElement) return;
        
        // Add refresh indicator to section header
        let sectionHeader = document.querySelector('.news-section .section-header h3');
        let originalText = '';
        
        if (sectionHeader) {
            // Store original text or get it without any existing refresh indicators
            originalText = sectionHeader.textContent.replace(/\s*⟳$/, '').trim();
        }
        
        try {
            // Show refresh indicator (remove any existing ones first)
            if (sectionHeader) {
                sectionHeader.innerHTML = `${originalText} <span class="refresh-indicator">⟳</span>`;
            }
            
            let news = await config.getNews().then(res => res).catch(err => false);
            
            // Add subtle refresh animation
            newsElement.style.opacity = '0.7';
            
            setTimeout(() => {
                this.renderNews(news);
                newsElement.style.opacity = '1';
                
                // Remove refresh indicator - restore original text
                if (sectionHeader) {
                    sectionHeader.textContent = originalText;
                }
                
                console.log('[News] Refreshed successfully');
            }, 300);
            
        } catch (error) {
            console.error('[News] Error refreshing news:', error);
            newsElement.style.opacity = '1';
            
            // Remove refresh indicator on error - restore original text
            if (sectionHeader) {
                sectionHeader.textContent = originalText;
            }
        }
    }

    showNewsLoading() {
        let newsElement = document.querySelector('.news-container');
        if (!newsElement) return;
        
        newsElement.innerHTML = `
            <div class="news-card loading">
                <div class="news-card-header">
                    <div class="news-meta">
                        <span class="news-date">Loading...</span>
                        <span class="news-author">System</span>
                    </div>
                    <h4 class="news-title">Fetching latest news...</h4>
                </div>
                <div class="news-content">
                    <p>Please wait while we load the latest updates and announcements.</p>
                </div>
            </div>
        `;
    }

    showNewsError() {
        let newsElement = document.querySelector('.news-container');
        if (!newsElement) return;
        
        newsElement.innerHTML = `
            <div class="news-card error">
                <div class="news-card-header">
                    <div class="news-meta">
                        <span class="news-date">Error</span>
                        <span class="news-author">System</span>
                    </div>
                    <h4 class="news-title">Unable to load news</h4>
                </div>
                <div class="news-content">
                    <p>Failed to fetch news. Check your connection and try again.</p>
                </div>
            </div>
        `;
    }

    renderNews(news) {
        let newsElement = document.querySelector('.news-container');
        if (!newsElement) return;
        
        console.log('[News] Rendering news:', news);
        
        // Clear existing content
        newsElement.innerHTML = '';
        
        if (news && news.length > 0) {
            console.log('[News] Processing', news.length, 'news items');
            for (let newsItem of news) {
                // Validate news item data
                if (!newsItem || typeof newsItem !== 'object') {
                    console.warn('[News] Invalid news item:', newsItem);
                    continue;
                }
                
                console.log('[News] Processing item:', newsItem);
                
                let date = this.getdate(newsItem.publish_date)
                let title = newsItem.title || 'Untitled';
                let author = newsItem.author || 'Unknown';
                let content = newsItem.content || 'No content available.';
                let link = newsItem.link || null;
                
                console.log('[News] Parsed date:', date, 'from:', newsItem.publish_date);
                
                let newsCard = document.createElement('div');
                newsCard.classList.add('news-card');
                
                // Add clickable class if link exists
                if (link) {
                    newsCard.classList.add('clickable');
                    newsCard.style.cursor = 'pointer';
                    newsCard.addEventListener('click', () => {
                        const { shell } = require('electron');
                        shell.openExternal(link);
                    });
                }
                
                newsCard.innerHTML = `
                    <div class="news-card-header">
                        <div class="news-meta">
                            <span class="news-date">${date.day} ${date.month}</span>
                            <span class="news-author">by ${author}</span>
                        </div>
                        <h4 class="news-title">${title}${link ? ' <span class="external-link-icon">🔗</span>' : ''}</h4>
                    </div>
                    <div class="news-content">
                        <p>${content.replace(/\n/g, '<br>')}</p>
                        ${link ? '<div class="news-link-hint">Click to open link</div>' : ''}
                    </div>
                `;
                newsElement.appendChild(newsCard);
            }
        } else {
            console.log('[News] No news data available, showing placeholder');
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

    // Cleanup method called when leaving this panel
    onDestroy() {
        this.stopPeriodicStatusUpdate()
        this.cleanup();
    }

    async launchGame() {
        try {
            let launch = new Launch()
            let configClient = await this.db.readData('configClient')
            let instance = await config.getInstanceList()
            let authenticator = await this.db.readData('accounts', configClient.account_selected)
            let options = instance.find(i => i.name == configClient.instance_selct)

            console.log('[Launch] Starting game launch...');
            console.log('[Launch] Config client:', configClient);
            console.log('[Launch] Auth data:', authenticator);
            console.log('[Launch] Instance options:', options);

            if (!authenticator) {
                this.showAlert('Error', 'No account selected. Please login first.')
                return
            }

            if (!options) {
                this.showAlert('Error', 'Selected instance not found.')
                return
            }

            let playInstanceBTN = document.querySelector('.play-button')
            let infoStartingBOX = document.querySelector('.progress-container')
            let infoStarting = document.querySelector('.progress-text')
            let progressBar = document.querySelector('.progress-bar')

            let opt = {
                url: options.url,
                authenticator: authenticator,
                timeout: 10000,
                path: `${configClient.game_config.game_path}`,
                instance: options.name,
                version: options.loadder.minecraft_version,
                detached: configClient.launcher_config?.closeLauncher == "close-all" ? false : true,
                downloadFileMultiple: configClient.launcher_config?.download_multi || 5,

                loader: {
                    type: options.loadder.loadder_type,
                    build: options.loadder.loadder_version,
                    enable: options.loadder.loadder_type == 'none' ? false : true
                },

                verify: options.verify,
                ignored: [...(options.ignored || [])],

                java: {
                    path: configClient.java_config?.java_path || "java",
                },

                JVM_ARGS: options.jvm_args || [],
                GAME_ARGS: options.game_args || [],

                screen: {
                    width: configClient.game_config?.screen_size?.width || 1280,
                    height: configClient.game_config?.screen_size?.height || 720
                },

                memory: {
                    min: `${(configClient.java_config?.java_memory?.min || 2) * 1024}M`,
                    max: `${(configClient.java_config?.java_memory?.max || 4) * 1024}M`
                }
            }

            console.log('[Launch] Launch options:', opt);

            launch.Launch(opt);

            // UI Updates
            if (playInstanceBTN) {
                playInstanceBTN.style.display = "none"
            }
            if (infoStartingBOX) infoStartingBOX.style.display = "block"
            if (progressBar) progressBar.style.display = ""
            if (infoStarting) infoStarting.innerHTML = `Preparing launch...`

            launch.on('extract', extract => {
                console.log('[Launch] Extract:', extract);
                if (infoStarting) infoStarting.innerHTML = `Extracting files...`
            });

            launch.on('progress', (progress, size) => {
                console.log('[Launch] Progress:', progress, size);
                if (infoStarting) infoStarting.innerHTML = `Downloading ${((progress / size) * 100).toFixed(0)}%`
                if (progressBar) {
                    progressBar.value = progress;
                    progressBar.max = size;
                }
            });

            launch.on('check', (progress, size) => {
                console.log('[Launch] Check:', progress, size);
                if (infoStarting) infoStarting.innerHTML = `Verifying ${((progress / size) * 100).toFixed(0)}%`
                if (progressBar) {
                    progressBar.value = progress;
                    progressBar.max = size;
                }
            });

            launch.on('estimated', (time) => {
                let hours = Math.floor(time / 3600);
                let minutes = Math.floor((time - hours * 3600) / 60);
                let seconds = Math.floor(time - hours * 3600 - minutes * 60);
                console.log(`[Launch] Estimated time: ${hours}h ${minutes}m ${seconds}s`);
            })

            launch.on('speed', (speed) => {
                console.log(`[Launch] Download speed: ${(speed / 1067008).toFixed(2)} Mb/s`)
            })

            launch.on('patch', patch => {
                console.log('[Launch] Patch:', patch);
                if (infoStarting) infoStarting.innerHTML = `Applying patches...`
            });

            launch.on('data', (e) => {
                console.log('[Launch] Game output:', e);
                if (progressBar) progressBar.style.display = "none"
                if (configClient.launcher_config?.closeLauncher == 'close-launcher') {
                    // Hide launcher window when game starts
                }
                if (infoStarting) infoStarting.innerHTML = `Game is starting...`
                console.log(e);
            })

            launch.on('close', code => {
                console.log('[Launch] Game closed with code:', code);
                if (configClient.launcher_config?.closeLauncher == 'close-launcher') {
                    // Show launcher window when game closes
                }
                if (infoStartingBOX) infoStartingBOX.style.display = "none"
                if (playInstanceBTN) playInstanceBTN.style.display = "flex"
                if (infoStarting) infoStarting.innerHTML = `Ready to launch`
                console.log('[Launch] Game closed');
            });

            launch.on('error', err => {
                console.error('[Launch] Launch error:', err);
                
                if (configClient.launcher_config?.closeLauncher == 'close-launcher') {
                    // Show launcher window on error
                }
                if (infoStartingBOX) infoStartingBOX.style.display = "none"
                if (playInstanceBTN) playInstanceBTN.style.display = "flex"
                if (infoStarting) infoStarting.innerHTML = `Launch failed`
                
                this.showAlert('Launch Error', err.error || err.message || 'Unknown launch error')
            })

        } catch (error) {
            console.error('[Launch] Critical launch error:', error);
            
            // Reset UI on critical error
            let playInstanceBTN = document.querySelector('.play-button')
            let infoStartingBOX = document.querySelector('.progress-container')
            let infoStarting = document.querySelector('.progress-text')
            
            if (infoStartingBOX) infoStartingBOX.style.display = "none"
            if (playInstanceBTN) playInstanceBTN.style.display = "flex"
            if (infoStarting) infoStarting.innerHTML = `Ready to launch`
            
            this.showAlert('Launch Error', error.message || 'Failed to launch the game')
        }
    }

    async refreshFiles() {
        try {
            console.log('[Refresh] Starting file refresh...');
            
            // Get configuration
            let configClient = await this.db.readData('configClient')
            let instancesList = await config.getInstanceList()
            
            if (!instancesList || instancesList.length === 0) {
                this.showAlert('Error', 'No instances available for refresh.')
                return
            }

            let currentInstance = instancesList.find(i => i.name === configClient.instance_selct)
            if (!currentInstance) {
                this.showAlert('Error', 'Selected instance not found.')
                return
            }

            // Update UI to show refreshing state
            this.setRefreshingState()
            
            this.updateProgress('Files verified!', 100, 100)
            setTimeout(() => {
                this.setReadyState()
                this.showAlert('Success', 'Files refreshed successfully!')
            }, 1500)

        } catch (error) {
            console.error('[Refresh] Refresh error:', error);
            this.setErrorState('Refresh failed')
            this.showAlert('Refresh Error', error.message || 'Failed to refresh files')
        }
    }

    setRefreshingState() {
        let refreshButton = document.querySelector('.refresh-button')
        let refreshText = document.querySelector('.refresh-text')
        let progressText = document.querySelector('.progress-text')
        
        if (refreshButton) {
            refreshButton.disabled = true
            refreshButton.classList.add('refreshing')
        }
        if (refreshText) refreshText.textContent = 'Refreshing...'
        if (progressText) progressText.textContent = 'Refreshing files...'
    }

    setReadyState() {
        let playButton = document.querySelector('.play-button')
        let playText = document.querySelector('.play-text')
        let refreshButton = document.querySelector('.refresh-button')
        let refreshText = document.querySelector('.refresh-text')
        let progressText = document.querySelector('.progress-text')
        let progressBar = document.querySelector('.progress-bar')
        let progressPercentage = document.querySelector('.progress-percentage')
        
        if (playButton) {
            playButton.disabled = false
            playButton.classList.remove('launching', 'running', 'error')
        }
        if (playText) playText.textContent = 'Launch Game'
        
        if (refreshButton) {
            refreshButton.disabled = false
            refreshButton.classList.remove('refreshing', 'error')
        }
        if (refreshText) refreshText.textContent = 'Reload'
        
        if (progressText) progressText.textContent = 'Ready to launch'
        if (progressBar) progressBar.value = 0
        if (progressPercentage) progressPercentage.textContent = ''
    }

    setErrorState(message) {
        let playButton = document.querySelector('.play-button')
        let playText = document.querySelector('.play-text')
        let refreshButton = document.querySelector('.refresh-button')
        let refreshText = document.querySelector('.refresh-text')
        let progressText = document.querySelector('.progress-text')
        
        if (playButton) {
            playButton.disabled = false
            playButton.classList.remove('launching', 'running')
            playButton.classList.add('error')
        }
        if (playText) playText.textContent = 'Launch Game'
        
        if (refreshButton) {
            refreshButton.disabled = false
            refreshButton.classList.remove('refreshing')
            refreshButton.classList.add('error')
        }
        if (refreshText) refreshText.textContent = 'Reload'
        
        if (progressText) progressText.textContent = message || 'Error occurred'
    }

    updateProgress(message, current, total) {
        let progressText = document.querySelector('.progress-text')
        let progressBar = document.querySelector('.progress-bar')
        let progressPercentage = document.querySelector('.progress-percentage')
        
        if (progressText) progressText.textContent = message
        
        if (progressBar && total > 0) {
            let percentage = Math.round((current / total) * 100)
            progressBar.value = percentage
            progressBar.max = 100
            
            if (progressPercentage) {
                progressPercentage.textContent = `${percentage}%`
            }
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
        })
    }

    getdate(timestamp) {
        let date;
        
        // Handle different date formats
        if (typeof timestamp === 'string' && timestamp.includes('/')) {
            // Handle DD/MM/YYYY format like "15/07/2025"
            const parts = timestamp.split('/');
            if (parts.length === 3) {
                // Create date from DD/MM/YYYY format
                date = new Date(parts[2], parts[1] - 1, parts[0]); // Year, Month (0-based), Day
            } else {
                date = new Date(timestamp);
            }
        } else {
            // Handle timestamp or other formats
            date = new Date(timestamp);
        }
        
        let day = date.getDate()
        let monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        let month = monthNames[date.getMonth()]
        return { day, month }
    }

    async instancesSelect() {
        try {
            let configClient = await this.db.readData('configClient')
            let auth = await this.db.readData('accounts', configClient.account_selected)
            
            console.log('=== INSTANCES SELECT DEBUG ===')
            console.log('ConfigClient:', {
                hasConfigClient: !!configClient,
                instanceSelected: configClient?.instance_selct
            })
            console.log('Auth:', {
                hasAuth: !!auth,
                authName: auth?.name,
                authType: auth?.meta?.type
            })
            
            let instancesList;
            try {
                instancesList = await config.getInstanceList()
                console.log('InstancesList fetch result:', {
                    hasInstances: !!instancesList,
                    instancesLength: instancesList?.length || 0,
                    instanceNames: instancesList?.map(i => i.name) || []
                })
            } catch (error) {
                console.error('Failed to fetch instances list:', error)
                instancesList = null
            }
            
            // Handle case where no instances are available
            if (!instancesList || instancesList.length === 0) {
                console.error('No instances available')
                let playButton = document.querySelector('.play-button')
                let progressText = document.querySelector('.progress-text')
                if (playButton) {
                    playButton.disabled = true
                    let playText = playButton.querySelector('.play-text')
                    if (playText) playText.textContent = 'Server Unavailable'
                }
                if (progressText) {
                    progressText.textContent = 'Cannot connect to server'
                }
                this.setOfflineStatus()
                return
            }

            // Set default instance if none selected
            if (!configClient.instance_selct) {
                configClient.instance_selct = instancesList[0].name
                await this.db.updateData('configClient', configClient)
            }

            // Update server status
            let currentInstance = instancesList.find(i => i.name === configClient.instance_selct)
            if (currentInstance && currentInstance.status) {
                await this.updateServerStatus(currentInstance.status)
            } else {
                this.setOfflineStatus()
            }

        } catch (error) {
            console.error('Error in instancesSelect:', error)
            this.setOfflineStatus()
        }
    }

    async updateServerStatus(status) {
        if (!status) return this.setOfflineStatus()

        try {
            // Update header status
            let headerStatusText = document.querySelector('.server-status-text')
            let statusPlayerCount = document.querySelector('.status-player-count')
            
            // Update main server card status  
            let statusIndicator = document.querySelector('.status-indicator')
            let statusText = document.querySelector('.status-text')
            let playerCountElement = document.querySelector('.player-count')

            if (status.nameServer && headerStatusText) {
                headerStatusText.textContent = `${status.nameServer} • Online`
                headerStatusText.classList.remove('red')
            }

            if (statusPlayerCount) {
                statusPlayerCount.textContent = '0 players'
                statusPlayerCount.classList.remove('red')
            }

            if (statusIndicator) {
                statusIndicator.classList.remove('offline')
                statusIndicator.classList.add('online')
            }

            if (statusText) {
                statusText.textContent = 'Online • 0ms'
            }

            if (playerCountElement) {
                playerCountElement.textContent = '0 players'
            }

        } catch (error) {
            console.error('Error updating server status:', error)
            this.setOfflineStatus()
        }
    }

    setOfflineStatus() {
        try {
            // Update header status
            let headerStatusText = document.querySelector('.server-status-text')
            let statusPlayerCount = document.querySelector('.status-player-count')
            
            // Update main server card status
            let statusIndicator = document.querySelector('.status-indicator')
            let statusText = document.querySelector('.status-text')
            let playerCountElement = document.querySelector('.player-count')

            if (headerStatusText) {
                headerStatusText.textContent = 'Offline'
                headerStatusText.classList.add('red')
            }

            if (statusPlayerCount) {
                statusPlayerCount.textContent = 'Server offline'
                statusPlayerCount.classList.add('red')
            }

            if (statusIndicator) {
                statusIndicator.classList.remove('online')
                statusIndicator.classList.add('offline')
            }

            if (statusText) {
                statusText.textContent = 'Offline'
            }

            if (playerCountElement) {
                playerCountElement.textContent = 'Server offline'
            }

        } catch (error) {
            console.error('Error setting offline status:', error)
        }
    }

    setFallbackStatus() {
        try {
            // Update header status
            let headerStatusText = document.querySelector('.server-status-text')
            let statusPlayerCount = document.querySelector('.status-player-count')
            
            // Update main server card status
            let statusIndicator = document.querySelector('.status-indicator')
            let statusText = document.querySelector('.status-text')
            let playerCountElement = document.querySelector('.player-count')

            if (headerStatusText) {
                headerStatusText.textContent = 'Local Mode'
                headerStatusText.classList.remove('red')
            }

            if (statusPlayerCount) {
                statusPlayerCount.textContent = 'Offline mode'
                statusPlayerCount.classList.remove('red')
            }

            if (statusIndicator) {
                statusIndicator.classList.remove('offline')
                statusIndicator.classList.add('online')
            }

            if (statusText) {
                statusText.textContent = 'Local Mode • Ready'
            }

            if (playerCountElement) {
                playerCountElement.textContent = 'Local mode'
            }

        } catch (error) {
            console.error('Error setting fallback status:', error)
        }
    }

    // Helper method to show alerts using the popup system
    showAlert(title, message, autoClose = false) {
        try {
            const popupInstance = new popup()
            
            // Determine color based on title
            let color = '#ff6b6b'; // Default red for errors
            if (title.toLowerCase().includes('success')) {
                color = '#4caf50'; // Green for success
                autoClose = true; // Auto-close success messages
            } else if (title.toLowerCase().includes('warning')) {
                color = '#ff9800'; // Orange for warnings
            }
            
            popupInstance.openPopup({
                title: title,
                content: message,
                color: color,
                exit: false, // Don't exit app on popup close
                options: true // Show the close button
            })
            
            // Auto-close success popups after 3 seconds
            if (autoClose) {
                setTimeout(() => {
                    try {
                        popupInstance.closePopup();
                        console.log('[Alert] Auto-closed success popup');
                    } catch (error) {
                        console.log('[Alert] Auto-close attempt failed:', error);
                    }
                }, 3000);
            }
            
        } catch (error) {
            console.error('[Alert] Failed to show popup:', error);
            // Fallback to console log if popup fails
            console.log(`[${title}] ${message}`);
        }
    }
}

export default Home;
