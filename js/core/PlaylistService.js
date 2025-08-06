/**
 * PlaylistService - Centralized playlist management
 * Handles playlist entries, phases view, and timeline coordination
 */
class PlaylistService extends ServiceBase {
    constructor(stateManager, eventBus, dependencies = {}) {
        super(stateManager, eventBus, dependencies);
        // Service-specific configuration
        this.config = {
            maxPlaylistSize: 100,
            autoStartClock: true,
            recenterInterval: 3 // Re-center tree every N tracks
        };
        // Initialize validation rules
        this.validationRules = {
            playlistEntry: {
                track: (track) => track && typeof track === 'object' && track.title,
                connectionTag: (tag) => typeof tag === 'string' && tag.length > 0
            }
        };
    }
    /**
     * Initialize service and set up event listeners
     */
    initialize() {
        // Ensure playlist state exists
        if (!this.getState('playlist.entries')) {
            this.setState('playlist.entries', []);
        }
        // Subscribe to playlist state changes
        this.subscribeToState('playlist.entries', (entries) => {
            this.onPlaylistChanged(entries);
        });
        // Subscribe to phases view changes
        this.subscribeToState('app.isPhasesViewActive', (isActive) => {
            this.onPhasesViewChanged(isActive);
        });
        // Subscribe to external events
        this.subscribeToEvent('node:click', (data) => {
            this.handleNodeClick(data.track, data.node, data.connectionTag);
        });
        this.subscribeToEvent('playlist:clear', () => {
            this.clearPlaylistAndTree();
        });
        this.subscribeToEvent('playlist:save', () => {
            this.savePlaylist();
        });
        this.subscribeToEvent('playlist:remove', (data) => {
            this.removeTrack(data.index);
        });
        this.subscribeToEvent('playlist:remove-track-by-index', (data) => {
            this.removeTrack(data.index);
            // Update display through UI handler
            if (window.PlaylistUIHandler) {
                window.PlaylistUIHandler.updateDisplay(this.getState('playlist.entries') || []);
            }
        });
        this.subscribeToEvent('container:track-added', (data) => {
            this.addTrack(data.track, data.connectionTag);
        });
        
        // Set up DOM event listeners through UI handler
        if (window.PlaylistUIHandler) {
            window.PlaylistUIHandler.setupEventListeners((trackIndex) => {
                this.emitEvent('playlist:remove-track-by-index', {
                    index: trackIndex
                });
            });
        }
    }
    
