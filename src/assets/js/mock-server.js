/**
 * Mock server responses to bypass problematic server endpoints
 * This intercepts minecraft-java-core requests and provides empty/valid responses
 */

// Store original fetch function
const originalFetch = window.fetch || global.fetch;

// Mock responses for different endpoints
const mockResponses = {
    // Instance files endpoint - return empty array
    'files?instance=404NotFound': [],
    'files/?instance=404NotFound': [],
    
    // Other potential problematic endpoints
    'libraries': [],
    'assets': [],
    'versions': []
};

// Custom fetch interceptor
async function mockFetch(url, options = {}) {
    const urlString = url.toString();
    
    // Check if this is a request to our problematic server
    if (urlString.includes('cdn.data-system.org/cdn/404/files')) {
        console.log('Intercepting server request:', urlString);
        
        // Extract the query part
        const urlObj = new URL(urlString);
        const query = urlObj.search.substring(1); // Remove the '?'
        
        // Check if we have a mock response for this endpoint
        for (const [endpoint, response] of Object.entries(mockResponses)) {
            if (urlString.includes(endpoint) || query === endpoint) {
                console.log('Returning mock response for:', endpoint);
                
                // Return a mock Response object
                return new Response(JSON.stringify(response), {
                    status: 200,
                    statusText: 'OK',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }
        }
        
        // If no specific mock, return empty array
        console.log('Returning default empty response for:', urlString);
        return new Response(JSON.stringify([]), {
            status: 200,
            statusText: 'OK',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    
    // For all other requests, use the original fetch
    return originalFetch(url, options);
}

// Override global fetch
if (typeof window !== 'undefined') {
    window.fetch = mockFetch;
} else if (typeof global !== 'undefined') {
    global.fetch = mockFetch;
}

// Also override require('node-fetch') for minecraft-java-core
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
    if (id === 'node-fetch') {
        return mockFetch;
    }
    return originalRequire.apply(this, arguments);
};

console.log('Mock server initialized - problematic requests will be intercepted');

module.exports = mockFetch;
