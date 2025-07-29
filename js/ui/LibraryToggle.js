window.LibraryToggle = (() => {
    let isShowingScan = false;
    let uniqueTags = [];
    
    function init() {
        const toggleButton = document.getElementById('toggleScanButton');
        const libraryContent = document.getElementById('libraryContent');
        const scanContent = document.getElementById('scanContent');
        
        if (!toggleButton || !libraryContent || !scanContent) {
            console.error('LibraryToggle: Required elements not found');
            return;
        }
        
        toggleButton.addEventListener('click', toggleView);
        
        // Listen for scan completion and database clear to update stats
        if (window.App && window.App.eventBus) {
            window.App.eventBus.on('scan:completed', () => {
                updateStats();
            });
            
            window.App.eventBus.on('database:cleared', () => {
                updateStats();
            });
        }
        
        // Load stats when the component initializes
        updateStats();
    }
    
    function toggleView() {
        const libraryContent = document.getElementById('libraryContent');
        const scanContent = document.getElementById('scanContent');
        const toggleButton = document.getElementById('toggleScanButton');
        const colorLegend = document.querySelector('.color-legend');
        const playlistPhasesLink = document.querySelector('.playlist-phases-link');
        
        isShowingScan = !isShowingScan;
        
        if (isShowingScan) {
            libraryContent.style.display = 'none';
            scanContent.style.display = 'block';
            if (colorLegend) colorLegend.style.display = 'none';
            if (playlistPhasesLink) playlistPhasesLink.style.display = 'none';
            toggleButton.querySelector('.toggle-icon').textContent = '📚';
            toggleButton.title = 'Back to Library';
            updateStats();
            
            // Re-initialize scan button when showing scan view
            // Emit event to notify that scan view is now visible
            if (window.App && window.App.eventBus) {
                window.App.eventBus.emit('scan:viewShown');
            }
            
            // Fallback: if ScanService doesn't handle the buttons, set them up here
            setTimeout(() => {
                const scanButton = document.getElementById('scanButton');
                const clearButton = document.getElementById('clearButton');
                
                if (scanButton && !scanButton.onclick) {
                    scanButton.onclick = async () => {
                        if (window.DataSourceAdapter) {
                            try {
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
                                    
                                    await window.DataSourceAdapter.scanDirectory(directory);
                                    updateStats();
                                }
                                
                                // Hide progress bar
                                if (scanProgress) scanProgress.style.display = 'none';
                            } catch (error) {
                                alert('Error scanning library: ' + error.message);
                                
                                // Hide progress bar on error
                                const scanProgress = document.getElementById('scanProgress');
                                if (scanProgress) scanProgress.style.display = 'none';
                            }
                        } else {
                            alert('Data source not available');
                        }
                    };
                }
                
                // Setup clear button fallback
                if (clearButton && !clearButton.onclick) {
                    clearButton.onclick = async () => {
                        const confirmed = confirm(
                            'Are you sure you want to clear the entire database?\n\n' +
                            'This will permanently delete all scanned tracks, artists, albums, and tags.\n\n' +
                            'This action cannot be undone.'
                        );
                        
                        if (!confirmed) {
                            return;
                        }
                        
                        if (window.DataSourceAdapter) {
                            try {
                                const success = await window.DataSourceAdapter.clearDatabase();
                                if (success) {
                                    updateStats();
                                    alert('Database cleared successfully!');
                                } else {
                                    alert('Failed to clear database');
                                }
                            } catch (error) {
                                alert('Error clearing database: ' + error.message);
                            }
                        } else {
                            alert('Data source not available');
                        }
                    };
                }
            }, 200);
        } else {
            libraryContent.style.display = 'block';
            scanContent.style.display = 'none';
            if (colorLegend) colorLegend.style.display = 'block';
            if (playlistPhasesLink) playlistPhasesLink.style.display = 'block';
            toggleButton.querySelector('.toggle-icon').textContent = '⚙️';
            toggleButton.title = 'Scan Settings';
        }
    }
    
    async function updateStats() {
        try {
            // Get stats from the data source
            const stats = await window.DataSourceAdapter.getStats();
            
            // Update the UI
            document.getElementById('tracksCount').textContent = stats.tracks || 0;
            document.getElementById('artistsCount').textContent = stats.artists || 0;
            document.getElementById('albumsCount').textContent = stats.albums || 0;
            
            // Update tags count and store unique tags
            if (stats.uniqueTags) {
                uniqueTags = stats.uniqueTags;
                document.getElementById('tagsCount').textContent = uniqueTags.length;
                updateTagsList();
            }
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }
    
    function updateTagsList() {
        const listContent = document.getElementById('tagsListContent');
        if (!listContent) return;
        
        // Clear existing content
        listContent.innerHTML = '';
        
        if (uniqueTags.length === 0) {
            listContent.innerHTML = '<p class="no-tags-message">No tags found in the database.</p>';
            return;
        }
        
        // Sort tags alphabetically
        const sortedTags = [...uniqueTags].sort();
        
        // Group tags by type
        const tagsByType = {};
        sortedTags.forEach(tag => {
            const [type, value] = tag.split(':');
            if (!tagsByType[type]) {
                tagsByType[type] = [];
            }
            tagsByType[type].push(value);
        });
        
        // Create grouped display
        Object.entries(tagsByType).forEach(([type, values]) => {
            const typeGroup = document.createElement('div');
            typeGroup.className = 'tag-type-group';
            
            const typeHeader = document.createElement('div');
            typeHeader.className = 'tag-type-header';
            typeHeader.textContent = type;
            typeGroup.appendChild(typeHeader);
            
            const tagsList = document.createElement('div');
            tagsList.className = 'tags-list';
            
            values.forEach(value => {
                const tagItem = document.createElement('span');
                tagItem.className = 'tag-item';
                tagItem.textContent = value;
                tagsList.appendChild(tagItem);
            });
            
            typeGroup.appendChild(tagsList);
            listContent.appendChild(typeGroup);
        });
    }
    
    return {
        init,
        updateStats
    };
})();