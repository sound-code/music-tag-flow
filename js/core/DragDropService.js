/**
 * DragDropService - Drag and Drop functionality management
 * Handles all drag and drop operations and auto-tree generation
 */
class DragDropService extends ServiceBase {
    constructor(stateManager, eventBus, dependencies = {}) {
        super(stateManager, eventBus, dependencies);
        
        // Service-specific configuration
        this.config = {
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
        };
        
        // State tracking
        this.isDragActive = false;
        this.currentDragData = null;
        
        // DOM element references
        this.elements = {
            dropZone: null,
            canvas: null
        };
        
        // Validation rules
        this.validationRules = {
            trackData: (data) => data && data.title && data.artist && data.tags,
            dragEvent: (e) => e && e.dataTransfer
        };
        
    }

    /**
     * Initialize drag and drop service
     */
    initialize() {
        
        // Initialize DOM elements
        this.initializeDOMElements();
        
        // Initialize state
        this.setState('dragdrop.isDragActive', false);
        this.setState('dragdrop.currentDragData', null);
        this.setState('dragdrop.isTreeBuilding', false);
        
        // Subscribe to events
        this.subscribeToEvent('dragdrop:drag-start', (data) => {
            this.handleDragStart(data.event, data.element);
        });
        this.subscribeToEvent('dragdrop:drag-end', (data) => {
            this.handleDragEnd(data.event, data.element);
        });
        this.subscribeToEvent('dragdrop:drop', (data) => {
            this.handleDrop(data.event);
        });
        this.subscribeToEvent('dragdrop:create-auto-tree', (data) => {
            this.createAutoTree(data.trackData);
        });
        this.subscribeToEvent('data:loading:complete', () => {
            this.setupDragListeners();
        });
        
        // Setup event bridges to other services
        this.setupServiceBridges();
        
        // Setup initial drag listeners
        this.setupDragListeners();
        this.setupDropZone();
    }

    /**
     * Initialize DOM element references
     */
    initializeDOMElements() {
        try {
            // Ensure elements object is initialized
            if (!this.elements) {
                this.elements = {};
            }
            
            this.elements.dropZone = document.querySelector('.drop-zone');
            this.elements.canvas = document.querySelector('.mindmap-canvas');
            
            if (!this.elements.dropZone) {
                console.warn('DragDropService: Drop zone not found');
            }
            if (!this.elements.canvas) {
                console.warn('DragDropService: Canvas not found');
            }
        } catch (error) {
            console.warn('DragDropService: Could not initialize DOM elements:', error);
        }
    }

    /**
     * Setup drag listeners for track items
     */
    setupDragListeners() {
        
        // Use event delegation for dynamically added track items
        document.addEventListener('dragstart', (e) => {
            const trackItem = e.target.closest('.track-item, .track-list-item, .search-result-item');
            if (trackItem && trackItem.dataset.track) {
                this.handleDragStart(e, trackItem);
            }
        });

        document.addEventListener('dragend', (e) => {
            const trackItem = e.target.closest('.track-item, .track-list-item, .search-result-item');
            if (trackItem) {
                this.handleDragEnd(e, trackItem);
            }
        });
        
    }

    /**
     * Setup drop zone event listeners
     */
    setupDropZone() {
        if (!this.elements.dropZone) {
            // Try to find drop zone again in case DOM wasn't ready
            this.initializeDOMElements();
            if (!this.elements.dropZone) {
                console.warn('DragDropService: Drop zone still not found, retrying...');
                setTimeout(() => this.setupDropZone(), 100);
                return;
            }
        }

        this.elements.dropZone.addEventListener('dragover', (e) => {
            this.handleDragOver(e);
        });

        this.elements.dropZone.addEventListener('dragenter', (e) => {
            this.handleDragEnter(e);
        });

        this.elements.dropZone.addEventListener('dragleave', (e) => {
            this.handleDragLeave(e);
        });

        this.elements.dropZone.addEventListener('drop', (e) => {
            this.handleDrop(e);
        });
    }

