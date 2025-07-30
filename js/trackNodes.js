/**
 * Track Nodes Module
 * Handles creation and management of track nodes on the canvas
 */

const TrackNodes = {
    // Click counter removed - now managed centrally by Playlist module
    
    /**
     * Create a new track node - Bridge to TrackNodesService
     * @param {Object} track - Track data object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {HTMLElement} parentNode - Parent node for positioning
     * @param {string} connectionTag - Tag that connects this node to its parent
     * @returns {HTMLElement} The created node element
     */
    create(track, x, y, parentNode = null, connectionTag = null) {
        // Delegate to TrackNodesService - NO FALLBACK
        if (window.App && window.App.getService) {
            const trackNodesService = window.App.getService('tracknodes');
            if (trackNodesService && typeof trackNodesService.createNode === 'function') {
                return trackNodesService.createNode(track, x, y, parentNode, connectionTag);
            } else {
                throw new Error('TrackNodesService is required but not available');
            }
        } else {
            throw new Error('App.getService is required but not available');
        }
    },

    /**
     * Create a play button for a track - Bridge to TrackNodesService
     * @param {Object} track - Track data object
     * @returns {HTMLElement} The play button element
     */
    createPlayButton(track) {
        // Delegate to TrackNodesService - NO FALLBACK
        if (window.App && window.App.getService) {
            const trackNodesService = window.App.getService('tracknodes');
            if (trackNodesService && typeof trackNodesService.createPlayButton === 'function') {
                return trackNodesService.createPlayButton(track);
            } else {
                throw new Error('TrackNodesService createPlayButton method is required but not available');
            }
        } else {
            throw new Error('App.getService is required but not available');
        }
    },

    /**
     * Create tags container for a track node - Bridge to TrackNodesService
     * @param {Object} track - Track data object
     * @param {HTMLElement} node - The node element
     * @returns {HTMLElement} The tags container element
     */
    createTagsContainer(track, node) {
        // Delegate to TrackNodesService - NO FALLBACK
        if (window.App && window.App.getService) {
            const trackNodesService = window.App.getService('tracknodes');
            if (trackNodesService && typeof trackNodesService.createTagsContainer === 'function') {
                return trackNodesService.createTagsContainer(track, node);
            } else {
                throw new Error('TrackNodesService createTagsContainer method is required but not available');
            }
        } else {
            throw new Error('App.getService is required but not available');
        }
    },

    /**
     * Create branches directly for a tag - Bridge to TreeService
     * @param {string} tagValue - The tag value (e.g., "mood:confident")
     * @param {HTMLElement} sourceNode - The source node to branch from
     */
    async createBranchesDirectly(tagValue, sourceNode) {
        // Delegate to TreeService for proper tree management
        if (window.App && window.App.getService) {
            const treeService = window.App.getService('tree');
            if (treeService && typeof treeService.createBranchesForTag === 'function') {
                // Get source track data
                try {
                    const sourceTrackData = JSON.parse(sourceNode.dataset.track);
                    await treeService.createBranchesForTag(tagValue, sourceNode, sourceTrackData);
                } catch (error) {
                    console.error('Error creating branches via TreeService:', error);
                }
            } else {
                console.warn('TreeService not available for createBranchesDirectly');
            }
        }
    },

    // togglePlay removed - now handled by TrackNodesService.handlePlayButtonClick

    /**
     * Add a track to the tree and playlist - Bridge to multiple services
     * @param {Object} track - Track data object
     * @param {string} connectionTag - The tag that connects this track to its parent
     * @param {HTMLElement} parentNode - Parent node
     * @param {HTMLElement} clickedContainer - The container that was clicked (if any)
     */
    addToPlaylist(track, connectionTag, parentNode, clickedContainer = null) {
        if (window.App && window.App.getService) {
            // 1. Create node via TreeService
            const treeService = window.App.getService('tree');
            if (treeService) {
                let position = { x: 400, y: 300 }; // Default center
                if (!parentNode && AppState && AppState.canvas) {
                    position = { 
                        x: AppState.canvas.offsetWidth / 2, 
                        y: AppState.canvas.offsetHeight / 2 
                    };
                }
                treeService.addNode(track, position, parentNode, connectionTag);
            }
            
            // 2. Add to playlist via PlaylistService
            const playlistService = window.App.getService('playlist');
            if (playlistService && typeof playlistService.addTrack === 'function') {
                playlistService.addTrack(track, connectionTag);
            }
            
            // 3. Handle container cleanup (keep legacy for now)
            if (clickedContainer) {
                const containerIndex = AppState.allContainers.indexOf(clickedContainer);
                if (containerIndex > -1) {
                    AppState.allContainers.splice(containerIndex, 1);
                }
                if (clickedContainer === AppState.currentMultiTagContainer) {
                    AppState.setCurrentMultiTagContainer(null);
                    if (typeof Tags !== 'undefined' && Tags.clearSelected) {
                        Tags.clearSelected();
                    }
                }
                clickedContainer.remove();
                if (typeof Utils !== 'undefined' && Utils.updateCanvasSize) {
                    Utils.updateCanvasSize();
                }
            }
        }
    },

    // createBranchesForTag removed - functionality moved to TreeService



    /**
     * Add a new tag to an existing node - Bridge to TrackNodesService
     * @param {HTMLElement} node - The node element
     * @param {Object} track - Track data object  
     * @param {string} newTag - New tag to add (format: "category:value")
     */
    async addTagToNode(node, track, newTag) {
        // Delegate to TrackNodesService
        if (window.App && window.App.getService) {
            const trackNodesService = window.App.getService('tracknodes');
            if (trackNodesService && typeof trackNodesService.addTagToNode === 'function') {
                await trackNodesService.addTagToNode(node, track, newTag);
            } else {
                throw new Error('TrackNodesService addTagToNode method is required but not available');
            }
        } else {
            throw new Error('App.getService is required but not available');
        }
    },

    // ensureCategoryStyles, darkenColor, hexToRgba removed - now handled by TrackNodesService

    // safeParseTrackData, findTrackElementByPartialData, reconstructTrackDataFromElement removed - now handled by TrackNodesService

    /**
     * Update the original track data - Bridge to DataSourceAdapter
     * @param {Object} track - Track data object
     * @param {string} newTag - New tag to add
     */
    async updateOriginalTrackData(track, newTag) {
        // Delegate to DataSourceAdapter which handles both localStorage and database
        if (typeof DataSourceAdapter !== 'undefined' && DataSourceAdapter.addTagToTrack) {
            try {
                await DataSourceAdapter.addTagToTrack(track, newTag);
            } catch (error) {
                console.error('❌ Error updating track data:', error);
            }
        } else if (typeof DataLoader !== 'undefined' && DataLoader.addTagToTrack) {
            // Fallback to DataLoader
            try {
                await DataLoader.addTagToTrack(track, newTag);
            } catch (error) {
                console.error('❌ Error updating track data via DataLoader:', error);
            }
        }
    },


};

// Make TrackNodes available globally
window.TrackNodes = TrackNodes; 