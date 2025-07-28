/**
 * Track Nodes Module
 * Handles creation and management of track nodes on the canvas
 */

const TrackNodes = {
    // Click counter removed - now managed centrally by Playlist module
    
    /**
     * Create a new track node
     * @param {Object} track - Track data object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {HTMLElement} parentNode - Parent node for positioning
     * @param {string} connectionTag - Tag that connects this node to its parent
     * @returns {HTMLElement} The created node element
     */
    create(track, x, y, parentNode = null, connectionTag = null) {
        const { allNodes, canvasContent } = AppState;
        const node = document.createElement('div');
        node.className = 'track-node';
        node.id = `node-${AppState.incrementNodeCounter()}`;
        
        // Store connection tag info but ALL nodes get neutral gray color
        if (connectionTag) {
            const [category] = connectionTag.split(':');
            node.dataset.connectionTag = connectionTag;
        }
        
        // ALL nodes use neutral gray color - no category-based coloring
        node.dataset.tagCategory = 'neutral';
        node.classList.add('node-neutral');
        
        // Add track data so UI tooltip system can use it
        node.dataset.track = JSON.stringify(track);
        
        if (parentNode) {
            node.dataset.parentId = parentNode.id;
            const parentLeft = parseInt(parentNode.style.left) || 0;
            const parentTop = parseInt(parentNode.style.top) || 0;
            node.style.left = `${parentLeft + 100}px`;
            node.style.top = `${parentTop}px`;
        } else {
            const { canvas } = AppState;
            const canvasRect = canvas.getBoundingClientRect();
            node.style.left = `${canvasRect.width / 2 - 40}px`;
            node.style.top = `${canvasRect.height / 2 - 40}px`;
        }

        const playBtn = this.createPlayButton(track);
        const title = Utils.createTextElement('div', 'title', track.title);
        const artist = Utils.createTextElement('div', 'artist', track.artist);
        const tagsContainer = this.createTagsContainer(track, node);

        node.appendChild(playBtn);
        node.appendChild(title);
        node.appendChild(artist);
        node.appendChild(tagsContainer);
        

        
        // Force clickable styles
        node.style.pointerEvents = 'auto';
        node.style.zIndex = '100';
        node.style.position = 'absolute';
        
        // Add click handler - now handled centrally by Playlist module
        node.addEventListener('click', async (e) => {
            // Only handle non-tag, non-button, non-input clicks
            if (e.target.classList.contains('play-btn') || 
                e.target.classList.contains('add-tag-btn') ||
                e.target.classList.contains('tooltip-add-tag-input') ||
                e.target.closest('.play-btn') ||
                e.target.closest('.add-tag-interface') ||
                e.target.classList.contains('tag') ||
                e.target.tagName === 'INPUT') {
                return;
            }
            
            // Emit node click event through EventBus
            if (window.EventBus) {
                window.EventBus.emit('node:click', {
                    track: track,
                    node: node,
                    connectionTag: connectionTag || 'direct-selection'
                });
            } else {
                // Fallback to legacy handler if EventBus not available
                Playlist.handleNodeClick(track, node, connectionTag || 'direct-selection');
            }
        });
        
        canvasContent.appendChild(node);
        
        const nodeData = {
            element: node,
            track: track
        };

        if (AppState.selectedTagForNextNode) {
            nodeData.selectedTag = AppState.selectedTagForNextNode;
            AppState.setSelectedTagForNextNode(null);
        }
        
        allNodes.push(nodeData);
        
        const parentId = parentNode ? parentNode.id : null;
        Tree.addNode(node.id, node, track, parentId, connectionTag);
        
        if (parentNode) {
            node.classList.add('growing');
            setTimeout(() => {
                node.classList.remove('growing');
            }, 600);
        }
        

        return node;
    },

    /**
     * Create a play button for a track
     * @param {Object} track - Track data object
     * @returns {HTMLElement} The play button element
     */
    createPlayButton(track) {
        const playBtn = document.createElement('button');
        playBtn.className = 'play-btn';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlay(playBtn, track);
        });
        return playBtn;
    },

    /**
     * Create tags container for a track node
     * @param {Object} track - Track data object
     * @param {HTMLElement} node - The node element
     * @returns {HTMLElement} The tags container element
     */
    createTagsContainer(track, node) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';

        // Title
        const title = document.createElement('div');
        title.className = 'tooltip-title';
        title.textContent = `${track.title} - ${track.artist}`;
        tagsContainer.appendChild(title);

        // Tags container
        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'tooltip-tags';

        track.tags.forEach(tagWithValue => {
            const [tagType, tagValue] = tagWithValue.split(':');
            const tag = document.createElement('div');
            tag.className = `tooltip-tag tag-${tagType}`;
            tag.textContent = tagValue;
            tag.dataset.tagValue = tagWithValue;
            
            // Connect tag clicks to EventBus -> TagService (clean single path)
            tag.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                
                // Emit event through EventBus (single path)
                if (window.EventBus) {
                    window.EventBus.emit('tag:click', {
                        element: tag,
                        tagValue: tagWithValue,
                        sourceNode: node,
                        sourceTrack: track
                    });
                } else {
                    // Fallback if EventBus not available
                    TrackNodes.createBranchesDirectly(tagWithValue, node);
                }
            }, true);
            
            // Ensure styles exist for this category
            this.ensureCategoryStyles(tagType);
            
            tagsWrapper.appendChild(tag);
        });

        // Add tag input directly in the tags wrapper
        const addTagInput = document.createElement('input');
        addTagInput.type = 'text';
        addTagInput.placeholder = '+';
        addTagInput.className = 'tooltip-add-tag-input';
        addTagInput.style.width = '60px';
        
        // Prevent click propagation on input
        addTagInput.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        // Also prevent mousedown to be safe
        addTagInput.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        tagsWrapper.appendChild(addTagInput);
        tagsContainer.appendChild(tagsWrapper);
        
        // Handle Enter key to add tag
        addTagInput.addEventListener('keypress', async (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                const newTag = addTagInput.value.trim();
                if (newTag && newTag.includes(':')) {
                    await TrackNodes.addTagToNode(node, track, newTag);
                    addTagInput.value = '';
                    
                    // Refresh the container by recreating it
                    const newTagsContainer = TrackNodes.createTagsContainer(track, node);
                    node.replaceChild(newTagsContainer, tagsContainer);
                }
            }
        });

        return tagsContainer;
    },

    /**
     * NEW METHOD: Create branches directly for a tag - bypasses all existing systems
     * @param {string} tagValue - The tag value (e.g., "mood:confident")
     * @param {HTMLElement} sourceNode - The source node to branch from
     */
    async createBranchesDirectly(tagValue, sourceNode) {
        const callId = Date.now();
        console.trace('🌿 Call stack trace');
        
        // Prevent multiple calls for the same tag+node combination
        const callKey = `${tagValue}-${sourceNode.id}`;
        if (this._activeCalls && this._activeCalls.has(callKey)) {
            console.warn(`🚫 [${callId}] Duplicate call prevented for ${callKey}`);
            return;
        }
        
        // Initialize active calls tracking
        if (!this._activeCalls) {
            this._activeCalls = new Set();
        }
        this._activeCalls.add(callKey);
        
        try {
            // Get source track data
            const sourceTrackData = JSON.parse(sourceNode.dataset.track);
            
            // Generate EXACTLY 5 tracks with this tag using DataLoader
            const relatedTracks = await DataLoader.generateTracksWithTag(tagValue, sourceTrackData);
            
            if (!relatedTracks || relatedTracks.length === 0) {
                console.warn(`🌿 [${callId}] No related tracks found for tag:`, tagValue);
                return;
            }
            
            
            // Filter out identical tracks and take EXACTLY 5
            const filteredTracks = relatedTracks.filter(track => 
                !(track.title === sourceTrackData.title && track.artist === sourceTrackData.artist)
            );
            
            // Take EXACTLY 5 tracks, no more, no less
            const tracksToCreate = filteredTracks.slice(0, 5);
            
            // Create each node with proper delay
            tracksToCreate.forEach((track, i) => {
                setTimeout(() => {
                    
                    // Create new node positioned around the source
                    const newNode = this.create(track, 0, 0, sourceNode, tagValue);
                    
                    // Add to playlist
                    if (typeof Playlist !== 'undefined' && Playlist.addTrack) {
                        Playlist.addTrack(track, tagValue);
                    }
                    
                }, i * 300); // Stagger creation
            });
            
            // Show notification
            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification(`🌿 Created ${tracksToCreate.length} branches for ${tagValue.split(':')[1]}`);
            }
            
        } catch (error) {
            console.error(`🌿 [${callId}] Error creating branches:`, error);
        } finally {
            // Clean up after 5 seconds
            setTimeout(() => {
                this._activeCalls.delete(callKey);
            }, 5000);
        }
    },

    /**
     * Toggle play state for a track
     * @param {HTMLElement} playBtn - The play button element
     * @param {Object} track - Track data object
     */
    togglePlay(playBtn, track) {
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
     * Add a track to the tree by creating a branch
     * @param {Object} track - Track data object
     * @param {string} connectionTag - The tag that connects this track to its parent
     * @param {HTMLElement} parentNode - Parent node
     * @param {HTMLElement} clickedContainer - The container that was clicked (if any)
     */
    addToPlaylist(track, connectionTag, parentNode, clickedContainer = null) {
        // Create new node as child of parent
        let newNode;
        if (parentNode) {
            newNode = this.create(track, 0, 0, parentNode, connectionTag);
        } else {
            // First node (root)
            newNode = this.create(track, AppState.canvas.offsetWidth / 2, AppState.canvas.offsetHeight / 2);
        }
        
        const nodeData = {
            element: newNode,
            track: track,
            selectedTag: connectionTag
        };
        
        // Find and update the node data if it already exists
        const existingIndex = AppState.allNodes.findIndex(n => n.element === newNode);
        if (existingIndex !== -1) {
            AppState.allNodes[existingIndex] = nodeData;
        }
        
        
        // Close the specific container that was clicked
        if (clickedContainer) {
            const containerIndex = AppState.allContainers.indexOf(clickedContainer);
            if (containerIndex > -1) {
                AppState.allContainers.splice(containerIndex, 1);
            }
            
                if (clickedContainer === AppState.currentMultiTagContainer) {
                AppState.setCurrentMultiTagContainer(null);
                Tags.clearSelected();
            }
            
            clickedContainer.remove();
            Utils.updateCanvasSize();
        }
        
        Utils.showNotification(`Added "${track.title}" connected by "${connectionTag.split(':')[1]}" tag`);
    },

    /**
     * Create a branch with multiple tracks for a selected tag - DISABLED TO PREVENT DUPLICATION
     * @param {string} tag - The tag to create branches for
     * @param {HTMLElement} sourceNode - The source node
     */
    async createBranchesForTag(tag, sourceNode) {
        return; // DISABLED
        // Get the source track to exclude it from generated tracks
        let sourceTrack = null;
        try {
            const sourceTrackData = sourceNode.dataset.track;
            if (sourceTrackData) {
                sourceTrack = this.safeParseTrackData(sourceTrackData);
            }
        } catch (error) {
        }
        
        // Generate tracks with this tag using DataLoader, excluding the source track
        const tracks = await DataLoader.generateTracksWithTag(tag, sourceTrack);
        
        // Create up to 5 branches to show more variety
        const numBranches = Math.min(5, tracks.length);
        
        for (let i = 0; i < numBranches; i++) {
            setTimeout(() => {
                const track = tracks[i];
                
                // RULE ENFORCEMENT: Double-check that we're not creating identical node
                if (sourceTrack && 
                    track.title === sourceTrack.title && 
                    track.artist === sourceTrack.artist && 
                    track.album === sourceTrack.album) {
                    return; // Skip this track
                }
                
                this.addToPlaylist(track, tag, sourceNode);
            }, i * 200); // Stagger creation for animation effect
        }
        
        Utils.showNotification(`Created ${numBranches} branches for "${tag.split(':')[1]}" tag`);
    },

    // addToPlaylistDisplay method removed - now handled centrally by Playlist.addTrackToPlaylist

    // recenterTreeOnTrack method removed - now handled centrally by Playlist.recenterTreeOnTrack



    /**
     * Add a new tag to an existing node
     * @param {HTMLElement} node - The node element
     * @param {Object} track - Track data object  
     * @param {string} newTag - New tag to add (format: "category:value")
     */
    async addTagToNode(node, track, newTag) {
        // Add tag to track data
        if (!track.tags.includes(newTag)) {
            track.tags.push(newTag);
            
            // Update original track data only if it's from the library (not generated)
            const isGenerated = track.generated || (track.id && track.id.startsWith('generated_'));
            
            if (!isGenerated) {
                await this.updateOriginalTrackData(track, newTag);
            } else {
            }
            
            // Update the visual tags container
            const tagsContainer = node.querySelector('.tags');
            if (tagsContainer) {
                const [category, value] = newTag.split(':');
                const tagElement = document.createElement('div');
                tagElement.className = `tag tag-${category}`;
                tagElement.textContent = value;
                tagElement.dataset.tag = newTag;
                
                // Add click handler for tag
                tagElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Tags.handleTagClick(tagElement, track);
                });
                
                tagsContainer.appendChild(tagElement);
            }
            
            // Ensure styles exist for the new tag category (for tooltips)
            const [category] = newTag.split(':');
            this.ensureCategoryStyles(category);
            
            // Node ALWAYS keeps neutral gray color (never changes)
            node.dataset.tagCategory = 'neutral';
            if (!node.classList.contains('node-neutral')) {
                node.classList.add('node-neutral');
            }
            
            // Update the node's dataset with the new track data
            node.dataset.track = JSON.stringify(track);
            
            // Force refresh any open tooltips to show the new tag
            if (UI && UI.tooltip && UI.tooltip.style.display === 'block') {
                UI.tooltip.style.display = 'none';
            }
            
            // Also clear the tooltip's current hover target to force refresh
            if (UI && UI.currentHoverTarget) {
                UI.currentHoverTarget = null;
            }
            
            Utils.showNotification(`✅ Tag "${newTag}" added to "${track.title}"`);
        } else {
            Utils.showNotification(`Tag "${newTag}" already exists on this track`);
        }
    },

    /**
     * Ensure CSS styles exist for a category
     * @param {string} category - Category name
     */
    ensureCategoryStyles(category) {
        // Check if styles already exist
        const existingStyle = document.querySelector(`#category-styles-${category}`);
        if (existingStyle) return;
        
        // Get color from Tree.getTagColor
        const color = Tree.getTagColor(`${category}:test`);
        
        // Create style element
        const style = document.createElement('style');
        style.id = `category-styles-${category}`;
        style.textContent = `
            /* Tooltip tag styles for ${category} */
            .tooltip-tag.tag-${category} {
                background: linear-gradient(135deg, ${color}, ${this.darkenColor(color, 20)});
                border-color: ${this.hexToRgba(color, 0.3)};
            }
            
            /* Node styling for ${category} */
            .track-node.node-tag-${category} {
                background: linear-gradient(135deg, ${this.hexToRgba(color, 0.9)}, ${this.hexToRgba(this.darkenColor(color, 20), 0.9)});
                border: 2px solid ${this.hexToRgba(color, 0.6)};
                box-shadow: 0 4px 20px ${this.hexToRgba(color, 0.3)};
            }
            
            .track-node.node-tag-${category}:hover {
                background: linear-gradient(135deg, ${color}, ${this.darkenColor(color, 20)});
                box-shadow: 0 6px 24px ${this.hexToRgba(color, 0.4)};
            }
            
            /* Legend popup tag styles for ${category} */
            .legend-popup-tag.tag-${category} {
                color: ${color};
                border-color: ${this.hexToRgba(color, 0.3)};
            }
        `;
        
        document.head.appendChild(style);
    },

    /**
     * Darken a hex color by a percentage
     * @param {string} color - Hex color
     * @param {number} percent - Percentage to darken (0-100)
     * @returns {string} Darkened hex color
     */
    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    },

    /**
     * Convert hex color to rgba
     * @param {string} hex - Hex color
     * @param {number} alpha - Alpha value (0-1)
     * @returns {string} RGBA color string
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    /**
     * Safely decode and parse track data from HTML dataset
     * @param {string} trackDataString - Raw track data string
     * @returns {Object|null} Parsed track data or null if parsing fails
     */
    safeParseTrackData(trackDataString) {
        let cleanString = '';
        try {
            // More comprehensive HTML entity decoding
            cleanString = trackDataString;
            
            // Create a temporary element to decode HTML entities
            const tempElement = document.createElement('div');
            tempElement.innerHTML = cleanString;
            cleanString = tempElement.textContent || tempElement.innerText || '';
            
            // Additional manual replacements for common issues
            cleanString = cleanString
                .replace(/&apos;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .trim();
            
            // Check if the string looks like valid JSON before parsing
            if (!cleanString.startsWith('{')) {
                return null;
            }
            
            // If string doesn't end with }, try to fix truncated JSON
            if (!cleanString.endsWith('}')) {
                
                // Try to get the track data from the element's text content or other attributes
                const trackElement = this.findTrackElementByPartialData(cleanString);
                if (trackElement) {
                    return this.reconstructTrackDataFromElement(trackElement);
                }
                
                return null;
            }
            
            return JSON.parse(cleanString);
        } catch (error) {
            return null;
        }
    },

    /**
     * Find track element by partial JSON data (for truncated datasets)
     * @param {string} partialJson - Partial JSON string
     * @returns {HTMLElement|null} Track element or null
     */
    findTrackElementByPartialData(partialJson) {
        try {
            // Try to extract title from partial JSON
            const titleMatch = partialJson.match(/"title":"([^"]+)"/);
            if (titleMatch) {
                const partialTitle = titleMatch[1];
                const trackItems = document.querySelectorAll('.track-item');
                
                for (const item of trackItems) {
                    const titleElement = item.querySelector('.track-title');
                    if (titleElement && titleElement.textContent.includes(partialTitle)) {
                        return item;
                    }
                }
            }
        } catch (error) {
        }
        return null;
    },

    /**
     * Reconstruct track data from element's DOM content
     * @param {HTMLElement} trackElement - Track element
     * @returns {Object|null} Reconstructed track data
     */
    reconstructTrackDataFromElement(trackElement) {
        try {
            const titleElement = trackElement.querySelector('.track-title');
            
            if (!titleElement) {
                return null;
            }
            
            const title = titleElement.textContent.trim();
            
            // Try to find artist and album from parent containers
            const albumFolder = trackElement.closest('.album-folder');
            const artistFolder = trackElement.closest('.artist-folder');
            
            let artist = 'Unknown Artist';
            let album = 'Unknown Album';
            
            if (artistFolder) {
                const artistNameElement = artistFolder.querySelector('.artist-name');
                if (artistNameElement) {
                    artist = artistNameElement.textContent.trim();
                }
            }
            
            if (albumFolder) {
                const albumNameElement = albumFolder.querySelector('.album-name');
                if (albumNameElement) {
                    album = albumNameElement.textContent.trim();
                }
            }
            
            // Basic track data - tags will be empty array for safety
            const reconstructedData = {
                title: title,
                artist: artist,
                album: album,
                tags: [] // Start with empty tags to avoid issues
            };
            
            return reconstructedData;
        } catch (error) {
            return null;
        }
    },

    /**
     * Update the original track data in the HTML library
     * @param {Object} track - Track data object
     * @param {string} newTag - New tag to add
     */
    async updateOriginalTrackData(track, newTag) {
        // Find the original track element in the library
        const trackItems = document.querySelectorAll('.track-item');
        
        
        let found = false;
        let validTracks = 0;
        
        trackItems.forEach((item, index) => {
            const originalTrackData = this.safeParseTrackData(item.dataset.track);
            
            if (originalTrackData) {
                validTracks++;
                
                if (originalTrackData.title === track.title && 
                    originalTrackData.artist === track.artist && 
                    originalTrackData.album === track.album) {
                    
                    found = true;
                    
                    // Add the new tag to the original data
                    if (!originalTrackData.tags.includes(newTag)) {
                        originalTrackData.tags.push(newTag);
                        
                        // Update the dataset with the new track data
                        item.dataset.track = JSON.stringify(originalTrackData);
                        
                    }
                }
            } else {
            }
        });
        
        
        // If we couldn't parse most tracks, there might be a systematic issue
        if (validTracks < trackItems.length * 0.5) {
        }
        
        if (found) {
            // Persist the tag to the database
            try {
                const success = await DataLoader.addTagToTrack(track, newTag);
                if (success) {
                } else {
                }
            } catch (error) {
            }
        } else {
        }
    },


};

// Make TrackNodes available globally
window.TrackNodes = TrackNodes; 