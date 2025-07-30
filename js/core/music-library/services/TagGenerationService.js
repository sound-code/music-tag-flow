/**
 * TagGenerationService
 * 
 * Responsible for generating synthetic tags for tracks
 * Ensures balanced distribution and quality assessment
 */
class TagGenerationService {
    constructor() {
        // Core music categorization tags (guaranteed to be populated)
        this.coreTagCategories = {
            emotion: ['happy', 'sad', 'romantic', 'energetic', 'melancholic', 'joyful', 'nostalgic', 'mysterious', 'uplifting', 'contemplative', 'passionate', 'dreamy', 'serene', 'intense', 'peaceful'],
            energy: ['high', 'medium', 'low', 'vibrant', 'calm', 'intense', 'relaxed', 'explosive', 'gentle', 'dynamic', 'mellow', 'powerful', 'subdued'],
            mood: ['bright', 'dark', 'neutral', 'cheerful', 'somber', 'playful', 'serious', 'whimsical', 'dramatic', 'peaceful', 'aggressive', 'tender', 'optimistic', 'introspective'],
            style: ['rock', 'pop', 'jazz', 'classical', 'electronic', 'folk', 'blues', 'reggae', 'country', 'funk', 'soul', 'indie', 'alternative', 'ambient', 'experimental'],
            intensity: ['powerful', 'gentle', 'moderate', 'fierce', 'subtle', 'overwhelming', 'delicate', 'strong', 'soft', 'crushing', 'smooth', 'bold', 'refined'],
            tempo: ['fast', 'slow', 'medium', 'upbeat', 'ballad', 'driving', 'relaxed', 'rushing', 'steady', 'variable', 'hypnotic', 'rhythmic', 'flowing'],
            vibe: ['chill', 'groovy', 'atmospheric', 'edgy', 'smooth', 'raw', 'polished', 'organic', 'warm', 'cold', 'spacey', 'intimate', 'epic', 'minimal'],
            occasion: ['party', 'study', 'workout', 'relaxation', 'driving', 'morning', 'evening', 'weekend', 'work', 'travel', 'romance', 'meditation', 'focus', 'celebration']
        };

        // Additional descriptive categories (fewer tags per category)
        this.descriptiveTagCategories = {
            rating: ['discovered', 'liked', 'favorite', 'hidden-gem', 'classic', 'underrated', 'popular', 'recommended'],
            weather: ['sunny', 'rainy', 'cloudy', 'stormy', 'clear', 'spring', 'summer', 'autumn', 'winter'],
            era: ['modern', '2020s', '2010s', '2000s', '90s', '80s', 'classic', 'contemporary', 'timeless']
        };
    }

    /**
     * Generate synthetic tags for a track
     * @param {Object} trackData - Track data to influence tag generation
     * @returns {Array} Array of synthetic tags in "category:value" format
     */
    generateSyntheticTags(trackData = {}) {
        const syntheticTags = [];

        // CORE CATEGORIES: Always add 2-4 tags to ensure rich categorization
        Object.entries(this.coreTagCategories).forEach(([category, tagList]) => {
            const numTags = Math.floor(Math.random() * 3) + 2; // 2-4 tags per core category
            
            // Shuffle and pick random tags
            const shuffledTags = [...tagList].sort(() => Math.random() - 0.5);
            const selectedTags = shuffledTags.slice(0, Math.min(numTags, tagList.length));
            
            // Add to synthetic tags with category prefix
            selectedTags.forEach(tag => {
                syntheticTags.push(`${category}:${tag}`);
            });
        });

        // DESCRIPTIVE CATEGORIES: Add 1-2 tags
        Object.entries(this.descriptiveTagCategories).forEach(([category, tagList]) => {
            const numTags = Math.floor(Math.random() * 2) + 1; // 1-2 tags per descriptive category
            
            // Shuffle and pick random tags
            const shuffledTags = [...tagList].sort(() => Math.random() - 0.5);
            const selectedTags = shuffledTags.slice(0, Math.min(numTags, tagList.length));
            
            // Add to synthetic tags with category prefix
            selectedTags.forEach(tag => {
                syntheticTags.push(`${category}:${tag}`);
            });
        });

        // QUALITY TAGS: Always add quality assessment based on file properties
        const qualityTags = this.generateQualityTags(trackData);
        syntheticTags.push(...qualityTags);

        // GENRE TAGS: Infer from existing genre or add generic ones
        const genreTags = this.generateGenreTags(trackData);
        syntheticTags.push(...genreTags);

        return syntheticTags;
    }

    /**
     * Generate quality tags based on track properties
     * @param {Object} trackData - Track data with file properties
     * @returns {Array} Quality-related tags
     */
    generateQualityTags(trackData) {
        const qualityTags = [];
        
        // Always add a general quality assessment
        const qualityLevels = ['excellent', 'good', 'standard', 'high', 'premium', 'studio'];
        const randomQuality = qualityLevels[Math.floor(Math.random() * qualityLevels.length)];
        qualityTags.push(`quality:${randomQuality}`);
        
        // Add format-based quality if file info available
        if (trackData.file_path) {
            const extension = trackData.file_path.split('.').pop().toLowerCase();
            
            if (['flac', 'wav', 'aiff'].includes(extension)) {
                qualityTags.push('quality:lossless');
                qualityTags.push('format:uncompressed');
            } else if (['mp3', 'aac', 'm4a', 'ogg'].includes(extension)) {
                qualityTags.push('quality:compressed');
                qualityTags.push('format:lossy');
            }
            
            // Add format tag
            qualityTags.push(`format:${extension}`);
        } else {
            // Default quality tags when no file info
            qualityTags.push('quality:digital');
            qualityTags.push('format:audio');
        }
        
        // Add bitrate estimation
        const bitrateEstimates = ['320k', '256k', '192k', 'variable', 'high-bitrate'];
        const randomBitrate = bitrateEstimates[Math.floor(Math.random() * bitrateEstimates.length)];
        qualityTags.push(`bitrate:${randomBitrate}`);
        
        return qualityTags;
    }

    /**
     * Generate genre tags based on existing metadata or defaults
     * @param {Object} trackData - Track data
     * @returns {Array} Genre-related tags
     */
    generateGenreTags(trackData) {
        const genreTags = [];
        
        // Use existing genre if available
        if (trackData.genre && trackData.genre.trim()) {
            const cleanGenre = trackData.genre.toLowerCase().trim();
            genreTags.push(`genre:${cleanGenre}`);
            genreTags.push(`style:${cleanGenre}`);
        } else {
            // Add random genre tags
            const genericGenres = ['alternative', 'indie', 'contemporary', 'modern', 'eclectic', 'fusion', 'crossover'];
            const randomGenre = genericGenres[Math.floor(Math.random() * genericGenres.length)];
            genreTags.push(`genre:${randomGenre}`);
        }
        
        return genreTags;
    }

    /**
     * Get available tag categories
     * @returns {Object} Object with core and descriptive categories
     */
    getTagCategories() {
        return {
            core: Object.keys(this.coreTagCategories),
            descriptive: Object.keys(this.descriptiveTagCategories)
        };
    }

    /**
     * Get all possible tags for a category
     * @param {string} category - Category name
     * @returns {Array} Array of possible tags for the category
     */
    getTagsForCategory(category) {
        return this.coreTagCategories[category] || 
               this.descriptiveTagCategories[category] || 
               [];
    }
}

module.exports = TagGenerationService;