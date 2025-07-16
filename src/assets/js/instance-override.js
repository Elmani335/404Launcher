/**
 * Instance Configuration Override
 * This modifies the instance configuration to disable problematic features
 */

const { config } = require('./utils.js');

// Override the getInstanceList function to modify instance configurations
const originalGetInstanceList = config.getInstanceList.bind(config);

config.getInstanceList = async function() {
    try {
        const instances = await originalGetInstanceList();
        
        // Modify each instance to disable file verification and downloads
        const modifiedInstances = instances.map(instance => {
            return {
                ...instance,
                verify: false,           // Disable file verification
                url: null,              // Remove URL to prevent file downloads
                ignored: ['*'],         // Ignore all files
                loadder: {
                    ...instance.loadder,
                    // Keep only essential loader info
                }
            };
        });
        
        console.log('Modified instances to disable file downloads:', modifiedInstances);
        return modifiedInstances;
        
    } catch (error) {
        console.error('Error in getInstanceList override:', error);
        
        // Return a safe default instance
        return [{
            name: '404NotFound',
            verify: false,
            url: null,
            ignored: ['*'],
            whitelistActive: false,
            whitelist: [],
            loadder: {
                minecraft_version: '1.20.1',
                loadder_type: 'forge',
                loadder_version: '1.20.1-47.4.0'
            },
            status: {
                nameServer: '404NotFound',
                ip: '82.64.34.8',
                port: 25569
            }
        }];
    }
};

module.exports = config;
