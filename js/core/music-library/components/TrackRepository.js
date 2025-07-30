const ITrackRepository = require('../interfaces/ITrackRepository');

class TrackRepository extends ITrackRepository {
    constructor(databaseManager, trackEnrichmentService = null) {
        super();
        this.db = databaseManager;
        this.enrichmentService = trackEnrichmentService;
    }

    isReady() {
        return this.db && this.db.isReady();
    }

    async init() {
        // TrackRepository doesn't need separate initialization
        // Relies on DatabaseManager initialization
        return this.isReady();
    }

    async close() {
        // TrackRepository doesn't manage database connection directly
        // DatabaseManager handles connection lifecycle
        return Promise.resolve();
    }

    async saveTrack(trackData) {
        if (!this.db.isReady()) {
            throw new Error('Database not ready');
        }

        try {
            // Enrich track data if enrichment service is available
            const dataToSave = this.enrichmentService 
                ? this.enrichmentService.enrichTrackData(trackData)
                : trackData;
            
            // Save track to database
            const trackSaved = await this.db.insertTrack(dataToSave);
            
            if (trackSaved) {
                // Business logic: Update related entities
                await this.updateArtistCount(trackData.artist);
                await this.updateAlbumCount(trackData.album, trackData.artist, trackData.year);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error saving track:', error);
            return false;
        }
    }





    async getAllTracks(limit = 100) {
        return await this.db.getAllTracks(limit);
    }

    async updateArtistCount(artistName) {
        if (!this.db.isReady()) return false;

        try {
            // Insert artist if not exists
            await this.db.insertArtistIfNotExists(artistName);
            
            // Update count
            await this.db.updateArtistTrackCount(artistName);
            
            return true;
        } catch (error) {
            console.error('Error updating artist count:', error);
            return false;
        }
    }

    async updateAlbumCount(albumName, artistName, year) {
        if (!this.db.isReady()) return false;

        try {
            // Insert album if not exists
            await this.db.insertAlbumIfNotExists(albumName, artistName, year);
            
            // Update count
            await this.db.updateAlbumTrackCount(albumName, artistName);
            
            return true;
        } catch (error) {
            console.error('Error updating album count:', error);
            return false;
        }
    }

    async getStats() {
        return await this.db.getStats();
    }

    async clearAll() {
        return this.db.clearDatabase();
    }

    async addTagToTrack(track, tag) {
        if (!this.db.isReady()) {
            throw new Error('Database not ready');
        }

        try {
            // Use the database manager to add tag to track
            const success = await this.db.addTagToTrack(track, tag);
            return success;
        } catch (error) {
            console.error('Error adding tag to track in repository:', error);
            return false;
        }
    }
}

module.exports = TrackRepository; 