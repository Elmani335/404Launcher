/**
 * Global JSON.parse and error protection
 * This script provides global protection against JSON parsing errors
 */

// Global JSON.parse error protection
console.log('[GLOBAL] Setting up global JSON.parse protection...');
const originalJSONParse = JSON.parse;
JSON.parse = function(text, reviver) {
    try {
        if (typeof text === 'string') {
            const trimmedText = text.trim();
            if (trimmedText.startsWith('<') || 
                trimmedText.includes('<html>') || 
                trimmedText.includes('<!DOCTYPE') ||
                trimmedText.includes('<body>') ||
                trimmedText.includes('<title>') ||
                trimmedText.includes('error code:') ||
                trimmedText.includes('<head>') ||
                trimmedText.includes('</html>')) {
                console.warn('[GLOBAL-HTML] HTML detected in JSON.parse, returning safe fallback');
                console.warn('[GLOBAL-HTML] Content preview:', trimmedText.substring(0, 100) + '...');
                
                // Check what kind of fallback to return based on context
                if (trimmedText.includes('version') || trimmedText.includes('manifest')) {
                    return { versions: [] };
                }
                if (trimmedText.includes('forge') || trimmedText.includes('fabric')) {
                    return [];
                }
                return {};
            }
        }
        return originalJSONParse.call(this, text, reviver);
    } catch (error) {
        console.error('[GLOBAL-HTML] JSON.parse error prevented:', {
            error: error.message,
            textPreview: text?.substring ? text.substring(0, 100) + '...' : text
        });
        return {};
    }
};

// Intercept all fetch requests to prevent HTML responses from reaching JSON.parse
if (typeof fetch !== 'undefined') {
    const originalFetch = fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
            const originalJson = response.json;
            response.json = function() {
                return originalJson.call(this).catch(error => {
                    if (error.message && error.message.includes('Unexpected token')) {
                        console.warn('[GLOBAL-FETCH] Caught JSON parsing error in fetch response, returning fallback');
                        return {};
                    }
                    throw error;
                });
            };
            return response;
        });
    };
}

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('[GLOBAL] Unhandled promise rejection:', event.reason);
    if (event.reason && event.reason.message && event.reason.message.includes('Unexpected token')) {
        console.warn('[GLOBAL] JSON parsing error caught in promise rejection');
        event.preventDefault(); // Prevent the error from crashing the app
    }
});

// Global error handler
window.addEventListener('error', function(event) {
    console.error('[GLOBAL] Global error:', event.error);
    if (event.error && event.error.message && event.error.message.includes('Unexpected token')) {
        console.warn('[GLOBAL] JSON parsing error caught in global error handler');
        event.preventDefault(); // Prevent the error from crashing the app
    }
});

console.log('[GLOBAL] Global error protection setup complete');
