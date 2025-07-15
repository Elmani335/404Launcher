/**
 * Minecraft Java Core Patch
 * This patches the minecraft-java-core library to prevent problematic HTTP requests
 */

const Module = require('module');
const originalRequire = Module.prototype.require;

// Mock fetch function that always returns empty JSON
const mockFetch = async (url, options) => {
    console.log('MockFetch intercepted:', url);
    
    // Return empty JSON for any problematic requests
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
            get: (header) => {
                if (header.toLowerCase() === 'content-type') {
                    return 'application/json';
                }
                return null;
            }
        },
        json: async () => ([]),
        text: async () => '[]',
        buffer: async () => Buffer.from('[]'),
        clone: function() { return this; }
    };
};

// Override node-fetch
Module.prototype.require = function(id) {
    if (id === 'node-fetch') {
        return mockFetch;
    }
    
    // Call original require for everything else
    const result = originalRequire.apply(this, arguments);
    
    // If this is minecraft-java-core, patch its internals
    if (id === 'minecraft-java-core') {
        console.log('Patching minecraft-java-core...');
        
        // Try to patch the Launch class if available
        if (result && result.Launch) {
            const OriginalLaunch = result.Launch;
            
            // Override Launch constructor to modify options
            result.Launch = class PatchedLaunch extends OriginalLaunch {
                constructor() {
                    super();
                    console.log('Patched Launch instance created');
                }
                
                Launch(options) {
                    // Modify options to disable file downloads
                    const patchedOptions = {
                        ...options,
                        verify: false,
                        url: null,
                        ignored: ['*']
                    };
                    
                    console.log('Launch called with patched options:', patchedOptions);
                    return super.Launch(patchedOptions);
                }
            };
        }
    }
    
    return result;
};

console.log('Minecraft Java Core patch applied');

module.exports = mockFetch;
