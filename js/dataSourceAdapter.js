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
            tracksFile: './data/tracks.json'
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
     * Organize flat database tracks into artist/album structure
     */
    organizeDatabaseTracks(tracks, allTracks, trackMap) {
        tracks.forEach(track => {
            const trackKey = `${track.artist}-${track.title}`;
            if (trackMap.has(trackKey)) return; // Skip duplicates
            
            trackMap.set(trackKey, track);
            
            // Find or create artist
            let artist = allTracks.artists.find(a => a.name === track.artist);
            if (!artist) {
                artist = {
                    name: track.artist,
                    albums: []
                };
                allTracks.artists.push(artist);
            }
            
            // Find or create album
            let album = artist.albums.find(a => a.name === track.album);
            if (!album) {
                album = {
                    name: track.album,
                    year: track.year,
                    tracks: []
                };
                artist.albums.push(album);
            }
            
            // Add track to album
            album.tracks.push(track);
        });
    },

    /**
     * Merge JSON-structured tracks
     */
    mergeJsonTracks(tracksData, allTracks, trackMap) {
        if (!tracksData.artists) return;
        
        tracksData.artists.forEach(jsonArtist => {
            // Find or create artist
            let artist = allTracks.artists.find(a => a.name === jsonArtist.name);
            if (!artist) {
                artist = {
                    name: jsonArtist.name,
                    albums: []
                };
                allTracks.artists.push(artist);
            }
            
            jsonArtist.albums.forEach(jsonAlbum => {
                // Find or create album
                let album = artist.albums.find(a => a.name === jsonAlbum.name);
                if (!album) {
                    album = {
                        name: jsonAlbum.name,
                        year: jsonAlbum.year,
                        tracks: []
                    };
                    artist.albums.push(album);
                }
                
                // Add tracks, checking for duplicates
                if (jsonAlbum.tracks) {
                    jsonAlbum.tracks.forEach(track => {
                        const trackKey = `${jsonArtist.name}-${track.title}`;
                        if (!trackMap.has(trackKey)) {
                            trackMap.set(trackKey, track);
                            album.tracks.push({
                                ...track,
                                artist: jsonArtist.name,
                                album: jsonAlbum.name
                            });
                        }
                    });
                }
            });
        });
    },

    /**
     * Get all tracks from all data sources and combine them
     */
    async getAllTracks() {
        // If we have a database adapter, use it exclusively
        if (this.activeAdapters.has('database')) {
            const databaseAdapter = this.activeAdapters.get('database');
            try {
                const result = await databaseAdapter.getAllTracks();
                return result;
            } catch (error) {
                console.error(`❌ Error loading tracks from database:`, error);
                // Fall back to other adapters if database fails
            }
        }
        
        // Fallback: combine all adapters (original behavior)
        const allTracks = { artists: [] };
        const trackMap = new Map(); // To avoid duplicates
        
        // Get tracks from all active adapters
        for (const [name, adapter] of this.activeAdapters) {
            try {
                const tracks = await adapter.getAllTracks();
                
                if (name === 'database') {
                    // Database tracks are already organized
                    this.mergeJsonTracks(tracks, allTracks, trackMap);
                } else {
                    // JSON tracks are already organized
                    this.mergeJsonTracks(tracks, allTracks, trackMap);
                }
            } catch (error) {
                console.error(`❌ Error loading tracks from ${name}:`, error);
            }
        }
        
        return allTracks;
    },

    /**
     * Clear cache and force refresh
     */
    clearCache() {
        // Clear cache for JSON adapter if it exists
        const primaryAdapter = this.getPrimaryAdapter();
        if (primaryAdapter && primaryAdapter.cache) {
            primaryAdapter.cache = {};
        }
        
        // Clear cache for all adapters
        for (const [name, adapter] of this.activeAdapters) {
            if (adapter.cache) {
                adapter.cache = {};
            }
        }
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
        // If we have a database adapter, use it exclusively
        if (this.activeAdapters.has('database')) {
            const databaseAdapter = this.activeAdapters.get('database');
            try {
                return await databaseAdapter.getLibraryStructure();
            } catch (error) {
                console.error(`❌ Error getting library structure from database:`, error);
                // Fall back to other adapters if database fails
            }
        }
        
        // Fallback to primary adapter
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
     * Get database statistics
     * @returns {Promise<Object>} Stats object with tracks, artists, albums counts
     */
    async getStats() {
        // Try database adapter first if available
        const dbAdapter = this.activeAdapters.get('database');
        if (dbAdapter && dbAdapter.getStats) {
            try {
                return await dbAdapter.getStats();
            } catch (error) {
                console.error('Error getting stats from database:', error);
            }
        }
        
        // Return default stats if no database adapter
        return { tracks: 0, artists: 0, albums: 0, uniqueTags: [] };
    },

    /**
     * Generate random synthetic tags from predefined lists
     * @param {number} tagsPerCategory - Number of random tags per category (default: 2-4)
     * @returns {Array} Array of random synthetic tags in "category:value" format
     */
    generateRandomSyntheticTags(tagsPerCategory = null) {
        // Predefined tag lists for each category
        const tagCategories = {
            emotion: ['happy', 'sad', 'romantic', 'energetic', 'melancholic', 'joyful', 'nostalgic', 'mysterious', 'uplifting', 'contemplative', 'passionate', 'dreamy'],
            energy: ['high', 'medium', 'low', 'vibrant', 'calm', 'intense', 'relaxed', 'explosive', 'gentle', 'dynamic'],
            mood: ['bright', 'dark', 'neutral', 'cheerful', 'somber', 'playful', 'serious', 'whimsical', 'dramatic', 'peaceful', 'aggressive', 'tender'],
            style: ['rock', 'pop', 'jazz', 'classical', 'electronic', 'folk', 'blues', 'reggae', 'country', 'funk', 'soul', 'indie', 'alternative'],
            genre: ['alternative', 'indie', 'experimental', 'fusion', 'acoustic', 'instrumental', 'vocal', 'orchestral', 'ambient', 'world', 'crossover'],
            intensity: ['powerful', 'gentle', 'moderate', 'fierce', 'subtle', 'overwhelming', 'delicate', 'strong', 'soft', 'crushing', 'smooth'],
            tempo: ['fast', 'slow', 'medium', 'upbeat', 'ballad', 'driving', 'relaxed', 'rushing', 'steady', 'variable', 'hypnotic'],
            vibe: ['chill', 'groovy', 'atmospheric', 'edgy', 'smooth', 'raw', 'polished', 'organic', 'synthetic', 'warm', 'cold', 'spacey'],
            rating: ['favorite', 'liked', 'discovered', 'hidden-gem', 'classic', 'underrated', 'popular', 'cult', 'mainstream', 'niche'],
            occasion: ['party', 'study', 'workout', 'relaxation', 'driving', 'morning', 'evening', 'weekend', 'work', 'travel', 'romance', 'meditation'],
            weather: ['sunny', 'rainy', 'cloudy', 'stormy', 'clear', 'foggy', 'windy', 'snow', 'spring', 'summer', 'autumn', 'winter'],
            era: ['modern', '2020s', '2010s', '2000s', '90s', '80s', '70s', '60s', 'classic', 'vintage', 'retro', 'contemporary']
        };

        const syntheticTags = [];

        // Add random tags from each category
        Object.entries(tagCategories).forEach(([category, tagList]) => {
            // Random number of tags per category (2-4 if not specified)
            const numTags = tagsPerCategory || (Math.floor(Math.random() * 3) + 2); // 2-4 tags
            
            // Shuffle and pick random tags
            const shuffledTags = [...tagList].sort(() => Math.random() - 0.5);
            const selectedTags = shuffledTags.slice(0, Math.min(numTags, tagList.length));
            
            // Add to synthetic tags with category prefix
            selectedTags.forEach(tag => {
                syntheticTags.push(`${category}:${tag}`);
            });
        });

        return syntheticTags;
    },

    /**
     * Generate synthetic tags for a track to enrich categorization (OLD METHOD - REPLACED)
     * @param {Object} track - Track object with basic metadata
     * @returns {Array} Array of synthetic tags in "category:value" format
     */
    generateSyntheticTags(track) {
        const syntheticTags = [];
        
        const trackTitle = (track.title || '').toLowerCase();
        const trackArtist = (track.artist || '').toLowerCase();
        
        // Energy tags based on genre patterns
        if (track.genre) {
            const genre = track.genre.toLowerCase();
            if (['rock', 'metal', 'punk', 'electronic', 'dance', 'edm', 'techno', 'house'].includes(genre)) {
                syntheticTags.push('energy:high');
                syntheticTags.push('intensity:powerful');
                syntheticTags.push('vibe:energetic');
            } else if (['classical', 'ambient', 'folk', 'acoustic', 'new age', 'meditation'].includes(genre)) {
                syntheticTags.push('energy:low');
                syntheticTags.push('intensity:gentle');
                syntheticTags.push('vibe:calm');
            } else if (['jazz', 'blues', 'soul', 'r&b'].includes(genre)) {
                syntheticTags.push('energy:medium');
                syntheticTags.push('intensity:smooth');
                syntheticTags.push('vibe:soulful');
            } else {
                syntheticTags.push('energy:medium');
                syntheticTags.push('intensity:moderate');
                syntheticTags.push('vibe:balanced');
            }
        } else {
            // Default tags if no genre
            syntheticTags.push('energy:medium');
            syntheticTags.push('intensity:moderate');
        }
        
        // Mood and emotion tags based on title/artist patterns
        if (trackTitle.includes('dark') || trackTitle.includes('night') || trackTitle.includes('shadow') || trackTitle.includes('black')) {
            syntheticTags.push('mood:dark');
            syntheticTags.push('weather:night');
            syntheticTags.push('emotion:mysterious');
        } else if (trackTitle.includes('light') || trackTitle.includes('bright') || trackTitle.includes('sun') || trackTitle.includes('morning')) {
            syntheticTags.push('mood:bright');
            syntheticTags.push('weather:sunny');
            syntheticTags.push('emotion:uplifting');
        } else if (trackTitle.includes('love') || trackTitle.includes('heart') || trackTitle.includes('romance')) {
            syntheticTags.push('emotion:romantic');
            syntheticTags.push('vibe:emotional');
            syntheticTags.push('mood:tender');
        } else if (trackTitle.includes('sad') || trackTitle.includes('cry') || trackTitle.includes('lonely')) {
            syntheticTags.push('emotion:melancholic');
            syntheticTags.push('mood:somber');
            syntheticTags.push('vibe:reflective');
        } else if (trackTitle.includes('happy') || trackTitle.includes('joy') || trackTitle.includes('celebration')) {
            syntheticTags.push('emotion:joyful');
            syntheticTags.push('mood:cheerful');
            syntheticTags.push('vibe:upbeat');
        } else {
            syntheticTags.push('mood:neutral');
            syntheticTags.push('vibe:chill');
            syntheticTags.push('emotion:contemplative');
        }
        
        // Tempo tags based on duration (rough estimation)
        if (track.duration && typeof track.duration === 'number') {
            if (track.duration < 180) { // Less than 3 minutes
                syntheticTags.push('tempo:upbeat');
                syntheticTags.push('style:pop');
            } else if (track.duration > 300) { // More than 5 minutes
                syntheticTags.push('tempo:slow');
                syntheticTags.push('style:progressive');
            } else {
                syntheticTags.push('tempo:mid');
                syntheticTags.push('style:standard');
            }
        } else {
            syntheticTags.push('tempo:mid');
        }
        
        // Era tags based on year
        if (track.year) {
            if (track.year >= 2020) {
                syntheticTags.push('era:modern');
                syntheticTags.push('occasion:contemporary');
            } else if (track.year >= 2010) {
                syntheticTags.push('era:2010s');
                syntheticTags.push('occasion:recent');
            } else if (track.year >= 2000) {
                syntheticTags.push('era:2000s');
                syntheticTags.push('occasion:millennial');
            } else if (track.year >= 1990) {
                syntheticTags.push('era:90s');
                syntheticTags.push('occasion:retro');
            } else if (track.year >= 1980) {
                syntheticTags.push('era:80s');
                syntheticTags.push('occasion:vintage');
            } else {
                syntheticTags.push('era:classic');
                syntheticTags.push('occasion:timeless');
            }
        } else {
            syntheticTags.push('era:unknown');
        }
        
        // Weather tags based on seasonal/mood patterns
        if (trackTitle.includes('winter') || trackTitle.includes('cold') || trackTitle.includes('snow')) {
            syntheticTags.push('weather:winter');
        } else if (trackTitle.includes('summer') || trackTitle.includes('hot') || trackTitle.includes('beach')) {
            syntheticTags.push('weather:summer');
        } else if (trackTitle.includes('rain') || trackTitle.includes('storm') || trackTitle.includes('thunder')) {
            syntheticTags.push('weather:rainy');
        } else if (trackTitle.includes('spring') || trackTitle.includes('flower') || trackTitle.includes('bloom')) {
            syntheticTags.push('weather:spring');
        } else {
            syntheticTags.push('weather:clear');
        }
        
        // Rating tags (all discovered tracks get this)
        syntheticTags.push('rating:discovered');
        
        // Add some variety in rating
        const trackHash = (track.title + track.artist).length;
        if (trackHash % 3 === 0) {
            syntheticTags.push('rating:favorite');
        } else if (trackHash % 5 === 0) {
            syntheticTags.push('rating:liked');
        }
        
        // Style tags based on genre
        if (track.genre) {
            syntheticTags.push(`style:${track.genre.toLowerCase()}`);
        }
        
        return syntheticTags;
    },


    /**
     * Clear database
     * @returns {Promise<boolean>} Success status
     */
    async clearDatabase() {
        const dbAdapter = this.activeAdapters.get('database');
        if (dbAdapter && window.electronAPI) {
            try {
                await window.electronAPI.clearDatabase();
                return true;
            } catch (error) {
                console.error('Error clearing database:', error);
                return false;
            }
        }
        return false;
    },

    /**
     * Get distinct tag categories from database
     * @returns {Promise<Array>} Array of tag categories
     */
    async getTagCategories() {
        const dbAdapter = this.activeAdapters.get('database');
        if (dbAdapter && dbAdapter.getAvailableTags) {
            try {
                const allTags = await dbAdapter.getAvailableTags();
                const categories = new Set();
                
                allTags.forEach(tag => {
                    const category = tagUtils.getTagType(tag);
                    if (category) {
                        // Include all categories, including 'other' for uncategorized tags
                        categories.add(category);
                    }
                });
                
                return Array.from(categories).sort();
            } catch (error) {
                console.error('Error getting tag categories from database:', error);
            }
        }
        
        // Fallback to default categories
        return ['emotion', 'energy', 'mood', 'style', 'occasion', 'weather', 'intensity', 'rating', 'tempo', 'vibe'];
    },

    /**
     * Get tags grouped by category from database
     * @returns {Promise<Object>} Object with categories as keys and tag arrays as values
     */
    async getTagsByCategory() {
        const dbAdapter = this.activeAdapters.get('database');
        if (dbAdapter && dbAdapter.getAvailableTags) {
            try {
                const allTags = await dbAdapter.getAvailableTags();
                const grouped = tagUtils.groupTagsByType(allTags);
                return grouped;
            } catch (error) {
                // Error getting tags by category from database
            }
        }
        
        // Fallback to empty object
        return {};
    },

    /**
     * Scan directory for music files
     * @param {string} directory - Directory path to scan
     * @returns {Promise<Object>} Scan results
     */
    async scanDirectory(directory) {
        const dbAdapter = this.activeAdapters.get('database');
        if (dbAdapter && window.electronAPI) {
            try {
                return await window.electronAPI.scanDirectory(directory);
            } catch (error) {
                console.error('Error scanning directory:', error);
                throw error;
            }
        }
        throw new Error('Database adapter not available');
    },

    /**
     * Select music directory
     * @returns {Promise<string>} Selected directory path
     */
    async selectMusicDirectory() {
        if (window.electronAPI) {
            try {
                return await window.electronAPI.selectMusicDirectory();
            } catch (error) {
                console.error('Error selecting directory:', error);
                throw error;
            }
        }
        throw new Error('Electron API not available');
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
            const tagCategory = tagUtils.getTagType(tagValue);
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
 * Database Data Adapter (for future database integration)
 */
class DatabaseAdapter {
    constructor(config) {
        this.config = config;
        this.initialized = false;
    }

    async initialize() {
        // Check if we're running in Electron
        if (!window.electronAPI) {
            console.warn('DatabaseAdapter: electronAPI not available, skipping initialization');
            return false;
        }
        
        try {
            const stats = await window.electronAPI.getStats();
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('❌ DatabaseAdapter initialization failed:', error);
            this.initialized = false;
            return false;
        }
    }

    async getAllTracks(limit = 1000) {
        if (!this.initialized || !window.electronAPI) {
            return { artists: [] };
        }

        try {
            const tracks = await window.electronAPI.getAllTracks(limit);
            
            // Transform database tracks and organize by artist/album
            const transformedTracks = tracks.map(track => this.transformTrack(track));
            const organizedData = this.organizeTracksIntoStructure(transformedTracks);
            
            return organizedData;
        } catch (error) {
            console.error('Error loading tracks from database:', error);
            return { artists: [] };
        }
    }

    /**
     * Organize flat tracks into artist/album structure for UI
     */
    organizeTracksIntoStructure(tracks) {
        const artistMap = new Map();
        
        tracks.forEach(track => {
            // Get or create artist
            if (!artistMap.has(track.artist)) {
                artistMap.set(track.artist, {
                    name: track.artist,
                    albums: new Map()
                });
            }
            
            const artist = artistMap.get(track.artist);
            
            // Get or create album
            if (!artist.albums.has(track.album)) {
                artist.albums.set(track.album, {
                    name: track.album,
                    year: track.year,
                    tracks: []
                });
            }
            
            const album = artist.albums.get(track.album);
            album.tracks.push(track);
        });
        
        // Convert maps to arrays
        const artists = Array.from(artistMap.values()).map(artist => ({
            name: artist.name,
            albums: Array.from(artist.albums.values())
        }));
        
        return { artists };
    }

    async searchTracks(query, limit = 100) {
        if (!this.initialized || !window.electronAPI) {
            return [];
        }

        try {
            const tracks = await window.electronAPI.searchTracks(query, { limit });
            return tracks.map(track => this.transformTrack(track));
        } catch (error) {
            console.error('Error searching tracks in database:', error);
            return [];
        }
    }

    async getStats() {
        if (!this.initialized || !window.electronAPI) {
            return { tracks: 0, artists: 0, albums: 0, uniqueTags: [] };
        }

        try {
            return await window.electronAPI.getStats();
        } catch (error) {
            console.error('Error getting database stats:', error);
            return { tracks: 0, artists: 0, albums: 0, uniqueTags: [] };
        }
    }

    async getAvailableTags() {
        if (!this.initialized || !window.electronAPI) {
            return [];
        }

        try {
            // Get stats which contains uniqueTags from database
            const stats = await window.electronAPI.getStats();
            return stats.uniqueTags || [];
        } catch (error) {
            console.error('Error getting available tags from database:', error);
            return [];
        }
    }

    async getLibraryStructure() {
        if (!this.initialized || !window.electronAPI) {
            return [];
        }

        try {
            const result = await this.getAllTracks();
            return result.artists;
        } catch (error) {
            console.error('Error getting library structure:', error);
            return [];
        }
    }

    /**
     * Generate tracks with a specific tag
     */
    async generateTracksWithTag(tagValue, excludeTrack = null) {
        if (!this.initialized || !window.electronAPI) {
            return [];
        }

        try {
            // Get all tracks from database
            const allTracks = await window.electronAPI.getAllTracks();
            const transformedTracks = allTracks.map(track => this.transformTrack(track));
            
            // Find tracks that have the requested tag
            let matchingTracks = transformedTracks.filter(track => 
                track.tags && track.tags.includes(tagValue)
            );
            
            // Exclude parent track to avoid direct repetition
            if (excludeTrack) {
                matchingTracks = matchingTracks.filter(track => 
                    !(track.title === excludeTrack.title && 
                      track.artist === excludeTrack.artist && 
                      track.album === excludeTrack.album)
                );
            }
            
            const requestedCount = 7; // Default count
            
            if (matchingTracks.length === 0) {
                // Fallback: find tracks with same tag category
                const tagCategory = tagUtils.getTagType(tagValue);
                let similarTracks = transformedTracks.filter(track => 
                    track.tags && track.tags.some(tag => tag.startsWith(tagCategory + ':'))
                );
                
                if (excludeTrack) {
                    similarTracks = similarTracks.filter(track => 
                        !(track.title === excludeTrack.title && 
                          track.artist === excludeTrack.artist && 
                          track.album === excludeTrack.album)
                    );
                }
                
                if (similarTracks.length > 0) {
                    return this.selectRandomTracks(similarTracks, requestedCount);
                }
                
                // Last fallback: return random tracks
                let randomTracks = [...transformedTracks];
                if (excludeTrack) {
                    randomTracks = randomTracks.filter(track => 
                        !(track.title === excludeTrack.title && 
                          track.artist === excludeTrack.artist && 
                          track.album === excludeTrack.album)
                    );
                }
                
                return this.selectRandomTracks(randomTracks, requestedCount);
            }
            
            return this.selectRandomTracks(matchingTracks, requestedCount);
        } catch (error) {
            console.error('Error generating tracks with tag:', error);
            return [];
        }
    }

    /**
     * Generate tracks with multiple tags
     */
    async generateTracksWithMultipleTags(selectedTagsArray) {
        if (!this.initialized || !window.electronAPI) {
            return [];
        }

        try {
            // Get all tracks from database
            const allTracks = await window.electronAPI.getAllTracks();
            const transformedTracks = allTracks.map(track => this.transformTrack(track));
            
            // Find tracks that have ALL the requested tags
            const exactMatches = transformedTracks.filter(track => 
                track.tags && selectedTagsArray.every(tag => track.tags.includes(tag))
            );
            
            // Find tracks that have SOME of the requested tags
            const partialMatches = transformedTracks.filter(track => 
                track.tags && selectedTagsArray.some(tag => track.tags.includes(tag))
            );
            
            const requestedCount = 7;
            
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
                return this.selectRandomTracks(transformedTracks, requestedCount);
            }
        } catch (error) {
            console.error('Error generating tracks with multiple tags:', error);
            return [];
        }
    }

    /**
     * Select random tracks from an array
     */
    selectRandomTracks(tracks, count) {
        if (tracks.length === 0) {
            return [];
        }
        
        // Always shuffle the tracks first for better randomness
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        
        if (tracks.length <= count) {
            return shuffled;
        }
        
        // Take the requested number from shuffled tracks
        return shuffled.slice(0, count);
    }

    /**
     * Transform database track to match UI expectations
     */
    transformTrack(dbTrack) {
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
        
        // Remove synthetic source tags - not useful for music categorization
        
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
        const trackArtist = (dbTrack.artist || '').toLowerCase();
        
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
        
        // Mood tags based on title/artist patterns
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
        
        // Occasion tags based on year
        if (dbTrack.year) {
            if (dbTrack.year >= 2000) {
                uiTags.push('occasion:modern');
            } else {
                uiTags.push('occasion:retro');
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

// Make DataSourceAdapter available globally
window.DataSourceAdapter = DataSourceAdapter; 