/**
 * EventBus - Centralized event management system
 * Enables loose coupling between modules through pub/sub pattern
 */
class EventBus {
    constructor() {
        this.events = new Map();
        this.middleware = [];
        this.debugMode = false;
    }
    /**
     * Subscribe to an event
     * @param {string} eventName - Event name (use namespace:event format)
     * @param {Function} callback - Event handler
     * @param {Object} options - Subscription options
     */
    on(eventName, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error(`EventBus.on: callback must be a function for event "${eventName}"`);
        }
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        // Wrap callback with options
        const wrappedCallback = this.wrapCallback(callback, options);
        this.events.get(eventName).add(wrappedCallback);
        if (this.debugMode) {
        }
        // Return unsubscribe function
        return () => this.off(eventName, wrappedCallback);
    }
    /**
     * Unsubscribe from an event
     * @param {string} eventName - Event name
     * @param {Function} callback - Event handler to remove
     */
    off(eventName, callback) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).delete(callback);
            // Clean up empty event sets
            if (this.events.get(eventName).size === 0) {
                this.events.delete(eventName);
            }
            if (this.debugMode) {
            }
        }
    }
    /**
     * Emit an event to all subscribers
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     * @param {Object} options - Emission options
     */
    emit(eventName, data = null, options = {}) {
        if (this.debugMode) {
        }
        // Run before middleware
        this.runMiddleware('before', eventName, data);
        // Execute all listeners
        if (this.events.has(eventName)) {
            const listeners = Array.from(this.events.get(eventName));
            for (const callback of listeners) {
                try {
                    if (options.async) {
                        // Non-blocking execution
                        setTimeout(() => callback(data), 0);
                    } else {
                        callback(data);
                    }
                } catch (error) {
                    // Emit error event
                    this.emit('system:error', {
                        originalEvent: eventName,
                        error: error,
                        data: data
                    });
                }
            }
        }
        // Run after middleware
        this.runMiddleware('after', eventName, data);
    }
    /**
     * Subscribe to an event only once
     * @param {string} eventName - Event name
     * @param {Function} callback - Event handler
     */
    once(eventName, callback) {
        const onceWrapper = (data) => {
            callback(data);
            this.off(eventName, onceWrapper);
        };
        this.on(eventName, onceWrapper);
    }
    /**
     * Add middleware for event processing
     * @param {string} type - 'before' or 'after'
     * @param {Function} middleware - Middleware function
     */
    use(type, middleware) {
        if (!['before', 'after'].includes(type)) {
            throw new Error('EventBus.use: type must be "before" or "after"');
        }
        this.middleware.push({ type, middleware });
    }
    /**
     * Get all active event names
     * @returns {Array} Array of event names
     */
    getEventNames() {
        return Array.from(this.events.keys());
    }
    /**
     * Get listener count for an event
     * @param {string} eventName - Event name
     * @returns {number} Number of listeners
     */
    getListenerCount(eventName) {
        return this.events.has(eventName) ? this.events.get(eventName).size : 0;
    }
    /**
     * Clear all listeners for an event or all events
     * @param {string} eventName - Optional event name
     */
    clear(eventName = null) {
        if (eventName) {
            this.events.delete(eventName);
        } else {
            this.events.clear();
        }
    }
    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Debug mode state
     */
    setDebug(enabled) {
        this.debugMode = enabled;
    }
    /**
     * Wrap callback with options
     * @private
     */
    wrapCallback(callback, options) {
        let wrappedCallback = callback;
        // Add throttling if specified
        if (options.throttle) {
            wrappedCallback = this.throttle(wrappedCallback, options.throttle);
        }
        // Add debouncing if specified
        if (options.debounce) {
            wrappedCallback = this.debounce(wrappedCallback, options.debounce);
        }
        return wrappedCallback;
    }
    /**
     * Run middleware
     * @private
     */
    runMiddleware(type, eventName, data) {
        this.middleware
            .filter(m => m.type === type)
            .forEach(m => {
                try {
                    m.middleware(eventName, data);
                } catch (error) {
                }
            });
    }
    /**
     * Throttle function execution
     * @private
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    /**
     * Debounce function execution
     * @private
     */
    debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
}
// Create global EventBus instance
const EventBusInstance = new EventBus();
// Make it available globally (both window.EventBus and global EventBus)
window.EventBus = EventBusInstance;
// Ensure EventBus is available as a global variable too
if (typeof globalThis !== 'undefined') {
    globalThis.EventBus = EventBusInstance;
}
if (typeof global !== 'undefined') {
    global.EventBus = EventBusInstance;
}
// For browser compatibility - explicit global assignment
try {
    eval('EventBus = EventBusInstance;');
} catch (e) {
    // If in strict mode, this might fail, but window.EventBus will still work
}
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBusInstance;
}