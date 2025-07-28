/**
 * TagService - Centralized tag selection and management
 * Handles tag selection, multi-tag logic, and container management
 */
class TagService extends ServiceBase {
    constructor(stateManager, eventBus) {
        super(stateManager, eventBus);
        // Service-specific configuration
        this.config = {
            maxSelectedTags: 10,
            autoOpenContainers: true,
            preserveSourceTrack: true,
            selectionTimeout: 1000 // Visual feedback duration
        };
        // Tag type priorities for branch creation
        this.tagPriorities = {
            emotion: 1,
            energy: 2,
            mood: 3,
            style: 4,
            occasion: 5,
            weather: 6,
            intensity: 7,
            rating: 8,
            tempo: 9,
            vibe: 10
        };
        // Initialize validation rules
        this.validationRules = {
            tagValue: (value) => typeof value === 'string' && value.includes(':'),
            tagElement: (element) => element && element.dataset && element.dataset.tagValue
        };
    }
    /**
     * Initialize service and set up event listeners
     */
    initialize() {
        // Ensure tag state exists
        if (!this.getState('ui.selectedTags')) {
            this.setState('ui.selectedTags', new Set());
        }
        // Subscribe to tag state changes
        this.subscribeToState('ui.selectedTags', (selectedTags) => {
            this.onSelectedTagsChanged(selectedTags);
        });
        // Subscribe to tag source changes
        this.subscribeToState('app.currentTagSourceTrack', (sourceTrack) => {
            this.onTagSourceChanged(sourceTrack);
        });
        // Subscribe to external events
        this.subscribeToEvent('tag:click', (data) => {
            this.handleTagClick(data.element, data.tagValue);
        });
        this.subscribeToEvent('tags:clear', () => {
            this.clearSelection();
        });
        this.subscribeToEvent('container:open', (data) => {
            this.handleContainerOpen(data.tagValue, data.sourceTrack, data.container);
        });
    }
    /**
     * Handle tag element click with smart routing
     * @param {HTMLElement} tagElement - Clicked tag element
     * @param {string} tagValue - Tag value (type:value format)
     */
    async handleTagClick(tagElement, tagValue = null) {
        // Extract tag value from element if not provided
        if (!tagValue && tagElement) {
            tagValue = tagElement.dataset.tagValue;
        }
        // Validate input
        if (!this.validate({ tagValue }, { tagValue: this.validationRules.tagValue })) {
            return;
        }
        // Determine context and route accordingly
        const container = tagElement?.closest('.track-list-container');
        const trackNode = tagElement?.closest('.track-node');
        if (container) {
            // Tag clicked in container - open new container
            await this.openContainerForTag(tagValue, null, container);
            return;
        }
        if (trackNode) {
            // Tag clicked in track node - create branches
            await this.createBranchesForTag(tagValue, trackNode, tagElement);
            return;
        }
        // Regular tag selection
        await this.toggleTagSelection(tagValue, tagElement, trackNode?.id);
    }
    /**
     * Toggle tag selection state
     * @param {string} tagValue - Tag value to toggle
     * @param {HTMLElement} tagElement - Tag element for visual feedback
     * @param {string} sourceTrackId - Source track ID
     */
    async toggleTagSelection(tagValue, tagElement, sourceTrackId = null) {
        // Handle source track changes
        const currentSource = this.getState('app.currentTagSourceTrack');
        if (sourceTrackId && currentSource && currentSource !== sourceTrackId) {
            this.clearSelection();
        }
        if (sourceTrackId) {
            this.setState('app.currentTagSourceTrack', sourceTrackId);
        }
        // Get current selection
        const selectedTags = this.getSelectedTags();
        const isSelected = selectedTags.has(tagValue);
        if (isSelected) {
            // Remove tag from selection
            this.removeTagFromSelection(tagValue, tagElement);
        } else {
            // Add tag to selection
            this.addTagToSelection(tagValue, tagElement);
        }
        // Auto-open container if multiple tags selected
        if (this.config.autoOpenContainers && this.getSelectedTagsCount() > 0) {
            await this.openMultiTagContainer();
        }
    }
    /**
     * Add tag to selection
     * @param {string} tagValue - Tag value to add
     * @param {HTMLElement} tagElement - Tag element for visual feedback
     */
    addTagToSelection(tagValue, tagElement) {
        // Check selection limit
        if (this.getSelectedTagsCount() >= this.config.maxSelectedTags) {
            return;
        }
        const selectedTags = this.getSelectedTags();
        selectedTags.add(tagValue);
        this.setState('ui.selectedTags', selectedTags);
        // Visual feedback
        if (tagElement) {
            this.addVisualFeedback(tagElement, 'selected');
            this.updateGlobalTagElements(tagValue, 'add');
        }
        // Emit event
        this.emitEvent('tag:selected', {
            tagValue,
            selectedTags: Array.from(selectedTags),
            count: selectedTags.size
        });
        // Show notification
        const [type, value] = tagValue.split(':');
        this.emitEvent('notification:show', {
            message: `Added "${value}" to selection`,
            type: 'success'
        });
    }
    /**
     * Remove tag from selection
     * @param {string} tagValue - Tag value to remove
     * @param {HTMLElement} tagElement - Tag element for visual feedback
     */
    removeTagFromSelection(tagValue, tagElement) {
        const selectedTags = this.getSelectedTags();
        selectedTags.delete(tagValue);
        this.setState('ui.selectedTags', selectedTags);
        // Visual feedback
        if (tagElement) {
            this.removeVisualFeedback(tagElement, 'selected');
            this.updateGlobalTagElements(tagValue, 'remove');
        }
        // Emit event
        this.emitEvent('tag:deselected', {
            tagValue,
            selectedTags: Array.from(selectedTags),
            count: selectedTags.size
        });
        // Show notification
        const [type, value] = tagValue.split(':');
        this.emitEvent('notification:show', {
            message: `Removed "${value}" from selection`,
            type: 'info'
        });
    }
    /**
     * Clear all tag selections
     */
    clearSelection() {
        const selectedTags = this.getSelectedTags();
        const wasEmpty = selectedTags.size === 0;
        if (!wasEmpty) {
            // Clear state
            this.setState('ui.selectedTags', new Set());
            this.setState('app.currentTagSourceTrack', null);
            // Clear visual feedback
            this.clearAllVisualFeedback();
            // Emit event
            this.emitEvent('tags:cleared', {
                previousCount: selectedTags.size,
                clearedTags: Array.from(selectedTags)
            });
        }
    }
    /**
     * Create branches for a specific tag from a track node
     * @param {string} tagValue - Tag value for branches
     * @param {HTMLElement} trackNode - Source track node
     * @param {HTMLElement} tagElement - Clicked tag element
     */
    async createBranchesForTag(tagValue, trackNode, tagElement) {
        // Visual feedback
        if (tagElement) {
            this.addTemporaryFeedback(tagElement, 'selected', this.config.selectionTimeout);
        }
        // Emit event for tree service to handle branch creation
        this.emitEvent('tree:create-branches', {
            tagValue,
            sourceNode: trackNode,
            trackData: this.extractTrackDataFromNode(trackNode)
        });
        // Analytics event
        this.emitEvent('analytics:tag-branch-created', {
            tagValue,
            tagType: tagValue.split(':')[0],
            sourceTrack: trackNode.id
        });
    }
    /**
     * Open container for a specific tag
     * @param {string} tagValue - Tag value
     * @param {string} sourceTrack - Source track ID
     * @param {HTMLElement} container - Container element
     */
    async openContainerForTag(tagValue, sourceTrack, container) {
        // Set current container context
        this.setState('app.currentMultiTagContainer', container);
        // Emit event for container service
        this.emitEvent('container:open-for-tag', {
            tagValue,
            sourceTrack,
            container
        });
    }
    /**
     * Open multi-tag container with current selection
     */
    async openMultiTagContainer() {
        const selectedTags = Array.from(this.getSelectedTags());
        if (selectedTags.length === 0) {
            return;
        }
        // Generate tracks for selected tags
        this.emitEvent('data:generate-multi-tag-tracks', {
            tags: selectedTags,
            callback: (tracks) => {
                this.handleMultiTagTracks(tracks, selectedTags);
            }
        });
    }
    /**
     * Handle generated multi-tag tracks
     * @param {Array} tracks - Generated tracks
     * @param {Array} selectedTags - Selected tags
     */
    handleMultiTagTracks(tracks, selectedTags) {
        const tagDisplays = selectedTags.map(tag => tag.split(':')[1]).join(' + ');
        // Emit event for container creation
        this.emitEvent('container:create-multi-tag', {
            tracks,
            tags: selectedTags,
            displayName: tagDisplays,
            count: tracks.length
        });
        // Show notification
        this.emitEvent('notification:show', {
            message: `Showing ${tracks.length} tracks matching ${selectedTags.length} selected tag${selectedTags.length > 1 ? 's' : ''}!`,
            type: 'success'
        });
    }
    /**
     * Get current selected tags
     * @returns {Set} Selected tags set
     */
    getSelectedTags() {
        return this.getState('ui.selectedTags') || new Set();
    }
    /**
     * Get selected tags count
     * @returns {number} Number of selected tags
     */
    getSelectedTagsCount() {
        return this.getSelectedTags().size;
    }
    /**
     * Get selected tags as array
     * @returns {Array} Selected tags array
     */
    getSelectedTagsArray() {
        return Array.from(this.getSelectedTags());
    }
    /**
     * Check if a tag is selected
     * @param {string} tagValue - Tag value to check
     * @returns {boolean} Selection status
     */
    isTagSelected(tagValue) {
        return this.getSelectedTags().has(tagValue);
    }
    /**
     * Get current tag source track
     * @returns {string|null} Source track ID
     */
    getTagSourceTrack() {
        return this.getState('app.currentTagSourceTrack');
    }
    /**
     * Get tag priority for sorting
     * @param {string} tagValue - Tag value
     * @returns {number} Priority value
     */
    getTagPriority(tagValue) {
        const type = tagValue.split(':')[0];
        return this.tagPriorities[type] || 999;
    }
    /**
     * Sort tags by priority
     * @param {Array} tags - Tags to sort
     * @returns {Array} Sorted tags
     */
    sortTagsByPriority(tags) {
        return tags.sort((a, b) => this.getTagPriority(a) - this.getTagPriority(b));
    }
    // Visual feedback methods
    addVisualFeedback(element, className) {
        element?.classList.add(className);
    }
    removeVisualFeedback(element, className) {
        element?.classList.remove(className);
    }
    addTemporaryFeedback(element, className, duration) {
        if (!element) return;
        element.classList.add(className);
        setTimeout(() => {
            element.classList.remove(className);
        }, duration);
    }
    updateGlobalTagElements(tagValue, action) {
        const elements = document.querySelectorAll(`[data-tag-value="${tagValue}"]`);
        elements.forEach(element => {
            if (action === 'add') {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        });
    }
    clearAllVisualFeedback() {
        const selectedElements = document.querySelectorAll('.tag.selected');
        selectedElements.forEach(element => {
            element.classList.remove('selected');
        });
    }
    extractTrackDataFromNode(trackNode) {
        // Extract track data from DOM node
        // This would need to be implemented based on the actual DOM structure
        return {
            id: trackNode.id,
            title: trackNode.dataset.title || '',
            artist: trackNode.dataset.artist || '',
            tags: trackNode.dataset.tags ? trackNode.dataset.tags.split(',') : []
        };
    }
    /**
     * Handle selected tags changes
     * @private
     */
    onSelectedTagsChanged(selectedTags) {
        // Emit global change event
        this.emitEvent('tags:selection-changed', {
            selectedTags: Array.from(selectedTags),
            count: selectedTags.size
        });
    }
    /**
     * Handle tag source changes
     * @private
     */
    onTagSourceChanged(sourceTrack) {
        this.emitEvent('tags:source-changed', { sourceTrack });
    }
}
// Make available globally
window.TagService = TagService;
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagService;
}