    /**
     * Add a track to the playlist
     * @param {Object} track - Track data
     * @param {string} connectionTag - Connection tag for the track
     * @returns {Object} Playlist entry
     */
    addTrack(track, connectionTag = 'direct-selection') {
        // Validate input
        this.validate({ track, connectionTag }, this.validationRules.playlistEntry);
        // Create playlist entry
        const playlistEntry = {
            element: null, // Will be set by UI
            track: { ...track },
            connectionTag,
            addedAt: Date.now(),
            duration: track.duration || 180, // Default 3 minutes
            order: this.getPlaylistSize()
        };
        // Get current playlist
        const currentPlaylist = this.getState('playlist.entries') || [];
        // Check playlist size limit
        if (currentPlaylist.length >= this.config.maxPlaylistSize) {
            throw new Error(`Playlist size limit reached: ${this.config.maxPlaylistSize}`);
        }
        // Add to playlist
        const newPlaylist = [...currentPlaylist, playlistEntry];
        this.setState('playlist.entries', newPlaylist);
        // Update visual highlighting for the track
        this.updateTrackHighlighting(track, true);
        
        // Emit events
        this.emitEvent('playlist:track-added', {
            entry: playlistEntry,
            playlistSize: newPlaylist.length,
            isFirstTrack: newPlaylist.length === 1
        });
        // Auto-start clock on first track
        if (newPlaylist.length === 1 && this.config.autoStartClock) {
            this.emitEvent('clock:auto-start', { reason: 'first-track-added' });
        }
        return playlistEntry;
    }
    /**
     * Remove a track from the playlist
     * @param {number} index - Track index to remove
     * @returns {boolean} Success status
     */
    removeTrack(index) {
        const currentPlaylist = this.getState('playlist.entries') || [];
        if (index < 0 || index >= currentPlaylist.length) {
            return false;
        }
        // Don't remove the first track if it's the only one
        if (index === 0 && currentPlaylist.length === 1) {
            return false;
        }
        const removedEntry = currentPlaylist[index];
        const newPlaylist = currentPlaylist.filter((_, i) => i !== index);
        // Update order indices
        newPlaylist.forEach((entry, i) => {
            entry.order = i;
        });
        
        // Remove visual highlighting from the removed track
        this.updateTrackHighlighting(removedEntry.track, false);
        
        this.setState('playlist.entries', newPlaylist);
        // Emit events
        this.emitEvent('playlist:track-removed', {
            removedEntry,
            index,
            newSize: newPlaylist.length
        });
        return true;
    }
    /**
     * Clear the entire playlist
     */
    clearPlaylist() {
        const currentPlaylist = this.getState('playlist.entries') || [];
        const wasEmpty = currentPlaylist.length === 0;
        if (!wasEmpty) {
            // Remove highlighting from all tracks in playlist
            currentPlaylist.forEach(entry => {
                this.updateTrackHighlighting(entry.track, false);
            });
            
            this.setState('playlist.entries', []);
            this.emitEvent('playlist:cleared', { previousSize: currentPlaylist.length });
        }
    }
    /**
     * Handle node clicks with tree recentering logic
     * @param {Object} track - Track data
     * @param {HTMLElement} node - Clicked node
     * @param {string} connectionTag - Connection tag
     */
    handleNodeClick(track, node, connectionTag = 'direct-selection') {
        // Get current state
        const currentSize = this.getPlaylistSize();
        
        // Check multiple sources for tree state
        const hasExistingTree = this.hasExistingTree();
        
        // Check tree building state from multiple sources
        const isTreeBuildingService = this.getState('tree.isBuilding');
        const isTreeBuildingAppState = this.getState('playlist.isTreeBuilding');
        
        const isTreeBuilding = isTreeBuildingService || isTreeBuildingAppState;
        const isTreeStable = hasExistingTree && !isTreeBuilding;
        // Calculate if we should recenter (every N tracks)
        const nextSize = currentSize + 1;
        const shouldRecenter = isTreeStable && 
                              nextSize % this.config.recenterInterval === 0 && 
                              nextSize > 0;
        
        if (shouldRecenter) {
            this.recenterTreeOnTrack(track, node, connectionTag);
        } else {
            // Normal add to playlist
            this.addTrack(track, connectionTag);
        }
    }
    /**
     * Recenter tree on a specific track
     * @param {Object} track - Track to center on
     * @param {HTMLElement} node - Track node
     * @param {string} connectionTag - Connection tag
     */
    recenterTreeOnTrack(track, node, connectionTag) {
        // Add visual effect through UI handler
        if (window.PlaylistUIHandler) {
            window.PlaylistUIHandler.applyRecenterEffect(node);
        }
        
        // Show feedback to user
        this.emitEvent('ui:notification', {
            message: `🎯 Re-centering tree on: ${track.title} - ${track.artist}`,
            type: 'info'
        });
        
        setTimeout(() => {
            // SAVE the existing playlist entries before clearing
            const savedPlaylistEntries = [...(this.getState('playlist.entries') || [])];
            
            // Add the current track to the saved playlist
            const newEntry = {
                element: null,
                track: { ...track },
                connectionTag,
                addedAt: Date.now(),
                duration: track.duration || 180,
                order: savedPlaylistEntries.length
            };
            savedPlaylistEntries.push(newEntry);
            
            // Clear the existing tree elements from DOM
            const allNodes = this.getState('dom.allNodes') || [];
            allNodes.forEach(nodeData => {
                if (nodeData.element) {
                    nodeData.element.remove();
                }
            });
            
            const allContainers = this.getState('dom.allContainers') || [];
            allContainers.forEach(container => container.remove());
            
            // Clear tree state
            const treeService = window.App?.getService('tree');
            if (treeService) {
                treeService.clearTreeStructure();
            }
            
            // Clear state completely via StateManager
            this.setState('dom.allNodes', []);
            this.setState('dom.allContainers', []);
            this.setState('ui.selectedTags', new Set());
            this.setState('app.nodeCounter', 0);
            this.setState('app.selectedTagForNextNode', null);
            this.setState('app.currentMultiTagContainer', null);
            this.setState('app.currentTagSourceTrack', null);
            this.setState('app.hasUsedDropZone', false);
            this.setState('app.rootNodeColor', null);
            this.setState('tree.nodes', []);
            this.setState('tree.connections', []);
            
            // Clear and restore playlist entries
            this.setState('playlist.entries', []);
            this.setState('playlist.entries', savedPlaylistEntries);
            
            // Wait a moment for the clear animation
            setTimeout(() => {
                // Create new tree with this track as root via dependency injection
                const dragDropService = this.getDependency('dragdrop');
                if (dragDropService && typeof dragDropService.createAutoTree === 'function') {
                    dragDropService.createAutoTree(track);
                }
                
                // Show success feedback
                this.emitEvent('ui:notification', {
                    message: `✨ New tree centered on: ${track.title}`,
                    type: 'success'
                });
            }, 200);
        }, 300);
    }
    /**
     * Toggle phases view
     */
    togglePhasesView() {
        const isActive = this.getState('app.isPhasesViewActive') || false;
        this.setState('app.isPhasesViewActive', !isActive);
    }
    /**
     * Get current playlist size
     * @returns {number} Playlist size
     */
    getPlaylistSize() {
        const playlist = this.getState('playlist.entries') || [];
        return playlist.length;
    }
    /**
     * Get playlist duration in minutes
     * @returns {number} Total duration
     */
    getPlaylistDuration() {
        const playlist = this.getState('playlist.entries') || [];
        return playlist.reduce((total, entry) => total + (entry.duration || 180), 0) / 60;
    }
    /**
     * Get current playlist entries
     * @returns {Array} Playlist entries
     */
    getPlaylistEntries() {
        return this.getState('playlist.entries') || [];
    }
    /**
     * Check if phases view is active
     * @returns {boolean} Phases view status
     */
    isPhasesViewActive() {
        return this.getState('app.isPhasesViewActive') || false;
    }
    /**
     * Handle playlist state changes
     * @private
     */
    onPlaylistChanged(entries) {
        // Update total duration
        const totalDuration = entries.reduce((sum, entry) => sum + (entry.duration || 180), 0);
        this.setState('playlist.totalDuration', totalDuration);
        
        // Update highlighting for all tracks - first clear all, then add current ones
        this.updateAllTrackHighlighting(entries);
        
        // Emit event for state sync
        this.emitEvent('playlist:entries-sync', {
            entries: entries.map(entry => ({
                element: entry.element,
                track: entry.track,
                selectedTag: entry.connectionTag, // Map connectionTag to selectedTag for legacy compatibility
                timestamp: entry.addedAt
            }))
        });
        
        // Automatically update display when playlist changes
        if (window.PlaylistUIHandler) {
            window.PlaylistUIHandler.updateDisplay(entries);
        }
        
        // Emit global change event
        this.emitEvent('playlist:changed', {
            entries,
            size: entries.length,
            totalDuration
        });
    }
    /**
     * Handle phases view state changes
     * @private
     */
    onPhasesViewChanged(isActive) {
        this.emitEvent('playlist:phases-view-changed', { isActive });
    }
    
    
    /**
     * Save playlist to external format
     * @public
     */
    savePlaylist() {
        const entries = this.getState('playlist.entries') || [];
        
        if (entries.length === 0) {
            // Show notification through event
            this.emitEvent('ui:notification', {
                message: 'No tracks selected for playlist! Click on nodes to add them.',
                type: 'warning'
            });
            return;
        }
        
        const playlistText = entries.map((entry, index) => {
            const track = entry.track;
            const tagInfo = entry.connectionTag && entry.connectionTag !== 'direct-selection' ? 
                ` (${tagUtils.getTagValue(entry.connectionTag)})` : '';
            return `${index + 1}. ${track.title} - ${track.artist}${tagInfo}`;
        }).join('\n');
        
        this.emitEvent('ui:notification', {
            message: `Playlist saved with ${entries.length} selected tracks!`,
            type: 'success'
        });
        
        this.emitEvent('playlist:saved', {
            entries,
            playlistText,
            totalTracks: entries.length
        });
    }
    
    
    /**
     * Clear entire playlist and tree (extended clear functionality)
     * @public
     */
    clearPlaylistAndTree() {
        // Clear tree elements through UI handler
        if (window.PlaylistUIHandler) {
            window.PlaylistUIHandler.clearTreeFromDOM();
        }
        
        // Rimuovi classe tree-active per ripristinare trasparenza
        document.body.classList.remove('tree-active');
        
        // Mostra nuovamente il drop-zone
        const dropZone = document.querySelector('.drop-zone');
        if (dropZone) {
            dropZone.style.display = 'flex';
        }
        
        // Clear search through SearchService
        const searchService = window.App?.getService('search');
        if (searchService) {
            searchService.clearSearch();
        }
        
        // Keep playlist and clock running - don't clear playlist
        // Just update display through UI handler
        const entries = this.getState('playlist.entries') || [];
        if (window.PlaylistUIHandler) {
            window.PlaylistUIHandler.updateDisplay(entries);
        }
        
        this.emitEvent('ui:notification', {
            message: 'Tree cleared - playlist and timer continue',
            type: 'info'
        });
    }
    
