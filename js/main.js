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
        this.legacyModules = [];
    }

    /**
     * Initialize the entire application with service architecture
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
            
            
            // 5. Initialize UI components
            await this.initializeUIComponents();
            
            this.isInitialized = true;
            
            
            // Statistics are now handled by StatsService automatically
            
        } catch (error) {
            console.error('Error loading application:', error);
            
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
        
        // Expose ServiceManager globally for external access
        window.serviceManager = this.serviceManager;
        
        // Make core components globally available
        window.App = this;
        window.AppStateManager = this.stateManager;
        
        // Initialize DOM references in StateManager
        this.initializeDOMReferences();
    }

    /**
     * Initialize DOM references in StateManager
     * This replaces functionality previously handled by AppStateProxy
     */
    initializeDOMReferences() {
        // Get DOM elements
        const canvas = document.querySelector('.mindmap-canvas');
        const canvasContent = document.querySelector('.canvas-content');
        const dropZone = document.querySelector('.drop-zone');
        const breadcrumb = document.getElementById('breadcrumb');
        const searchField = document.getElementById('searchField');
        const clearSearchBtn = document.getElementById('clearSearch');
        const searchResults = document.getElementById('searchResults');
        const searchResultsList = document.getElementById('searchResultsList');
        const musicLibrary = document.getElementById('musicLibrary');

        // Register DOM elements in StateManager
        this.stateManager.set('dom.canvas', canvas);
        this.stateManager.set('dom.canvasContent', canvasContent);
        this.stateManager.set('dom.dropZone', dropZone);
        this.stateManager.set('dom.breadcrumb', breadcrumb);
        this.stateManager.set('dom.searchField', searchField);
        this.stateManager.set('dom.clearSearchBtn', clearSearchBtn);
        this.stateManager.set('dom.searchResults', searchResults);
        this.stateManager.set('dom.searchResultsList', searchResultsList);
        this.stateManager.set('dom.musicLibrary', musicLibrary);
        
        // Initialize empty arrays for dynamic elements
        this.stateManager.set('dom.allNodes', []);
        this.stateManager.set('dom.allContainers', []);
    }

    /**
     * Setup reactive application state
     */
    async setupReactiveState() {
        
        // Initialize reactive state structure
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
        this.serviceManager.registerService('data', DataService, [], {
            required: true,
            autoStart: true
        });
        
        this.serviceManager.registerService('search', SearchService, ['data', 'dragdrop'], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('playlist', PlaylistService, ['dragdrop'], {
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
        
        // Check if UIService is available before registering
        if (typeof UIService !== 'undefined') {
            this.serviceManager.registerService('ui', UIService, ['tags', 'tracknodes', 'data', 'tree'], {
                required: false,
                autoStart: true
            });
        } else {
            console.warn('UIService not found - skipping registration');
        }
        
        if (typeof TrackNodesService !== 'undefined') {
            this.serviceManager.registerService('tracknodes', TrackNodesService, ['data'], {
                required: false,
                autoStart: true
            });
        } else {
            console.warn('TrackNodesService not found - skipping registration');
        }
        
        if (typeof DragDropService !== 'undefined') {
            this.serviceManager.registerService('dragdrop', DragDropService, ['data', 'tracknodes'], {
                required: false,
                autoStart: true
            });
        } else {
            console.warn('DragDropService not found - skipping registration');
        }
        
        if (typeof ScanService !== 'undefined') {
            this.serviceManager.registerService('scan', ScanService, ['data'], {
                required: false,
                autoStart: true
            });
        } else {
            console.warn('ScanService not found - skipping registration');
        }
        
        if (typeof LegendService !== 'undefined') {
            this.serviceManager.registerService('legend', LegendService, ['data'], {
                required: false,
                autoStart: true
            });
        } else {
            console.warn('LegendService not found - skipping registration');
        }
        
        if (typeof ClockService !== 'undefined') {
            this.serviceManager.registerService('clock', ClockService, [], {
                required: false,
                autoStart: true
            });
        } else {
            console.warn('ClockService not found - skipping registration');
        }
        
        // StatsService replaced by StatsComponent
        
        // Initialize all services
        try {
            await this.serviceManager.initializeServices();
            
            // Preload tags at startup for better performance
            await this.preloadAppData();
            
            // Render music library after DataService is initialized
            if (typeof Utils !== 'undefined' && Utils.renderMusicLibrary) {
                await Utils.renderMusicLibrary();
            }
        } catch (error) {
            // Services initialization failed
        }
    }

    /**
     * Preload essential app data at startup
     */
    async preloadAppData() {
        try {
            
            // Preload tags for legend
            const dataService = this.serviceManager?.getService('data');
            if (dataService) {
                const tags = await dataService.getTagsByCategory();
                
                // Emit event to trigger legend refresh with preloaded data
                this.eventBus.emit('data:loading:complete');
            }
            
        } catch (error) {
            console.warn('⚠️ Error preloading app data:', error);
            // Don't throw - app can still work
        }
    }

    /**
     * Setup event-driven communication bridge
     */
    setupEventIntegration() {
        
        // System-wide events
        this.eventBus.on('app:shutdown', () => {
            this.shutdown();
        });
        
        // Statistics updates are now handled by StatsService
        
        // Legacy bridge events - NOTIFICATIONS DISABLED
        this.eventBus.on('legacy:notification', (data) => {
        });
        
        // UI notification events from services - NOTIFICATIONS DISABLED
        this.eventBus.on('ui:notification', (data) => {
        });
        
        // Notification events from TagService - NOTIFICATIONS DISABLED
        this.eventBus.on('notification:show', (data) => {
        });
        
        // State synchronization events
        this.eventBus.on('state:sync', (data) => {
            const { path, value } = data;
            this.stateManager.set(path, value);
                    });
    }

    /**
     * Initialize UI components
     */
    async initializeUIComponents() {
        try {
            
            // Initialize LibraryToggle BEFORE services so EventBus subscriptions are ready
            if (typeof LibraryToggle !== 'undefined' && LibraryToggle.init) {
                LibraryToggle.init();
            }
            
            // Initialize legacy modules with error handling
            for (const moduleName of this.legacyModules) {
                if (typeof window[moduleName] !== 'undefined' && window[moduleName].initialize) {
                    try {
                        window[moduleName].initialize();
                    } catch (error) {
                        console.error(`Error initializing ${moduleName}:`, error);
                        // Continue with other modules - non-blocking
                    }
                }
            }
            
            // LibraryToggle already initialized above
            
            // Initialize StatsComponent
            if (typeof StatsComponent !== 'undefined') {
                this.statsComponent = new StatsComponent('scanStats', this.eventBus);
                window.GlobalStatsComponent = this.statsComponent;
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
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await AppInstance.initialize();
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    });
} else {
    (async () => {
        try {
            await AppInstance.initialize();
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    })();
}

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppInstance;
} 