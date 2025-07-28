/**
 * Repository Interface
 * Defines the contract that all repositories must implement
 */
class IRepository {
    constructor() {
        if (this.constructor === IRepository) {
            throw new Error("Cannot instantiate abstract class IRepository");
        }
    }

    /**
     * Check if repository is ready for operations
     * @returns {boolean}
     */
    isReady() {
        throw new Error("Method 'isReady()' must be implemented");
    }

    /**
     * Initialize the repository
     * @returns {Promise<boolean>}
     */
    async init() {
        throw new Error("Method 'init()' must be implemented");
    }

    /**
     * Close/cleanup repository resources
     * @returns {Promise<void>}
     */
    async close() {
        throw new Error("Method 'close()' must be implemented");
    }
}

module.exports = IRepository; 