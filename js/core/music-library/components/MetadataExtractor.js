const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class MetadataExtractor {
    constructor() {
        this.loaded = true; // Always ready since we use FFProbe
    }

    async init() {
        return true; // No initialization needed
    }

    async extractMetadata(filePath) {
        try {
            // First check if file exists and is readable
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                console.warn(`${filePath} is not a file`);
                return null;
            }

            // Try FFProbe first for all audio files
            try {
                return await this.extractWithFFProbe(filePath);
            } catch (ffprobeError) {
                // FFProbe failed, try filename parsing fallback
                return await this.extractBasicFileInfo(filePath);
            }
            
        } catch (error) {
            // Complete failure, return error object
            return {
                error: true,
                filePath: filePath,
                fileName: path.basename(filePath),
                errorMessage: error.message,
                errorType: error.name || 'UnknownError'
            };
        }
    }

    
    async extractWithFFProbe(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                try {
                    const stats = fs.statSync(filePath);
                    const format = metadata.format || {};
                    const tags = format.tags || {};
                    
                    const trackData = {
                        title: tags.title || tags.TITLE || path.basename(filePath, path.extname(filePath)),
                        artist: tags.artist || tags.ARTIST || tags.album_artist || tags.ALBUM_ARTIST || 'Unknown Artist',
                        album: tags.album || tags.ALBUM || 'Unknown Album',
                        duration: parseFloat(format.duration) || 0,
                        file_path: filePath,
                        file_size: stats.size,
                        year: tags.date ? parseInt(tags.date.substring(0, 4)) : (tags.DATE ? parseInt(tags.DATE.substring(0, 4)) : null),
                        genre: tags.genre || tags.GENRE || null,
                        track_number: tags.track ? parseInt(tags.track.split('/')[0]) : (tags.TRACK ? parseInt(tags.TRACK.split('/')[0]) : null),
                        tags: JSON.stringify([
                            'source:ffprobe',
                            format.format_name ? `format:${format.format_name}` : null,
                            format.bit_rate ? `bitrate:${Math.round(format.bit_rate/1000)}k` : null,
                            'quality:lossless'
                        ].filter(Boolean))
                    };
                    
                    resolve(trackData);
                } catch (parseError) {
                    reject(parseError);
                }
            });
        });
    }
    
    
    async extractBasicFileInfo(filePath) {
        const stats = fs.statSync(filePath);
        
        // Try to extract basic info from filename
        const fileName = path.basename(filePath, path.extname(filePath));
        const parts = fileName.split(' - ');
        
        let trackNumber = null;
        let title = fileName;
        let artist = 'Unknown Artist';
        
        // Parse common filename patterns: "01 - Artist - Title" or "Artist - Title"
        if (parts.length >= 2) {
            const firstPart = parts[0].trim();
            if (/^\d+$/.test(firstPart)) {
                // Pattern: "01 - Artist - Title"
                trackNumber = parseInt(firstPart);
                if (parts.length >= 3) {
                    artist = parts[1].trim();
                    title = parts.slice(2).join(' - ').trim();
                } else {
                    title = parts[1].trim();
                }
            } else {
                // Pattern: "Artist - Title"
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }
        }
        
        // Try to extract album from directory name
        const albumFromPath = path.basename(path.dirname(filePath));
        
        return {
            title: title,
            artist: artist,
            album: albumFromPath || 'Unknown Album',
            duration: 0, // Cannot determine without parsing
            file_path: filePath,
            file_size: stats.size,
            year: null,
            genre: null,
            track_number: trackNumber,
            tags: JSON.stringify(['source:filename', 'quality:unknown'])
        };
    }

    isReady() {
        return this.loaded;
    }
}

module.exports = MetadataExtractor; 