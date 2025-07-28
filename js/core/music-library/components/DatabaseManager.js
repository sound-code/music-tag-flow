const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
    constructor(dbPath = null) {
        this.db = null;
        this.dbPath = dbPath || path.join(__dirname, '..', 'music_library.db');
    }

    init() {
        return new Promise((resolve, reject) => {
            try {
                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        console.error('Database initialization error:', err);
                        this.db = null;
                        resolve(false);
                    } else {
                        this.createTables()
                            .then(() => resolve(true))
                            .catch((error) => {
                                console.error('Table creation error:', error);
                                resolve(false);
                            });
                    }
                });
            } catch (error) {
                console.error('Database initialization error:', error);
                this.db = null;
                resolve(false);
            }
        });
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const queries = [
                `CREATE TABLE IF NOT EXISTS tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    album TEXT,
                    duration REAL,
                    file_path TEXT UNIQUE NOT NULL,
                    file_size INTEGER,
                    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
                    year INTEGER,
                    genre TEXT,
                    track_number INTEGER,
                    tags TEXT
                )`,
                
                `CREATE TABLE IF NOT EXISTS artists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    track_count INTEGER DEFAULT 0
                )`,
                
                `CREATE TABLE IF NOT EXISTS albums (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    year INTEGER,
                    track_count INTEGER DEFAULT 0,
                    UNIQUE(name, artist)
                )`,
                
                `CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)`,
                `CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album)`,
                `CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title)`
            ];
            
            this.db.serialize(() => {
                let completed = 0;
                const total = queries.length;
                
                queries.forEach((query) => {
                    this.db.run(query, (err) => {
                        if (err) {
                            console.error('Error creating table/index:', err);
                            reject(err);
                            return;
                        }
                        completed++;
                        if (completed === total) {
                            resolve();
                        }
                    });
                });
            });
        });
    }

    insertTrack(trackData) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(false);
                return;
            }

            const sql = `
                INSERT OR REPLACE INTO tracks 
                (title, artist, album, duration, file_path, file_size, year, genre, track_number, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                trackData.title, trackData.artist, trackData.album,
                trackData.duration, trackData.file_path, trackData.file_size,
                trackData.year, trackData.genre, trackData.track_number, trackData.tags
            ];

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Error inserting track:', err);
                    resolve(false);
                } else {
                    // ❌ TODO: Move business logic to service layer
                    // this.updateArtistCount(trackData.artist);
                    // this.updateAlbumCount(trackData.album, trackData.artist, trackData.year);
                    resolve(true);
                }
            });
        });
    }

    // Pure database operations for artists
    insertArtistIfNotExists(artistName) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT OR IGNORE INTO artists (name, track_count) VALUES (?, 0)`;
            this.db.run(sql, [artistName], (err) => {
                if (err) {
                    console.error('Error inserting artist:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    updateArtistTrackCount(artistName) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE artists SET track_count = (
                    SELECT COUNT(*) FROM tracks WHERE artist = ?
                ) WHERE name = ?
            `;
            this.db.run(sql, [artistName, artistName], (err) => {
                if (err) {
                    console.error('Error updating artist count:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    // Pure database operations for albums
    insertAlbumIfNotExists(albumName, artistName, year) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT OR IGNORE INTO albums (name, artist, year, track_count) VALUES (?, ?, ?, 0)`;
            this.db.run(sql, [albumName, artistName, year], (err) => {
                if (err) {
                    console.error('Error inserting album:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    updateAlbumTrackCount(albumName, artistName) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE albums SET track_count = (
                    SELECT COUNT(*) FROM tracks WHERE album = ? AND artist = ?
                ) WHERE name = ? AND artist = ?
            `;
            this.db.run(sql, [albumName, artistName, albumName, artistName], (err) => {
                if (err) {
                    console.error('Error updating album count:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    getStats() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve({ tracks: 0, artists: 0, albums: 0 });
                return;
            }
            
            // Use Promise.all to run all three queries in parallel
            const queries = [
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM tracks', [], (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                }),
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM artists', [], (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                }),
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM albums', [], (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                })
            ];
            
            Promise.all(queries)
                .then(([tracks, artists, albums]) => {
                    resolve({ tracks, artists, albums });
                })
                .catch(error => {
                    console.error('Error getting stats:', error);
                    resolve({ tracks: 0, artists: 0, albums: 0 });
                });
        });
    }

    getAllTracks(limit = 100) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            
            const query = `
                SELECT * FROM tracks 
                ORDER BY artist, album, track_number
                LIMIT ?
            `;
            
            this.db.all(query, [limit], (err, rows) => {
                if (err) {
                    console.error('Error getting all tracks:', err);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    clearDatabase() {
        if (!this.db) return false;
        
        try {
            this.db.exec(`
                DELETE FROM tracks;
                DELETE FROM artists;
                DELETE FROM albums;
            `);
            return true;
        } catch (error) {
            console.error('Error clearing database:', error);
            return false;
        }
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    isReady() {
        return this.db !== null;
    }
}

module.exports = DatabaseManager; 