/**
 * TrackEnrichmentService
 * 
 * Responsible for enriching track data with synthetic tags and additional metadata
 * Separates the enrichment logic from the repository layer
 */
class TrackEnrichmentService {
    constructor(tagGenerationService) {
        this.tagGenerationService = tagGenerationService;
    }

    /**
     * Enrich track data with synthetic tags for better categorization
     * @param {Object} trackData - Original track data
     * @returns {Object} Track data with synthetic tags added
     */
    enrichTrackData(trackData) {
        // Parse existing tags
        let existingTags = this.parseExistingTags(trackData.tags);

        // Generate synthetic tags using TagGenerationService
        const syntheticTags = this.tagGenerationService.generateSyntheticTags(trackData);
        
        // Combine existing + synthetic (remove duplicates)
        const allTags = [...new Set([...existingTags, ...syntheticTags])];
        
        // Return enriched track data
        return {
            ...trackData,
            tags: JSON.stringify(allTags)
        };
    }

    /**
     * Parse existing tags from various formats
     * @param {string|Array} tags - Tags in string or array format
     * @returns {Array} Parsed tags array
     */
    parseExistingTags(tags) {
        if (!tags) {
            return [];
        }

        if (Array.isArray(tags)) {
            return tags;
        }

        if (typeof tags === 'string') {
            try {
                const parsed = JSON.parse(tags);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                // If not valid JSON, treat as comma-separated string
                return tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            }
        }

        return [];
    }

    /**
     * Enrich multiple tracks in batch
     * @param {Array} tracks - Array of track data
     * @returns {Array} Array of enriched track data
     */
    enrichMultipleTracks(tracks) {
        return tracks.map(track => this.enrichTrackData(track));
    }

    /**
     * Add specific tags to a track without regenerating all synthetic tags
     * @param {Object} trackData - Track data
     * @param {Array} newTags - Array of new tags to add
     * @returns {Object} Track data with new tags added
     */
    addTagsToTrack(trackData, newTags) {
        const existingTags = this.parseExistingTags(trackData.tags);
        const allTags = [...new Set([...existingTags, ...newTags])];
        
        return {
            ...trackData,
            tags: JSON.stringify(allTags)
        };
    }

    /**
     * Remove specific tags from a track
     * @param {Object} trackData - Track data
     * @param {Array} tagsToRemove - Array of tags to remove
     * @returns {Object} Track data with tags removed
     */
    removeTagsFromTrack(trackData, tagsToRemove) {
        const existingTags = this.parseExistingTags(trackData.tags);
        const filteredTags = existingTags.filter(tag => !tagsToRemove.includes(tag));
        
        return {
            ...trackData,
            tags: JSON.stringify(filteredTags)
        };
    }

    /**
     * Get tag statistics for a track
     * @param {Object} trackData - Track data
     * @returns {Object} Statistics about the track's tags
     */
    getTrackTagStats(trackData) {
        const tags = this.parseExistingTags(trackData.tags);
        const tagsByCategory = {};
        
        tags.forEach(tag => {
            const [category, value] = tag.split(':');
            if (category && value) {
                if (!tagsByCategory[category]) {
                    tagsByCategory[category] = [];
                }
                tagsByCategory[category].push(value);
            }
        });
        
        return {
            totalTags: tags.length,
            categories: Object.keys(tagsByCategory).length,
            tagsByCategory
        };
    }
}

module.exports = TrackEnrichmentService;