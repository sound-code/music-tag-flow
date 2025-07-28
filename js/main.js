/**
 * Main Application Module - Service Architecture with Legacy Bridge
 * Safely migrates to service architecture while maintaining legacy compatibility
 */

class Application {
    constructor() {
        this.stateManager = null;
        this.eventBus = null;
        this.serviceManager = null;
        this.isInitialized = false;
        this.legacyModules = ['Tree', 'DragDrop', 'Search', 'UI', 'RealTimeClock'];
    }

    /**
     * Initialize the entire application with service architecture + legacy bridge
     */
    async initialize() {
        try {
            
            // 1. Initialize core infrastructure
            await this.initializeCore();
            
            // 2. Setup application state (reactive)
            await this.setupReactiveState();
            
            // 3. Register and initialize services
            await this.initializeServices();
            
            // 4. Setup event-driven communication
            this.setupEventIntegration();
            
            // 5. Initialize legacy modules (bridge mode)
            await this.initializeLegacyBridge();
            
            this.isInitialized = true;
            
            // Show success notification via EventBus
            this.eventBus.emit('ui:notification', {
                message: 'Tree Playlist App loaded with Service Architecture! 🎵',
                type: 'success'
            });
            
        } catch (error) {
            
            // Fallback to legacy notification
            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification('Error loading application.');
            }
            
            throw error;
        }
    }

    /**
     * Initialize core infrastructure (EventBus, StateManager, ServiceManager)
     */
    async initializeCore() {
        
        // Initialize EventBus (global instance already created)
        this.eventBus = window.EventBus;
        if (!this.eventBus) {
            throw new Error('EventBus not available - check if EventBus.js loaded correctly');
        }
        this.eventBus.setDebug(true); // Enable debug for development
        
        // Initialize StateManager with EventBus
        this.stateManager = new StateManager(this.eventBus);
        
        // Initialize ServiceManager
        this.serviceManager = new ServiceManager(this.stateManager, this.eventBus);
        
        // Make core components globally available
        window.App = this;
        window.AppStateManager = this.stateManager;
    }

    /**
     * Setup reactive application state
     */
    async setupReactiveState() {
        
        // Initialize state structure that mirrors legacy AppState
        this.stateManager.set('app', {
            version: '2.0.0',
            isLoading: false,
            isInitialized: false
        });
        
        this.stateManager.set('nodes', {
            all: [],
            counter: 0
        });
        
        this.stateManager.set('containers', {
            all: []
        });
        
        this.stateManager.set('tags', {
            selected: new Set(),
            currentSource: null
        });
        
        this.stateManager.set('playlist', {
            entries: [],
            isTreeBuilding: false
        });
        
        this.stateManager.set('ui', {
            hasUsedDropZone: false,
            isPhasesViewActive: false,
            currentPlaylistTime: 0,
            rootNodeColor: null
        });
    }

    /**
     * Initialize services with proper dependencies
     */
    async initializeServices() {
        
        // Register services with database fallback support
        
        // Essential services
        this.serviceManager.registerService('search', SearchService, [], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('playlist', PlaylistService, [], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('tags', TagService, [], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('tree', TreeService, ['playlist', 'tags'], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('phases', PhasesService, [], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('ui', UIService, [], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('dragdrop', DragDropService, [], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('scan', ScanService, [], {
            required: false,
            autoStart: true
        });
        
        
        // Initialize all services
        await this.serviceManager.initializeServices();
    }

    /**
     * Setup event-driven communication bridge
     */
    setupEventIntegration() {
        
        // System-wide events
        this.eventBus.on('app:shutdown', () => {
            this.shutdown();
        });
        
        // Legacy bridge events
        this.eventBus.on('legacy:notification', (data) => {
            // Bridge legacy Utils.showNotification calls to EventBus
            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification(data.message);
            }
        });
        
        // UI notification events from services
        this.eventBus.on('ui:notification', (data) => {
            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification(data.message);
            }
        });
        
        // Notification events from TagService
        this.eventBus.on('notification:show', (data) => {
            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification(data.message, data.type);
            }
        });
        
        // State synchronization events (bridge AppState to StateManager)
        this.eventBus.on('state:sync', (data) => {
            const { path, value } = data;
            this.stateManager.set(path, value);
                    });
    }

    /**
     * Initialize legacy modules with bridge compatibility
     */
    async initializeLegacyBridge() {
        try {
            // Initialize phases DOM elements first (legacy requirement)
            if (typeof AppState !== 'undefined' && AppState.initializePhasesElements) {
                AppState.initializePhasesElements();
            }
            
            // Initialize AppState EventBus listeners
            if (typeof AppState !== 'undefined' && AppState.initializeEventBusListeners) {
                AppState.initializeEventBusListeners();
            }
            
            // Initialize data source adapter
            if (typeof DataSourceAdapter !== 'undefined') {
                await DataSourceAdapter.initialize();
            }
            
            // Render dynamic music library
            if (typeof Utils !== 'undefined' && Utils.renderMusicLibrary) {
                await Utils.renderMusicLibrary();
            }
            
            // Initialize legacy modules with error handling
            for (const moduleName of this.legacyModules) {
                if (typeof window[moduleName] !== 'undefined' && window[moduleName].initialize) {
                    try {
                        window[moduleName].initialize();
                    } catch (error) {
                        // Continue with other modules - non-blocking
                    }
                }
            }
            
        } catch (error) {
            // Don't throw - app can still work with services
        }
    }

    /**
     * Get a service instance
     * @param {string} serviceName - Service name
     * @returns {Object|null} Service instance
     */
    getService(serviceName) {
        return this.serviceManager ? this.serviceManager.getService(serviceName) : null;
    }

    /**
     * Check if application is fully initialized
     * @returns {boolean} Initialization status
     */
    isReady() {
        return this.isInitialized && 
               this.serviceManager && 
               this.serviceManager.isInitialized;
    }

    /**
     * Get application statistics and health
     * @returns {Object} Application stats
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            services: this.serviceManager ? this.serviceManager.getStatistics() : null,
            state: this.stateManager ? this.stateManager.getStats() : null,
            events: this.eventBus ? {
                activeEvents: this.eventBus.getEventNames().length,
                debugMode: this.eventBus.debugMode
            } : null
        };
    }

    /**
     * Graceful application shutdown
     */
    async shutdown() {
        
        if (this.serviceManager) {
            await this.serviceManager.shutdownServices();
        }
        
        this.isInitialized = false;
    }
}

// Create and initialize the application
const AppInstance = new Application();

// Make it available globally (maintains legacy compatibility)
window.App = AppInstance;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppInstance.initialize());
} else {
    AppInstance.initialize();
}

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppInstance;
} 