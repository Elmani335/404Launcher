/**
 * @author SentryXSystems
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');

let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url

let config = `${url}/launcher/config-launcher/config.json`;
let news = `${url}/launcher/news-launcher/news.json`;

class Config {
    GetConfig() {
        return new Promise((resolve, reject) => {
            nodeFetch(config, { 
                follow: 10,
                redirect: 'follow'
            }).then(async response => {
                if (response.status === 200) {
                    // Check content type
                    const contentType = response.headers.get('content-type')
                    
                    if (!contentType || !contentType.includes('application/json')) {
                        console.error('Config response is not JSON:', contentType)
                        const text = await response.text()
                        console.error('Config response body:', text.substring(0, 200) + '...')
                        return reject({ error: { code: 'INVALID_RESPONSE', message: 'Server returned HTML instead of JSON' } })
                    }
                    
                    try {
                        const jsonData = await response.json()
                        return resolve(jsonData)
                    } catch (parseError) {
                        console.error('Failed to parse config JSON:', parseError)
                        return reject({ error: { code: 'PARSE_ERROR', message: 'Invalid JSON response' } })
                    }
                } else {
                    return reject({ error: { code: response.statusText, message: 'server not accessible' } });
                }
            }).catch(error => {
                console.error('Config fetch error:', error)
                return reject({ error });
            })
        })
    }    async getInstanceList(retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds between retries
        
        let urlInstance = `${url}/files/`  // Added trailing slash to avoid redirect
        
        try {
            let response = await nodeFetch(urlInstance, { 
                follow: 10,  // Follow up to 10 redirects
                redirect: 'follow',
                timeout: 10000 // 10 second timeout
            })
            
            if (!response.ok) {
                console.error(`Failed to fetch instances: ${response.status} ${response.statusText}`)
                
                // Return fallback instance if server is down
                if (response.status >= 500) {
                    console.log('Server error detected, using fallback instance')
                    return this.getFallbackInstance()
                }
                return this.getFallbackInstance()
            }

            // Check content type
            const contentType = response.headers.get('content-type')
            const responseText = await response.text()

            if (!contentType || !contentType.includes('application/json')) {
                console.error('Response is not JSON:', contentType)
                console.error('Response text:', responseText)
                // If we get HTML instead of JSON, likely server error - retry
                if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE') || responseText.includes('error code:')) {
                    if (retryCount < maxRetries) {
                        console.log(`HTML/Error response detected, retrying... (${retryCount + 1}/${maxRetries})`)
                        await this.delay(retryDelay)
                        return this.getInstanceList(retryCount + 1)
                    } else {
                        console.log('Max retries reached, using fallback instance')
                        return this.getFallbackInstance()
                    }
                }
                return this.getFallbackInstance()
            }
            
            let instances;
            try {
                instances = JSON.parse(responseText)
            } catch (parseError) {
                console.error('JSON parse error:', parseError.message)
                console.error('Response text:', responseText)
                
                // Retry on JSON parse errors
                if (retryCount < maxRetries) {
                    console.log(`JSON parse error, retrying... (${retryCount + 1}/${maxRetries})`)
                    await this.delay(retryDelay)
                    return this.getInstanceList(retryCount + 1)
                } else {
                    console.log('Max retries reached after parse errors, using fallback instance')
                    return this.getFallbackInstance()
                }
            }
            let instancesList = []
            
            // Check if instances is a valid object
            if (!instances || typeof instances !== 'object') {
                console.error('Invalid instances data received:', instances)
                return this.getFallbackInstance()
            }
            
            instances = Object.entries(instances)

            for (let [name, data] of instances) {
                let instance = data
                instance.name = name
                instancesList.push(instance)
            }
            
            // If no instances found, return fallback
            if (instancesList.length === 0) {
                console.log('No instances from server, using fallback')
                return this.getFallbackInstance()
            }
            
            return instancesList
        } catch (error) {
            console.error('Error fetching instance list:', error)
            
            // Check if it's a JSON parse error
            if (error.message && error.message.includes('Unexpected token')) {
                if (retryCount < maxRetries) {
                    console.log(`JSON parse error in catch, retrying... (${retryCount + 1}/${maxRetries})`)
                    await this.delay(retryDelay)
                    return this.getInstanceList(retryCount + 1)
                } else {
                    console.log('Max retries reached after JSON errors, using fallback instance')
                    return this.getFallbackInstance()
                }
            }
            
            // Network error or other issues
            if (retryCount < maxRetries) {
                console.log(`Network error, retrying... (${retryCount + 1}/${maxRetries})`)
                await this.delay(retryDelay)
                return this.getInstanceList(retryCount + 1)
            } else {
                console.log('Max retries reached after network errors, using fallback instance')
                return this.getFallbackInstance()
            }
        }
    }

    // Helper method to add delay between retries
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    getFallbackInstance() {
        console.log('=== USING FALLBACK INSTANCE ===')
        console.log('This means the server is unavailable or returning invalid responses')
        return [{
            name: "404NotFound",
            url: "https://files.minecraftforge.net/",
            status: {
                ip: "mc.hypixel.net", // Use a real server for status checking
                port: 25565,
                nameServer: "404NotFound (Offline Mode)"
            },
            loadder: {
                loadder_type: "forge",
                loadder_version: "47.2.0",
                minecraft_version: "1.20.1"
            },
            verify: true,
            ignored: [],
            whitelistActive: false,
            whitelist: [],
            isFallback: true // Mark as fallback instance
        }]
    }

    async getLocalNews() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            // Path to local news JSON file - from utils/ go up to js/, then to assets/, then to data/
            const newsPath = path.join(__dirname, '../../data/news.json');
            
            console.log('[News] Looking for local news at:', newsPath);
            
            // Check if file exists
            try {
                await fs.access(newsPath);
                console.log('[News] Local news file found!');
            } catch (error) {
                console.log('[News] Local news file not found at:', newsPath);
                console.log('[News] Access error:', error.message);
                return false;
            }
            
            // Read and parse JSON file
            const newsData = await fs.readFile(newsPath, 'utf8');
            console.log('[News] Raw news data:', newsData);
            const news = JSON.parse(newsData);
            
            console.log('[News] Loaded local news:', news.length, 'items');
            return news;
            
        } catch (error) {
            console.error('[News] Error loading local news:', error);
            return false;
        }
    }

    async getNews(retryCount = 0) {
        const maxRetries = 2; // Fewer retries for news since it's less critical
        const retryDelay = 1500; // 1.5 seconds between retries
        
        let config = await this.GetConfig() || {}

        // Always try to fetch from the news URL first (either from config or default)
        const newsUrl = config.news || news; // Use config.news if exists, otherwise use default news URL
        
        console.log('[News] Trying to fetch from URL:', newsUrl);
        
        try {
            const result = await new Promise((resolve, reject) => {
                nodeFetch(newsUrl, { 
                    follow: 10,
                    redirect: 'follow',
                    timeout: 10000 // 10 second timeout
                }).then(async response => {
                    if (response.status === 200) {
                        // Check content type
                        const contentType = response.headers.get('content-type')
                        
                        if (!contentType || !contentType.includes('application/json')) {
                            console.error('News response is not JSON:', contentType)
                            const text = await response.text()
                            console.error('News response body:', text.substring(0, 200) + '...')
                            return resolve(false) // Return false for news errors to not break the launcher
                        }
                        
                        try {
                            const responseText = await response.text()
                            console.log('[News] Raw response (first 200 chars):', responseText.substring(0, 200))
                            
                            // Clean and validate JSON before parsing
                            let cleanedJson = responseText.trim()
                            
                            // Remove trailing comma if present
                            cleanedJson = cleanedJson.replace(/,(\s*])/, '$1')
                            
                            // Try to fix common JSON formatting issues
                            cleanedJson = cleanedJson.replace(/\n\s*(?=")/g, ' ')
                            
                            const jsonData = JSON.parse(cleanedJson)
                            console.log('[News] Successfully fetched from web:', jsonData.length, 'items');
                            return resolve(jsonData)
                        } catch (parseError) {
                            console.error('Failed to parse news JSON:', parseError)
                            console.error('This indicates the JSON from the CDN is malformed')
                            
                            // Retry on JSON parse errors for news too
                            if (retryCount < maxRetries) {
                                console.log(`News JSON parse error, retrying... (${retryCount + 1}/${maxRetries})`)
                                setTimeout(async () => {
                                    try {
                                        const retryResult = await this.getNews(retryCount + 1)
                                        resolve(retryResult)
                                    } catch (err) {
                                        resolve(false)
                                    }
                                }, retryDelay)
                            } else {
                                console.log('Max retries reached for news, falling back to local')
                                return resolve(false)
                            }
                        }
                    } else {
                        console.error('News fetch failed with status:', response.status, response.statusText);
                        return resolve(false);
                    }
                }).catch(error => {
                    console.error('News fetch error:', error)
                    return resolve(false);
                })
            });
            
            if (result && result.length > 0) {
                console.log('[News] Loaded from web API:', result.length, 'items');
                return result;
            }
        } catch (error) {
            console.error('[News] Web API failed, trying local fallback:', error);
        }

        // First try RSS if available
        if (config.rss) {
            try {
                const result = await new Promise((resolve, reject) => {
                    nodeFetch(config.rss, { 
                        follow: 10,
                        redirect: 'follow'
                    }).then(async response => {
                        if (response.status === 200) {
                            try {
                                let news = [];
                                let responseText = await response.text()
                                let parsedResponse = (JSON.parse(convert.xml2json(responseText, { compact: true })))?.rss?.channel?.item;

                                if (!Array.isArray(parsedResponse)) parsedResponse = [parsedResponse];
                                for (let item of parsedResponse) {
                                    news.push({
                                        title: item.title._text,
                                        content: item['content:encoded']._text,
                                        author: item['dc:creator']._text,
                                        publish_date: item.pubDate._text
                                    })
                                }
                                return resolve(news);
                            } catch (parseError) {
                                console.error('Failed to parse RSS XML:', parseError)
                                return resolve(false)
                            }
                        }
                        else return reject({ error: { code: response.statusText, message: 'server not accessible' } });
                    }).catch(error => {
                        console.error('RSS fetch error:', error)
                        return reject({ error })
                    })
                });
                
                if (result && result.length > 0) {
                    console.log('[News] Loaded from RSS:', result.length, 'items');
                    return result;
                }
            } catch (error) {
                console.error('[News] RSS failed, trying local fallback:', error);
            }
        }
        
        // Fallback to local news JSON file
        console.log('[News] Trying local news fallback...');
        const localNews = await this.getLocalNews();
        if (localNews && localNews.length > 0) {
            return localNews;
        }
        
        // If everything fails, return false
        console.log('[News] All news sources failed');
        return false;
    }
}

export default new Config;