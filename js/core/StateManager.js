/**
 * StateManager - Centralized state management with validation and change notifications
 * Replaces direct AppState manipulation with controlled access
 */
class StateManager {
    constructor(eventBus) {
        if (!eventBus || typeof eventBus.emit !== 'function') {
            throw new Error(`StateManager requires EventBus instance with emit method. Received: ${typeof eventBus}`);
        }
        this.eventBus = eventBus;
        this.state = this.initializeState();
        this.listeners = new Map();
        this.history = [];
        this.maxHistorySize = 50;
        this.batchUpdates = false;
        this.pendingUpdates = [];
        this.validationRules = this.initializeValidation();
    }
    /**
     * Initialize the application state structure
     * @private
     */
    initializeState() {
        return {
            // Tree state
            tree: {
                nodes: [],
                connections: [],
                rootNode: null,
                nodeCounter: 0
            },
            // Playlist state
            playlist: {
                entries: [],
                currentIndex: 0,
                isPlaying: false,
                totalDuration: 0
            },
            // UI state
            ui: {
                selectedTags: new Set(),
                currentView: 'tree',
                dropZoneVisible: true,
                isLoading: false,
                notifications: []
            },
            // Application state
            app: {
                hasUsedDropZone: false,
                isPhasesViewActive: false,
                currentMultiTagContainer: null,
                currentTagSourceTrack: null,
                selectedTagForNextNode: null
            },
            // Data state
            data: {
                tracks: [],
                artists: [],
                albums: [],
                loadedSources: []
            },
            // DOM state
            dom: {
                canvas: null,
                canvasContent: null,
                breadcrumb: null,
                dropZone: null,
                allNodes: [],
                allContainers: []
            }
        };
    }
    /**
     * Initialize validation rules for state properties
     * @private
     */
    initializeValidation() {
        return {
            'tree.nodeCounter': (value) => typeof value === 'number' && value >= 0,
            'playlist.entries': (value) => Array.isArray(value),
            'playlist.currentIndex': (value) => typeof value === 'number' && value >= 0,
            'ui.selectedTags': (value) => value instanceof Set,
            'dom.allNodes': (value) => Array.isArray(value),
            'dom.allContainers': (value) => Array.isArray(value)
        };
    }
    /**
     * Get a value from the state
     * @param {string} path - Dot notation path (e.g., 'tree.nodes')
     * @returns {*} The value at the path
     */
    get(path) {
        try {
            return this.getNestedProperty(this.state, path);
        } catch (error) {
            return undefined;
        }
    }
    /**
     * Set a value in the state
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     * @param {Object} options - Set options
     */
    set(path, value, options = {}) {
        if (!path) {
            throw new Error('StateManager.set: path is required');
        }
        // Validate the value if rule exists
        if (this.validationRules[path] && !this.validationRules[path](value)) {
            throw new Error(`StateManager.set: Invalid value for "${path}"`);
        }
        const oldValue = this.get(path);
        // Don't update if value hasn't changed (unless forced)
        if (!options.force && this.deepEqual(oldValue, value)) {
            return;
        }
        // Add to history
        if (!this.batchUpdates) {
            this.addToHistory(path, oldValue, value);
        }
        // Update the state
        this.setNestedProperty(this.state, path, value);
        // Notify listeners and EventBus
        if (!this.batchUpdates) {
            this.notifyChange(path, value, oldValue);
        } else {
            this.pendingUpdates.push({ path, value, oldValue });
        }
    }
    /**
     * Update multiple state values atomically
     * @param {Array} updates - Array of {path, value} objects
     */
    transaction(updates) {
        if (!Array.isArray(updates)) {
            throw new Error('StateManager.transaction: updates must be an array');
        }
        this.batchUpdates = true;
        this.pendingUpdates = [];
        try {
            updates.forEach(({ path, value, options }) => {
                this.set(path, value, options);
            });
            // Process all pending updates
            this.flush();
        } catch (error) {
            // Rollback on error
            this.rollback();
            throw error;
        } finally {
            this.batchUpdates = false;
            this.pendingUpdates = [];
        }
    }
    /**
     * Subscribe to state changes
     * @param {string} path - Path to watch
     * @param {Function} callback - Change callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        this.listeners.get(path).add(callback);
        // Return unsubscribe function
        return () => {
            if (this.listeners.has(path)) {
                this.listeners.get(path).delete(callback);
            }
        };
    }
    /**
     * Get the entire state (read-only)
     * @returns {Object} Cloned state object
     */
    getState() {
        return this.deepClone(this.state);
    }
    /**
     * Reset state to initial values
     * @param {Array} paths - Optional paths to reset (resets all if not provided)
     */
    reset(paths = null) {
        const initialState = this.initializeState();
        if (paths) {
            paths.forEach(path => {
                const initialValue = this.getNestedProperty(initialState, path);
                this.set(path, initialValue);
            });
        } else {
            this.state = initialState;
            this.eventBus.emit('state:reset');
        }
    }
    /**
     * Get state change history
     * @returns {Array} History array
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Undo last state change
     * @returns {boolean} True if undo was successful
     */
    undo() {
        if (this.history.length === 0) {
            return false;
        }
        const lastChange = this.history.pop();
        this.setNestedProperty(this.state, lastChange.path, lastChange.oldValue);
        this.notifyChange(lastChange.path, lastChange.oldValue, lastChange.newValue);
        return true;
    }
    /**
     * Clear change history
     */
    clearHistory() {
        this.history = [];
    }
    // Private methods
    /**
     * Get nested property using dot notation
     * @private
     */
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
    /**
     * Set nested property using dot notation
     * @private
     */
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
    /**
     * Notify listeners of state changes
     * @private
     */
    notifyChange(path, newValue, oldValue) {
        // Notify specific path listeners
        if (this.listeners.has(path)) {
            this.listeners.get(path).forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                }
            });
        }
        // Emit global state change event
        this.eventBus.emit('state:change', {
            path,
            newValue,
            oldValue,
            timestamp: Date.now()
        });
        // Emit specific state change event
        const eventName = `state:${path.replace(/\./g, ':')}`;
        this.eventBus.emit(eventName, {
            value: newValue,
            oldValue,
            path
        });
    }
    /**
     * Add change to history
     * @private
     */
    addToHistory(path, oldValue, newValue) {
        this.history.push({
            path,
            oldValue: this.deepClone(oldValue),
            newValue: this.deepClone(newValue),
            timestamp: Date.now()
        });
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }
    /**
     * Flush pending updates after transaction
     * @private
     */
    flush() {
        this.pendingUpdates.forEach(({ path, value, oldValue }) => {
            this.notifyChange(path, value, oldValue);
        });
    }
    /**
     * Rollback transaction on error
     * @private
     */
    rollback() {
        // For now, just clear pending updates
        // In the future, we could implement proper rollback
        this.pendingUpdates = [];
    }
    /**
     * Deep clone object
     * @private
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Set) return new Set(obj);
        if (obj instanceof Map) return new Map(obj);
        if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = this.deepClone(obj[key]);
        });
        return cloned;
    }
    /**
     * Deep equality check
     * @private
     */
    deepEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return false;
        if (typeof a !== typeof b) return false;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            return a.every((item, index) => this.deepEqual(item, b[index]));
        }
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length) return false;
            return keysA.every(key => this.deepEqual(a[key], b[key]));
        }
        return false;
    }
}
// Create global StateManager instance (will be initialized in main.js)
window.StateManager = StateManager;
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}