const ISearchEngine = require('../interfaces/ISearchEngine');

class SearchEngine extends ISearchEngine {
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
            const [category, value] = tag.split(':');
            if (!categories[category]) {
                categories[category] = [];
            }
            if (value) {
                categories[category].push(value);
            }
        });
        
        return categories;
    }
}

module.exports = SearchEngine; 