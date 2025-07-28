/**
 * DataSourceAdapter - Unified interface for different data sources
 * Supports JSON files, REST APIs, filesystem scanning, and databases
 */
const DataSourceAdapter = {
    config: null,
    activeAdapters: new Map(),

    /**
     * Initialize the adapter with configuration
     */
    async initialize() {
        try {
            const response = await fetch('./config/dataSource.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.config = await response.json();
            
            // Initialize enabled adapters
            for (const [name, sourceConfig] of Object.entries(this.config.dataSources)) {
                if (sourceConfig.enabled) {
                    await this.initializeAdapter(name, sourceConfig);
                }
            }
        } catch (error) {
            // Fallback to default JSON adapter
            this.initializeFallbackAdapter();
        }
    },

    /**
     * Initialize a specific adapter
     */
    async initializeAdapter(name, config) {
        try {
            let adapter;
            
            switch (config.type) {
                case 'json':
                    adapter = new JsonDataAdapter(config.config);
                    break;
                case 'rest_api':
                    adapter = new RestApiAdapter(config.config);
                    break;
                case 'filesystem':
                    adapter = new FilesystemAdapter(config.config);
                    break;
                case 'database':
                    adapter = new DatabaseAdapter(config.config);
                    break;
                default:
                    throw new Error(`Unknown adapter type: ${config.type}`);
            }
            
            await adapter.initialize();
            this.activeAdapters.set(name, adapter);
        } catch (error) {
        }
    },

    /**
     * Initialize fallback adapter when config fails
     */
    initializeFallbackAdapter() {
        const fallbackConfig = {
            tracksFile: './data/tracks.json',
            sampleDataFile: './data/sample-data.json'
        };
        const adapter = new JsonDataAdapter(fallbackConfig);
        this.activeAdapters.set('fallback', adapter);
    },

    /**
     * Get the primary adapter
     */
    getPrimaryAdapter() {
        // Return the first enabled adapter, or fallback
        return this.activeAdapters.values().next().value || this.activeAdapters.get('fallback');
    },

    /**
     * Get all tracks from the primary data source
     */
    async getAllTracks() {
        const adapter = this.getPrimaryAdapter();
        if (!adapter) {
            throw new Error('No data adapter available');
        }
        return await adapter.getAllTracks();
    },

    /**
     * Search tracks using the primary adapter
     */
    async searchTracks(query, searchType = 'all') {
        const adapter = this.getPrimaryAdapter();
        if (!adapter) {
            throw new Error('No data adapter available');
        }
        return await adapter.searchTracks(query, searchType);
    },

    /**
     * Generate tracks with tag using the primary adapter
     */
    async generateTracksWithTag(tagValue) {
        const adapter = this.getPrimaryAdapter();
        if (!adapter) {
            throw new Error('No data adapter available');
        }
        return await adapter.generateTracksWithTag(tagValue);
    },

    /**
     * Generate tracks with multiple tags
     */
    async generateTracksWithMultipleTags(selectedTagsArray) {
        const adapter = this.getPrimaryAdapter();
        if (!adapter) {
            throw new Error('No data adapter available');
        }
        return await adapter.generateTracksWithMultipleTags(selectedTagsArray);
    },

    /**
     * Get library structure for UI
     */
    async getLibraryStructure() {
        const adapter = this.getPrimaryAdapter();
        if (!adapter) {
            throw new Error('No data adapter available');
        }
        return await adapter.getLibraryStructure();
    },

    /**
     * Add a tag to a specific track and persist to database
     * @param {Object} track - Track object with title, artist, album
     * @param {string} newTag - New tag to add (format: "category:value")
     * @returns {Promise<boolean>} Success status
     */
    async addTagToTrack(track, newTag) {
        const adapter = this.getPrimaryAdapter();
        if (!adapter) {
            return false;
        }
        
        if (adapter.addTagToTrack) {
            return await adapter.addTagToTrack(track, newTag);
        } else {
            return false;
        }
    },

    /**
     * Clear all adapter caches
     */
    clearCache() {
        for (const adapter of this.activeAdapters.values()) {
            if (adapter.clearCache) {
                adapter.clearCache();
            }
        }
    },

    /**
     * Get configuration settings
     */
    getSettings() {
        return this.config?.settings || {
            cacheTimeout: 300000,
            retryAttempts: 3,
            fallbackToSampleData: true,
            enableOfflineMode: true,
            trackGenerationCount: 7,
            maxTagsPerTrack: 10
        };
    },

    /**
     * Check if a feature is enabled
     */
    isFeatureEnabled(feature) {
        return this.config?.features?.[feature] || false;
    }
};

/**
 * JSON File Data Adapter
 */
class JsonDataAdapter {
    constructor(config) {
        this.config = config;
        this.cache = {
            tracks: null,
            sampleData: null
        };
    }

    async initialize() {
        // JSON adapter doesn't need special initialization
    }

    async loadTracks() {
        // Force reload every time for debugging
        
        try {
            const tracksFile = this.config.tracksFile || './data/tracks.json';
            
            // Add timestamp to force cache busting
            const timestamp = new Date().getTime();
            const response = await fetch(`${tracksFile}?_t=${timestamp}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const tracksData = await response.json();
            
            // Load and merge custom tags from localStorage
            this.loadCustomTagsFromLocalStorage(tracksData.artists);
            
            
            tracksData.artists.forEach((artist, i) => {
                artist.albums.forEach((album, j) => {
                });
            });
            
            // Cache the result
            this.cache.tracks = tracksData;
            
            return tracksData;
        } catch (error) {
            return { artists: [] };
        }
    }

    async loadSampleData() {
        if (this.cache.sampleData) {
            return this.cache.sampleData;
        }

        try {
            const response = await fetch(this.config.sampleDataFile);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.cache.sampleData = await response.json();
            return this.cache.sampleData;
        } catch (error) {
            return this.getFallbackSampleData();
        }
    }

    getFallbackSampleData() {
        return {
            sampleTrackNames: ["Midnight Dreams", "Electric Pulse", "Ocean Waves"],
            sampleArtists: ["Luna Martinez", "Alex Rivers", "Maya Chen"],
            tagTypes: ["emotion", "energy", "mood"],
            tagValues: {
                emotion: ["happy", "sad", "excited"],
                energy: ["high", "low", "explosive"],
                mood: ["bright", "dark", "cheerful"]
            }
        };
    }

    async getAllTracks() {
        const tracksData = await this.loadTracks();
        const allTracks = [];
        
        tracksData.artists.forEach(artist => {
            artist.albums.forEach(album => {
                album.tracks.forEach(track => {
                    allTracks.push(track);
                });
            });
        });
        
        return allTracks;
    }

    async searchTracks(query, searchType = 'all') {
        const allTracks = await this.getAllTracks();
        const lowerQuery = query.toLowerCase();
        
        return allTracks.filter(track => {
            switch (searchType) {
                case 'title':
                    return track.title.toLowerCase().includes(lowerQuery);
                case 'artist':
                    return track.artist.toLowerCase().includes(lowerQuery);
                case 'album':
                    return track.album.toLowerCase().includes(lowerQuery);
                case 'tag':
                    return track.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
                case 'all':
                default:
                    return track.title.toLowerCase().includes(lowerQuery) ||
                           track.artist.toLowerCase().includes(lowerQuery) ||
                           track.album.toLowerCase().includes(lowerQuery) ||
                           track.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
            }
        });
    }

    async generateTracksWithTag(tagValue, excludeTrack = null) {
        const tracksData = await this.loadTracks();
        const allTracks = [];
        
        // Flatten all tracks from all artists/albums
        for (const artist of tracksData.artists) {
            for (const album of artist.albums) {
                for (const track of album.tracks) {
                    allTracks.push({
                        ...track,
                        artist: artist.name,
                        album: album.name
                    });
                }
            }
        }
        
        
        // Find tracks that have the requested tag, excluding the parent track if specified
        let matchingTracks = allTracks.filter(track => 
            track.tags && track.tags.includes(tagValue)
        );
        
        
        // Exclude parent track to avoid direct repetition
        if (excludeTrack) {
            const originalCount = matchingTracks.length;
            matchingTracks = matchingTracks.filter(track => 
                !(track.title === excludeTrack.title && 
                  track.artist === excludeTrack.artist && 
                  track.album === excludeTrack.album)
            );
            
            if (matchingTracks.length < originalCount) {
            }
        }
        
        const settings = DataSourceAdapter.getSettings();
        const requestedCount = settings.trackGenerationCount || 3;
        
        
        if (matchingTracks.length === 0) {
            
            // Fallback: find tracks with same tag category (e.g., "mood:*" if looking for "mood:happy")
            const [tagCategory] = tagValue.split(':');
            let similarTracks = allTracks.filter(track => 
                track.tags && track.tags.some(tag => tag.startsWith(tagCategory + ':'))
            );
            
            // Also exclude parent track from similar tracks
            if (excludeTrack) {
                similarTracks = similarTracks.filter(track => 
                    !(track.title === excludeTrack.title && 
                      track.artist === excludeTrack.artist && 
                      track.album === excludeTrack.album)
                );
            }
            
            if (similarTracks.length > 0) {
                return this.selectRandomTracks(similarTracks, requestedCount, excludeTrack);
            }
            
            // Last fallback: return random tracks from library (excluding parent)
            let randomTracks = [...allTracks];
            if (excludeTrack) {
                randomTracks = randomTracks.filter(track => 
                    !(track.title === excludeTrack.title && 
                      track.artist === excludeTrack.artist && 
                      track.album === excludeTrack.album)
                );
            }
            
            return this.selectRandomTracks(randomTracks, requestedCount, excludeTrack);
        }
        
        // Return the matching tracks (or random selection if more than needed)
        return this.selectRandomTracks(matchingTracks, requestedCount, excludeTrack);
    }

    /**
     * Select random tracks from an array
     * @param {Array} tracks - Array of tracks to select from
     * @param {number} count - Number of tracks to select
     * @returns {Array} Selected tracks
     */
    selectRandomTracks(tracks, count, excludeTrack = null) {
        if (excludeTrack) {
        }
        
        if (tracks.length === 0) {
            return [];
        }
        
        // Double-check exclusion of parent track (safety measure)
        let filteredTracks = tracks;
        if (excludeTrack) {
            filteredTracks = tracks.filter(track => 
                !(track.title === excludeTrack.title && 
                  track.artist === excludeTrack.artist && 
                  track.album === excludeTrack.album)
            );
            
            if (filteredTracks.length < tracks.length) {
            }
        }
        
        if (filteredTracks.length === 0) {
            return [];
        }
        
        // Always shuffle the tracks first for better randomness
        const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
        
        if (filteredTracks.length <= count) {
            // If we don't have enough unique tracks, fill with random duplicates
            // but ensure we NEVER duplicate the parent track
            const result = [...shuffled];
            
            // Add random duplicates to reach the requested count
            while (result.length < count && shuffled.length > 0) {
                const randomTrack = shuffled[Math.floor(Math.random() * shuffled.length)];
                
                // Additional safety check: ensure we're not adding the parent track
                if (excludeTrack && 
                    randomTrack.title === excludeTrack.title && 
                    randomTrack.artist === excludeTrack.artist && 
                    randomTrack.album === excludeTrack.album) {
                    continue;
                }
                
                result.push({
                    ...randomTrack,
                    // Add a unique identifier to make it distinguishable
                    id: `${randomTrack.id || 'track'}_dup_${result.length}`,
                    generated: true
                });
            }
            
            return result;
        }
        
        // Take the requested number from shuffled tracks
        const selected = shuffled.slice(0, count);
        return selected;
    }

    async generateTracksWithMultipleTags(selectedTagsArray) {
        const tracksData = await this.loadTracks();
        const allTracks = [];
        
        // Flatten all tracks from all artists/albums
        for (const artist of tracksData.artists) {
            for (const album of artist.albums) {
                for (const track of album.tracks) {
                    allTracks.push({
                        ...track,
                        artist: artist.name,
                        album: album.name
                    });
                }
            }
        }
        
        
        // Find tracks that have ALL the requested tags
        const exactMatches = allTracks.filter(track => 
            track.tags && selectedTagsArray.every(tag => track.tags.includes(tag))
        );
        
        // Find tracks that have SOME of the requested tags
        const partialMatches = allTracks.filter(track => 
            track.tags && selectedTagsArray.some(tag => track.tags.includes(tag))
        );
        
        const settings = DataSourceAdapter.getSettings();
        const requestedCount = settings.trackGenerationCount || 7;
        
        
        // Prefer exact matches, then partial matches, then random
        if (exactMatches.length >= requestedCount) {
            return this.selectRandomTracks(exactMatches, requestedCount);
        } else if (partialMatches.length > 0) {
            // Mix exact matches with partial matches
            const result = [...exactMatches];
            const remaining = requestedCount - exactMatches.length;
            const additionalTracks = this.selectRandomTracks(
                partialMatches.filter(track => !exactMatches.includes(track)), 
                remaining
            );
            return [...result, ...additionalTracks];
        } else {
            // Fallback to random tracks
            return this.selectRandomTracks(allTracks, requestedCount);
        }
    }

    async getLibraryStructure() {
        const tracksData = await this.loadTracks();
        return tracksData.artists;
    }

    /**
     * Add a tag to a specific track in the sample data
     * @param {Object} track - Track object with title, artist, album
     * @param {string} newTag - New tag to add (format: "category:value")
     * @returns {Promise<boolean>} Success status
     */
    async addTagToTrack(track, newTag) {
        try {
            const tracksData = await this.loadTracks();
            let trackFound = false;

            // Find and update the track in all artists/albums
            for (const artist of tracksData.artists) {
                for (const album of artist.albums) {
                    for (const t of album.tracks) {
                        if (t.title === track.title && 
                            t.artist === track.artist && 
                            t.album === track.album) {
                            
                            // Add tag if not already present
                            if (!t.tags.includes(newTag)) {
                                t.tags.push(newTag);
                                trackFound = true;
                            }
                        }
                    }
                }
            }

            if (trackFound) {
                // Update cache with new data
                this.cache.tracks = tracksData;
                
                // Save to localStorage for persistence across refreshes
                this.saveCustomTagsToLocalStorage(track, newTag);
                
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * Save custom tags to localStorage for persistence
     * @param {Object} track - Track object
     * @param {string} newTag - New tag to save
     */
    saveCustomTagsToLocalStorage(track, newTag) {
        try {
            const trackKey = `${track.artist}|${track.album}|${track.title}`;
            const customTagsKey = 'musicTagFlow_customTags';
            
            // Get existing custom tags
            let customTags = {};
            const existingData = localStorage.getItem(customTagsKey);
            if (existingData) {
                customTags = JSON.parse(existingData);
            }
            
            // Add new tag to this track
            if (!customTags[trackKey]) {
                customTags[trackKey] = [];
            }
            
            if (!customTags[trackKey].includes(newTag)) {
                customTags[trackKey].push(newTag);
                localStorage.setItem(customTagsKey, JSON.stringify(customTags));
            }
        } catch (error) {
        }
    }

    /**
     * Load custom tags from localStorage and merge with track data
     * @param {Array} artists - Artists data to merge custom tags into
     */
    loadCustomTagsFromLocalStorage(artists) {
        try {
            const customTagsKey = 'musicTagFlow_customTags';
            const existingData = localStorage.getItem(customTagsKey);
            
            if (existingData) {
                const customTags = JSON.parse(existingData);
                
                // Merge custom tags back into tracks
                for (const artist of artists) {
                    for (const album of artist.albums) {
                        for (const track of album.tracks) {
                            const trackKey = `${track.artist}|${track.album}|${track.title}`;
                            if (customTags[trackKey]) {
                                // Add custom tags that aren't already present
                                customTags[trackKey].forEach(customTag => {
                                    if (!track.tags.includes(customTag)) {
                                        track.tags.push(customTag);
                                    }
                                });
                            }
                        }
                    }
                }
                
            }
        } catch (error) {
        }
    }

    clearCache() {
        this.cache.tracks = null;
        this.cache.sampleData = null;
    }
}

/**
 * REST API Data Adapter (for future API integrations)
 */
class RestApiAdapter {
    constructor(config) {
        this.config = config;
        this.cache = new Map();
    }

    async initialize() {
        // Test API connection
        try {
            const response = await fetch(`${this.config.baseUrl}/health`);
        } catch (error) {
        }
    }

    async getAllTracks() {
        // Implementation for API calls
        // This would make HTTP requests to your music library API
        return [];
    }

    async searchTracks(query, searchType) {
        return [];
    }

    // ... other methods would implement API calls
}

/**
 * Filesystem Data Adapter (for future local file scanning)
 */
class FilesystemAdapter {
    constructor(config) {
        this.config = config;
    }

    async initialize() {
    }

    async getAllTracks() {
        return [];
    }

    // ... other methods would scan filesystem
}

/**
 * Database Data Adapter (for future database integration)
 */
class DatabaseAdapter {
    constructor(config) {
        this.config = config;
    }

    async initialize() {
    }

    async getAllTracks() {
        return [];
    }

    // ... other methods would query database
}

// Make DataSourceAdapter available globally
window.DataSourceAdapter = DataSourceAdapter; 