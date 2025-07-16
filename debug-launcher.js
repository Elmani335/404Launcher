/**
 * Debug script for 404Launcher JSON parsing issues
 * Run this with: node debug-launcher.js
 */

// Apply the patch first
require('./src/assets/js/minecraft-patch.js');

const config = require('./src/assets/js/utils/config.js').default || require('./src/assets/js/utils/config.js');

async function debugLauncherIssues() {
    console.log('=== 404LAUNCHER DEBUG SCRIPT ===');
    console.log('Checking for JSON parsing and server connectivity issues...\n');

    try {
        // Test 1: Check config loading
        console.log('1. Testing config loading...');
        const configInstance = new config();
        const appConfig = await configInstance.GetConfig();
        console.log('Config loaded:', {
            hasConfig: !!appConfig,
            configKeys: appConfig ? Object.keys(appConfig) : [],
            launcher_config: appConfig?.launcher_config || 'Not found'
        });

        // Test 2: Check instances list
        console.log('\n2. Testing instances list...');
        const instancesList = await configInstance.getInstanceList();
        console.log('Instances result:', {
            hasInstances: !!instancesList,
            instancesCount: instancesList?.length || 0,
            instances: instancesList?.map(i => ({
                name: i.name,
                isFallback: i.isFallback,
                hasUrl: !!i.url,
                version: i.loadder?.minecraft_version
            })) || []
        });

        // Test 3: Check news
        console.log('\n3. Testing news...');
        const news = await configInstance.getNews();
        console.log('News result:', {
            hasNews: !!news,
            newsCount: news?.length || 0,
            newsTypes: news?.map(n => typeof n) || []
        });

        // Test 4: Direct URL tests
        console.log('\n4. Testing direct URL requests...');
        const nodeFetch = require('node-fetch');
        
        // Test the main config URL
        if (appConfig?.client_config) {
            try {
                console.log('Testing config URL:', appConfig.client_config);
                const response = await nodeFetch(appConfig.client_config, { timeout: 5000 });
                const text = await response.text();
                console.log('Config URL response:', {
                    status: response.status,
                    statusText: response.statusText,
                    isHTML: text.includes('<html>') || text.includes('<!DOCTYPE'),
                    contentStart: text.substring(0, 100) + '...'
                });
            } catch (error) {
                console.error('Config URL error:', error.message);
            }
        }

        // Test the instances URL
        if (appConfig?.client_instances) {
            try {
                console.log('Testing instances URL:', appConfig.client_instances);
                const response = await nodeFetch(appConfig.client_instances, { timeout: 5000 });
                const text = await response.text();
                console.log('Instances URL response:', {
                    status: response.status,
                    statusText: response.statusText,
                    isHTML: text.includes('<html>') || text.includes('<!DOCTYPE'),
                    contentStart: text.substring(0, 100) + '...'
                });
            } catch (error) {
                console.error('Instances URL error:', error.message);
            }
        }

        console.log('\n=== DEBUG COMPLETE ===');
        console.log('If you see HTML responses above, that\'s the source of your JSON parsing errors.');
        console.log('The launcher should handle these gracefully now with the enhanced error handling.');

    } catch (error) {
        console.error('Debug script error:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the debug
debugLauncherIssues().then(() => {
    console.log('\nDebug script finished. You can now test the launcher.');
}).catch(error => {
    console.error('Failed to run debug script:', error);
});
