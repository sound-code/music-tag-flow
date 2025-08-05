/**
 * DataService - Centralized data access service
 * Provides unified interface for all data operations using MusicLibraryFacade
 * Database-only implementation for Electron environment
 */
class DataService extends ServiceBase {
    constructor(stateManager, eventBus) {
        super(stateManager, eventBus);
        this.musicLibraryFacade = null;
        this.initialized = false;
        this.cache = {
            tracks: null,
            structure: null,
            stats: null,
            tags: null,
            cacheTimeout: 300000 // 5 minutes
        };
    }

    initialize() {
        // ServiceBase synchronous initialization
        // Async initialization will be handled by ServiceManager
    }

    async initializeAsync() {
        
        // Check if we're in Electron environment
        if (!window.electronAPI) {
            console.error('DataService: Electron API not available');
            throw new Error('DataService requires Electron environment for database access');
        }

        // Work directly with Electron IPC since MusicLibraryFacade uses require()
        this.useDirectIPC = true;

        // Subscribe to database update events
        this.subscribeToEvent('database:updated', () => this.clearCache());
        this.subscribeToEvent('scan:complete', () => this.clearCache());

        this.initialized = true;
        
        // Emit initialization complete event
        this.events.emit('data:loading:complete');
    }

    /**
     * Get all tracks from database
     * @param {number} limit - Maximum number of tracks to return
     * @returns {Promise<Object>} Tracks organized by artist/album structure
     */
    async getAllTracks(limit = 1000) {
        this._ensureInitialized();
        
        if (this.cache.tracks && this._isCacheValid('tracks')) {
            return this.cache.tracks.data;
        }

        try {
            const tracks = await window.electronAPI.getAllTracks(limit);
            
            // NO FALLBACKS - only database data
            if (!tracks || tracks.length === 0) {
                const emptyData = { artists: [] };
                
                this.cache.tracks = {
                    data: emptyData,
                    timestamp: Date.now()
                };
                return emptyData;
            }
            
            const organizedData = this._organizeTracksIntoStructure(tracks);
            
            this.cache.tracks = {
                data: organizedData,
                timestamp: Date.now()
            };
            return organizedData;
        } catch (error) {
            console.error('Error getting all tracks:', error);
            // NO FALLBACKS - return empty on error
            return { artists: [] };
        }
    }

    /**
     * Get library structure for UI rendering
     * @returns {Promise<Array>} Array of artists with albums and tracks
     */
    async getLibraryStructure() {
        this._ensureInitialized();
        
        if (this.cache.structure && this._isCacheValid('structure')) {
            return this.cache.structure.data;
        }

        try {
            const tracks = await this.getAllTracks();
            const structure = tracks.artists || [];
            
            this.cache.structure = {
                data: structure,
                timestamp: Date.now()
            };
            return structure;
        } catch (error) {
            console.error('Error getting library structure:', error);
            return [];
        }
    }

    /**
     * Search tracks by various criteria
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Matching tracks
     */
    async searchTracks(query, options = {}) {
        this._ensureInitialized();
        
        try {
            const tracks = await window.electronAPI.searchTracks(query, options);
            return tracks.map(track => this._transformTrack(track));
        } catch (error) {
            console.error('Error searching tracks:', error);
            return [];
        }
    }

    /**
     * Generate tracks with a specific tag
     * @param {string} tagValue - Tag value to search for
     * @param {Object} excludeTrack - Track to exclude from results
     * @returns {Promise<Array>} Array of tracks with the tag
     */
    async generateTracksWithTag(tagValue, excludeTrack = null) {
        this._ensureInitialized();
        
        
        try {
            const allTracks = await this._getFlattenedTracks();
            
            // Find tracks with the requested tag
            let matchingTracks = allTracks.filter(track => 
                track.tags && track.tags.includes(tagValue)
            );
            
            // Exclude parent track if specified
            if (excludeTrack) {
                matchingTracks = matchingTracks.filter(track => 
                    !(track.title === excludeTrack.title && 
                      track.artist === excludeTrack.artist && 
                      track.album === excludeTrack.album)
                );
            }
            
            const requestedCount = 7; // Default count
            
            // NO FALLBACKS - only exact tag matches
            if (matchingTracks.length === 0) {
                return [];
            }
            
            return this._selectRandomTracks(matchingTracks, requestedCount);
        } catch (error) {
            console.error('Error generating tracks with tag:', error);
            return [];
        }
    }