    /**
     * Handle drag start event
     * @param {DragEvent} e - The drag event
     * @param {HTMLElement} element - The dragged element
     */
    handleDragStart(e, element) {
        
        if (!this.validate({ dragEvent: e }, { dragEvent: this.validationRules.dragEvent })) {
            return;
        }

        element.classList.add('dragging');
        this.isDragActive = true;
        
        try {
            this.setState('dragdrop.isDragActive', true);
        } catch (stateError) {
            console.error('🎯 DragDropService: Error setting state:', stateError);
        }
        
        const trackData = element.dataset.track;
        
        // Extract track data from element
        
        if (!trackData) {
            this.emitEvent('notification:show', {
                message: 'No track data found',
                type: 'error'
            });
            return;
        }
        
        // Decode HTML entities that might be in the JSON
        const decodedTrackData = trackData.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        
        this.currentDragData = decodedTrackData;
        
        try {
            this.setState('dragdrop.currentDragData', decodedTrackData);
        } catch (stateError) {
            console.error('🎯 DragDropService: Error setting drag data state:', stateError);
        }
        
        e.dataTransfer.setData('text/plain', decodedTrackData);
        e.dataTransfer.effectAllowed = 'copy';

        try {
            this.emitEvent('dragdrop:started', {
                trackData: decodedTrackData,
                element
            });
        } catch (eventError) {
            console.error('🎯 DragDropService: Error emitting event:', eventError);
        }
        
    }

    /**
     * Handle drag end event
     * @param {DragEvent} e - The drag event
     * @param {HTMLElement} element - The dragged element
     */
    handleDragEnd(e, element) {
        element.classList.remove('dragging');
        this.isDragActive = false;
        this.currentDragData = null;
        
        this.setState('dragdrop.isDragActive', false);
        this.setState('dragdrop.currentDragData', null);

        this.emitEvent('dragdrop:ended', {
            element
        });
    }

    /**
     * Handle drag over event
     * @param {DragEvent} e - The drag event
     */
    handleDragOver(e) {
        e.preventDefault();
    }

    /**
     * Handle drag enter event
     * @param {DragEvent} e - The drag event
     */
    handleDragEnter(e) {
        e.preventDefault();
        if (this.elements.dropZone) {
            this.elements.dropZone.classList.add('drag-over');
        }
        
        this.emitEvent('dragdrop:drag-enter', {
            dropZone: this.elements.dropZone
        });
    }

    /**
     * Handle drag leave event
     * @param {DragEvent} e - The drag event
     */
    handleDragLeave(e) {
        if (this.elements.dropZone) {
            this.elements.dropZone.classList.remove('drag-over');
        }
        
        this.emitEvent('dragdrop:drag-leave', {
            dropZone: this.elements.dropZone
        });
    }

    /**
     * Handle drop event
     * @param {DragEvent} e - The drag event
     */
    async handleDrop(e) {
        e.preventDefault();
        
        if (this.elements.dropZone) {
            this.elements.dropZone.classList.remove('drag-over');
        }
        
        try {
            const trackDataString = e.dataTransfer.getData('text/plain');
            
            if (!trackDataString?.trim()) {
                this.emitEvent('notification:show', {
                    message: 'No track data found',
                    type: 'error'
                });
                return;
            }
            
            const trackData = JSON.parse(trackDataString);
            
            if (!this.validate({ trackData }, { trackData: this.validationRules.trackData })) {
                this.emitEvent('notification:show', {
                    message: 'Invalid track data',
                    type: 'error'
                });
                return;
            }
            
            // Set flag that tree is being built
            this.setState('dragdrop.isTreeBuilding', true);
            this.setState('playlist.isTreeBuilding', true);
            
            // Emit event for other services to know tree building started
            this.emitEvent('tree:building-started', { trackData });
            
            await this.createAutoTree(trackData);
            
            if (this.elements.dropZone) {
                this.elements.dropZone.style.display = 'none';
            }
            
            // Aggiungi classe per indicare che c'è un albero attivo
            document.body.classList.add('tree-active');
            
            // Reset flag after tree is built (give it time to complete)
            setTimeout(() => {
                this.setState('dragdrop.isTreeBuilding', false);
                this.setState('playlist.isTreeBuilding', false);
                this.emitEvent('tree:building-completed', { trackData });
            }, 3000);
            
            this.emitEvent('dragdrop:dropped', {
                trackData,
                dropZone: this.elements.dropZone
            });
            
        } catch (error) {
            this.emitEvent('notification:show', {
                message: 'Error loading track data',
                type: 'error'
            });
        }
    }

