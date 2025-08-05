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
        this.legacyModules = ['UI'];
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
            
            // 4.5. Setup AppState-StateManager bridge for backward compatibility
            this.setupAppStateBridge();
            
            // 5. Initialize legacy modules (bridge mode)
            await this.initializeLegacyBridge();
            
            this.isInitialized = true;
            
            // Show success notification via EventBus
            this.eventBus.emit('ui:notification', {
                message: 'Tree Playlist App loaded with Service Architecture! 🎵',
                type: 'success'
            });
            
            // Statistics are now handled by StatsService automatically
            
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
        
        // Expose ServiceManager globally for external access
        window.serviceManager = this.serviceManager;
        
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
        
        // Initialize DOM elements in StateManager
        this.stateManager.set('dom', {
            canvas: document.querySelector('.mindmap-canvas'),
            canvasContent: document.querySelector('.canvas-content'),
            dropZone: document.querySelector('.drop-zone'),
            breadcrumb: document.getElementById('breadcrumb'),
            searchField: document.getElementById('searchField'),
            clearSearchBtn: document.getElementById('clearSearch'),
            searchResults: document.getElementById('searchResults'),
            searchResultsList: document.getElementById('searchResultsList'),
            musicLibrary: document.getElementById('musicLibrary'),
            allNodes: [],
            allContainers: []
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
        
        this.serviceManager.registerService('search', SearchService, ['data'], {
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
        
        this.serviceManager.registerService('tracknodes', TrackNodesService, [], {
            required: false,
            autoStart: true
        });
        
        this.serviceManager.registerService('scan', ScanService, ['data'], {
            required: false,
            autoStart: true
        });
        
        if (typeof LegendService !== 'undefined') {
            this.serviceManager.registerService('legend', LegendService, ['data'], {
                required: false,
                autoStart: true
            });
        }
        
        this.serviceManager.registerService('clock', ClockService, [], {
            required: false,
            autoStart: true
        });
        
        // StatsService replaced by StatsComponent
        
        // Initialize all services
        try {
            await this.serviceManager.initializeServices();
            
            // Render music library after DataService is initialized
            if (typeof Utils !== 'undefined' && Utils.renderMusicLibrary) {
                await Utils.renderMusicLibrary();
            }
        } catch (error) {
            // Services initialization failed
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
     * Setup bridge between AppState and StateManager for backward compatibility
     */
    setupAppStateBridge() {
        if (!window.AppState || !this.stateManager) return;

        // Sync essential DOM elements from AppState to StateManager if they exist
        const domElements = ['canvas', 'canvasContent', 'dropZone', 'breadcrumb'];
        domElements.forEach(element => {
            if (window.AppState[element]) {
                this.stateManager.set(`dom.${element}`, window.AppState[element]);
            }
        });

        // Sync essential state from AppState to StateManager
        if (window.AppState.allNodes) {
            this.stateManager.set('dom.allNodes', window.AppState.allNodes);
        }
        if (window.AppState.allContainers) {
            this.stateManager.set('dom.allContainers', window.AppState.allContainers);
        }
        if (window.AppState.selectedTags) {
            this.stateManager.set('ui.selectedTags', window.AppState.selectedTags);
        }
        if (window.AppState.playlistEntries) {
            this.stateManager.set('playlist.entries', window.AppState.playlistEntries);
        }

        // Create proxy for AppState setters to update StateManager
        const originalSetters = {
            setHasUsedDropZone: window.AppState.setHasUsedDropZone,
            setCurrentMultiTagContainer: window.AppState.setCurrentMultiTagContainer,
            setCurrentTagSourceTrack: window.AppState.setCurrentTagSourceTrack,
            clearState: window.AppState.clearState,
            clearTreeState: window.AppState.clearTreeState
        };

        // Bridge AppState setters to StateManager
        if (originalSetters.setHasUsedDropZone) {
            window.AppState.setHasUsedDropZone = (value) => {
                this.stateManager.set('app.hasUsedDropZone', value);
                originalSetters.setHasUsedDropZone.call(window.AppState, value);
            };
        }

        if (originalSetters.setCurrentMultiTagContainer) {
            window.AppState.setCurrentMultiTagContainer = (container) => {
                this.stateManager.set('app.currentMultiTagContainer', container);
                originalSetters.setCurrentMultiTagContainer.call(window.AppState, container);
            };
        }

        if (originalSetters.clearTreeState) {
            window.AppState.clearTreeState = () => {
                // Clear tree state in StateManager
                this.stateManager.set('dom.allNodes', []);
                this.stateManager.set('dom.allContainers', []);
                this.stateManager.set('tree.nodes', []);
                this.stateManager.set('tree.connections', []);
                this.stateManager.set('ui.selectedTags', new Set());
                
                // Call original AppState function
                originalSetters.clearTreeState.call(window.AppState);
            };
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