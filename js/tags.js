/**
 * Tags Module - Facade/Bridge to TagService
 * Provides backward compatibility for legacy code
 * All functionality is delegated to TagService
 */

const Tags = {
    /**
     * Toggle tag selection - delegates to TagService
     * @param {HTMLElement} tagElement - The tag element clicked
     */
    async toggleSelection(tagElement) {
        // Delegate to TagService
        if (window.App && window.App.getService) {
            const tagService = window.App.getService('tags');
            if (tagService && typeof tagService.handleTagClick === 'function') {
                await tagService.handleTagClick(tagElement);
                return;
            }
        }
        
        // Fallback implementation (should not be reached if TagService is available)
        const tagValue = tagElement.dataset.tagValue;
        const tagName = tagElement.textContent;
        
        const container = tagElement.closest('.track-list-container');
        if (container) {
            await this.openContainer(tagValue, null, container);
            return;
        }
        
        let trackNode = tagElement.closest('.track-node');
        if (trackNode) {
            // DISABLED - now handled by EventBus system
            
            tagElement.classList.add('selected');
            setTimeout(() => {
                tagElement.classList.remove('selected');
            }, 1000);
            
            return;
        }
        
        let currentTrackId = trackNode ? trackNode.id : null;
        
        if (currentTrackId && AppState.currentTagSourceTrack && AppState.currentTagSourceTrack !== currentTrackId) {
            this.clearSelected();
        }
        
        if (currentTrackId) {
            AppState.currentTagSourceTrack = currentTrackId;
        }

        if (AppState.selectedTags.has(tagValue)) {
            AppState.selectedTags.delete(tagValue);
            tagElement.classList.remove('selected');
            document.querySelectorAll(`[data-tag-value="${tagValue}"]`).forEach(tag => {
                tag.classList.remove('selected');
            });
            Utils.showNotification(`Removed "${tagValue.split(':')[1]}" from selection`);
        } else {
            AppState.selectedTags.add(tagValue);
            tagElement.classList.add('selected');
            document.querySelectorAll(`[data-tag-value="${tagValue}"]`).forEach(tag => {
                tag.classList.add('selected');
            });
            Utils.showNotification(`Added "${tagValue.split(':')[1]}" to selection`);
        }
        
        if (AppState.selectedTags.size === 0) {
            AppState.currentTagSourceTrack = null;
        }
        
        await this.updateMultiTagContainer();
    },

    /**
     * Update the multi-tag container based on selected tags
     */
    async updateMultiTagContainer() {
        // First, remove ALL existing multi-tag containers (safeguard against duplicates)
        AppState.allContainers.forEach((container) => {
            if (container.dataset.isMultiTagContainer === 'true') {
                const containerIndex = AppState.allContainers.indexOf(container);
                if (containerIndex > -1) {
                    AppState.allContainers.splice(containerIndex, 1);
                }
                container.remove();
            }
        });
        
        // Clear the current multi-tag container reference
        AppState.setCurrentMultiTagContainer(null);

        // If no tags selected, just return
        if (AppState.selectedTags.size === 0) {
            return;
        }

        // Get the source track info for better container title
        const sourceTrack = AppState.currentTagSourceTrack ? 
            document.getElementById(AppState.currentTagSourceTrack) : null;
        
        // Create new container with selected tags
        const tracks = await DataLoader.generateTracksWithMultipleTags(Array.from(AppState.selectedTags));
        const tagDisplays = Array.from(AppState.selectedTags).map(tag => tag.split(':')[1]).join(' + ');
        
        // Create a more informative title
        let containerTitle;
        if (AppState.selectedTags.size === 1) {
            containerTitle = `Tag: ${tagDisplays}`;
        } else {
            containerTitle = `Multi-tag: ${tagDisplays}`;
        }
        
        const container = Containers.create(containerTitle, tracks, sourceTrack, null);
        
        // Position the container near the source track if available
        let finalX, finalY;
        
        if (sourceTrack) {
            // Position to the right of the source track
            const sourceX = parseInt(sourceTrack.style.left) || 0;
            const sourceY = parseInt(sourceTrack.style.top) || 0;
            finalX = sourceX + 180; // Track width (160) + spacing
            finalY = sourceY;
        } else {
            // Fallback: position to the right of all existing content
            let rightmostX = 100;
            
            // Check all nodes to find the rightmost position
            AppState.allNodes.forEach(nodeData => {
                if (nodeData.element) {
                    const nodeX = parseInt(nodeData.element.style.left) || 0;
                    const nodeWidth = 160; // Track node width
                    rightmostX = Math.max(rightmostX, nodeX + nodeWidth);
                }
            });
            
            // Check all existing containers to find the rightmost position
            AppState.allContainers.forEach(existingContainer => {
                if (existingContainer !== container) {
                    const containerX = parseInt(existingContainer.style.left) || 0;
                    const containerWidth = 380; // Container width
                    rightmostX = Math.max(rightmostX, containerX + containerWidth);
                }
            });
            
            finalX = Math.max(100, rightmostX + 30);
            finalY = 100;
        }
        
        container.style.position = 'absolute';
        container.style.left = `${finalX}px`;
        container.style.top = `${finalY}px`;
        container.dataset.manuallyPositioned = 'true';
        container.dataset.isMultiTagContainer = 'true';
        
        AppState.canvasContent.appendChild(container);
        AppState.allContainers.push(container);
        AppState.setCurrentMultiTagContainer(container);
        
        Utils.updateCanvasSize();
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        Utils.showNotification(`Showing 7 tracks matching ${AppState.selectedTags.size} selected tag${AppState.selectedTags.size > 1 ? 's' : ''}!`);
    },

    /**
     * Clear all selected tags
     */
    clearSelected() {
        // Delegate to TagService
        if (window.App && window.App.getService) {
            const tagService = window.App.getService('tags');
            if (tagService && typeof tagService.clearSelection === 'function') {
                tagService.clearSelection();
                return;
            }
        }
        
        // Fallback implementation (should not be reached if TagService is available)
        // Remove selected class from all tags
        document.querySelectorAll('.tag.selected').forEach(tag => {
            tag.classList.remove('selected');
        });
        AppState.selectedTags.clear();
        AppState.currentTagSourceTrack = null;
        
        // Remove ALL multi-tag containers (robust cleanup)
        AppState.allContainers.forEach((container) => {
            if (container.dataset.isMultiTagContainer === 'true') {
                const containerIndex = AppState.allContainers.indexOf(container);
                if (containerIndex > -1) {
                    AppState.allContainers.splice(containerIndex, 1);
                }
                container.remove();
            }
        });
        
        // Clear the current multi-tag container reference
        AppState.setCurrentMultiTagContainer(null);
        
        Utils.showNotification('All tags cleared.');
    },

    /**
     * Create a container for a specific tag
     * @param {string} tagValue - The tag value
     * @param {HTMLElement} sourceNode - Source node for positioning
     * @param {HTMLElement} sourceContainer - Source container for positioning
     */
    async openContainer(tagValue, sourceNode, sourceContainer = null) {
        // Check if container already exists for this tag and source
        const sourceId = sourceNode ? sourceNode.id : (sourceContainer ? sourceContainer.dataset.sourceNodeId || 'container' : 'unknown');
        const existingContainer = AppState.allContainers.find(c => 
            c.dataset.tagValue === tagValue && c.dataset.sourceId === sourceId
        );
        
        if (existingContainer) {
            existingContainer.scrollIntoView({ behavior: 'smooth' });
            Utils.showNotification(`Scrolled to existing container for "${tagValue.split(':')[1]}"`);
            return;
        }

        const tracks = await DataLoader.generateTracksWithTag(tagValue);
        const container = Containers.create(tagValue, tracks, sourceNode, sourceContainer);
        
        AppState.canvasContent.appendChild(container);
        AppState.allContainers.push(container);
        
        // Reposition all containers after adding new one
        Containers.repositionAll();
        
        Utils.showNotification(`Created new container for "${tagValue.split(':')[1]}" with 7 tracks`);
    }
};

// Make Tags available globally
window.Tags = Tags; 