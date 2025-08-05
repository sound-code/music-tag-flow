/**
 * Utility Functions Module - Service Architecture Integration
 * Enhanced with EventBus integration while maintaining legacy compatibility
 */

const Utils = {
    /**
     * Initialize Utils with EventBus integration
     */
    initialize() {
        // Subscribe to EventBus events if available
        if (window.EventBus) {
            window.EventBus.on('ui:notification', (data) => {
                this.handleNotificationEvent(data);
            });
        }
    },

    /**
     * Handle notification events from EventBus
     * @param {Object} data - Notification data {message, type, duration}
     */
    handleNotificationEvent(data) {
        const { message, type = 'info', duration = 3000 } = data;
        this.showNotification(message, type, duration);
    },

    /**
     * Show a notification message to the user (Enhanced with EventBus)
     * @param {string} message - The message to display
     * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
     * @param {number} duration - Display duration in milliseconds
     */
    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element
        const notification = document.createElement('div');
        
        // Define notification styles based on type
        const styles = {
            info: {
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            },
            success: {
                background: 'rgba(0, 150, 0, 0.9)',
                color: 'white',
                border: '1px solid rgba(0, 255, 0, 0.3)'
            },
            error: {
                background: 'rgba(200, 0, 0, 0.9)',
                color: 'white',
                border: '1px solid rgba(255, 0, 0, 0.3)'
            },
            warning: {
                background: 'rgba(255, 140, 0, 0.9)',
                color: 'white',
                border: '1px solid rgba(255, 165, 0, 0.3)'
            }
        };
        
        const style = styles[type] || styles.info;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${style.background};
            color: ${style.color};
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 1001;
            font-size: 14px;
            backdrop-filter: blur(10px);
            transition: opacity 0.3s ease;
            border: ${style.border};
            max-width: 400px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove notification
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
        
        // Emit event for tracking (if EventBus available)
        if (window.EventBus) {
            window.EventBus.emit('ui:notification:shown', { message, type, duration });
        }
    },

    /**
     * Get next available X position in a row
     * @param {number} y - The Y coordinate of the row
     * @param {boolean} excludeContainers - Whether to exclude containers from calculation
     * @returns {number} The next available X position
     */
    getNextXPositionInRow(y, excludeContainers = false) {
        const { allNodes, allContainers } = AppState;
        
        const nodesInRow = allNodes.filter(nodeData => {
            if (!nodeData.element) return false;
            const nodeY = parseInt(nodeData.element.style.top);
            return Math.abs(nodeY - y) < 50; // Within 50px tolerance
        });

        const containersInRow = excludeContainers ? [] : allContainers.filter(container => {
            const containerY = parseInt(container.style.top);
            return Math.abs(containerY - y) < 50; // Within 50px tolerance
        });

        let maxX = 100; // Start position

        nodesInRow.forEach(nodeData => {
            const nodeX = parseInt(nodeData.element.style.left);
            const nodeWidth = 160;
            maxX = Math.max(maxX, nodeX + nodeWidth + 5);
        });

        containersInRow.forEach(container => {
            const containerX = parseInt(container.style.left);
            const containerWidth = 380;
            maxX = Math.max(maxX, containerX + containerWidth + 20);
        });

        return maxX;
    },

    /**
     * Update canvas size to accommodate all content
     */
    updateCanvasSize() {
        const { allNodes, allContainers, canvas, canvasContent } = AppState;
        
        let maxX = 0;
        let maxY = 0;
        let minX = Infinity;
        let minY = Infinity;
        
        allNodes.forEach(nodeData => {
            if (nodeData.element) {
                let nodeX = parseInt(nodeData.element.style.left) || 0;
                let nodeY = parseInt(nodeData.element.style.top) || 0;
                
                if ((nodeX === 0 && nodeY === 0)) {
                    const treeService = window.App?.getService('tree');
                    const treeNode = treeService?.nodes?.get(nodeData.element.id);
                    if (treeNode && treeNode.position) {
                        nodeX = treeNode.position.x - 40;
                        nodeY = treeNode.position.y - 40;
                    }
                }

                maxX = Math.max(maxX, nodeX + 80);
                maxY = Math.max(maxY, nodeY + 80);
                minX = Math.min(minX, nodeX);
                minY = Math.min(minY, nodeY);
            }
        });
        
        allContainers.forEach(container => {
            const containerX = parseInt(container.style.left) || 0;
            const containerY = parseInt(container.style.top) || 0;
            maxX = Math.max(maxX, containerX + 380);
            maxY = Math.max(maxY, containerY + 820);
            minX = Math.min(minX, containerX);
            minY = Math.min(minY, containerY);
        });
        
        if (minX === Infinity) minX = 0;
        if (minY === Infinity) minY = 0;
        
        const paddedMinX = Math.max(0, minX - 200);
        const paddedMinY = Math.max(0, minY - 200);
        const paddedMaxX = maxX + 200;
        const paddedMaxY = maxY + 200;
        
        const requiredWidth = paddedMaxX - paddedMinX;
        const requiredHeight = paddedMaxY - paddedMinY;
        
        const viewportWidth = canvas.offsetWidth - 48;
        const viewportHeight = canvas.offsetHeight - 48;
        
        const newWidth = Math.max(viewportWidth, requiredWidth);
        const newHeight = Math.max(viewportHeight, requiredHeight);
        
        canvasContent.style.width = `${newWidth}px`;
        canvasContent.style.height = `${newHeight}px`;
        
        const svg = canvasContent.querySelector('.tree-svg');
        if (svg) {
            svg.style.width = `${newWidth}px`;
            svg.style.height = `${newHeight}px`;
        }
        
    },

    /**
     * Create a text element with specified class and content
     * @param {string} tagName - HTML tag name
     * @param {string} className - CSS class name
     * @param {string} textContent - Text content
     * @returns {HTMLElement} Created element
     */
    createTextElement(tagName, className, textContent) {
        const element = document.createElement(tagName);
        element.className = className;
        element.textContent = textContent;
        return element;
    },

    /**
     * Scroll to a specific node and highlight it
     * @param {string} nodeId - The ID of the node to scroll to
     */
    scrollToNode(nodeId) {
        const node = document.getElementById(nodeId);
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.style.animation = 'pulse 1s ease-in-out';
            setTimeout(() => {
                node.style.animation = '';
            }, 1000);
        }
    },



    /**
     * Render music library dynamically from external data
     */
    async renderMusicLibrary() {
        try {
            const dataService = window.serviceManager?.getService('data');
            if (!dataService) {
                console.error('DataService not available');
                return;
            }
            
            const libraryStructure = await dataService.getLibraryStructure();
            const musicLibrary = document.querySelector('.music-library');
            
            if (!musicLibrary) {
                return;
            }

            // Clear existing content
            musicLibrary.innerHTML = `
                <div class="library-header">
                    <button class="refresh-library" onclick="Utils.refreshMusicLibrary()">⟳</button>
                </div>
            `;

            // Check if we have data
            if (!libraryStructure || !Array.isArray(libraryStructure) || libraryStructure.length === 0) {
                musicLibrary.innerHTML += '<div class="no-data">No music library data available</div>';
                return;
            }

            // Render artists one by one safely
            for (const artist of libraryStructure) {
                try {
                    if (!artist || !artist.name || !artist.albums) continue;
                    
                    const artistFolder = document.createElement('div');
                    artistFolder.className = 'artist-folder';
                    
                    // Create artist header
                    const artistHeader = document.createElement('div');
                    artistHeader.className = 'artist-header';
                    artistHeader.onclick = function() { toggleArtist(this); };
                    artistHeader.innerHTML = `
                        <span class="artist-icon">+</span>
                        <span class="artist-name">${artist.name}</span>
                        <span class="artist-count">${artist.albums.length} albums</span>
                    `;
                    
                    artistFolder.appendChild(artistHeader);
                    
                    // Create albums container
                    const albumsContainer = document.createElement('div');
                    albumsContainer.className = 'albums-container';
                    
                    // Add albums
                    for (const album of artist.albums) {
                        if (!album || !album.name || !album.tracks) continue;
                        
                        const albumFolder = document.createElement('div');
                        albumFolder.className = 'album-folder';
                        
                        const albumHeader = document.createElement('div');
                        albumHeader.className = 'album-header';
                        albumHeader.onclick = function() { toggleAlbum(this); };
                        albumHeader.innerHTML = `
                            <span class="album-icon">+</span>
                            <span class="album-name">${album.name}</span>
                            <span class="album-count">${album.tracks.length} tracks</span>
                        `;
                        
                        const tracksContainer = document.createElement('div');
                        tracksContainer.className = 'tracks-container';
                        
                        // Add tracks
                        for (const track of album.tracks) {
                            if (!track || !track.title) continue;
                            
                            // Sanitize track data for JSON serialization
                            const safeTrack = {
                                title: track.title || 'Unknown Track',
                                artist: track.artist || artist.name,
                                album: track.album || album.name,
                                duration: track.duration || '',
                                tags: Array.isArray(track.tags) ? track.tags : [],
                                source: track.source || 'database'
                            };
                            
                            const trackItem = document.createElement('div');
                            trackItem.className = 'track-item';
                            trackItem.draggable = true;
                            
                            try {
                                const trackJson = JSON.stringify(safeTrack);
                                trackItem.setAttribute('data-track', trackJson);
                            } catch (jsonError) {
                                console.error('🎯 Error serializing track:', track, jsonError);
                                // Fallback with minimal data
                                trackItem.setAttribute('data-track', JSON.stringify({
                                    title: safeTrack.title,
                                    artist: safeTrack.artist,
                                    album: safeTrack.album,
                                    tags: []
                                }));
                            }
                            
                            trackItem.innerHTML = `
                                <div class="track-title">${safeTrack.title}</div>
                                <div class="track-duration">${safeTrack.duration}</div>
                            `;
                            
                            tracksContainer.appendChild(trackItem);
                        }
                        
                        albumFolder.appendChild(albumHeader);
                        albumFolder.appendChild(tracksContainer);
                        albumsContainer.appendChild(albumFolder);
                    }
                    
                    artistFolder.appendChild(albumsContainer);
                    musicLibrary.appendChild(artistFolder);
                    
                } catch (artistError) {
                    console.error('Error rendering artist:', artist?.name, artistError);
                    continue;
                }
            }

            // Add drag & drop functionality
            const trackItems = musicLibrary.querySelectorAll('.track-item[draggable="true"]');
            trackItems.forEach(trackItem => {
                if (window.App && window.App.getService) {
                    const dragDropService = window.App.getService('dragdrop');
                    if (dragDropService && typeof dragDropService.addDragToElement === 'function') {
                        dragDropService.addDragToElement(trackItem);
                    }
                }
            });


        } catch (error) {
            console.error('🎵 Error in renderMusicLibrary:', error);
            this.showNotification('Error loading music library', 'error');
        }
    },

    /**
     * Refresh music library data
     */
    async refreshMusicLibrary() {
        const dataService = window.serviceManager?.getService('data');
        if (dataService) {
            dataService.clearCache();
        }
        await this.renderMusicLibrary();
        this.showNotification('Music library refreshed', 'success');
    },

    /**
     * Legacy fallback for generateTracksWithTag - redirects to DataService
     * @param {string} tagValue - The tag value to generate tracks for
     * @param {Object} excludeTrack - Optional track to exclude from results
     * @returns {Promise<Array>} Array of track objects
     */
    async generateTracksWithTag(tagValue, excludeTrack = null) {
        const dataService = window.serviceManager?.getService('data');
        if (!dataService) {
            console.error('DataService not available');
            return [];
        }
        return await dataService.generateTracksWithTag(tagValue, excludeTrack);
    },

    /**
     * Debug helper to show application state
     */
    debugAppState() {
        if (window.App && window.App.getStats) {
            
        } else {
            
        }
    }
};

// Auto-initialize Utils when EventBus is available
if (window.EventBus) {
    Utils.initialize();
} else {
    // Wait for EventBus to be ready
    document.addEventListener('DOMContentLoaded', () => {
        if (window.EventBus) {
            Utils.initialize();
        }
    });
}

// Make Utils available globally
window.Utils = Utils; 