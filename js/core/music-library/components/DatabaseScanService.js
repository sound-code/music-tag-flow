const IScanService = require('../interfaces/IScanService');

class DatabaseScanService extends IScanService {
    constructor(trackRepository, fileScanner, metadataExtractor) {
        super();
        this.trackRepository = trackRepository;
        this.fileScanner = fileScanner;
        this.metadataExtractor = metadataExtractor;
    }

    async scanDirectory(directory, progressCallback = null) {
        if (!this.trackRepository || !this.fileScanner || !this.metadataExtractor) {
            throw new Error('DatabaseScanService dependencies not properly initialized');
        }

        // Scan for audio files
        const audioFiles = await this.fileScanner.scanDirectory(directory);
        
        let processedCount = 0;
        const results = {
            total: audioFiles.length,
            processed: 0,
            errors: 0,
            tracks: [],
            errorDetails: []
        };

        for (let i = 0; i < audioFiles.length; i++) {
            const filePath = audioFiles[i];
            
            try {
                // Extract metadata
                const trackData = await this.metadataExtractor.extractMetadata(filePath);
                
                if (trackData && !trackData.error) {
                    // Save track (business logic handled in repository)
                    const saved = await this.trackRepository.saveTrack(trackData);
                    if (saved) {
                        results.tracks.push(trackData);
                        processedCount++;
                    } else {
                        results.errors++;
                        results.errorDetails.push({
                            filePath: filePath,
                            fileName: require('path').basename(filePath),
                            errorMessage: 'Failed to save track to database',
                            errorType: 'DatabaseError'
                        });
                    }
                } else if (trackData && trackData.error) {
                    // Handle metadata extraction error
                    results.errors++;
                    results.errorDetails.push(trackData);
                } else {
                    // trackData is null
                    results.errors++;
                    results.errorDetails.push({
                        filePath: filePath,
                        fileName: require('path').basename(filePath),
                        errorMessage: 'Unknown metadata extraction error',
                        errorType: 'UnknownError'
                    });
                }
            } catch (error) {
                console.error(`Error processing ${filePath}:`, error);
                results.errors++;
                results.errorDetails.push({
                    filePath: filePath,
                    fileName: require('path').basename(filePath),
                    errorMessage: error.message,
                    errorType: error.name || 'ProcessingError'
                });
            }

            results.processed = i + 1;
            
            // Call progress callback if provided
            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: audioFiles.length,
                    filePath,
                    processed: processedCount,
                    errors: results.errors
                });
            }
        }

        return results;
    }

    getSupportedExtensions() {
        return this.fileScanner.getSupportedExtensions();
    }

    isAudioFile(filePath) {
        return this.fileScanner.isAudioFile(filePath);
    }
}

module.exports = DatabaseScanService; 