/**
 * ScanService - Gestisce la funzionalità di scanning della libreria musicale
 * Integra i componenti di scanning da test-modules nell'app principale
 */

class ScanService extends ServiceBase {
    constructor(stateManager, eventBus) {
        super(stateManager, eventBus);
        
        this.isScanning = false;
        this.scanStats = {
            tracks: 0,
            artists: 0,
            albums: 0
        };
        
        this.setupEventListeners();
        this.setupUI();
    }

    initialize() {
        // Initialize elements immediately if DOM is ready
        if (document.readyState !== 'loading') {
            this.initializeElements();
            this.loadExistingStats();
        }
    }

    setupEventListeners() {
        // Setup scan button click handler - try immediately and on DOM ready
        this.setupScanButton();
        this.setupClearButton();
        
        // Listen for scan view being shown
        this.eventBus.on('scan:viewShown', () => {
            this.initializeElements();
            this.setupScanButton();
            this.setupClearButton();
        });
        
        // Also try when DOM is fully loaded as fallback
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupScanButton();
            });
        }

        // Listen for Electron IPC messages
        if (window.electronAPI) {
            window.electronAPI.onScanProgress((progress) => {
                this.updateProgress(progress);
            });
        }
    }

    setupScanButton() {
        const scanButton = document.getElementById('scanButton');
        
        if (scanButton) {
            // Remove existing listener if any
            const boundHandleScanClick = this.handleScanClick.bind(this);
            scanButton.removeEventListener('click', boundHandleScanClick);
            
            // Add new listener
            scanButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleScanClick();
            });
        }
    }

    setupClearButton() {
        const clearButton = document.getElementById('clearButton');
        
        if (clearButton) {
            // Remove existing listener if any
            const boundHandleClearClick = this.handleClearClick.bind(this);
            clearButton.removeEventListener('click', boundHandleClearClick);
            
            // Add new listener
            clearButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleClearClick();
            });
        }
    }


    setupUI() {
        this.elements = {
            scanButton: null,
            scanProgress: null,
            progressFill: null,
            progressText: null,
            scanStats: null,
            tracksCount: null,
            artistsCount: null,
            albumsCount: null
        };

        // Initialize elements when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeElements();
            this.loadExistingStats(); // Load existing stats on startup
        });
    }

    initializeElements() {
        this.elements.scanButton = document.getElementById('scanButton');
        this.elements.scanProgress = document.getElementById('scanProgress');
        this.elements.progressFill = document.getElementById('progressFill');
        this.elements.progressText = document.getElementById('progressText');
        this.elements.scanStats = document.getElementById('scanStats');
        this.elements.tracksCount = document.getElementById('tracksCount');
        this.elements.artistsCount = document.getElementById('artistsCount');
        this.elements.albumsCount = document.getElementById('albumsCount');

        // Update stats display if we have existing data
        this.updateStatsDisplay();
    }

    async handleScanClick() {
        if (this.isScanning) {
            return;
        }

        try {
            // Check if DataSourceAdapter is available
            if (!window.DataSourceAdapter) {
                alert('Data source not available');
                return;
            }

            // Select directory
            const directory = await window.DataSourceAdapter.selectMusicDirectory();
            if (!directory) {
                return;
            }

            // Start scanning
            await this.startScan(directory);

        } catch (error) {
            console.error('Error during scan:', error);
            this.showError('Scan failed: ' + error.message);
            this.resetScanUI();
        }
    }

    async handleClearClick() {
        // Show confirmation dialog
        const confirmed = confirm(
            'Are you sure you want to clear the entire database?\n\n' +
            'This will permanently delete all scanned tracks, artists, albums, and tags.\n\n' +
            'This action cannot be undone.'
        );
        
        if (!confirmed) {
            return;
        }

        try {
            // Check if DataSourceAdapter is available
            if (!window.DataSourceAdapter) {
                alert('Data source not available');
                return;
            }

            // Clear the database
            const success = await window.DataSourceAdapter.clearDatabase();
            if (!success) {
                throw new Error('Failed to clear database');
            }
            
            // Reset local stats
            this.scanStats = {
                tracks: 0,
                artists: 0,
                albums: 0
            };
            
            // Update stats display
            this.updateStatsDisplay();
            
            // Emit events to notify other components
            this.eventBus.emit('database:cleared');
            this.eventBus.emit('library:refresh');
            
            alert('Database cleared successfully!');
            
        } catch (error) {
            console.error('Error clearing database:', error);
            alert('Error clearing database: ' + error.message);
        }
    }

    async startScan(directory) {
        this.isScanning = true;
        this.showProgress();
        
        try {
            // Clean up any existing listeners and setup new one for this scan
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('scan-progress');
                window.electronAPI.onScanProgress((progress) => {
                    this.updateProgress(progress);
                });
            }
            
            // Call DataSourceAdapter to start scanning
            const results = await window.DataSourceAdapter.scanDirectory(directory);
            
            
            // Update stats
            this.scanStats = {
                tracks: results.processed || 0,
                artists: results.artists || 0,
                albums: results.albums || 0
            };
            
            // Show results
            this.showScanResults(results);
            
            // Emit event to notify other services
            this.eventBus.emit('scan:completed', {
                directory,
                results,
                stats: this.scanStats
            });
            
            // Refresh the music library display
            this.eventBus.emit('library:refresh');
            
            // Clear cache and force reload of library data
            if (typeof DataSourceAdapter !== 'undefined' && DataSourceAdapter.clearCache) {
                DataSourceAdapter.clearCache();
            }
            
            // Force complete page reload to refresh the library
            setTimeout(() => {
                window.location.reload();
            }, 2000); // Give time for user to see completion message
            
        } catch (error) {
            console.error('Scan error:', error);
            throw error;
        } finally {
            this.isScanning = false;
        }
    }

    updateProgress(progress) {
        if (!this.elements.progressFill || !this.elements.progressText) return;
        
        const percentage = Math.round((progress.processed / progress.total) * 100);
        
        this.elements.progressFill.style.width = `${percentage}%`;
        this.elements.progressText.textContent = 
            `Scanning... ${progress.processed}/${progress.total} (${percentage}%)`;
        
        // Update button text
        if (this.elements.scanButton) {
            const scanText = this.elements.scanButton.querySelector('.scan-text');
            if (scanText) {
                scanText.textContent = `Scanning... ${percentage}%`;
            }
        }
    }

    showProgress() {
        if (this.elements.scanButton) {
            this.elements.scanButton.disabled = true;
            const scanText = this.elements.scanButton.querySelector('.scan-text');
            if (scanText) {
                scanText.textContent = 'Scanning...';
            }
        }
        
        if (this.elements.scanProgress) {
            this.elements.scanProgress.style.display = 'block';
        }
        
        // Reset progress
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = '0%';
        }
        if (this.elements.progressText) {
            this.elements.progressText.textContent = 'Starting scan...';
        }
    }

    showScanResults(results) {
        // Update stats display
        this.updateStatsDisplay();
        
        // Show stats section
        if (this.elements.scanStats) {
            this.elements.scanStats.style.display = 'block';
        }
        
        // Reset button
        this.resetScanUI();
        
        // Show success message in progress text
        if (this.elements.progressText) {
            this.elements.progressText.textContent = 
                `Scan completed! Found ${results.processed} tracks`;
        }
    }

    updateStatsDisplay() {
        if (this.elements.tracksCount) {
            this.elements.tracksCount.textContent = this.scanStats.tracks;
        }
        if (this.elements.artistsCount) {
            this.elements.artistsCount.textContent = this.scanStats.artists;
        }
        if (this.elements.albumsCount) {
            this.elements.albumsCount.textContent = this.scanStats.albums;
        }
    }

    resetScanUI() {
        if (this.elements.scanButton) {
            this.elements.scanButton.disabled = false;
            const scanText = this.elements.scanButton.querySelector('.scan-text');
            if (scanText) {
                scanText.textContent = 'Scan Music Library';
            }
        }
    }

    showError(message) {
        console.error('ScanService Error:', message);
        
        if (this.elements.progressText) {
            this.elements.progressText.textContent = `Error: ${message}`;
            this.elements.progressText.style.color = '#ef4444';
        }
        
        // Reset color after 5 seconds
        setTimeout(() => {
            if (this.elements.progressText) {
                this.elements.progressText.style.color = '';
            }
        }, 5000);
    }

    // Public API methods
    getScanStats() {
        return { ...this.scanStats };
    }

    isCurrentlyScanning() {
        return this.isScanning;
    }

    // Load existing stats from storage/database
    async loadExistingStats() {
        try {
            if (window.DataSourceAdapter) {
                const stats = await window.DataSourceAdapter.getStats();
                this.scanStats = stats;
                this.updateStatsDisplay();
            }
        } catch (error) {
            console.error('Error loading existing stats:', error);
        }
    }
}

// Make available globally
window.ScanService = ScanService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScanService;
}