const { createInitializedContainer } = require('../container/ServiceRegistration');

/**
 * Music Library Facade
 * Lightweight facade using Dependency Injection Container
 * Single Responsibility: Orchestration and API exposure only
 */
class MusicLibraryFacade {
    constructor(container = null) {
        this.container = container;
        this.initialized = false;
    }

    /**
     * Initialize the facade with DI container
     * @param {string} dbPath - Optional database path
     * @returns {Promise<boolean>}
     */
    async init(dbPath = null) {
        try {
            if (!this.container) {
                this.container = await createInitializedContainer(dbPath);
            }
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing MusicLibraryFacade:', error);
            this.initialized = false;
            return false;
        }
    }

    /**
     * Scan directory for music files
     * @param {string} directory - Directory to scan
     * @param {Function} progressCallback - Optional progress callback
     * @returns {Promise<Object>} Scan results
     */
    async scanDirectory(directory, progressCallback = null) {
        this._ensureInitialized();
        const scanService = this.container.resolve('scanService');
        return await scanService.scanDirectory(directory, progressCallback);
    }

    // Search operations (delegate to SearchEngine)
    async search(query, options = {}) {
        this._ensureInitialized();
        const searchEngine = this.container.resolve('searchEngine');
        return await searchEngine.search(query, options);
    }

    async searchByTag(tagName, tagValue = null) {
        this._ensureInitialized();
        const searchEngine = this.container.resolve('searchEngine');
        return await searchEngine.searchByTag(tagName, tagValue);
    }

    async searchByGenre(genre) {
        this._ensureInitialized();
        const searchEngine = this.container.resolve('searchEngine');
        return await searchEngine.searchByGenre(genre);
    }

    async searchByEra(era) {
        this._ensureInitialized();
        const searchEngine = this.container.resolve('searchEngine');
        return await searchEngine.searchByEra(era);
    }

    // Track operations (delegate to TrackRepository)
    async getAllTracks(limit = 100) {
        this._ensureInitialized();
        const trackRepository = this.container.resolve('trackRepository');
        return await trackRepository.getAllTracks(limit);
    }

    async getStats() {
        this._ensureInitialized();
        const trackRepository = this.container.resolve('trackRepository');
        return await trackRepository.getStats();
    }

    async clearDatabase() {
        this._ensureInitialized();
        const trackRepository = this.container.resolve('trackRepository');
        return await trackRepository.clearAll();
    }

    // Utility operations (delegate to various services)
    async getAvailableTags() {
        this._ensureInitialized();
        const searchEngine = this.container.resolve('searchEngine');
        return await searchEngine.getAvailableTags();
    }

    async getTagsByCategory() {
        this._ensureInitialized();
        const searchEngine = this.container.resolve('searchEngine');
        return await searchEngine.getTagsByCategory();
    }

    getSupportedExtensions() {
        this._ensureInitialized();
        const scanService = this.container.resolve('scanService');
        return scanService.getSupportedExtensions();
    }

    // Lifecycle operations
    isReady() {
        return this.initialized && this.container !== null;
    }

    close() {
        if (this.container) {
            const dbManager = this.container.resolve('databaseManager');
            dbManager.close();
        }
        this.initialized = false;
    }

    // Internal helper
    _ensureInitialized() {
        if (!this.initialized || !this.container) {
            throw new Error('MusicLibraryFacade not initialized. Call init() first.');
        }
    }

    /**
     * Get direct access to a service (for advanced use cases)
     * @param {string} serviceName - Name of the service
     * @returns {*} Service instance
     */
    getService(serviceName) {
        this._ensureInitialized();
        return this.container.resolve(serviceName);
    }

    /**
     * Get all registered services (for debugging)
     * @returns {Array<string>} Service names
     */
    getRegisteredServices() {
        return this.container ? this.container.getRegisteredServices() : [];
    }
}

module.exports = MusicLibraryFacade; 