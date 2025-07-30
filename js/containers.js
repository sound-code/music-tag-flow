/**
 * Containers Module
 * Handles creation and management of track list containers
 */

const Containers = {
    /**
     * Create a new container for tracks
     * @param {string} tagValue - Tag value for the container
     * @param {Array} tracks - Array of track objects
     * @param {HTMLElement} sourceNode - Source node for positioning
     * @param {HTMLElement} sourceContainer - Source container for positioning
     * @returns {HTMLElement} The created container element
     */
    create(tagValue, tracks, sourceNode, sourceContainer = null) {
        const { allNodes, allContainers, canvas, canvasContent } = AppState;
        const container = document.createElement('div');
        container.className = 'track-list-container';
        container.dataset.tagValue = tagValue;
        
        if (sourceNode) {
            container.dataset.sourceNodeId = sourceNode.id;
            container.dataset.sourceId = sourceNode.id;
            
            const sourceY = parseInt(sourceNode.style.top);
            
            const nodesInRow = allNodes.filter(nodeData => {
                if (!nodeData.element) return false;
                const nodeY = parseInt(nodeData.element.style.top);
                return Math.abs(nodeY - sourceY) < 50;
            });
            
            let rightmostX = 100;
            nodesInRow.forEach(nodeData => {
                const nodeX = parseInt(nodeData.element.style.left);
                const nodeWidth = 160;
                rightmostX = Math.max(rightmostX, nodeX + nodeWidth);
            });
            
            const newX = rightmostX + 30;
            
            container.style.position = 'absolute';
            container.style.left = `${newX}px`;
            container.style.top = `${sourceY}px`;
        } else if (sourceContainer) {
            // For containers created from other containers
            const containerY = parseInt(sourceContainer.style.top);
            
            // Find the rightmost node in this row
            const nodesInRow = allNodes.filter(nodeData => {
                if (!nodeData.element) return false;
                const nodeY = parseInt(nodeData.element.style.top);
                return Math.abs(nodeY - containerY) < 50;
            }).sort((a, b) => {
                const aX = parseInt(a.element.style.left);
                const bX = parseInt(b.element.style.left);
                return bX - aX; // Sort descending by X position
            });
            
            const rightmostNode = nodesInRow[0]; // First element is rightmost
            if (rightmostNode) {
                container.dataset.sourceNodeId = rightmostNode.element.id;
                container.dataset.sourceId = rightmostNode.element.id;
            } else {
                container.dataset.sourceId = sourceContainer.dataset.sourceId || 'container';
            }
            
            // Calculate position to the right of source container
            const containerX = parseInt(sourceContainer.style.left) || 0;
            const newX = containerX + 380 + 50; // container width (380) + 50px spacing
            
            container.style.position = 'absolute';
            container.style.left = `${newX}px`;
            container.style.top = `${containerY}px`;
            
            // Mark this container as manually positioned to avoid auto-repositioning
            container.dataset.manuallyPositioned = 'true';
            
            // Update canvas size to accommodate new container
            setTimeout(() => Utils.updateCanvasSize(), 10);
            
        } else {
            // Fallback positioning
            const containerIndex = allContainers.length;
            const canvasWidth = canvas.offsetWidth;
            
            container.style.position = 'absolute';
            container.style.left = `${canvasWidth - 400 + (containerIndex * 400)}px`;
            container.style.top = '40px';
        }

        const header = this.createHeader(tagValue, container);
        container.appendChild(header);

        tracks.forEach(track => {
            // For containers created from other containers, use the rightmost node as source
            const effectiveSourceNode = container.dataset.sourceNodeId ? 
                document.getElementById(container.dataset.sourceNodeId) : sourceNode;
            
            // For multi-tag containers, pass the actual selected tags instead of the display string
            let effectiveSelectedTag = tagValue;
            if (container.dataset.isMultiTagContainer === 'true') {
                effectiveSelectedTag = Array.from(AppState.selectedTags).join(', ');
            }
            
            const trackItem = this.createTrackListItem(track, effectiveSelectedTag, effectiveSourceNode);
            container.appendChild(trackItem);
        });

        return container;
    },

    /**
     * Create container header with title and controls
     * @param {string} tagValue - Tag value for the header
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement} The header element
     */
    createHeader(tagValue, container) {
        const header = document.createElement('div');
        header.className = 'track-list-header';
        
        const title = Utils.createTextElement('div', 'track-list-title', 
            `7 Tracks: ${tagValue.replace(':', ' → ')}`);
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'header-buttons';
        
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'refresh-btn';
        refreshBtn.title = 'Refresh tracks';
        refreshBtn.addEventListener('click', () => {
            this.refreshTracks(container, tagValue);
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => {
            this.remove(container);
        });
        
        buttonsContainer.appendChild(refreshBtn);
        buttonsContainer.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(buttonsContainer);
        
        return header;
    },

    /**
     * Create a track list item
     * @param {Object} track - Track data object
     * @param {string} selectedTag - Selected tag
     * @param {HTMLElement} sourceNode - Source node
     * @returns {HTMLElement} The track list item element
     */
    createTrackListItem(track, selectedTag, sourceNode) {
        const trackItem = document.createElement('div');
        trackItem.className = 'track-list-item';
        
        // Add data-track attribute for tooltip functionality
        trackItem.dataset.track = JSON.stringify(track);
        
        const trackInfo = this.createTrackInfo(track, sourceNode);
        const playBtn = this.createListPlayButton(track);
        
        trackItem.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag') || 
                e.target.classList.contains('list-play-btn') ||
                e.target.closest('.list-play-btn')) {
                return;
            }
            
            // Find the container this track item belongs to
            const parentContainer = e.target.closest('.track-list-container');
            
            // For multi-tag containers, use the selected tags as the selectedTag
            let effectiveSelectedTag = selectedTag;
            if (parentContainer && parentContainer.dataset.isMultiTagContainer === 'true') {
                effectiveSelectedTag = Array.from(AppState.selectedTags).join(', ');
            }
            
            // Use services directly instead of TrackNodes facade
            if (window.App && window.App.getService) {
                // 1. Create node via TreeService
                const treeService = window.App.getService('tree');
                if (treeService) {
                    let position = { x: 400, y: 300 }; // Default center
                    if (!sourceNode && AppState && AppState.canvas) {
                        position = { 
                            x: AppState.canvas.offsetWidth / 2, 
                            y: AppState.canvas.offsetHeight / 2 
                        };
                    }
                    treeService.addNode(track, position, sourceNode, effectiveSelectedTag);
                }
                
                // 2. Add to playlist via PlaylistService
                const playlistService = window.App.getService('playlist');
                if (playlistService && typeof playlistService.addTrack === 'function') {
                    playlistService.addTrack(track, effectiveSelectedTag);
                }
                
                // 3. Handle container cleanup
                if (parentContainer) {
                    const containerIndex = AppState.allContainers.indexOf(parentContainer);
                    if (containerIndex > -1) {
                        AppState.allContainers.splice(containerIndex, 1);
                    }
                    if (parentContainer === AppState.currentMultiTagContainer) {
                        AppState.setCurrentMultiTagContainer(null);
                        if (typeof Tags !== 'undefined' && Tags.clearSelected) {
                            Tags.clearSelected();
                        }
                    }
                    parentContainer.remove();
                    if (typeof Utils !== 'undefined' && Utils.updateCanvasSize) {
                        Utils.updateCanvasSize();
                    }
                }
            }
        });
        
        trackItem.appendChild(trackInfo);
        trackItem.appendChild(playBtn);
        
        return trackItem;
    },

    /**
     * Create track info section
     * @param {Object} track - Track data object
     * @param {HTMLElement} sourceNode - Source node
     * @returns {HTMLElement} The track info element
     */
    createTrackInfo(track, sourceNode) {
        const trackInfo = document.createElement('div');
        trackInfo.className = 'track-info';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        
        const title = Utils.createTextElement('div', 'title', track.title);
        const artist = Utils.createTextElement('div', 'artist', track.artist);
        const tagsContainer = this.createTrackTagsContainer(track, sourceNode);
        
        trackHeader.appendChild(title);
        trackHeader.appendChild(artist);
        trackInfo.appendChild(trackHeader);
        trackInfo.appendChild(tagsContainer);
        
        return trackInfo;
    },

    /**
     * Create track tags container
     * @param {Object} track - Track data object
     * @param {HTMLElement} sourceNode - Source node
     * @returns {HTMLElement} The tags container element
     */
    createTrackTagsContainer(track) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'track-tags';
        
        track.tags.forEach(tagWithValue => {
            const tagInfo = tagUtils.parseTag(tagWithValue);
            const tag = document.createElement('div');
            tag.className = `tag ${tagInfo.type}`;
            tag.textContent = tagInfo.value;
            tag.dataset.tagValue = tagWithValue;
            tag.addEventListener('click', async (e) => {
                e.stopPropagation();
                await Tags.toggleSelection(tag);
            });
            tagsContainer.appendChild(tag);
        });
        
        return tagsContainer;
    },

    /**
     * Create list play button
     * @param {Object} track - Track data object
     * @returns {HTMLElement} The play button element
     */
    createListPlayButton(track) {
        const playBtn = document.createElement('button');
        playBtn.className = 'list-play-btn';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleListPlay(playBtn, track);
        });
        return playBtn;
    },

    /**
     * Toggle play state for list item
     * @param {HTMLElement} playBtn - The play button element
     * @param {Object} track - Track data object
     */
    toggleListPlay(playBtn, track) {
        document.querySelectorAll('.play-btn.playing, .list-play-btn.playing')
            .forEach(btn => {
                if (btn !== playBtn) {
                    btn.classList.remove('playing');
                }
            });
        
        playBtn.classList.toggle('playing');
        
        if (playBtn.classList.contains('playing')) {
            Utils.showNotification(`Now playing: ${track.title} by ${track.artist}`);
        }
    },

    /**
     * Refresh tracks in a container
     * @param {HTMLElement} container - Container element
     * @param {string} tagValue - Tag value
     */
    async refreshTracks(container, tagValue) {
        let newTracks;
        let notificationMessage;
        
        // Check if this is a multi-tag container
        if (container.dataset.isMultiTagContainer === 'true') {
            // Generate tracks with multiple selected tags
            newTracks = await DataLoader.generateTracksWithMultipleTags(Array.from(AppState.selectedTags));
            const tagDisplays = Array.from(AppState.selectedTags).map(tag => tagUtils.getTagValue(tag)).join(' + ');
            notificationMessage = `Refreshed 7 tracks for ${tagDisplays}`;
        } else {
            // Generate new tracks with the single tag
            newTracks = await DataLoader.generateTracksWithTag(tagValue);
            notificationMessage = `Refreshed 7 tracks for ${tagUtils.getTagValue(tagValue)}`;
        }
        
        // Remove existing track items
        const trackItems = container.querySelectorAll('.track-list-item');
        trackItems.forEach(item => item.remove());
        
        // Get the source node for this container
        const sourceNodeId = container.dataset.sourceNodeId;
        const sourceNode = sourceNodeId ? document.getElementById(sourceNodeId) : null;
        
        // Add new tracks
        newTracks.forEach(track => {
            // For multi-tag containers, use the selected tags as the effective tag
            let effectiveSelectedTag = tagValue;
            if (container.dataset.isMultiTagContainer === 'true') {
                effectiveSelectedTag = Array.from(AppState.selectedTags).join(', ');
            }
            
            const trackItem = this.createTrackListItem(track, effectiveSelectedTag, sourceNode);
            container.appendChild(trackItem);
        });
        
        // Show notification
        Utils.showNotification(notificationMessage);
    },

    /**
     * Remove a container
     * @param {HTMLElement} container - Container to remove
     */
    remove(container) {
        // Remove container from array
        const containerIndex = AppState.allContainers.indexOf(container);
        if (containerIndex > -1) {
            AppState.allContainers.splice(containerIndex, 1);
        }
        
        // Remove from DOM
        container.remove();
        
        // Reposition all remaining containers
        this.repositionAll();
    },

    /**
     * Reposition all containers
     */
    repositionAll() {
        AppState.allContainers.forEach((container, index) => {
            // Skip manually positioned containers (those created from other containers)
            if (container.dataset.manuallyPositioned === 'true') {
                return;
            }
            
            const sourceNodeId = container.dataset.sourceNodeId;
            if (sourceNodeId) {
                const sourceNode = document.getElementById(sourceNodeId);
                if (sourceNode) {
                    const sourceY = parseInt(sourceNode.style.top);
                    const newX = Utils.getNextXPositionInRow(sourceY, true); // Exclude containers from calculation
                    container.style.left = `${newX}px`;
                    container.style.top = `${sourceY}px`;
                }
            } else {
                // Fallback positioning for containers without source nodes
                const canvasWidth = AppState.canvas.offsetWidth;
                const newLeft = canvasWidth - 400 + (index * 50);
                container.style.left = `${Math.max(50, newLeft)}px`;
            }
        });
        
        // Update canvas size after repositioning
        Utils.updateCanvasSize();
    }
};

// Make Containers available globally
window.Containers = Containers; 