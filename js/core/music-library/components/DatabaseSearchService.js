const ISearchService = require('../interfaces/ISearchService');

class DatabaseSearchService extends ISearchService {
    constructor(databaseManager) {
        super();
        this.db = databaseManager;
    }

    async search(query, options = {}) {
        if (!this.db.isReady()) {
            return [];
        }

        try {
            return await this.db.searchTracks(query, options);
        } catch (error) {
            console.error('Error searching tracks:', error);
            return [];
        }
    }

    async searchByTag(tagName, tagValue = null) {
        if (!this.db.isReady()) {
            return [];
        }

        try {
            return await this.db.searchTracksByTag(tagName, tagValue);
        } catch (error) {
            console.error('Error searching by tag:', error);
            return [];
        }
    }

    searchByGenre(genre) {
        return this.searchByTag('genre', genre.toLowerCase());
    }

    searchByEra(era) {
        return this.searchByTag('era', era.toLowerCase());
    }

    searchByLength(length) {
        return this.searchByTag('length', length.toLowerCase());
    }

    searchByQuality(quality) {
        return this.searchByTag('quality', quality.toLowerCase());
    }

    async getUniqueValues(field) {
        if (!this.db.isReady()) {
            return [];
        }

        try {
            return await this.db.getUniqueValues(field);
        } catch (error) {
            console.error(`Error getting unique values for ${field}:`, error);
            return [];
        }
    }

    async getAvailableTags() {
        if (!this.db.isReady()) {
            return [];
        }

        try {
            const tags = await this.db.getAvailableTags();
            return tags.sort();
        } catch (error) {
            console.error('Error getting available tags:', error);
            return [];
        }
    }

    async getTagsByCategory() {
        const allTags = await this.getAvailableTags();
        const categories = {};
        
        allTags.forEach(tag => {
            const tagInfo = tagUtils.parseTag(tag);
            if (!categories[tagInfo.type]) {
                categories[tagInfo.type] = [];
            }
            if (tagInfo.value) {
                categories[tagInfo.type].push(tagInfo.value);
            }
        });
        
        return categories;
    }
}

module.exports = DatabaseSearchService; 