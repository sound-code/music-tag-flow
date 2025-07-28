/**
 * ServiceBase - Base class for all service layer implementations
 * Provides common functionality for state management and event handling
 */
class ServiceBase {
    constructor(stateManager, eventBus) {
        if (!stateManager || !eventBus) {
            throw new Error('ServiceBase requires StateManager and EventBus instances');
        }
        this.state = stateManager;
        this.events = eventBus;
        this.subscriptions = [];
        // Initialize service after construction
        this.initialize();
    }
    /**
     * Initialize service - override in subclasses
     */
    initialize() {
        // Override in subclasses
    }
    /**
     * Subscribe to state changes with automatic cleanup
     * @param {string} path - State path to watch
     * @param {Function} callback - Change callback
     */
    subscribeToState(path, callback) {
        const unsubscribe = this.state.subscribe(path, callback);
        this.subscriptions.push(unsubscribe);
        return unsubscribe;
    }
    /**
     * Subscribe to events with automatic cleanup
     * @param {string} eventName - Event name
     * @param {Function} callback - Event callback
     */
    subscribeToEvent(eventName, callback) {
        const unsubscribe = this.events.on(eventName, callback);
        this.subscriptions.push(unsubscribe);
        return unsubscribe;
    }
    /**
     * Emit an event
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     */
    emitEvent(eventName, data) {
        this.events.emit(eventName, data);
    }
    /**
     * Get state value
     * @param {string} path - State path
     * @returns {*} State value
     */
    getState(path) {
        return this.state.get(path);
    }
    /**
     * Set state value
     * @param {string} path - State path
     * @param {*} value - New value
     * @param {Object} options - Set options
     */
    setState(path, value, options = {}) {
        this.state.set(path, value, options);
    }
    /**
     * Update multiple state values atomically
     * @param {Array} updates - Array of {path, value} objects
     */
    updateState(updates) {
        this.state.transaction(updates);
    }
    /**
     * Validate data against rules
     * @param {*} data - Data to validate
     * @param {Object} rules - Validation rules
     * @returns {boolean} Validation result
     */
    validate(data, rules) {
        if (!rules) return true;
        for (const [field, rule] of Object.entries(rules)) {
            if (typeof rule === 'function' && !rule(data[field])) {
                throw new Error(`Validation failed for field: ${field}`);
            }
        }
        return true;
    }
    /**
     * Clean up subscriptions and resources
     */
    destroy() {
        this.subscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
            }
        });
        this.subscriptions = [];
    }
    /**
     * Get service name for debugging
     * @returns {string} Service name
     */
    get serviceName() {
        return this.constructor.name;
    }
    /**
     * Log with service name prefix
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {*} data - Optional data
     */
    log(level, message, data = null) {
        // Logging disabled for production
    }
}
// Make available globally
window.ServiceBase = ServiceBase;
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ServiceBase;
}