    /**
     * Generate tracks with multiple tags
     * @param {Array} selectedTagsArray - Array of tags to match
     * @returns {Promise<Array>} Array of matching tracks
     */
    async generateTracksWithMultipleTags(selectedTagsArray) {
        this._ensureInitialized();
        
        try {
            const allTracks = await this._getFlattenedTracks();
            
            // Find tracks that have ALL the requested tags
            const exactMatches = allTracks.filter(track => 
                track.tags && selectedTagsArray.every(tag => track.tags.includes(tag))
            );
            
            // Find tracks that have SOME of the requested tags
            const partialMatches = allTracks.filter(track => 
                track.tags && selectedTagsArray.some(tag => track.tags.includes(tag))
            );
            
            const requestedCount = 7;
            
            if (exactMatches.length >= requestedCount) {
                return this._selectRandomTracks(exactMatches, requestedCount);
            } else if (partialMatches.length > 0) {
                const result = [...exactMatches];
                const remaining = requestedCount - exactMatches.length;
                const additionalTracks = this._selectRandomTracks(
                    partialMatches.filter(track => !exactMatches.includes(track)), 
                    remaining
                );
                return [...result, ...additionalTracks];
            } else {
                // NO FALLBACKS - return empty if no matches
                return [];
            }
        } catch (error) {
            console.error('Error generating tracks with multiple tags:', error);
            return [];
        }
    }

    /**
     * Get database statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStats() {
        this._ensureInitialized();
        
        if (this.cache.stats && this._isCacheValid('stats')) {
            return this.cache.stats.data;
        }

        try {
            const stats = await window.electronAPI.getStats();
            // Calculate categories count from uniqueTags
            const categories = new Set();
            if (stats.uniqueTags && Array.isArray(stats.uniqueTags)) {
                stats.uniqueTags.forEach(tag => {
                    const category = this._getTagCategory(tag);
                    if (category && category !== '') {
                        categories.add(category);
                    }
                });
            }
            const enrichedStats = {
                ...stats,
                categories: categories.size
            };
            
            this.cache.stats = {
                data: enrichedStats,
                timestamp: Date.now()
            };
            return enrichedStats;
        } catch (error) {
            console.error('Error getting stats:', error);
            return { tracks: 0, artists: 0, albums: 0, categories: 0 };
        }
    }

    /**
     * Add a tag to a track
     * @param {Object} track - Track object
     * @param {string} newTag - Tag to add
     * @returns {Promise<boolean>} Success status
     */
    async addTagToTrack(track, newTag) {
        this._ensureInitialized();
        
        try {
            const result = await window.electronAPI.addTagToTrack(track, newTag);
            if (result) {
                this.clearCache();
                this.events.emit('database:updated', {
                    type: 'tag_added',
                    track: track,
                    tag: newTag,
                    timestamp: Date.now()
                });
            }
            return result;
        } catch (error) {
            console.error('Error adding tag to track:', error);
            return false;
        }
    }

    /**
     * Get available tags grouped by category
     * @returns {Promise<Object>} Tags grouped by category
     */
    async getTagsByCategory() {
        this._ensureInitialized();
        
        if (this.cache.tags && this._isCacheValid('tags')) {
            return this.cache.tags.data;
        }

        try {
            const stats = await window.electronAPI.getStats();
            const allTags = stats.uniqueTags || [];
            
            // NO FALLBACKS - only database data
            if (allTags.length === 0) {
                this.cache.tags = {
                    data: {},
                    timestamp: Date.now()
                };
                return {};
            }
            
            // Group tags by category
            const grouped = {};
            allTags.forEach(tag => {
                const category = this._getTagCategory(tag);
                if (!grouped[category]) {
                    grouped[category] = [];
                }
                grouped[category].push(tag);
            });
            
            
            this.cache.tags = {
                data: grouped,
                timestamp: Date.now()
            };
            return grouped;
        } catch (error) {
            console.error('Error getting tags by category:', error);
            // NO FALLBACKS - return empty on error
            return {};
        }
    }

