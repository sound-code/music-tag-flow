/**
 * Scan Service Interface
 * Defines the contract for scanning operations
 */
class IScanService {
    constructor() {
        if (this.constructor === IScanService) {
            throw new Error("Cannot instantiate abstract class IScanService");
        }
    }

    /**
     * Scan directory for audio files and process them
     * @param {string} directory - Directory path to scan
     * @param {Function} progressCallback - Optional progress callback
     * @returns {Promise<Object>} Scan results
     */
    async scanDirectory(directory, progressCallback = null) {
        throw new Error("Method 'scanDirectory(directory, progressCallback)' must be implemented");
    }

    /**
     * Get supported audio file extensions
     * @returns {Array<string>}
     */
    getSupportedExtensions() {
        throw new Error("Method 'getSupportedExtensions()' must be implemented");
    }

    /**
     * Check if file is an audio file
     * @param {string} filePath - File path to check
     * @returns {boolean}
     */
    isAudioFile(filePath) {
        throw new Error("Method 'isAudioFile(filePath)' must be implemented");
    }
}

module.exports = IScanService; 