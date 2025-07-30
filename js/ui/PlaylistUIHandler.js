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
        // Get breadcrumb element - prefer StateManager, fallback to AppState
        let breadcrumb = document.getElementById('breadcrumb');
        
        if (!breadcrumb) {
            // Try StateManager if available - StateManager is not registered as a service
            const stateManager = window.App?.stateManager || window.AppStateManager || window.StateManager;
            if (stateManager) {
                breadcrumb = stateManager.get('dom.breadcrumb');
            }
            
            // Fallback to AppState for backward compatibility
            if (!breadcrumb && window.AppState) {
                breadcrumb = window.AppState.breadcrumb;
            }
        }
        
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
        // Get StateManager instance - StateManager is not registered as a service
        const stateManager = window.App?.stateManager || window.AppStateManager || window.StateManager;
        
        // Clear tree elements from DOM - prefer StateManager, fallback to AppState
        let allNodes = [];
        let allContainers = [];
        let dropZone = null;
        
        if (stateManager) {
            allNodes = stateManager.get('dom.allNodes') || [];
            allContainers = stateManager.get('dom.allContainers') || [];
            dropZone = stateManager.get('dom.dropZone');
            
            // StateManager data retrieved
        }
        
        // Fallback to AppState if StateManager doesn't have data or doesn't exist
        if ((!allNodes || allNodes.length === 0) && window.AppState) {
            allNodes = window.AppState.allNodes || [];
            allContainers = window.AppState.allContainers || [];
            dropZone = dropZone || window.AppState.dropZone;
        }
        
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
        
        // Clear tree state - prefer StateManager
        if (stateManager) {
            // Reset tree state in StateManager
            stateManager.set('dom.allNodes', []);
            stateManager.set('dom.allContainers', []);
            stateManager.set('tree.nodes', []);
            stateManager.set('tree.connections', []);
        } else if (window.AppState && window.AppState.clearTreeState) {
            // Fallback to AppState for backward compatibility
            window.AppState.clearTreeState();
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