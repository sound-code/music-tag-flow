/**
 * Drag and Drop Module - Facade/Bridge to DragDropService
 * Provides backward compatibility for legacy code
 * All functionality is delegated to DragDropService
 */

const DragDrop = {
    // 🌳 Tree Generation Configuration - Easy to modify!
    config: {
        maxLevels: 2,              // Total tree depth (2 levels after root)
        branchesPerTag: 1,         // Number of tracks per tag (1 node per tag)
        tagsPerLevel: 5,          // Default number of different tags (overridden per level)
        // Level-specific configurations
        levelConfigs: {
            1: { tagsPerLevel: 5 },  // First level: 5 nodes in circle
            2: { tagsPerLevel: 3 },  // Second level: 3 nodes per semi-circle (FINAL LEVEL)
        },
        animationDelay: 400,       // Delay between level generation (ms)
        branchDelay: 150          // Delay between individual branches (ms)
    },

    /**
     * Initialize drag and drop functionality - delegates to DragDropService
     */
    initialize() {
        // Delegate to DragDropService
        if (window.App && window.App.getService) {
            const dragDropService = window.App.getService('dragdrop');
            if (dragDropService) {
                // DragDropService is already initialized by ServiceManager
                // Setup event bridge between DragDropService and legacy modules
                this.setupDragDropServiceBridge(dragDropService);
                // Just run legacy-specific initialization
                this.initializeLegacyFeatures();
                return;
            }
        }
        
        // Fallback implementation (should not be reached if DragDropService is available)
        const { dropZone } = AppState;
        
        const trackItems = document.querySelectorAll('.track-item');
        
        trackItems.forEach(item => {
            item.addEventListener('dragstart', this.handleDragStart.bind(this));
            item.addEventListener('dragend', this.handleDragEnd.bind(this));
        });

        if (dropZone) {
            dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
            dropZone.addEventListener('dragenter', this.handleDragEnter.bind(this));
            dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
            dropZone.addEventListener('drop', this.handleDrop.bind(this));
        } else {
            console.error('Drop zone not found!');
        }
    },

    /**
     * Setup bridge between DragDropService and legacy modules
     */
    setupDragDropServiceBridge(dragDropService) {
        // Listen for DragDropService events and handle with legacy modules
        if (window.EventBus) {
            // Bridge tree creation events to legacy TrackNodes
            window.EventBus.on('tree:create-root-node', (data) => {
                if (typeof TrackNodes !== 'undefined' && TrackNodes.create) {
                    const rootNode = TrackNodes.create(data.trackData, data.x, data.y);
                    // Store root node reference for tree building
                    this._currentRootNode = rootNode;
                }
            });

            window.EventBus.on('tree:create-child-node', (data) => {
                if (typeof TrackNodes !== 'undefined' && TrackNodes.create) {
                    const childNode = TrackNodes.create(data.trackData, 0, 0, data.parentNode || this._currentRootNode, data.connectionTag);
                    if (data.callback) {
                        data.callback(childNode);
                    }
                }
            });

            // Bridge data generation events to legacy DataLoader
            window.EventBus.on('data:generate-tracks-with-tag', (data) => {
                if (typeof DataLoader !== 'undefined' && DataLoader.generateTracksWithTag) {
                    DataLoader.generateTracksWithTag(data.tag, data.parentTrack).then(relatedTracks => {
                        if (data.callback) {
                            data.callback(relatedTracks);
                        }
                    });
                }
            });

            // Bridge tag click events to create additional branches - DISABLED
            window.EventBus.on('tag:click-from-node', (data) => {
                // DISABLED - use the new tag:click event instead
            });

            // Bridge TagService tree:create-branches events to NEW TrackNodes method
            window.EventBus.on('tree:create-branches', (data) => {
                if (typeof TrackNodes !== 'undefined' && TrackNodes.createBranchesDirectly) {
                    TrackNodes.createBranchesDirectly(data.tagValue, data.sourceNode);
                } else {
                    console.warn('🌿 TrackNodes.createBranchesDirectly not available');
                }
            });

            // Bridge tag:click events to TagService
            window.EventBus.on('tag:click', (data) => {
                if (window.App && window.App.getService) {
                    const tagService = window.App.getService('tags');
                    if (tagService && typeof tagService.handleTagClick === 'function') {
                        tagService.handleTagClick(data.element, data.tagValue);
                    } else {
                        console.warn('🏷️ TagService not available, using fallback');
                        // Fallback to legacy Tags module
                        if (typeof Tags !== 'undefined' && Tags.toggleSelection) {
                            Tags.toggleSelection(data.element);
                        }
                    }
                } else {
                    console.warn('🏷️ App.getService not available');
                }
            });
        }
    },

    /**
     * Initialize legacy-specific features not in DragDropService
     */
    initializeLegacyFeatures() {
        // Tags now handled directly in TrackNodes with onclick
    },

    /**
     * Add drag functionality to a single track item
     * @param {HTMLElement} trackItem - The track item element
     */
    addDragToElement(trackItem) {
        // Delegate to DragDropService
        if (window.App && window.App.getService) {
            const dragDropService = window.App.getService('dragdrop');
            if (dragDropService && typeof dragDropService.addDragToElement === 'function') {
                dragDropService.addDragToElement(trackItem);
                return;
            }
        }
        
        // Fallback implementation
        if (!trackItem) {
            return;
        }
        
        
        trackItem.addEventListener('dragstart', this.handleDragStart.bind(this));
        trackItem.addEventListener('dragend', this.handleDragEnd.bind(this));
    },

    /**
     * Create auto tree - delegates to DragDropService
     * @param {Object} trackData - Root track data
     */
    async createAutoTree(trackData) {
        // Delegate to DragDropService
        if (window.App && window.App.getService) {
            const dragDropService = window.App.getService('dragdrop');
            if (dragDropService && typeof dragDropService.createAutoTree === 'function') {
                await dragDropService.createAutoTree(trackData);
                return;
            }
        }
        
        // Fallback implementation
        await this.createAutoTreeLegacy(trackData);
    },

    /**
     * Handle drag start event
     * @param {DragEvent} e - The drag event
     */
    handleDragStart(e) {
        
        e.target.classList.add('dragging');
        
        const trackData = e.target.dataset.track;
        
        if (!trackData) {
            Utils.showNotification('No track data found');
            return;
        }
        
        // Decode HTML entities that might be in the JSON
        const decodedTrackData = trackData.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        
        e.dataTransfer.setData('text/plain', decodedTrackData);
        e.dataTransfer.effectAllowed = 'copy';
        
    },

    /**
     * Handle drag end event
     * @param {DragEvent} e - The drag event
     */
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
    },

    /**
     * Handle drag over event
     * @param {DragEvent} e - The drag event
     */
    handleDragOver(e) {
        e.preventDefault();
    },

    /**
     * Handle drag enter event
     * @param {DragEvent} e - The drag event
     */
    handleDragEnter(e) {
        e.preventDefault();
        AppState.dropZone.classList.add('drag-over');
    },

    /**
     * Handle drag leave event
     */
    handleDragLeave() {
        AppState.dropZone.classList.remove('drag-over');
    },

    /**
     * Handle drop event
     * @param {DragEvent} e - The drag event
     */
    async handleDrop(e) {
        // Global safety wrapper
        const originalOnError = window.onerror;
        window.onerror = function(message, source, lineno, colno, error) {
            console.error('🎯 GLOBAL ERROR during drop:', {message, source, lineno, colno, error});
            return false; // Let default handler run too
        };
        
        // Setup timeout safety
        const dropTimeout = setTimeout(() => {
            console.error('🎯 DROP TIMEOUT - operation took too long');
        }, 10000); // 10 second timeout
        
        try {
            e.preventDefault();
            e.stopPropagation();
            
            const { dropZone } = AppState;
            dropZone.classList.remove('drag-over');
            
            const trackDataString = e.dataTransfer.getData('text/plain');
            
            if (!trackDataString?.trim()) {
                Utils.showNotification('No track data found');
                return;
            }
            
            let trackData;
            try {
                trackData = JSON.parse(trackDataString);
            } catch (parseError) {
                console.error('🎯 JSON parse failed:', parseError.message);
                Utils.showNotification('Invalid track data format');
                return;
            }
            
            // ULTRA SIMPLE TEST - just show notification without creating anything
            try {
                Utils.showNotification(`🎵 Dropped: ${trackData.title} by ${trackData.artist}`);
                
            } catch (simpleError) {
                console.error('🎯 Error in simple test:', simpleError);
                throw simpleError;
            }
            
            dropZone.style.display = 'none';
            
        } catch (error) {
            console.error('🎯 CRITICAL DROP ERROR:', error);
            console.error('🎯 Error name:', error.name);
            console.error('🎯 Error message:', error.message);
            console.error('🎯 Error stack:', error.stack);
            
            // Try to show notification even if there's an error
            try {
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification('❌ Drop failed: ' + error.message);
                }
            } catch (notificationError) {
                console.error('🎯 Even notification failed:', notificationError);
            }
        }
        
        // Cleanup
        clearTimeout(dropTimeout);
        window.onerror = originalOnError;
        
    },

    /**
     * Create an automatic tree structure up to 3 levels deep (legacy fallback)
     * @param {Object} rootTrackData - The root track data
     */
         async createAutoTreeLegacy(rootTrackData) {
         const { maxLevels, animationDelay } = this.config;
         
         Utils.showNotification(`🌱 Building your ${maxLevels}-level musical tree from "${rootTrackData.title}"...`);
         
         // Create root node
         const rootNode = TrackNodes.create(rootTrackData, AppState.canvas.offsetWidth / 2, AppState.canvas.offsetHeight / 2);
         
         // Build tree levels with staggered timing for smooth animation
         setTimeout(async () => await this.buildTreeLevel(rootNode, rootTrackData, 1, maxLevels), animationDelay * 2);
     },

    /**
     * Build a specific level of the tree
     * @param {HTMLElement} parentNode - Parent node element
     * @param {Object} parentTrack - Parent track data
     * @param {number} currentLevel - Current level being built (1-3)
     * @param {number} maxLevels - Maximum levels to build
     */
         async buildTreeLevel(parentNode, parentTrack, currentLevel, maxLevels) {
         if (currentLevel > maxLevels) return;
         
         const { branchesPerTag, animationDelay, branchDelay, levelConfigs } = this.config;
         
         // Get level-specific configuration or default
         const levelConfig = levelConfigs[currentLevel] || { tagsPerLevel: this.config.tagsPerLevel };
         const tagsPerLevel = levelConfig.tagsPerLevel;
         
         // Get unique tags from parent track
         let availableTags = this.selectRepresentativeTags(parentTrack.tags);
         
         // RULE: Exclude the tag that was used to create this node (avoid redundant connections)
         const parentConnectionTag = parentNode.dataset?.connectionTag;
         if (parentConnectionTag) {
             const originalCount = availableTags.length;
             availableTags = availableTags.filter(tag => tag !== parentConnectionTag);
             
             // Log the exclusion for debugging
             if (availableTags.length < originalCount) {
 
             }
         }
         
         const selectedTags = availableTags.slice(0, tagsPerLevel);
         
         // If we don't have enough tags after filtering, show a message
         if (selectedTags.length === 0) {
             
             return;
         }
         
         selectedTags.forEach((tag, tagIndex) => {
             setTimeout(async () => {
                 // Generate tracks for this tag using the new DataLoader
                 const relatedTracks = await DataLoader.generateTracksWithTag(tag, parentTrack);
                 
                 // Create limited branches per tag to avoid overcrowding
                 const numBranches = Math.min(branchesPerTag, relatedTracks.length);
                 
                 for (let i = 0; i < numBranches; i++) {
                     setTimeout(() => {
                         const childTrack = relatedTracks[i];
                         // RULE ENFORCEMENT: Never create a child node identical to parent
                        if (childTrack.title === parentTrack.title && 
                            childTrack.artist === parentTrack.artist && 
                            childTrack.album === parentTrack.album) {
                            return; // Skip this track
                        }
                        
                        const childNode = TrackNodes.create(childTrack, 0, 0, parentNode, tag);
                         
                         // Recursively build next level
                         if (currentLevel < maxLevels) {
                             setTimeout(async () => {
                                 await this.buildTreeLevel(childNode, childTrack, currentLevel + 1, maxLevels);
                             }, animationDelay);
                         }
                     }, i * branchDelay);
                 }
             }, tagIndex * (animationDelay + 200)); // Stagger each tag group
         });
         
         // Dynamic notifications based on actual max levels
         if (currentLevel === 1 && maxLevels > 1) {
             setTimeout(() => {
                 Utils.showNotification(`Level ${currentLevel} complete! ${maxLevels > 2 ? 'Growing deeper...' : 'Final level growing...'}`);
             }, 1000);
         } else if (currentLevel === maxLevels) {
             setTimeout(() => {
                  Utils.showNotification(`🌳 Your ${maxLevels}-level musical tree is complete! Click any tag to grow more branches.`);
             }, animationDelay * 2);
         }
     },

    /**
     * Select representative tags from a track's tags
     * @param {Array} tags - Array of all tags
     * @returns {Array} Selected representative tags
     */
         selectRepresentativeTags(tags) {
         // Prioritize certain tag types for better tree diversity
         const tagPriority = {
             'mood': 3,
             'energy': 3, 
             'emotion': 2,
             'style': 2,
             'vibe': 2,
             'occasion': 1,
             'tempo': 1,
             'weather': 1,
             'intensity': 1,
             'rating': 0
         };
         
         // Group tags by type and score them
         const tagsByType = {};
         tags.forEach(tag => {
             const [type] = tag.split(':');
             if (!tagsByType[type]) tagsByType[type] = [];
             tagsByType[type].push(tag);
         });
         
         // Select best tags based on priority (now configurable)
         const selectedTags = [];
         Object.entries(tagsByType)
             .sort(([typeA], [typeB]) => (tagPriority[typeB] || 0) - (tagPriority[typeA] || 0))
             .slice(0, this.config.tagsPerLevel + 1) // Take configurable number of tag types
             .forEach(([, typeTags]) => {
                 // Pick one tag from each type (preferably the first)
                 selectedTags.push(typeTags[0]);
             });
         
         return selectedTags;
     },

    /**
     * Add drag functionality to an element
     * @param {HTMLElement} element - The element to make draggable
     */
    addDragToElement(element) {
        element.addEventListener('dragstart', this.handleDragStart.bind(this));
        element.addEventListener('dragend', this.handleDragEnd.bind(this));
    }
};

// Make DragDrop available globally
window.DragDrop = DragDrop; 