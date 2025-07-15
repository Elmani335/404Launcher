/**
 * @author Luuxis
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
    }

    async getInstanceList() {
        let urlInstance = `${url}/files/`  // Added trailing slash to avoid redirect
        
        try {
            let response = await nodeFetch(urlInstance, { 
                follow: 10,  // Follow up to 10 redirects
                redirect: 'follow'
            })
            
            if (!response.ok) {
                console.error(`Failed to fetch instances: ${response.status} ${response.statusText}`)
                return []
            }
            
            // Check content type
            const contentType = response.headers.get('content-type')
            
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Response is not JSON:', contentType)
                const text = await response.text()
                console.error('Response body:', text.substring(0, 200) + '...')
                return []
            }
            
            let instances = await response.json()
            let instancesList = []
            
            // Check if instances is a valid object
            if (!instances || typeof instances !== 'object') {
                console.error('Invalid instances data received:', instances)
                return []
            }
            
            instances = Object.entries(instances)

            for (let [name, data] of instances) {
                let instance = data
                instance.name = name
                instancesList.push(instance)
            }
            return instancesList
        } catch (error) {
            console.error('Error fetching instance list:', error)
            return []
        }
    }

    async getNews() {
        let config = await this.GetConfig() || {}

        if (config.rss) {
            return new Promise((resolve, reject) => {
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
            })
        } else {
            return new Promise((resolve, reject) => {
                nodeFetch(news, { 
                    follow: 10,
                    redirect: 'follow'
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
                            const jsonData = await response.json()
                            return resolve(jsonData)
                        } catch (parseError) {
                            console.error('Failed to parse news JSON:', parseError)
                            return resolve(false)
                        }
                    } else {
                        return reject({ error: { code: response.statusText, message: 'server not accessible' } });
                    }
                }).catch(error => {
                    console.error('News fetch error:', error)
                    return reject({ error });
                })
            })
        }
    }
}

export default new Config;