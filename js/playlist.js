/**
 * Playlist Module - Pure Facade/Bridge to PlaylistService
 * Provides backward compatibility for legacy code
 * All functionality is delegated to PlaylistService
 */

const Playlist = {
    // Legacy properties for compatibility
    clickCounter: 0,
    isTreeBuilding: false,
    
    /**
     * Handle node clicks centrally - delegates to PlaylistService
     * @param {Object} track - Track data
     * @param {HTMLElement} node - The clicked node
     * @param {string} connectionTag - Connection tag for the track
     */
    handleNodeClick(track, node, connectionTag = 'direct-selection') {
        // Delegate to PlaylistService
        if (window.App && window.App.getService) {
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.handleNodeClick === 'function') {
                playlistService.handleNodeClick(track, node, connectionTag);
                return;
            }
        }
        
        // Fallback implementation (should not be reached if PlaylistService is available)
        // Add visual feedback
        node.classList.add('active');
        setTimeout(() => {
            node.classList.remove('active');
        }, 300);
        
        // Increment the centralized counter
        this.clickCounter++;
        
        // Check if we should re-center the tree based on playlist size
        const hasExistingTree = Tree.rootNode !== null;
        const isTreeStable = hasExistingTree && !this.isTreeBuilding;
        const playlistSize = AppState.playlistEntries.length + 1; // +1 for the track about to be added
        const shouldRecenter = isTreeStable && playlistSize % 3 === 0 && playlistSize > 0;
        
        if (shouldRecenter) {
            // Reset tree on this track (from 3rd click onwards)
            this.recenterTreeOnTrack(track, node, connectionTag);
        } else {
            // Normal click - add to playlist
            this.addTrackToPlaylist(track, connectionTag);
        }
    },
    
    /**
     * Add a track to the playlist - delegates to PlaylistService
     * @param {Object} track - Track data
     * @param {string} connectionTag - Connection tag
     */
    addTrackToPlaylist(track, connectionTag) {
        // Delegate to PlaylistService
        if (window.App && window.App.getService) {
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.addTrack === 'function') {
                try {
                    playlistService.addTrack(track, connectionTag);
                    
                    // Show notification through PlaylistService event system
                    if (window.EventBus) {
                        window.EventBus.emit('ui:notification', {
                            message: `"${track.title}" added to playlist!`,
                            type: 'success'
                        });
                    }
                    return;
                } catch (error) {
                    if (window.EventBus) {
                        window.EventBus.emit('ui:notification', {
                            message: error.message,
                            type: 'error'
                        });
                    }
                    return;
                }
            }
        }
        
        // This should not be reached if PlaylistService is available
    },
    
    /**
     * Re-center the tree on a selected track - delegates to PlaylistService
     */
    recenterTreeOnTrack(track, clickedNode, connectionTag) {
        // Delegate to PlaylistService
        if (window.App && window.App.getService) {
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.recenterTreeOnTrack === 'function') {
                playlistService.recenterTreeOnTrack(track, clickedNode, connectionTag);
                return;
            }
        }
        
        // This should not be reached if PlaylistService is available
    },

    /**
     * Update the playlist display - delegates to PlaylistService
     */
    update() {
        // Delegate to PlaylistService
        if (window.App && window.App.getService) {
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.updatePlaylistDisplay === 'function') {
                playlistService.updatePlaylistDisplay();
                return;
            }
        }
        
        // This should not be reached if PlaylistService is available
    },

    /**
     * Update playlist display including user-selected playlist entries
     * Legacy compatibility method
     */
    updateWithPlaylistEntries() {
        this.update();
    },

    /**
     * Save the current playlist - delegates to PlaylistService
     */
    save() {
        // Delegate to PlaylistService
        if (window.App && window.App.getService) {
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.savePlaylist === 'function') {
                playlistService.savePlaylist();
                return;
            }
        }
        
        // This should not be reached if PlaylistService is available
    },

    /**
     * Remove a track from the playlist using element reference
     */
    removeTrackByIndex(element) {
        // Delegate to PlaylistService
        if (window.App && window.App.getService) {
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.removeTrackByIndex === 'function') {
                playlistService.removeTrackByIndex(element);
                return;
            }
        }
        
        // This should not be reached if PlaylistService is available
    },

    /**
     * Remove a track from the playlist by index
     */
    removeTrack(index) {
        // Delegate to PlaylistService
        if (window.App && window.App.getService) {
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.removeTrack === 'function') {
                const success = playlistService.removeTrack(index);
                if (!success) {
                    if (window.EventBus) {
                        window.EventBus.emit('ui:notification', {
                            message: index === 0 ? 'Cannot remove the currently playing track!' : 'Invalid track index!',
                            type: 'warning'
                        });
                    }
                }
                return;
            }
        }
        
        // This should not be reached if PlaylistService is available
    },

    /**
     * Clear the entire playlist and tree - delegates to PlaylistService
     */
    clear() {
        // Delegate to PlaylistService
        if (window.App && window.App.getService) {
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.clearPlaylistAndTree === 'function') {
                playlistService.clearPlaylistAndTree();
                return;
            }
        }
        
        // This should not be reached if PlaylistService is available
    }
};

// Make Playlist available globally
window.Playlist = Playlist;