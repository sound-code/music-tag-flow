/**
 * PlaylistUIHandler - Handles all UI/DOM operations for playlist
 * Separates presentation logic from business logic in PlaylistService
 */
window.PlaylistUIHandler = (() => {
    
    /**
     * Update playlist display in the DOM
     * @param {Array} entries - Playlist entries
     */
    function updateDisplay(entries) {
        updateNewPlaylistSidebar(entries);
        // Keep legacy breadcrumb updated for compatibility (but hidden)
        updateLegacyBreadcrumb(entries);
    }
    
    /**
     * Update the new playlist sidebar
     * @param {Array} entries - Playlist entries
     */
    function updateNewPlaylistSidebar(entries) {
        const playlistCount = document.getElementById('playlistCount');
        const playlistEmptyState = document.getElementById('playlistEmptyState');
        const playlistTracks = document.getElementById('playlistTracks');
        
        if (!playlistCount || !playlistEmptyState || !playlistTracks) return;
        
        // Update playlist count
        playlistCount.textContent = `(${entries.length})`;
        
        if (entries.length === 0) {
            // Show empty state
            playlistEmptyState.style.display = 'flex';
            playlistTracks.style.display = 'none';
            return;
        }
        
        // Hide empty state and show tracks
        playlistEmptyState.style.display = 'none';
        playlistTracks.style.display = 'block';
        
        // Generate tracks HTML
        let html = '';
        entries.forEach((entry, index) => {
            const track = entry.track;
            const selectedTag = entry.connectionTag;
            
            const tagDisplay = selectedTag && selectedTag !== 'direct-selection' ? 
                `via ${tagUtils.getTagValue(selectedTag)}` : 'Direct selection';
            
            const isNowPlaying = index === 0; // First track is considered "now playing"
            const playingClass = isNowPlaying ? ' now-playing' : '';
            
            html += `
                <div class="playlist-track-item${playingClass}" data-track-index="${index}" onclick="selectTrackForPlayback(${index})">
                    <div class="playlist-track-number">${index + 1}</div>
                    <div class="playlist-track-info">
                        <div class="playlist-track-title">${track.title}</div>
                        <div class="playlist-track-artist">${track.artist}</div>
                        <div class="playlist-track-connection">${tagDisplay}</div>
                    </div>
                    <div class="playlist-track-actions">
                        ${!isNowPlaying ? `<button class="playlist-track-action remove-track" data-track-index="${index}" title="Rimuovi traccia" onclick="event.stopPropagation()">×</button>` : ''}
                    </div>
                </div>
            `;
        });
        
        playlistTracks.innerHTML = html;
    }
    
    /**
     * Update legacy breadcrumb (kept for compatibility but hidden)
     * @param {Array} entries - Playlist entries
     */
    function updateLegacyBreadcrumb(entries) {
        const breadcrumb = document.getElementById('breadcrumb');
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
                ` (${tagUtils.getTagValue(selectedTag)})` : '';
            const trackDisplay = `${track.title} - ${track.artist}${tagDisplay}`;
            
            // Add remove button for all tracks except the first one (playing track)
            const removeButton = index === 0 ? '' : 
                `<span class="remove-track" data-track-index="${index}" title="Rimuovi traccia">−</span>`;
            
            html += `<div class="breadcrumb-item playlist-entry">${trackDisplay}${removeButton}</div>`;
        });
        
        breadcrumb.innerHTML = html;
    }
    
    /**
     * Setup DOM event listeners for playlist interactions
     * @param {Function} onRemoveTrack - Callback when track removal is requested
     * @param {Function} onClearPlaylist - Callback when clear playlist is requested
     * @param {Function} onSavePlaylist - Callback when save playlist is requested
     */
    function setupEventListeners(onRemoveTrack, onClearPlaylist, onSavePlaylist) {
        // Use event delegation for dynamic playlist interactions
        document.addEventListener('click', (e) => {
            // Handle remove track buttons (both legacy and new)
            if (e.target.classList.contains('remove-track')) {
                e.stopPropagation();
                e.preventDefault();
                
                const trackIndex = parseInt(e.target.getAttribute('data-track-index'));
                if (!isNaN(trackIndex) && onRemoveTrack) {
                    onRemoveTrack(trackIndex);
                }
                return;
            }
            
            // Handle clear playlist button
            if (e.target.closest('#clearPlaylistBtn')) {
                e.stopPropagation();
                e.preventDefault();
                
                if (onClearPlaylist) {
                    onClearPlaylist();
                }
                return;
            }
            
            // Handle save playlist button
            if (e.target.closest('#savePlaylistBtn')) {
                e.stopPropagation();
                e.preventDefault();
                
                if (onSavePlaylist) {
                    onSavePlaylist();
                }
                return;
            }
        });
    }
    
    /**
     * Apply recenter visual effect to a node
     * @param {HTMLElement} node - Track node element
     */
    function applyRecenterEffect(node) {
        node.style.transform = 'scale(1.2)';
        node.style.zIndex = '1000';
        node.style.boxShadow = '0 0 30px rgba(255, 255, 255, 0.8)';
    }
    
    /**
     * Clear tree elements from DOM
     */
    function clearTreeFromDOM() {
        // Get elements from StateManager
        const stateManager = window.App?.stateManager;
        const allNodes = stateManager?.get('dom.allNodes') || [];
        const allContainers = stateManager?.get('dom.allContainers') || [];
        const dropZone = stateManager?.get('dom.dropZone');
        
        // Clear tree elements
        allNodes.forEach(nodeData => {
            if (nodeData.element) {
                nodeData.element.remove();
            }
        });
        
        allContainers.forEach(container => container.remove());
        
        // Clear tree structure via TreeService
        const treeService = window.App?.getService('tree');
        if (treeService) {
            treeService.clearTreeStructure();
        }
        
        // Clear selected tags
        document.querySelectorAll('.tag.selected').forEach(tag => {
            tag.classList.remove('selected');
        });
        
        // Clear tree state via StateManager
        if (stateManager) {
            stateManager.set('dom.allNodes', []);
            stateManager.set('dom.allContainers', []);
            stateManager.set('ui.selectedTags', new Set());
            stateManager.set('app.nodeCounter', 0);
            stateManager.set('app.selectedTagForNextNode', null);
            stateManager.set('app.currentMultiTagContainer', null);
            stateManager.set('app.currentTagSourceTrack', null);
            stateManager.set('app.hasUsedDropZone', false);
            stateManager.set('app.rootNodeColor', null);
            stateManager.set('tree.nodes', []);
            stateManager.set('tree.connections', []);
        }
        
        // Show drop zone again so user can drag new tracks
        if (dropZone) {
            dropZone.style.display = 'flex';
        } else {
            // Fallback to DOM query
            const dropZoneElement = document.querySelector('.drop-zone');
            if (dropZoneElement) {
                dropZoneElement.style.display = 'flex';
            }
        }
    }
    
    // Public API
    return {
        updateDisplay,
        setupEventListeners,
        applyRecenterEffect,
        clearTreeFromDOM
    };
})();