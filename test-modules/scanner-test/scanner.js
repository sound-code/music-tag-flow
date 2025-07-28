// Check if electron is available
let ipcRenderer;

try {
    ({ ipcRenderer } = require('electron'));
} catch (error) {
    console.error('Error loading ipcRenderer:', error);
}

class MusicScanner {
    constructor() {
        this.selectedDirectory = null;
        this.isScanning = false;
        this.init();
    }
    
    init() {
        this.bindEvents();
        
        // Listen for scan progress updates
        if (ipcRenderer) {
            ipcRenderer.on('scan-progress', (event, progress) => {
                this.updateProgress(progress);
            });
        }
    }
    
    bindEvents() {
        document.getElementById('selectDirectoryBtn').addEventListener('click', () => {
            this.selectDirectory();
        });
        
        document.getElementById('scanBtn').addEventListener('click', () => {
            this.startScan();
        });
        
        document.getElementById('clearDbBtn').addEventListener('click', () => {
            this.clearDatabase();
        });
        
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchTracks();
        });
        
        document.getElementById('showAllBtn').addEventListener('click', () => {
            this.showAllTracks();
        });
        
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchTracks();
            }
        });
    }
    
    async selectDirectory() {
        try {
            const directory = await ipcRenderer.invoke('select-music-directory');
            
            if (directory) {
                this.selectedDirectory = directory;
                document.getElementById('selectedPath').textContent = `Selected: ${directory}`;
                document.getElementById('scanBtn').disabled = false;
            }
        } catch (error) {
            console.error('Error selecting directory:', error);
            alert('Error selecting directory: ' + error.message);
        }
    }
    
    async startScan() {
        if (!this.selectedDirectory || this.isScanning) return;
        
        this.isScanning = true;
        const startTime = Date.now();
        
        // Show progress
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('scanBtn').disabled = true;
        document.getElementById('selectDirectoryBtn').disabled = true;
        
        try {
            // Start scanning using the new modular approach
            const results = await ipcRenderer.invoke('scan-directory', this.selectedDirectory);
            
            const endTime = Date.now();
            const scanTime = ((endTime - startTime) / 1000).toFixed(1);
            
            // Update final stats
            await this.updateStats(scanTime);
            await this.showAllTracks();
            
            // Display errors in dedicated section
            this.displayErrors(results.errorDetails || []);
            
            // Show simplified results summary
            alert(`Scan completed!\n\nProcessed: ${results.processed}/${results.total} files\nSuccess: ${results.tracks.length}\nErrors: ${results.errors}\nTime: ${scanTime}s\n\n${results.errors > 0 ? 'Check the Import Errors section below for details.' : ''}`);
            
        } catch (error) {
            console.error('Scan error:', error);
            alert('Error during scan: ' + error.message);
        } finally {
            this.isScanning = false;
            document.getElementById('scanBtn').disabled = false;
            document.getElementById('selectDirectoryBtn').disabled = false;
            document.getElementById('progressContainer').style.display = 'none';
        }
    }
    
    updateProgress(progress) {
        const percent = (progress.current / progress.total) * 100;
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = 
            `Processing ${progress.current}/${progress.total} files... (${progress.processed} success, ${progress.errors} errors)`;
    }
    
    async updateStats(scanTime) {
        try {
            const stats = await ipcRenderer.invoke('get-stats');
            
            document.getElementById('totalTracks').textContent = stats.tracks;
            document.getElementById('totalArtists').textContent = stats.artists;
            document.getElementById('totalAlbums').textContent = stats.albums;
            document.getElementById('scanTime').textContent = scanTime + 's';
            document.getElementById('stats').style.display = 'grid';
        } catch (error) {
            console.error('Error getting stats:', error);
        }
    }
    
    async searchTracks() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            this.showAllTracks();
            return;
        }
        
        try {
            const tracks = await ipcRenderer.invoke('search-tracks', query);
            this.displayTracks(tracks, `Search results for "${query}"`);
        } catch (error) {
            console.error('Error searching tracks:', error);
        }
    }
    
    async showAllTracks() {
        try {
            const tracks = await ipcRenderer.invoke('get-all-tracks');
            this.displayTracks(tracks, 'All Tracks (first 100)');
        } catch (error) {
            console.error('Error getting all tracks:', error);
        }
    }
    
    displayErrors(errorDetails) {
        const errorsContainer = document.getElementById('errorsContainer');
        const errorsSummary = document.getElementById('errorsSummary');
        const errorsList = document.getElementById('errorsList');
        
        if (errorDetails.length === 0) {
            errorsContainer.style.display = 'none';
            return;
        }
        
        // Show errors container
        errorsContainer.style.display = 'block';
        
        // Update summary
        errorsSummary.textContent = `${errorDetails.length} files failed to import`;
        
        // Clear previous errors
        errorsList.innerHTML = '';
        
        // Display each error
        errorDetails.forEach((error, index) => {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-item';
            
            errorDiv.innerHTML = `
                <div class="error-filename">${index + 1}. ${error.fileName}</div>
                <div class="error-message">Error: ${error.errorMessage}</div>
                <div class="error-type">Type: ${error.errorType}</div>
            `;
            
            errorsList.appendChild(errorDiv);
        });
    }
    
    displayTracks(tracks, title) {
        const container = document.getElementById('resultsContainer');
        const tracksList = document.getElementById('tracksList');
        
        tracksList.innerHTML = `<h4>${title} (${tracks.length} tracks)</h4>`;
        
        tracks.forEach(track => {
            const trackDiv = document.createElement('div');
            trackDiv.className = 'track-item';
            
            const tags = JSON.parse(track.tags || '[]');
            const tagsHtml = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
            
            trackDiv.innerHTML = `
                <div class="track-title">${track.title}</div>
                <div class="track-artist">${track.artist} - ${track.album}</div>
                <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">
                    Duration: ${this.formatDuration(track.duration)} | 
                    Year: ${track.year || 'Unknown'} | 
                    Size: ${this.formatFileSize(track.file_size)}
                </div>
                <div class="track-tags">${tagsHtml}</div>
            `;
            
            tracksList.appendChild(trackDiv);
        });
        
        container.style.display = 'block';
    }
    
    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }
    
    async clearDatabase() {
        if (confirm('Are you sure you want to clear the entire database?')) {
            try {
                const success = await ipcRenderer.invoke('clear-database');
                if (success) {
                    document.getElementById('stats').style.display = 'none';
                    document.getElementById('resultsContainer').style.display = 'none';
                    alert('Database cleared successfully!');
                } else {
                    alert('Error clearing database!');
                }
            } catch (error) {
                console.error('Error clearing database:', error);
                alert('Error clearing database: ' + error.message);
            }
        }
    }

    // New methods for advanced search functionality
    async searchByGenre(genre) {
        try {
            const tracks = await ipcRenderer.invoke('search-by-genre', genre);
            this.displayTracks(tracks, `Tracks in genre: ${genre}`);
        } catch (error) {
            console.error('Error searching by genre:', error);
        }
    }

    async searchByEra(era) {
        try {
            const tracks = await ipcRenderer.invoke('search-by-era', era);
            this.displayTracks(tracks, `Tracks from era: ${era}`);
        } catch (error) {
            console.error('Error searching by era:', error);
        }
    }

    async getAvailableTags() {
        try {
            return await ipcRenderer.invoke('get-available-tags');
        } catch (error) {
            console.error('Error getting available tags:', error);
            return [];
        }
    }

    async getTagsByCategory() {
        try {
            return await ipcRenderer.invoke('get-tags-by-category');
        } catch (error) {
            console.error('Error getting tags by category:', error);
            return {};
        }
    }
}

// Initialize scanner when page loads
document.addEventListener('DOMContentLoaded', () => {
    new MusicScanner();
}); 