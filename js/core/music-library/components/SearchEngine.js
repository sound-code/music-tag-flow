const ISearchEngine = require('../interfaces/ISearchEngine');

class SearchEngine extends ISearchEngine {
    constructor(databaseManager) {
        super();
        this.db = databaseManager;
    }

    search(query, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.db.isReady()) {
                resolve([]);
                return;
            }

            const { 
                limit = 50,
                searchFields = ['title', 'artist', 'album', 'tags'],
                exact = false
            } = options;

            try {
                // Build WHERE clause based on search fields
                const conditions = searchFields.map(field => `${field} LIKE ?`).join(' OR ');
                const sql = `
                    SELECT * FROM tracks 
                    WHERE ${conditions}
                    ORDER BY artist, album, track_number
                    LIMIT ?
                `;

                const searchTerm = exact ? query : `%${query}%`;
                const params = new Array(searchFields.length).fill(searchTerm);
                params.push(limit);

                this.db.db.all(sql, params, (err, rows) => {
                    if (err) {
                        console.error('Error searching tracks:', err);
                        resolve([]);
                    } else {
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('Error searching tracks:', error);
                resolve([]);
            }
        });
    }

    searchByTag(tagName, tagValue = null) {
        return new Promise((resolve, reject) => {
            if (!this.db.isReady()) {
                resolve([]);
                return;
            }

            try {
                let searchTerm;
                if (tagValue) {
                    searchTerm = `%${tagName}:${tagValue}%`;
                } else {
                    searchTerm = `%${tagName}%`;
                }

                const sql = `
                    SELECT * FROM tracks 
                    WHERE tags LIKE ?
                    ORDER BY artist, album, track_number
                    LIMIT 50
                `;

                this.db.db.all(sql, [searchTerm], (err, rows) => {
                    if (err) {
                        console.error('Error searching by tag:', err);
                        resolve([]);
                    } else {
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('Error searching by tag:', error);
                resolve([]);
            }
        });
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

    getUniqueValues(field) {
        return new Promise((resolve, reject) => {
            if (!this.db.isReady()) {
                resolve([]);
                return;
            }

            try {
                const sql = `SELECT DISTINCT ${field} FROM tracks WHERE ${field} IS NOT NULL ORDER BY ${field}`;
                this.db.db.all(sql, [], (err, rows) => {
                    if (err) {
                        console.error('Error getting unique values:', err);
                        resolve([]);
                    } else {
                        resolve((rows || []).map(row => row[field]));
                    }
                });
            } catch (error) {
                console.error(`Error getting unique values for ${field}:`, error);
                resolve([]);
            }
        });
    }

    getAvailableTags() {
        return new Promise((resolve, reject) => {
            if (!this.db.isReady()) {
                resolve([]);
                return;
            }

            try {
                const sql = `SELECT tags FROM tracks WHERE tags IS NOT NULL`;
                this.db.db.all(sql, [], (err, results) => {
                    if (err) {
                        console.error('Error getting available tags:', err);
                        resolve([]);
                        return;
                    }
                    
                    const allTags = new Set();
                    (results || []).forEach(row => {
                        try {
                            const tags = JSON.parse(row.tags);
                            tags.forEach(tag => allTags.add(tag));
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    });
                    
                    resolve(Array.from(allTags).sort());
                });
            } catch (error) {
                console.error('Error getting available tags:', error);
                resolve([]);
            }
        });
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