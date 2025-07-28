/**
 * Search Module - Pure Facade/Bridge to SearchService
 * Provides backward compatibility for legacy code
 * All functionality is delegated to SearchService
 */

const Search = {
    /**
     * Initialize search functionality
     * SearchService handles all events and functionality
     */
    initialize() {
        // SearchService handles everything
        // This method exists only for backward compatibility
    },

    /**
     * Get all tracks from the music library
     * @returns {Promise<Array>} Array of track objects
     */
    async getAllTracks() {
        // Check if SearchService is available
        if (window.App && window.App.getService) {
            const searchService = window.App.getService('search');
            if (searchService && typeof searchService.getAllTracks === 'function') {
                return await searchService.getAllTracks();
            }
        }
        
        // Fallback to DataLoader
        return await DataLoader.getAllTracks();
    },

    /**
     * Filter tracks based on search term
     * @param {string} searchTerm - The search term
     * @returns {Promise<Array>} Filtered tracks array
     */
    async filterTracks(searchTerm) {
        // Delegate to SearchService
        if (window.App && window.App.getService) {
            const searchService = window.App.getService('search');
            if (searchService && typeof searchService.filterTracks === 'function') {
                return await searchService.filterTracks(searchTerm);
            }
        }
        
        // Fallback implementation (should not be reached if SearchService is available)
        if (!searchTerm || searchTerm.trim().length === 0) {
            return [];
        }
        
        const allTracks = await this.getAllTracks();
        const term = searchTerm.toLowerCase().trim();
        
        return allTracks.filter(track => {
            const title = track.title.toLowerCase();
            const artist = track.artist.toLowerCase();
            const album = track.album.toLowerCase();
            
            const titleWords = title.split(' ');
            const artistWords = artist.split(' ');
            const albumWords = album.split(' ');
            
            let tagMatch = false;
            if (track.tags && track.tags.length > 0) {
                tagMatch = track.tags.some(tag => {
                    const tagLower = tag.toLowerCase();
                    const [category, value] = tag.split(':');
                    return tagLower.includes(term) || 
                           (category && category.toLowerCase().includes(term)) ||
                           (value && value.toLowerCase().includes(term));
                });
            }
            
            return titleWords.some(word => word.startsWith(term)) ||
                   artistWords.some(word => word.startsWith(term)) ||
                   albumWords.some(word => word.startsWith(term)) ||
                   tagMatch;
        });
    },

    /**
     * Display search results
     * @param {Array} tracks - Array of track objects to display
     */
    displayResults(tracks) {
        // Delegate to SearchService
        if (window.App && window.App.getService) {
            const searchService = window.App.getService('search');
            if (searchService && typeof searchService.updateSearchDisplay === 'function') {
                searchService.updateSearchDisplay(tracks);
                return;
            }
        }
        
        // This should not be reached if SearchService is available
    },

    /**
     * Clear search
     */
    clear() {
        // Delegate to SearchService
        if (window.App && window.App.getService) {
            const searchService = window.App.getService('search');
            if (searchService && typeof searchService.clearSearch === 'function') {
                searchService.clearSearch();
                return;
            }
        }
        
        // This should not be reached if SearchService is available
    },

    /**
     * Initialize EventBus integration (legacy compatibility)
     */
    initializeEventBusIntegration() {
        // No longer needed - SearchService handles all events
    },

    /**
     * Handle search query events (legacy compatibility)
     */
    handleSearchQuery(data) {
        // No longer needed - SearchService handles all events
    },

    /**
     * Handle search clear events (legacy compatibility)
     */
    handleSearchClear() {
        // No longer needed - SearchService handles all events
    },

    /**
     * Handle data ready events (legacy compatibility)
     */
    handleDataReady() {
        // No longer needed - SearchService handles all events
    }
};

// Make Search available globally
window.Search = Search;