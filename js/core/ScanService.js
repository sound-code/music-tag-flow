/**
 * ScanService - Gestisce la funzionalità di scanning della libreria musicale
 * Integra i componenti di scanning da test-modules nell'app principale
 */

class ScanService extends ServiceBase {
    constructor(stateManager, eventBus) {
        
        // MUST call super() first in derived class
        super(stateManager, eventBus);
        
        this.setupEventListeners();
        this.setupUI();
        
        // Try to setup button immediately if scan view is already visible
        setTimeout(() => {
            const scanContent = document.getElementById('scanContent');
            if (scanContent && scanContent.style.display !== 'none') {
                this.initializeElements();
                this.setupScanButton();
            }
        }, 100);
    }

    initialize() {
        
        // Initialize properties
        this.isScanning = false;
        
        // Initialize elements object
        this.elements = {
            scanButton: null,
            scanProgress: null,
            progressFill: null,
            progressText: null,
            scanStats: null
        };
        
        try {
            // Initialize elements immediately if DOM is ready
            if (document.readyState !== 'loading') {
                this.initializeElements();
            }
        } catch (error) {
            console.error('ScanService: Error in initialize():', error);
        }
    }

    setupEventListeners() {
        // Setup scan button click handler - try immediately and on DOM ready
        this.setupScanButton();
        // Clear button now handled by StatsComponent
        
        // Listen for scan view being shown
        
        this.events.on('scan:viewShown', () => {
            this.initializeElements();
            this.setupScanButton();
            // Clear button handled by StatsComponent
        });
        
        // Also try when DOM is fully loaded as fallback
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupScanButton();
            });
        }

        // Electron IPC messages are handled directly in handleScanClick
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
            
        } else {
        }
    }

    setupUI() {
        // Initialize elements when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeElements();
        });
    }

    initializeElements() {
        try {
            this.elements.scanButton = document.getElementById('scanButton');
            this.elements.scanProgress = document.getElementById('scanProgress');
            this.elements.progressFill = document.getElementById('progressFill');
            this.elements.progressText = document.getElementById('progressText');
            this.elements.scanStats = document.getElementById('scanStats');
        } catch (error) {
            console.error('ScanService: Error in initializeElements():', error);
        }
    }

    async handleScanClick() {
        if (this.isScanning) {
            return;
        }

        if (window.DataSourceAdapter) {
            try {
                this.isScanning = true;
                
                const scanProgress = document.getElementById('scanProgress');
                const progressFill = document.getElementById('progressFill');
                const progressText = document.getElementById('progressText');
                
                // Show progress bar
                if (scanProgress) scanProgress.style.display = 'block';
                if (progressFill) progressFill.style.width = '0%';
                if (progressText) progressText.textContent = 'Starting scan...';
                
                const directory = await window.DataSourceAdapter.selectMusicDirectory();
                if (directory) {
                    // Clean up existing listeners and setup new one
                    if (window.electronAPI) {
                        window.electronAPI.removeAllListeners('scan-progress');
                        window.electronAPI.onScanProgress((progress) => {
                            if (progressFill && progressText) {
                                const percentage = Math.round((progress.processed / progress.total) * 100);
                                progressFill.style.width = `${percentage}%`;
                                progressText.textContent = `Scanning... ${progress.processed}/${progress.total} (${percentage}%)`;
                            }
                        });
                    }
                    
                    const results = await window.DataSourceAdapter.scanDirectory(directory);
                    
                    // Emit event for StatsComponent to update stats
                    if (window.App && window.App.eventBus) {
                        window.App.eventBus.emit('scan:completed', {
                            directory,
                            results
                        });
                    }
                    
                    // Emit event for LibraryToggle to update tags list
                    this.events.emit('scan:completed', {
                        directory,
                        results
                    });
                }
                
                // Hide progress bar
                if (scanProgress) scanProgress.style.display = 'none';
                
            } catch (error) {
                alert('Error scanning library: ' + error.message);
                
                // Hide progress bar on error
                const scanProgress = document.getElementById('scanProgress');
                if (scanProgress) scanProgress.style.display = 'none';
            } finally {
                this.isScanning = false;
            }
        } else {
            alert('Data source not available');
        }
    }



    // Public API methods
    isCurrentlyScanning() {
        return this.isScanning;
    }
}

// Make available globally
window.ScanService = ScanService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScanService;
}