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
     */
    function setupEventListeners(onRemoveTrack) {
        // Use event delegation for dynamic playlist remove buttons
        document.addEventListener('click', (e) => {
            // Handle remove track buttons
            if (e.target.classList.contains('remove-track')) {
                e.stopPropagation();
                e.preventDefault();
                
                const trackIndex = parseInt(e.target.getAttribute('data-track-index'));
                if (!isNaN(trackIndex) && onRemoveTrack) {
                    onRemoveTrack(trackIndex);
                }
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
            
            // Clear only tree state, keep playlist entries and clock running
            window.AppState.clearTreeState();
            
            // Show drop zone again so user can drag new tracks
            if (window.AppState.dropZone) {
                window.AppState.dropZone.style.display = 'flex';
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