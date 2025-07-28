/**
 * Search Engine Interface
 * Defines the contract for search operations
 */
class ISearchService {
    constructor() {
        if (this.constructor === ISearchService) {
            throw new Error("Cannot instantiate abstract class ISearchService");
        }
    }

    /**
     * Search tracks by query
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Array>}
     */
    async search(query, options = {}) {
        throw new Error("Method 'search(query, options)' must be implemented");
    }

    /**
     * Search tracks by tag
     * @param {string} tagName - Tag name
     * @param {string} tagValue - Optional tag value
     * @returns {Promise<Array>}
     */
    async searchByTag(tagName, tagValue = null) {
        throw new Error("Method 'searchByTag(tagName, tagValue)' must be implemented");
    }

    /**
     * Get available tags
     * @returns {Promise<Array>}
     */
    async getAvailableTags() {
        throw new Error("Method 'getAvailableTags()' must be implemented");
    }

    /**
     * Get tags organized by category
     * @returns {Promise<Object>}
     */
    async getTagsByCategory() {
        throw new Error("Method 'getTagsByCategory()' must be implemented");
    }
}

module.exports = ISearchService; 