    /**
     * Clear the database
     * @returns {Promise<boolean>} Success status
     */
    async clearDatabase() {
        this._ensureInitialized();
        
        try {
            await window.electronAPI.clearDatabase();
            this.clearCache();
            this.events.emit('database:cleared');
            return true;
        } catch (error) {
            console.error('Error clearing database:', error);
            return false;
        }
    }

    /**
     * Scan directory for music files
     * @param {string} directory - Directory to scan
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>} Scan results
     */
    async scanDirectory(directory, progressCallback = null) {
        this._ensureInitialized();
        
        try {
            const result = await window.electronAPI.scanDirectory(directory);
            this.clearCache();
            return result;
        } catch (error) {
            console.error('Error scanning directory:', error);
            throw error;
        }
    }

    /**
     * Select music directory via dialog
     * @returns {Promise<string>} Selected directory path
     */
    async selectMusicDirectory() {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }
        
        try {
            return await window.electronAPI.selectMusicDirectory();
        } catch (error) {
            console.error('Error selecting directory:', error);
            throw error;
        }
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.tracks = null;
        this.cache.structure = null;
        this.cache.stats = null;
        this.cache.tags = null;
    }

    // Private helper methods

    /**
     * Get flattened array of all tracks
     * @returns {Promise<Array>} Flat array of tracks
     */
    async _getFlattenedTracks() {
        const tracksData = await this.getAllTracks();
        const allTracks = [];
        
        if (tracksData.artists) {
            tracksData.artists.forEach(artist => {
                artist.albums.forEach(album => {
                    album.tracks.forEach(track => {
                        allTracks.push({
                            ...track,
                            artist: artist.name,
                            album: album.name
                        });
                    });
                });
            });
        }
        
        return allTracks;
    }

    /**
     * Select random tracks from array
     * @param {Array} tracks - Tracks to select from
     * @param {number} count - Number to select
     * @returns {Array} Selected tracks
     */
    _selectRandomTracks(tracks, count) {
        if (tracks.length === 0) return [];
        
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        
        if (tracks.length <= count) {
            return shuffled;
        }
        
        return shuffled.slice(0, count);
    }

    /**
     * Get tag category from tag value
     * @param {string} tagValue - Tag in format "category:value"
     * @returns {string} Category part
     */
    _getTagCategory(tagValue) {
        // Use tagUtils if available for consistency with rest of app
        if (window.tagUtils && window.tagUtils.getTagType) {
            const category = window.tagUtils.getTagType(tagValue);
            return category || 'other';
        }
        
        // Fallback: extract category from tag format
        const parts = tagValue.split(':');
        return parts[0] || 'other';
    }

    /**
     * Check if cache entry is still valid
     * @param {string} key - Cache key
     * @returns {boolean} True if valid
     */
    _isCacheValid(key) {
        const cacheEntry = this.cache[key];
        if (!cacheEntry) return false;
        
        const now = Date.now();
        return (now - cacheEntry.timestamp) < this.cache.cacheTimeout;
    }

    /**
     * Ensure service is initialized
     * @throws {Error} If not initialized
     */
    _ensureInitialized() {
        if (!this.initialized) {
            throw new Error('DataService not initialized');
        }
    }

    /**
     * Organize flat tracks into artist/album structure
     * @param {Array} tracks - Flat array of tracks
     * @returns {Object} Organized data with artists array
     */
    _organizeTracksIntoStructure(tracks) {
        const artistMap = new Map();
        
        tracks.forEach(track => {
            const transformedTrack = this._transformTrack(track);
            
            // Get or create artist
            if (!artistMap.has(transformedTrack.artist)) {
                artistMap.set(transformedTrack.artist, {
                    name: transformedTrack.artist,
                    albums: new Map()
                });
            }
            
            const artist = artistMap.get(transformedTrack.artist);
            
            // Get or create album
            if (!artist.albums.has(transformedTrack.album)) {
                artist.albums.set(transformedTrack.album, {
                    name: transformedTrack.album,
                    year: track.year,
                    tracks: []
                });
            }
            
            const album = artist.albums.get(transformedTrack.album);
            album.tracks.push(transformedTrack);
        });
        
        // Convert maps to arrays
        const artists = Array.from(artistMap.values()).map(artist => ({
            name: artist.name,
            albums: Array.from(artist.albums.values())
        }));
        
        return { artists };
    }

    /**
     * Transform database track to match UI expectations
     * @param {Object} dbTrack - Raw database track
     * @returns {Object} Transformed track
     */
    _transformTrack(dbTrack) {
        // Parse tags JSON if it's a string
        let tags = [];
        if (dbTrack.tags) {
            try {
                tags = typeof dbTrack.tags === 'string' ? JSON.parse(dbTrack.tags) : dbTrack.tags;
            } catch (e) {
                tags = [];
            }
        }

        // Create tags in the format expected by the UI
        const uiTags = [];
        
        // First, add ALL original tags from database (they should already be in "category:value" format)
        if (Array.isArray(tags)) {
            uiTags.push(...tags);
        }
        
        // Add genre if available
        if (dbTrack.genre) {
            uiTags.push(`genre:${dbTrack.genre.toLowerCase()}`);
            uiTags.push(`style:${dbTrack.genre.toLowerCase()}`);
        }
        
        // Add year/era if available
        if (dbTrack.year) {
            if (dbTrack.year >= 2020) uiTags.push('era:modern');
            else if (dbTrack.year >= 2010) uiTags.push('era:2010s');
            else if (dbTrack.year >= 2000) uiTags.push('era:2000s');
            else if (dbTrack.year >= 1990) uiTags.push('era:90s');
            else uiTags.push('era:classic');
        }
        
        // Add synthetic tags based on track characteristics for better tree generation
        const trackTitle = (dbTrack.title || '').toLowerCase();
        
        // Energy tags based on genre patterns
        if (dbTrack.genre) {
            const genre = dbTrack.genre.toLowerCase();
            if (['rock', 'metal', 'punk', 'electronic', 'dance'].includes(genre)) {
                uiTags.push('energy:high');
                uiTags.push('intensity:powerful');
            } else if (['classical', 'ambient', 'folk', 'acoustic'].includes(genre)) {
                uiTags.push('energy:low');
                uiTags.push('intensity:gentle');
            } else {
                uiTags.push('energy:medium');
                uiTags.push('intensity:moderate');
            }
        }
        
        // Mood tags based on title patterns
        if (trackTitle.includes('dark') || trackTitle.includes('night') || trackTitle.includes('shadow')) {
            uiTags.push('mood:dark');
            uiTags.push('weather:night');
        } else if (trackTitle.includes('light') || trackTitle.includes('bright') || trackTitle.includes('sun')) {
            uiTags.push('mood:bright');
            uiTags.push('weather:sunny');
        } else if (trackTitle.includes('love') || trackTitle.includes('heart')) {
            uiTags.push('emotion:romantic');
            uiTags.push('vibe:emotional');
        } else {
            uiTags.push('mood:neutral');
            uiTags.push('vibe:chill');
        }
        
        // Tempo tags based on duration (rough estimation)
        if (dbTrack.duration && typeof dbTrack.duration === 'number') {
            if (dbTrack.duration < 180) { // Less than 3 minutes
                uiTags.push('tempo:upbeat');
            } else if (dbTrack.duration > 300) { // More than 5 minutes
                uiTags.push('tempo:slow');
            } else {
                uiTags.push('tempo:mid');
            }
        }
        
        // Rating tags (all database tracks are "discovered")
        uiTags.push('rating:discovered');

        // Convert duration to string format like JSON tracks
        let durationStr = '';
        if (dbTrack.duration && typeof dbTrack.duration === 'number') {
            const minutes = Math.floor(dbTrack.duration / 60);
            const seconds = Math.floor(dbTrack.duration % 60);
            durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        return {
            id: `${dbTrack.artist}-${dbTrack.title}`.toLowerCase().replace(/[^\w-]/g, '-'),
            title: dbTrack.title || 'Unknown Title',
            artist: dbTrack.artist || 'Unknown Artist',
            album: dbTrack.album || 'Unknown Album',
            duration: durationStr || '0:00',
            tags: uiTags,
            source: 'database'
        };
    }

}

// Make DataService available globally
window.DataService = DataService;