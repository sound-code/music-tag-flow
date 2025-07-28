const IRepository = require('./IRepository');

/**
 * Track Repository Interface
 * Defines the contract for track-related operations
 */
class ITrackRepository extends IRepository {
    constructor() {
        super();
        if (this.constructor === ITrackRepository) {
            throw new Error("Cannot instantiate abstract class ITrackRepository");
        }
    }

    /**
     * Save a track with all business logic
     * @param {Object} trackData - Track information
     * @returns {Promise<boolean>}
     */
    async saveTrack(trackData) {
        throw new Error("Method 'saveTrack(trackData)' must be implemented");
    }

    /**
     * Get all tracks with optional limit
     * @param {number} limit - Maximum number of tracks
     * @returns {Promise<Array>}
     */
    async getAllTracks(limit = 100) {
        throw new Error("Method 'getAllTracks(limit)' must be implemented");
    }

    /**
     * Get repository statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        throw new Error("Method 'getStats()' must be implemented");
    }

    /**
     * Clear all tracks
     * @returns {Promise<boolean>}
     */
    async clearAll() {
        throw new Error("Method 'clearAll()' must be implemented");
    }
}

module.exports = ITrackRepository; 