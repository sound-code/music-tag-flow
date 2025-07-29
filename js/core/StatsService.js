/**
 * StatsService - Centralized statistics management
 * Handles all database statistics display and updates via EventBus
 */
class StatsService extends ServiceBase {
    constructor(stateManager, eventBus) {
        // Initialize properties BEFORE calling super() since super() calls initialize()
        this.updateTimers = [];
        this.elements = {
            tracksCount: null,
            artistsCount: null,
            albumsCount: null,
            categoriesCount: null,
            tagsCount: null
        };
        
        super(stateManager, eventBus);
    }

    initialize() {
        // Subscribe to all stats-related events
        this.subscribeToEvent('scan:completed', () => {
            this.updateStats();
        });
        
        this.subscribeToEvent('database:cleared', () => {
            this.resetStats();
        });
        
        this.subscribeToEvent('stats:refresh', () => {
            this.updateStats();
        });
        
        // Initialize DOM elements
        this.initializeElements();
        
        // Initial stats load
        setTimeout(() => {
            this.updateStats();
        }, 1000);
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements.tracksCount = document.getElementById('tracksCount');
        this.elements.artistsCount = document.getElementById('artistsCount');
        this.elements.albumsCount = document.getElementById('albumsCount');
        this.elements.categoriesCount = document.getElementById('categoriesCount');
        this.elements.tagsCount = document.getElementById('tagsCount');
    }

    /**
     * Update all statistics from database
     */
    async updateStats() {
        try {
            if (!window.DataSourceAdapter) {
                return;
            }
            
            // Clear cache to ensure fresh data
            if (window.DataSourceAdapter.clearCache) {
                window.DataSourceAdapter.clearCache();
            }
            
            const stats = await window.DataSourceAdapter.getStats();
            
            // Update all UI elements
            this.updateStatsUI(stats);
            
            // Emit event for other components
            this.emitEvent('stats:updated', stats);
            
        } catch (error) {
            console.error('StatsService: Error updating stats:', error);
        }
    }

    /**
     * Reset all statistics to zero
     */
    resetStats() {
        const zeroStats = {
            tracks: 0,
            artists: 0,
            albums: 0,
            categories: 0,
            uniqueTags: []
        };
        
        this.updateStatsUI(zeroStats);
        this.emitEvent('stats:updated', zeroStats);
    }

    /**
     * Update UI elements with stats data
     */
    updateStatsUI(stats) {
        if (this.elements.tracksCount) {
            this.elements.tracksCount.textContent = stats.tracks || 0;
        }
        if (this.elements.artistsCount) {
            this.elements.artistsCount.textContent = stats.artists || 0;
        }
        if (this.elements.albumsCount) {
            this.elements.albumsCount.textContent = stats.albums || 0;
        }
        if (this.elements.categoriesCount) {
            this.elements.categoriesCount.textContent = stats.categories || 0;
        }
        if (this.elements.tagsCount && stats.uniqueTags) {
            this.elements.tagsCount.textContent = stats.uniqueTags.length || 0;
        }
    }

    /**
     * Get current stats from database
     * @returns {Promise<Object>} Current statistics
     */
    async getCurrentStats() {
        try {
            if (window.DataSourceAdapter) {
                return await window.DataSourceAdapter.getStats();
            }
            return { tracks: 0, artists: 0, albums: 0, categories: 0, uniqueTags: [] };
        } catch (error) {
            console.error('StatsService: Error getting current stats:', error);
            return { tracks: 0, artists: 0, albums: 0, categories: 0, uniqueTags: [] };
        }
    }

    /**
     * Force refresh elements (in case DOM changed)
     */
    refreshElements() {
        this.initializeElements();
        this.updateStats();
    }

    /**
     * Cleanup on destroy
     */
    destroy() {
        this.clearTimers();
        super.destroy();
    }

    /**
     * Clear any pending timers
     */
    clearTimers() {
        this.updateTimers.forEach(timer => clearTimeout(timer));
        this.updateTimers = [];
    }
}

// Make available globally
window.StatsService = StatsService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsService;
}