    /**
     * Helper method to check if tree exists (consolidates legacy access)
     * @private
     * @returns {boolean} True if tree exists
     */
    hasExistingTree() {
        const treeRootFromState = this.getState('tree.rootNode');
        const treeService = window.App?.getService('tree');
        const treeRootFromLegacy = treeService ? treeService.rootNode : null;
        const treeRootFromStateNodes = (this.getState('dom.allNodes') || []).length > 0;
        
        return treeRootFromState !== null || treeRootFromLegacy !== null || treeRootFromStateNodes;
    }
    
    /**
     * Update visual highlighting for track nodes in the tree
     * @param {Object} track - Track data
     * @param {boolean} inPlaylist - Whether track is in playlist
     */
    updateTrackHighlighting(track, inPlaylist) {
        if (!track) return;
        
        // Find all nodes in the tree that match this track
        const trackNodes = this.findTrackNodes(track);
        
        trackNodes.forEach(node => {
            if (inPlaylist) {
                node.classList.add('in-playlist');
            } else {
                node.classList.remove('in-playlist');
            }
        });
    }
    
    /**
     * Find all DOM nodes that represent a specific track
     * @param {Object} track - Track data to find
     * @returns {Array} Array of DOM nodes
     */
    findTrackNodes(track) {
        if (!track || !track.title || !track.artist) return [];
        
        const allTrackNodes = document.querySelectorAll('.track-node');
        const matchingNodes = [];
        
        allTrackNodes.forEach(node => {
            const titleElement = node.querySelector('.title');
            const artistElement = node.querySelector('.artist');
            
            if (titleElement && artistElement) {
                const nodeTitle = titleElement.textContent?.trim();
                const nodeArtist = artistElement.textContent?.trim();
                
                if (nodeTitle === track.title && nodeArtist === track.artist) {
                    matchingNodes.push(node);
                }
            }
        });
        
        return matchingNodes;
    }
    
    /**
     * Update highlighting for all tracks based on current playlist
     * @param {Array} playlistEntries - Current playlist entries
     */
    updateAllTrackHighlighting(playlistEntries) {
        // First, remove highlighting from all nodes
        const allTrackNodes = document.querySelectorAll('.track-node');
        allTrackNodes.forEach(node => {
            node.classList.remove('in-playlist');
        });
        
        // Then, add highlighting for tracks in the playlist
        playlistEntries.forEach(entry => {
            this.updateTrackHighlighting(entry.track, true);
        });
    }
}
// Make available globally
window.PlaylistService = PlaylistService;
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistService;
}