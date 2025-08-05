/**
 * SearchService - Centralized search functionality
 * Handles search functionality for tracks, artists, and albums with EventBus integration
 */
class SearchService extends ServiceBase {
    constructor(stateManager, eventBus) {
        super(stateManager, eventBus);
        
        // Service configuration
        this.config = {
            minSearchLength: 1,
            searchDelay: 300, // Debounce search queries
            maxResults: 100
        };
        
        // DOM element cache
        this.elements = {};
        
        // Search state
        this.currentQuery = '';
        this.searchResults = [];
        
        // Validation rules
        this.validationRules = {
            searchQuery: (query) => typeof query === 'string' && query.length >= 0
        };
    }

    /**
     * Initialize search service and set up event listeners
     */
    initialize() {
        try {
            // Initialize DOM element references
            this.initializeDOMElements();
            
            // Set up EventBus subscriptions
            this.setupEventListeners();
            
            // Set up DOM event handlers
            this.setupDOMEventHandlers();
            
            // Initialize search state
            this.setState('search.currentQuery', '');
            this.setState('search.results', []);
            this.setState('search.isActive', false);
            
        } catch (error) {
            // If initialization fails, set up minimal functionality
            this.elements = {};
            this.setupEventListeners(); // At least set up events
        }
    }

    /**
     * Initialize DOM element references through StateManager
     */
    initializeDOMElements() {
        // Get DOM elements directly from document (more reliable than AppState)
        this.elements = {
            searchField: document.getElementById('searchField'),
            clearSearchBtn: document.getElementById('clearSearch'),
            searchResults: document.getElementById('searchResults'),
            searchResultsList: document.getElementById('searchResultsList'),
            musicLibrary: document.getElementById('musicLibrary')
        };
        
        // Elements must be found via DOM - no AppState fallbacks
        
        // Validate critical elements exist (but don't fail if some are missing)
        const criticalElements = ['searchField'];
        let hasCriticalElements = true;
        
        criticalElements.forEach(key => {
            if (!this.elements[key]) {
                hasCriticalElements = false;
            }
        });
        
        if (!hasCriticalElements) {
            // Don't throw - just skip DOM handling
            this.elements = {};
        }
    }

    /**
     * Set up EventBus event listeners
     */
    setupEventListeners() {
        // Listen for search queries from other modules
        this.subscribeToEvent('search:query:update', (data) => {
            this.handleExternalSearchQuery(data);
        });
        
        // Listen for search clear requests
        this.subscribeToEvent('search:clear', () => {
            this.clearSearch();
        });
        
        // Listen for data loading completion to refresh search capabilities
        this.subscribeToEvent('data:loading:complete', () => {
            this.handleDataReady();
        });
        
        // Subscribe to search state changes
        this.subscribeToState('search.currentQuery', (query) => {
            this.onSearchQueryChanged(query);
        });
        
        this.subscribeToState('search.results', (results) => {
            this.onSearchResultsChanged(results);
        });
    }

    /**
     * Set up DOM event handlers
     */
    setupDOMEventHandlers() {
        // Defensive check - only set up handlers if elements exist
        if (!this.elements || !this.elements.searchField) {
            return;
        }
        
        try {
            // Search input handler with debouncing
            let searchTimeout;
            this.elements.searchField.addEventListener('input', (e) => {
                const searchTerm = e.target.value;
                
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.performSearch(searchTerm);
                }, this.config.searchDelay);
                
                // Update clear button visibility
                if (searchTerm.trim().length > 0) {
                    this.elements.clearSearchBtn?.classList.add('active');
                } else {
                    this.elements.clearSearchBtn?.classList.remove('active');
                }
            });
            
            // Clear button handler
            if (this.elements.clearSearchBtn) {
                this.elements.clearSearchBtn.addEventListener('click', () => {
                    this.clearSearch();
                });
            }
            
