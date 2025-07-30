/**
 * DataLoader - Manages loading and caching of external music data
 * Now uses DataSourceAdapter for flexible data source management
 */
const DataLoader = {
    initialized: false,

    /**
     * Initialize DataLoader with DataSourceAdapter
     */
    async initialize() {
        if (!this.initialized) {
            await DataSourceAdapter.initialize();
            this.initialized = true;
        }
    },

    /**
     * Get all tracks in a flattened format (compatible with current getAllTracks)
     * @returns {Promise<Array>} Array of track objects
     */
    async getAllTracks() {
        await this.initialize();
        return await DataSourceAdapter.getAllTracks();
    },

    /**
     * Search tracks by various criteria
     * @param {string} query - Search query
     * @param {string} searchType - Type of search (title, artist, album, tag)
     * @returns {Promise<Array>} Matching tracks
     */
    async searchTracks(query, searchType = 'all') {
        await this.initialize();
        return await DataSourceAdapter.searchTracks(query, searchType);
    },

    /**
     * Generate tracks with a specific tag (async version of Utils.generateTracksWithTag)
     * @param {string} tagValue - The tag value to generate tracks for
     * @param {Object} excludeTrack - Optional track to exclude from results
     * @returns {Promise<Array>} Array of track objects
     */
    async generateTracksWithTag(tagValue, excludeTrack = null) {
        await this.initialize();
        return await DataSourceAdapter.generateTracksWithTag(tagValue, excludeTrack);
    },

    /**
     * Generate tracks with multiple selected tags (async version)
     * @param {Array} selectedTagsArray - Array of selected tags
     * @returns {Promise<Array>} Array of track objects
     */
    async generateTracksWithMultipleTags(selectedTagsArray) {
        await this.initialize();
        return await DataSourceAdapter.generateTracksWithMultipleTags(selectedTagsArray);
    },

    /**
     * Get structured artist/album/track data for the music library UI
     * @returns {Promise<Array>} Array of artist objects with albums and tracks
     */
    async getLibraryStructure() {
        await this.initialize();
        return await DataSourceAdapter.getLibraryStructure();
    },

    /**
     * Add a tag to a specific track and persist to database
     * @param {Object} track - Track object with title, artist, album
     * @param {string} newTag - New tag to add (format: "category:value")
     * @returns {Promise<boolean>} Success status
     */
    async addTagToTrack(track, newTag) {
        console.log('🗄️ DataLoader.addTagToTrack called:', {
            trackTitle: track.title,
            trackArtist: track.artist,
            newTag: newTag
        });
        
        await this.initialize();
        console.log('✅ DataLoader initialized, calling DataSourceAdapter...');
        
        const result = await DataSourceAdapter.addTagToTrack(track, newTag);
        console.log('📊 DataSourceAdapter.addTagToTrack result:', result);
        
        return result;
    },

    /**
     * Clear cache (useful for reloading data)
     */
    clearCache() {
        DataSourceAdapter.clearCache();
    }
};

// Make DataLoader available globally
window.DataLoader = DataLoader; 