/**
 * StatsComponent - Centralized statistics display component
 * Manages both HTML rendering and data updates
 */
class StatsComponent {
    constructor(containerId, eventBus) {
        this.containerId = containerId;
        this.eventBus = eventBus;
        this.elements = {};
        
        this.initialize();
    }

    initialize() {
        // Create HTML structure
        this.renderHTML();
        
        // Cache DOM elements
        this.cacheElements();
        
        // Subscribe to events
        this.subscribeToEvents();
        
        // Initial load
        setTimeout(() => {
            this.updateStats();
            
            // Also load initial tags list
            if (window.LibraryToggle && window.LibraryToggle.updateTagsList) {
                window.LibraryToggle.updateTagsList();
            }
        }, 1500);
    }

    /**
     * Render complete HTML structure for statistics
     */
    renderHTML() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('StatsComponent: Container not found:', this.containerId);
            return;
        }

        container.innerHTML = `
            <div class="stats-header">
                <h4>Database Statistics</h4>
                <button class="trash-button" id="clearButton" title="Clear Database">
                    🗑️
                </button>
            </div>
            <div class="stat-item">
                <span class="stat-label">Tracks:</span>
                <span class="stat-value" id="tracksCount">0</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Artists:</span>
                <span class="stat-value" id="artistsCount">0</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Albums:</span>
                <span class="stat-value" id="albumsCount">0</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Unique Tags:</span>
                <span class="stat-value" id="tagsCount">0</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Unique Categories:</span>
                <span class="stat-value" id="categoriesCount">0</span>
            </div>
        `;
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            tracksCount: document.getElementById('tracksCount'),
            artistsCount: document.getElementById('artistsCount'),
            albumsCount: document.getElementById('albumsCount'),
            categoriesCount: document.getElementById('categoriesCount'),
            tagsCount: document.getElementById('tagsCount'),
            clearButton: document.getElementById('clearButton')
        };

        // Setup clear button handler if not already handled by ScanService
        if (this.elements.clearButton && !this.elements.clearButton.onclick) {
            this.elements.clearButton.onclick = () => {
                this.handleClearDatabase();
            };
        }
    }

    /**
     * Subscribe to EventBus events
     */
    subscribeToEvents() {
        if (!this.eventBus) return;

        this.eventBus.on('scan:completed', () => {
            this.updateStats();
        });
        
        this.eventBus.on('database:cleared', () => {
            this.resetStats();
        });
        
        this.eventBus.on('stats:refresh', () => {
            this.updateStats();
        });
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
            
            // Update UI elements
            this.updateStatsUI(stats);
            
            // Emit event for other components
            if (this.eventBus) {
                this.eventBus.emit('stats:updated', stats);
            }
            
        } catch (error) {
            console.error('StatsComponent: Error updating stats:', error);
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
        
        if (this.eventBus) {
            this.eventBus.emit('stats:updated', zeroStats);
        }
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
     * Handle clear database button click
     */
    async handleClearDatabase() {
        const confirmed = confirm(
            'Are you sure you want to clear the entire database?\n\n' +
            'This will permanently delete all scanned tracks, artists, albums, and tags.\n\n' +
            'This action cannot be undone.'
        );
        
        if (!confirmed) {
            return;
        }

        try {
            if (!window.DataSourceAdapter) {
                alert('Data source not available');
                return;
            }

            const success = await window.DataSourceAdapter.clearDatabase();
            if (!success) {
                throw new Error('Failed to clear database');
            }
            
            // Emit events to notify other components
            if (this.eventBus) {
                this.eventBus.emit('database:cleared');
                this.eventBus.emit('library:refresh');
            }
            
            // Update tags list after clearing database
            if (window.LibraryToggle && window.LibraryToggle.updateTagsList) {
                window.LibraryToggle.updateTagsList();
            }
            
            alert('Database cleared successfully!');
            
        } catch (error) {
            console.error('Error clearing database:', error);
            alert('Error clearing database: ' + error.message);
        }
    }

    /**
     * Get current stats from database
     */
    async getCurrentStats() {
        try {
            if (window.DataSourceAdapter) {
                return await window.DataSourceAdapter.getStats();
            }
            return { tracks: 0, artists: 0, albums: 0, categories: 0, uniqueTags: [] };
        } catch (error) {
            console.error('StatsComponent: Error getting current stats:', error);
            return { tracks: 0, artists: 0, albums: 0, categories: 0, uniqueTags: [] };
        }
    }

    /**
     * Refresh component (useful if DOM changes)
     */
    refresh() {
        this.renderHTML();
        this.cacheElements();
        this.updateStats();
    }

    /**
     * Destroy component and cleanup
     */
    destroy() {
        if (this.eventBus) {
            this.eventBus.off('scan:completed');
            this.eventBus.off('database:cleared');
            this.eventBus.off('stats:refresh');
        }
    }
}

// Make available globally
window.StatsComponent = StatsComponent;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsComponent;
}