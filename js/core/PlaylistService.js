/**
 * PlaylistService - Centralized playlist management
 * Handles playlist entries, phases view, and timeline coordination
 */
class PlaylistService extends ServiceBase {
    constructor(stateManager, eventBus) {
        super(stateManager, eventBus);
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
            this.clearPlaylist();
        });
        this.subscribeToEvent('playlist:remove', (data) => {
            this.removeTrack(data.index);
        });
        this.subscribeToEvent('playlist:remove-track-by-index', (data) => {
            this.removeTrack(data.index);
            // Update display after removal
            this.updatePlaylistDisplay();
        });
        
        // Set up DOM event listeners for playlist UI
        this.setupPlaylistDOMEventListeners();
    }
    
    /**
     * Set up DOM event listeners for playlist interactions
     * @private
     */
    setupPlaylistDOMEventListeners() {
        // Use event delegation for dynamic playlist remove buttons
        document.addEventListener('click', (e) => {
            // Handle remove track buttons
            if (e.target.classList.contains('remove-track')) {
                e.stopPropagation();
                e.preventDefault();
                
                const trackIndex = parseInt(e.target.getAttribute('data-track-index'));
                if (!isNaN(trackIndex)) {
                    // Emit remove event through EventBus
                    this.emitEvent('playlist:remove-track-by-index', {
                        index: trackIndex,
                        element: e.target
                    });
                }
            }
        });
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
        const treeRootFromState = this.getState('tree.rootNode');
        const treeRootFromLegacy = window.Tree && window.Tree.rootNode;
        const treeRootFromAppState = window.AppState && window.AppState.allNodes && window.AppState.allNodes.length > 0;
        
        const hasExistingTree = treeRootFromState !== null || treeRootFromLegacy !== null || treeRootFromAppState;
        
        // Check tree building state from multiple sources
        const isTreeBuildingService = this.getState('tree.isBuilding');
        const isTreeBuildingLegacy = window.Playlist && window.Playlist.isTreeBuilding;
        const isTreeBuildingAppState = this.getState('playlist.isTreeBuilding');
        
        const isTreeBuilding = isTreeBuildingService || isTreeBuildingLegacy || isTreeBuildingAppState;
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
        // Add visual effect to clicked node before clearing
        node.style.transform = 'scale(1.2)';
        node.style.zIndex = '1000';
        node.style.boxShadow = '0 0 30px rgba(255, 255, 255, 0.8)';
        
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
            if (window.AppState) {
                window.AppState.allNodes.forEach(nodeData => {
                    if (nodeData.element) {
                        nodeData.element.remove();
                    }
                });
                
                window.AppState.allContainers.forEach(container => container.remove());
                
                // Clear tree state
                if (window.Tree && window.Tree.clearTree) {
                    window.Tree.clearTree();
                }
                
                // Clear state completely
                window.AppState.clearTreeState();
            }
            
            // Clear and restore playlist entries
            this.setState('playlist.entries', []);
            this.setState('playlist.entries', savedPlaylistEntries);
            
            // Wait a moment for the clear animation
            setTimeout(() => {
                // Create new tree with this track as root
                if (window.DragDrop && window.DragDrop.createAutoTree) {
                    window.DragDrop.createAutoTree(track);
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
        
        // Emit event for AppState sync (instead of direct manipulation)
        this.emitEvent('playlist:entries-sync', {
            entries: entries.map(entry => ({
                element: entry.element,
                track: entry.track,
                selectedTag: entry.connectionTag, // Map connectionTag to selectedTag for legacy compatibility
                timestamp: entry.addedAt
            }))
        });
        
        // Automatically update display when playlist changes
        this.updatePlaylistDisplay();
        
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
     * Update playlist display in the DOM
     * @public
     */
    updatePlaylistDisplay() {
        const entries = this.getState('playlist.entries') || [];
        
        // Get breadcrumb element
        const breadcrumb = document.getElementById('breadcrumb') || 
                          (window.AppState && window.AppState.breadcrumb);
        
        if (!breadcrumb) return;
        
        // Only show playlist if there are manually selected tracks
        if (entries.length === 0) {
            breadcrumb.classList.remove('active');
            return;
        }

        breadcrumb.classList.add('active');
        
        let html = `<div class="breadcrumb-item">🎵 Selected Tracks (${entries.length})</div>`;
        
        entries.forEach((entry, index) => {
            const track = entry.track;
            const selectedTag = entry.connectionTag;
            
            const tagDisplay = selectedTag && selectedTag !== 'direct-selection' ? 
                ` (${selectedTag.split(':')[1]})` : '';
            const trackDisplay = `${track.title} - ${track.artist}${tagDisplay}`;
            
            // Add remove button for all tracks except the first one (playing track)
            const removeButton = index === 0 ? '' : 
                `<span class="remove-track" data-track-index="${index}" title="Rimuovi traccia">−</span>`;
            
            html += `<div class="breadcrumb-item playlist-entry">${trackDisplay}${removeButton}</div>`;
        });
        
        breadcrumb.innerHTML = html;
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
                ` (${entry.connectionTag.split(':')[1]})` : '';
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
     * Remove track by DOM element index (Legacy compatibility - now uses EventBus)
     * @param {HTMLElement} element - DOM element with track info
     * @public
     * @deprecated Use EventBus 'playlist:remove-track-by-index' event instead
     */
    removeTrackByIndex(element) {
        // Legacy compatibility - emit through EventBus
        const trackIndex = parseInt(element.getAttribute('data-track-index'));
        if (!isNaN(trackIndex)) {
            this.emitEvent('playlist:remove-track-by-index', {
                index: trackIndex,
                element: element
            });
        }
    }
    
    /**
     * Clear entire playlist and tree (extended clear functionality)
     * @public
     */
    clearPlaylistAndTree() {
        // Clear tree elements from DOM
        if (window.AppState) {
            window.AppState.allNodes.forEach(nodeData => {
                if (nodeData.element) {
                    nodeData.element.remove();
                }
            });
            
            window.AppState.allContainers.forEach(container => container.remove());
            
            // Clear tree structure
            if (window.Tree && window.Tree.clearTree) {
                window.Tree.clearTree();
            }
            
            // Clear selected tags
            document.querySelectorAll('.tag.selected').forEach(tag => {
                tag.classList.remove('selected');
            });
            
            // Clear search through SearchService
            const searchService = window.App?.getService('search');
            if (searchService) {
                searchService.clearSearch();
            }
            
            // Clear only tree state, keep playlist entries and clock running
            window.AppState.clearTreeState();
            
            // Show drop zone again so user can drag new tracks
            if (window.AppState.dropZone) {
                window.AppState.dropZone.style.display = 'flex';
            }
        }
        
        // Keep playlist and clock running - don't clear playlist
        // Just update display
        this.updatePlaylistDisplay();
        
        this.emitEvent('ui:notification', {
            message: 'Tree cleared - playlist and timer continue',
            type: 'info'
        });
    }
}
// Make available globally
window.PlaylistService = PlaylistService;
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistService;
}