            // Escape key handler
            this.elements.searchField.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                    this.elements.searchField.blur();
                }
            });
            
        } catch (error) {
            // Event handler setup failed - continue without DOM handlers
        }
    }

    /**
     * Perform search operation
     * @param {string} searchTerm - The search term
     */
    async performSearch(searchTerm) {
        // Validate input
        if (!this.validate({ searchQuery: searchTerm }, { searchQuery: this.validationRules.searchQuery })) {
            return;
        }
        
        // Update current query state
        this.setState('search.currentQuery', searchTerm);
        
        if (!searchTerm || searchTerm.trim().length < this.config.minSearchLength) {
            this.clearSearch();
            return;
        }
        
        try {
            // Emit search start event
            this.emitEvent('search:query:update', {
                query: searchTerm,
                timestamp: Date.now()
            });
            
            // Perform the actual search
            const results = await this.filterTracks(searchTerm);
            
            // Update results state
            this.setState('search.results', results);
            this.setState('search.isActive', results.length > 0);
            
            // Emit results event
            if (results.length > 0) {
                this.emitEvent('search:results:found', {
                    count: results.length,
                    tracks: results,
                    query: searchTerm,
                    timestamp: Date.now()
                });
            } else {
                this.emitEvent('search:results:empty', {
                    query: searchTerm,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.emitEvent('search:error', {
                error: error.message,
                query: searchTerm,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Filter tracks based on search term
     * @param {string} searchTerm - The search term
     * @returns {Promise<Array>} Filtered tracks array
     */
    async filterTracks(searchTerm) {
        if (!searchTerm || searchTerm.trim().length === 0) {
            return [];
        }
        
        // Get all tracks through DataLoader
        const allTracks = await this.getAllTracks();
        const term = searchTerm.toLowerCase().trim();
        
        const results = allTracks.filter(track => {
            // Search in track title, artist, and album
            const title = track.title?.toLowerCase() || '';
            const artist = track.artist?.toLowerCase() || '';
            const album = track.album?.toLowerCase() || '';
            
            // Word-start matching
            const titleWords = title.split(' ');
            const artistWords = artist.split(' ');
            const albumWords = album.split(' ');
            
            // Tag search
            let tagMatch = false;
            if (track.tags && track.tags.length > 0) {
                tagMatch = track.tags.some(tag => {
                    const tagLower = tag.toLowerCase();
                    const tagInfo = tagUtils.parseTag(tag);
                    return tagLower.includes(term) || 
                           (tagInfo.type && tagInfo.type.toLowerCase().includes(term)) ||
                           (tagInfo.value && tagInfo.value.toLowerCase().includes(term));
                });
            }
            
            return titleWords.some(word => word.startsWith(term)) ||
                   artistWords.some(word => word.startsWith(term)) ||
                   albumWords.some(word => word.startsWith(term)) ||
                   tagMatch;
        });
        
        // Limit results if configured
        return results.slice(0, this.config.maxResults);
    }

    /**
     * Get all tracks from DataService (database)
     * @returns {Promise<Array>} Array of track objects
     */
    async getAllTracks() {
        const dataService = window.serviceManager?.getService('data');
        if (dataService) {
            const result = await dataService.getAllTracks();
            // Convert artist/album structure to flat track array
            const tracks = [];
            if (result && result.artists) {
                result.artists.forEach(artist => {
                    if (artist.albums) {
                        artist.albums.forEach(album => {
                            if (album.tracks) {
                                tracks.push(...album.tracks);
                            }
                        });
                    }
                });
            }
            return tracks;
        }
        return [];
    }

    /**
     * Clear search and reset UI
     */
    clearSearch() {
        // Update state
        this.setState('search.currentQuery', '');
        this.setState('search.results', []);
        this.setState('search.isActive', false);
        
        // Update UI elements
        if (this.elements.searchField) {
            this.elements.searchField.value = '';
        }
        
        if (this.elements.clearSearchBtn) {
            this.elements.clearSearchBtn.classList.remove('active');
        }
        
        if (this.elements.searchResults) {
            this.elements.searchResults.classList.remove('active');
        }
        
        if (this.elements.musicLibrary) {
            this.elements.musicLibrary.style.display = 'block';
        }
        
        // Emit clear event
        this.emitEvent('search:cleared', {
            timestamp: Date.now()
        });
    }

    /**
     * Handle external search query
     * @param {Object} data - Search query data
     */
    handleExternalSearchQuery(data) {
        const { query } = data;
        
        // Update search field if different
        if (this.elements.searchField && this.elements.searchField.value !== query) {
            this.elements.searchField.value = query;
            this.performSearch(query);
        }
    }

    /**
     * Handle data ready events
     */
    handleDataReady() {
        // Refresh search capabilities when new data is loaded
        // Could clear cache or reindex if needed
    }

    /**
     * Get current search query
     * @returns {string} Current search query
     */
    getCurrentQuery() {
        return this.getState('search.currentQuery') || '';
    }

    /**
     * Get current search results
     * @returns {Array} Current search results
     */
    getCurrentResults() {
        return this.getState('search.results') || [];
    }

    /**
     * Check if search is active
     * @returns {boolean} Search active status
     */
    isSearchActive() {
        return this.getState('search.isActive') || false;
    }

    /**
     * Handle search query state changes
     * @private
     */
    onSearchQueryChanged(query) {
        this.currentQuery = query;
    }

    /**
     * Handle search results state changes
     * @private
     */
    onSearchResultsChanged(results) {
        this.searchResults = results;
        this.updateSearchDisplay(results);
    }

    /**
     * Update search display with results
     * @param {Array} tracks - Search results to display
     * @public
     */
    updateSearchDisplay(tracks) {
        if (!this.elements.searchResultsList || !this.elements.searchResults || !this.elements.musicLibrary) {
            // Try to get elements again if not found
            this.initializeDOMElements();
            if (!this.elements.searchResultsList || !this.elements.searchResults || !this.elements.musicLibrary) {
                return;
            }
        }
        
        // Clear previous results
        this.elements.searchResultsList.innerHTML = '';
        
        if (!tracks || tracks.length === 0) {
            this.elements.searchResults.classList.remove('active');
            this.elements.searchResults.style.display = 'none';
            this.elements.musicLibrary.style.display = 'block';
            return;
        }
        
        // Render results
        tracks.forEach(track => {
            const resultItem = this.createSearchResultItem(track);
            this.elements.searchResultsList.appendChild(resultItem);
        });
        
        // Show results, hide library
        this.elements.searchResults.classList.add('active');
        this.elements.searchResults.style.display = 'block';
        this.elements.musicLibrary.style.display = 'none';
        
        // Emit display event
        this.emitEvent('search:results:displayed', {
            count: tracks.length,
            timestamp: Date.now()
        });
    }

    /**
     * Create search result item element
     * @param {Object} track - Track data
     * @returns {HTMLElement} Result item element
     * @private
     */
    createSearchResultItem(track) {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.draggable = true;
        resultItem.dataset.track = JSON.stringify(track);
        
        // Search result created successfully
        
        const resultInfo = document.createElement('div');
        resultInfo.className = 'search-result-info';
        
        const title = document.createElement('div');
        title.className = 'search-result-title';
        title.textContent = track.title;
        
        const meta = document.createElement('div');
        meta.className = 'search-result-meta';
        meta.textContent = `${track.artist} • ${track.album}`;
        
        // Add matched tags preview
        const currentQuery = this.getCurrentQuery().toLowerCase();
        if (track.tags && track.tags.length > 0 && currentQuery) {
            const matchedTags = track.tags.filter(tag => {
                const tagLower = tag.toLowerCase();
                const tagInfo = tagUtils.parseTag(tag);
                return tagLower.includes(currentQuery) || 
                       (tagInfo.type && tagInfo.type.toLowerCase().includes(currentQuery)) ||
                       (tagInfo.value && tagInfo.value.toLowerCase().includes(currentQuery));
            });
            
            if (matchedTags.length > 0) {
                const tagsPreview = document.createElement('div');
                tagsPreview.className = 'search-result-tags';
                tagsPreview.textContent = `Tags: ${matchedTags.map(tag => tagUtils.getTagValue(tag)).join(', ')}`;
                resultInfo.appendChild(tagsPreview);
            }
        }
        
        resultInfo.appendChild(title);
        resultInfo.appendChild(meta);
        resultItem.appendChild(resultInfo);
        
        // Add drag functionality
        if (window.App && window.App.getService) {
            const dragDropService = window.App.getService('dragdrop');
            if (dragDropService && typeof dragDropService.addDragToElement === 'function') {
                dragDropService.addDragToElement(resultItem);
            }
        }
        
        return resultItem;
    }
}

// Make available globally
window.SearchService = SearchService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchService;
}