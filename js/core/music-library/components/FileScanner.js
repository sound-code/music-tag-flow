const glob = require('glob');

class FileScanner {
    constructor() {
        this.audioExtensions = ['**/*.mp3', '**/*.flac', '**/*.m4a', '**/*.wav', '**/*.aac', '**/*.wma', '**/*.ogg'];
        this.ignorePatterns = ['**/.*', '**/node_modules/**'];
    }

    async scanDirectory(directory) {
        try {
            let files = [];
            
            for (const pattern of this.audioExtensions) {
                const found = await new Promise((resolve, reject) => {
                    glob(pattern, { 
                        cwd: directory, 
                        absolute: true,
                        ignore: this.ignorePatterns,
                        nocase: true  // Case insensitive matching
                    }, (err, matches) => {
                        if (err) reject(err);
                        else resolve(matches);
                    });
                });
                files = files.concat(found);
            }
            
            // Remove duplicates and sort
            files = [...new Set(files)].sort();
            
            console.log(`Found ${files.length} audio files in ${directory}`);
            
            return files;
        } catch (error) {
            console.error('Error scanning directory:', error);
            return [];
        }
    }

    getSupportedExtensions() {
        return this.audioExtensions.map(pattern => pattern.replace('**/*', ''));
    }

    isAudioFile(filePath) {
        const ext = filePath.toLowerCase().split('.').pop();
        return ['mp3', 'flac', 'm4a', 'wav', 'aac', 'wma', 'ogg'].includes(ext);
    }
}

module.exports = FileScanner; 