    /**
     * Create an automatic tree structure
     * @param {Object} rootTrackData - The root track data
     */
    async createAutoTree(rootTrackData) {
        
        if (!this.validate({ trackData: rootTrackData }, { trackData: this.validationRules.trackData })) {
            return;
        }
        

        const { maxLevels, animationDelay } = this.config;
        
        this.emitEvent('notification:show', {
            message: `🌱 Building your ${maxLevels}-level musical tree from "${rootTrackData.title}"...`,
            type: 'info'
        });
        
        // Emit event to create root node
        this.emitEvent('tree:create-root-node', {
            trackData: rootTrackData,
            x: this.elements.canvas ? this.elements.canvas.offsetWidth / 2 : 400,
            y: this.elements.canvas ? this.elements.canvas.offsetHeight / 2 : 300
        });
        
        // Build tree levels with staggered timing for smooth animation
        setTimeout(async () => {
            await this.buildTreeLevel(null, rootTrackData, 1, maxLevels);
        }, animationDelay * 2);
    }

    /**
     * Build a specific level of the tree
     * @param {HTMLElement|null} parentNode - Parent node element (null for root)
     * @param {Object} parentTrack - Parent track data
     * @param {number} currentLevel - Current level being built (1-3)
     * @param {number} maxLevels - Maximum levels to build
     */
    async buildTreeLevel(parentNode, parentTrack, currentLevel, maxLevels) {
        
        if (currentLevel > maxLevels) {
            return;
        }
        
        const { branchesPerTag, animationDelay, branchDelay, levelConfigs } = this.config;
        
        // Get level-specific configuration or default
        const levelConfig = levelConfigs[currentLevel] || { tagsPerLevel: this.config.tagsPerLevel };
        const tagsPerLevel = levelConfig.tagsPerLevel;
        
        // Get unique tags from parent track
        let availableTags = this.selectRepresentativeTags(parentTrack.tags);
        
        // RULE: Exclude the tag that was used to create this node (avoid redundant connections)
        const parentConnectionTag = parentNode?.dataset?.connectionTag;
        if (parentConnectionTag) {
            const originalCount = availableTags.length;
            availableTags = availableTags.filter(tag => tag !== parentConnectionTag);
        }
        
        const selectedTags = availableTags.slice(0, tagsPerLevel);
        
        // If we don't have enough tags after filtering, show a message
        if (selectedTags.length === 0) {
            return;
        }
        
        selectedTags.forEach((tag, tagIndex) => {
            setTimeout(async () => {
                // Emit event to generate tracks for this tag
                this.emitEvent('data:generate-tracks-with-tag', {
                    tag,
                    parentTrack,
                    callback: async (relatedTracks) => {
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
                                
                                // RULE ENFORCEMENT: Never create a node that already exists in tree or playlist
                                // (This is handled by DataService exclusion logic, but double-check for safety)
                                if (this._shouldExcludeTrack(childTrack)) {
                                    return; // Skip this track
                                }
                                
                                // Emit event to create child node
                                this.emitEvent('tree:create-child-node', {
                                    trackData: childTrack,
                                    parentNode,
                                    connectionTag: tag,
                                    callback: async (childNode) => {
                                        // Recursively build next level
                                        if (currentLevel < maxLevels) {
                                            setTimeout(async () => {
                                                await this.buildTreeLevel(childNode, childTrack, currentLevel + 1, maxLevels);
                                            }, animationDelay);
                                        }
                                    }
                                });
                            }, i * branchDelay);
                        }
                    }
                });
            }, tagIndex * (animationDelay + 200)); // Stagger each tag group
        });
        
        // Dynamic notifications based on actual max levels
        if (currentLevel === 1 && maxLevels > 1) {
            setTimeout(() => {
                this.emitEvent('notification:show', {
                    message: `Level ${currentLevel} complete! ${maxLevels > 2 ? 'Growing deeper...' : 'Final level growing...'}`,
                    type: 'info'
                });
            }, 1000);
        } else if (currentLevel === maxLevels) {
            setTimeout(() => {
                this.emitEvent('notification:show', {
                    message: `🌳 Your ${maxLevels}-level musical tree is complete! Click any tag to grow more branches.`,
                    type: 'success'
                });
            }, animationDelay * 2);
        }
    }

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
            const type = tagUtils.getTagType(tag);
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
    }

    /**
     * Add drag functionality to an element
     * @param {HTMLElement} element - The element to make draggable
     */
    addDragToElement(element) {
        if (!element) return;
        
        element.setAttribute('draggable', 'true');
        
        // Events are handled by document delegation, no need to add individual listeners
        this.emitEvent('dragdrop:element-made-draggable', {
            element
        });
    }

    /**
     * Get current drag state
     * @returns {Object} Current drag state
     */
    getDragState() {
        return {
            isDragActive: this.getState('dragdrop.isDragActive'),
            currentDragData: this.getState('dragdrop.currentDragData'),
            isTreeBuilding: this.getState('dragdrop.isTreeBuilding')
        };
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration values
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.setState('dragdrop.config', this.config);
        
        this.emitEvent('dragdrop:config-updated', {
            config: this.config
        });
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Setup bridges between DragDropService events and other services
     */
    setupServiceBridges() {
        
        // Bridge tree:create-root-node to TrackNodesService
        this.subscribeToEvent('tree:create-root-node', (data) => {
            
            // Get TrackNodesService via dependency injection
            const trackNodesService = this.getDependency('tracknodes');
            if (trackNodesService && typeof trackNodesService.createNode === 'function') {
                const rootNode = trackNodesService.createNode(data.trackData, data.x, data.y);
                this._currentRootNode = rootNode;
            } else {
                console.error('🔥 TrackNodesService not available');
            }
        });

        // Bridge tree:create-child-node to TrackNodesService
        this.subscribeToEvent('tree:create-child-node', (data) => {
            
            const trackNodesService = this.getDependency('tracknodes');
            if (trackNodesService && typeof trackNodesService.createNode === 'function') {
                const childNode = trackNodesService.createNode(
                    data.trackData, 
                    0, 0, 
                    data.parentNode || this._currentRootNode, 
                    data.connectionTag
                );
                if (data.callback) {
                    data.callback(childNode);
                }
            }
        });

        // Bridge data:generate-tracks-with-tag to DataService
        this.subscribeToEvent('data:generate-tracks-with-tag', (data) => {
            
            const dataService = this.getDependency('data');
            if (dataService) {
                dataService.generateTracksWithTag(data.tag, data.parentTrack).then(relatedTracks => {
                    if (data.callback) {
                        data.callback(relatedTracks);
                    }
                });
            } else {
                console.error('🔥 DataService not available');
            }
        });
    }


    /**
     * Check if a track should be excluded (delegates to DataService centralized logic)
     * @param {Object} track - Track to check
     * @returns {boolean} True if track should be excluded
     */
    _shouldExcludeTrack(track) {
        try {
            const dataService = this.getDependency('data');
            if (dataService && typeof dataService._shouldExcludeTrack === 'function') {
                return dataService._shouldExcludeTrack(track);
            }
            
            // Fallback: if DataService not available, assume track is not excluded
            console.warn('🔥 DataService not available for track exclusion check');
            return false;
        } catch (error) {
            console.error('🔥 Error checking track exclusion:', error);
            return false;
        }
    }
}

// Make available globally
window.DragDropService = DragDropService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragDropService;
}