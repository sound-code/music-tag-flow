/**
 * UIService - User Interface management
 * Handles tooltips, legend popups, visual effects, and category highlighting
 */
class UIService extends ServiceBase {
    constructor(stateManager, eventBus) {
        // Must call super() first in ES6+ classes
        super(stateManager, eventBus);
        
        // Service-specific configuration
        this.config = {
            tooltipDelay: 500, // ms
            tooltipHideDelay: 200, // ms
            legendPopupDelay: 300, // ms
            notificationEffectDuration: 300, // ms
            colorFixInterval: 5000 // ms
        };
        
        // UI element references
        this.elements = {
            tooltip: null,
            legendPopup: null,
            trackNodeTooltip: null
        };
        
        // State tracking
        this.currentHoverTarget = null;
        this.highlightedCategories = new Set();
        
        // Timeout management
        this.timeouts = {
            show: null,
            hide: null,
            legendShow: null,
            legendHide: null,
            trackNodeShow: null,
            trackNodeHide: null
        };
        
        // Validation rules
        this.validationRules = {
            category: (cat) => typeof cat === 'string' && cat.length > 0,
            trackElement: (el) => el && el.dataset && el.dataset.track
        };
        
        // Reinitialize after properties are set up
        this.initialize();
    }

    /**
     * Initialize UI service
     */
    initialize() {
        // Check if properties are properly initialized (avoid double initialization)
        if (!this.config || !this.elements || !this.timeouts) {
            // Properties not ready yet - skip initialization
            return;
        }

        // Initialize UI state
        if (!this.getState('ui.highlightedCategories')) {
            this.setState('ui.highlightedCategories', new Set());
        }
        if (!this.getState('ui.currentHoverTarget')) {
            this.setState('ui.currentHoverTarget', null);
        }

        // Subscribe to state changes
        this.subscribeToState('ui.highlightedCategories', (categories) => {
            this.onHighlightedCategoriesChanged(categories);
        });

        // Subscribe to events
        this.subscribeToEvent('ui:tooltip-show', (data) => {
            this.showTooltip(data.element, data.event);
        });
        this.subscribeToEvent('ui:tooltip-hide', () => {
            this.hideTooltip();
        });
        this.subscribeToEvent('ui:legend-show', (data) => {
            this.showLegendPopup(data.category, data.event);
        });
        this.subscribeToEvent('ui:legend-hide', () => {
            this.hideLegendPopup();
        });
        this.subscribeToEvent('ui:category-toggle', (data) => {
            this.toggleCategoryHighlight(data.category, data.element);
        });
        this.subscribeToEvent('ui:clear-highlights', () => {
            this.clearCategoryHighlight();
        });
        this.subscribeToEvent('ui:notification', (data) => {
            this.handleNotificationVisualEffects(data);
        });

        // Initialize UI components
        this.initializeTooltips();
        
        // Remove any existing external track node tooltip before creating new one
        this.removeExternalTrackNodeTooltip();
        
        this.initializeSimpleTrackTooltips(); // Create track node tooltips
        
        // NOTE: Legend popups handled by legacy ui.js to avoid duplication
        // this.initializeLegendPopups(); 
        this.initializeVisualEffects();
        this.setupEventListeners();
    }

    /**
     * Initialize tooltip system
     */
    initializeTooltips() {
        // Check if DOM is ready
        if (typeof document === 'undefined') {
            return;
        }
        
        try {
            this.createTooltipElement();
            this.setupTooltipEventListeners();
        } catch (error) {
            console.warn('UIService: Could not initialize tooltips:', error);
        }
    }

    /**
     * Create tooltip DOM element
     */
    createTooltipElement() {
        if (this.elements.tooltip) return;

        this.elements.tooltip = document.createElement('div');
        this.elements.tooltip.className = 'track-tooltip';
        this.elements.tooltip.style.cssText = `
            position: absolute;
            background: rgba(45, 45, 45, 0.95);
            color: white;
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            opacity: 0;
            display: none;
            max-width: 300px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: opacity 0.2s ease;
            pointer-events: none;
        `;
        document.body.appendChild(this.elements.tooltip);

        // Tooltip hover behavior
        this.elements.tooltip.addEventListener('mouseenter', () => {
            if (this.timeouts.hide) {
                clearTimeout(this.timeouts.hide);
                this.timeouts.hide = null;
            }
        });

        this.elements.tooltip.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    /**
     * Setup tooltip event listeners
     */
    setupTooltipEventListeners() {
        document.addEventListener('mouseover', (e) => {
            // Skip track-node to avoid double tooltips (CSS hover handles track nodes now)
            const trackElement = e.target.closest('.track-item, .track-list-item');
            if (trackElement && trackElement !== this.currentHoverTarget && trackElement.dataset.track) {
                this.currentHoverTarget = trackElement;
                this.showTooltip(trackElement, e);
            }
        });

        document.addEventListener('mouseout', (e) => {
            // Skip track-node to avoid double tooltips (CSS hover handles track nodes now)
            const trackElement = e.target.closest('.track-item, .track-list-item');
            if (trackElement && trackElement === this.currentHoverTarget) {
                const relatedTarget = e.relatedTarget;
                if (!relatedTarget || (!trackElement.contains(relatedTarget) && !this.elements.tooltip.contains(relatedTarget))) {
                    setTimeout(() => {
                        if (this.currentHoverTarget === trackElement && 
                            !this.elements.tooltip.matches(':hover') && 
                            !trackElement.matches(':hover')) {
                            this.hideTooltip();
                        }
                    }, 50);
                }
            }
        });
    }

    /**
     * Show tooltip for track element
     * @param {HTMLElement} trackElement - Track element to show tooltip for
     * @param {Event} event - Mouse event
     */
    showTooltip(trackElement, event) {
        if (!this.validate({ trackElement }, { trackElement: this.validationRules.trackElement })) {
            return;
        }

        // Clear existing timeouts
        if (this.timeouts.hide) {
            clearTimeout(this.timeouts.hide);
            this.timeouts.hide = null;
        }
        if (this.timeouts.show) {
            clearTimeout(this.timeouts.show);
        }

        this.timeouts.show = setTimeout(() => {
            try {
                const trackData = JSON.parse(trackElement.dataset.track);
                if (trackData.tags && trackData.tags.length > 0) {
                    this.renderTooltipContent(trackData, trackElement);
                    this.positionTooltip(trackElement);
                    this.elements.tooltip.style.display = 'block';
                    this.elements.tooltip.style.pointerEvents = 'auto';
                    setTimeout(() => {
                        if (this.elements.tooltip.style.display === 'block') {
                            this.elements.tooltip.style.opacity = '1';
                        }
                    }, 10);
                }
            } catch (error) {
                // Invalid track data
            }
        }, this.config.tooltipDelay);
    }

    /**
     * Centralized tooltip renderer for both library tracks and tree nodes
     * @param {HTMLElement} tooltipContainer - The tooltip container element
     * @param {Object} trackData - Track data
     * @param {HTMLElement} trackElement - Track element (library track or tree node)
     * @param {string} tooltipType - Type of tooltip ('library' or 'node')
     */
    renderUnifiedTooltipContent(tooltipContainer, trackData, trackElement, tooltipType = 'library') {
        tooltipContainer.innerHTML = '';

        // Title
        const title = document.createElement('div');
        title.className = 'tooltip-title';
        title.style.cssText = `
            color: #ffffff;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 12px;
            line-height: 1.3;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 8px;
        `;
        title.textContent = `${trackData.title} - ${trackData.artist}`;

        // Tags container
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tooltip-tags';
        tagsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;';

        if (trackData.tags && trackData.tags.length > 0) {
            trackData.tags.forEach(tagWithValue => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tooltip-tag';
                tagElement.dataset.tagValue = tagWithValue;
                
                // Get the tag display value (remove type: prefix)
                const tagValue = tagWithValue.includes(':') ? tagWithValue.split(':')[1] : tagWithValue;
                
                tagElement.style.cssText = `
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 500;
                    color: white;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                    line-height: 1;
                    background: rgba(99, 102, 241, 0.7);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                `;
                
                tagElement.style.setProperty('background', this.getTagColor(tagWithValue), 'important');
                tagElement.textContent = tagValue;

                // Tag click handler - different behavior for library vs node tooltips
                tagElement.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (tooltipType === 'library') {
                        // For library track items, delegate to Tags.toggleSelection
                        if (typeof Tags !== 'undefined' && Tags.toggleSelection) {
                            const tempTag = document.createElement('div');
                            tempTag.className = `tag ${tagWithValue.split(':')[0]}`;
                            tempTag.dataset.tagValue = tagWithValue;
                            tempTag.textContent = tagValue;
                            
                            trackElement.appendChild(tempTag);
                            await Tags.toggleSelection(tempTag);
                            tempTag.remove();
                        }
                        this.hideTooltip();
                    } else if (tooltipType === 'node') {
                        // For tree nodes, delegate to TrackNodesService for branch creation
                        if (window.App && window.App.getService) {
                            const trackNodesService = window.App.getService('tracknodes');
                            if (trackNodesService && typeof trackNodesService.handleTagElementClick === 'function') {
                                trackNodesService.handleTagElementClick(tagWithValue, trackElement, trackData, tagElement);
                            }
                        }
                        this.hideTrackNodeTooltipImmediate();
                    }
                });

                tagsContainer.appendChild(tagElement);
            });
        }

        // Add input for new tags
        const addTagInput = document.createElement('input');
        addTagInput.type = 'text';
        addTagInput.placeholder = 'categoria:valore';
        addTagInput.className = 'tooltip-add-tag-input';
        addTagInput.style.cssText = `
            margin-top: 8px;
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 11px;
            color: white;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            outline: none;
            width: 100%;
            box-sizing: border-box;
        `;
        
        // Handle Enter key for adding new tag
        addTagInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newTag = addTagInput.value.trim();
                
                if (newTag && newTag.includes(':')) {
                    try {
                        // Add tag to track data
                        if (!trackData.tags.includes(newTag)) {
                            trackData.tags.push(newTag);
                            
                            // Update the track element's dataset
                            trackElement.dataset.track = JSON.stringify(trackData);
                            
                            // Save to database
                            if (typeof DataSourceAdapter !== 'undefined' && DataSourceAdapter.addTagToTrack) {
                                await DataSourceAdapter.addTagToTrack(trackData, newTag);
                            } else if (typeof DataLoader !== 'undefined' && DataLoader.addTagToTrack) {
                                await DataLoader.addTagToTrack(trackData, newTag);
                            }
                            
                            // Clear input and hide tooltip
                            addTagInput.value = '';
                            
                            if (tooltipType === 'library') {
                                this.hideTooltip();
                            } else {
                                this.hideTrackNodeTooltipImmediate();
                                
                                // For tree nodes, emit event for potential tree updates
                                const eventBus = window.App?.getService('eventbus');
                                if (eventBus && typeof eventBus.emit === 'function') {
                                    eventBus.emit('tracknode:tag-added', {
                                        node: trackElement,
                                        track: trackData,
                                        newTag: newTag
                                    });
                                }
                            }
                            
                            // Show success notification
                            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                                Utils.showNotification(`Tag "${newTag}" aggiunto a "${trackData.title}"`);
                            }
                        } else {
                            // Tag already exists
                            addTagInput.style.borderColor = '#fbbf24';
                            addTagInput.placeholder = 'Tag già presente';
                            setTimeout(() => {
                                addTagInput.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                                addTagInput.placeholder = 'categoria:valore';
                            }, 2000);
                        }
                    } catch (error) {
                        console.error('Error adding tag:', error);
                        // Show error feedback
                        addTagInput.style.borderColor = '#ef4444';
                        addTagInput.placeholder = 'Errore durante aggiunta tag';
                        setTimeout(() => {
                            addTagInput.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            addTagInput.placeholder = 'categoria:valore';
                        }, 2000);
                    }
                } else {
                    // Show error feedback
                    addTagInput.style.borderColor = '#ef4444';
                    addTagInput.placeholder = 'Formato: categoria:valore';
                    setTimeout(() => {
                        addTagInput.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                        addTagInput.placeholder = 'categoria:valore';
                    }, 2000);
                }
            }
        });

        tooltipContainer.appendChild(title);
        tooltipContainer.appendChild(tagsContainer);
        tooltipContainer.appendChild(addTagInput);
    }

    /**
     * Render tooltip content for library tracks (uses centralized renderer)
     * @param {Object} trackData - Track data
     * @param {HTMLElement} trackElement - Track element
     */
    renderTooltipContent(trackData, trackElement) {
        this.renderUnifiedTooltipContent(this.elements.tooltip, trackData, trackElement, 'library');
    }

    /**
     * Position tooltip near element
     * @param {HTMLElement} element - Element to position near
     */
    positionTooltip(element) {
        if (!this.elements.tooltip) return;

        const elementRect = element.getBoundingClientRect();
        const tooltipRect = this.elements.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = elementRect.right + 10;
        let y = elementRect.top;

        // Adjust if tooltip goes off screen
        if (x + tooltipRect.width > viewportWidth) {
            x = elementRect.left - tooltipRect.width - 10;
        }
        if (y + tooltipRect.height > viewportHeight) {
            y = viewportHeight - tooltipRect.height - 10;
        }
        if (y < 15) {
            y = elementRect.bottom + 10;
        }
        if (x < 15) {
            x = 15;
        }

        this.elements.tooltip.style.left = `${x}px`;
        this.elements.tooltip.style.top = `${y}px`;
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.timeouts.show) {
            clearTimeout(this.timeouts.show);
            this.timeouts.show = null;
        }

        this.timeouts.hide = setTimeout(() => {
            if (this.elements.tooltip) {
                this.elements.tooltip.style.opacity = '0';
                this.elements.tooltip.style.pointerEvents = 'none';
                setTimeout(() => {
                    if (this.elements.tooltip.style.opacity === '0') {
                        this.elements.tooltip.style.display = 'none';
                        this.elements.tooltip.innerHTML = '';
                        // Move tooltip out of the way when hidden
                        this.elements.tooltip.style.left = '-9999px';
                        this.elements.tooltip.style.top = '-9999px';
                    }
                }, 200);
            }
            this.currentHoverTarget = null;
        }, this.config.tooltipHideDelay);
    }

    /**
     * Initialize legend popup system
     */
    initializeLegendPopups() {
        // Check if DOM is ready
        if (typeof document === 'undefined') {
            return;
        }
        
        try {
            this.createLegendPopupElement();
            this.setupLegendEventListeners();
        } catch (error) {
            console.warn('UIService: Could not initialize legend popups:', error);
        }
    }

    // Legend functionality removed - handled by ui.js to avoid conflicts

    /**
     * Handle notification visual effects
     * @param {Object} data - Notification data
     */
    handleNotificationVisualEffects(data) {
        const { type } = data;

        switch (type) {
            case 'success':
                this.addSuccessEffect();
                break;
            case 'error':
                this.addErrorEffect();
                break;
            case 'warning':
                this.addWarningEffect();
                break;
        }
    }

    /**
     * Add success visual effect
     */
    addSuccessEffect() {
        const canvas = document.querySelector('.mindmap-canvas');
        if (canvas) {
            canvas.style.filter = 'brightness(1.1) hue-rotate(120deg)';
            setTimeout(() => {
                canvas.style.filter = '';
            }, this.config.notificationEffectDuration);
        }
    }

    /**
     * Add error visual effect
     */
    addErrorEffect() {
        const canvas = document.querySelector('.mindmap-canvas');
        if (canvas) {
            canvas.style.filter = 'brightness(1.1) hue-rotate(-30deg)';
            setTimeout(() => {
                canvas.style.filter = '';
            }, this.config.notificationEffectDuration);
        }
    }

    /**
     * Add warning visual effect
     */
    addWarningEffect() {
        const canvas = document.querySelector('.mindmap-canvas');
        if (canvas) {
            canvas.style.filter = 'brightness(1.1) hue-rotate(30deg)';
            setTimeout(() => {
                canvas.style.filter = '';
            }, this.config.notificationEffectDuration);
        }
    }

    /**
     * Initialize visual effects
     */
    initializeVisualEffects() {
        // Check if DOM is ready
        if (typeof document === 'undefined') {
            return;
        }
        
        try {
            this.setupColorFixes();
        } catch (error) {
            console.warn('UIService: Could not initialize visual effects:', error);
        }
    }

    /**
     * Setup color fixes for legend text
     */
    setupColorFixes() {
        const fixColors = () => {
            document.querySelectorAll('.legend-item span').forEach(span => {
                span.style.color = 'white';
                span.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';
            });

            document.querySelectorAll('.legend-popup-tag').forEach(tag => {
                tag.style.color = 'white';
                tag.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';
            });
        };

        fixColors();
        setTimeout(fixColors, 1000);
        setTimeout(fixColors, 3000);
        setInterval(fixColors, this.config.colorFixInterval);
    }

    /**
     * Setup general event listeners
     */
    setupEventListeners() {
        // Data loading complete - refresh tooltip listeners
        this.subscribeToEvent('data:loading:complete', () => {
            setTimeout(() => {
                this.refreshTooltipListeners();
            }, 100);
        });
    }

    /**
     * Refresh tooltip listeners after dynamic content changes
     */
    refreshTooltipListeners() {
        // The mouseover/mouseout listeners are already set on document
        // so they will catch new elements automatically
    }

    /**
     * Get category from legend item element
     * @param {HTMLElement} legendItem - Legend item element
     * @returns {string|null} Category name
     */
    getCategoryFromLegendItem(legendItem) {
        const colorElement = legendItem.querySelector('.legend-color');
        if (colorElement) {
            const classList = Array.from(colorElement.classList);
            // Look for category-specific legend classes (with legend- prefix)
            const categoryClasses = ['legend-emotion', 'legend-energy', 'legend-mood', 'legend-style', 
                                   'legend-occasion', 'legend-weather', 'legend-intensity', 'legend-rating', 
                                   'legend-tempo', 'legend-vibe'];
            
            const legendClass = classList.find(cls => categoryClasses.includes(cls));
            if (legendClass) {
                return legendClass.replace('legend-', '');
            }
        }
        return null;
    }

    /**
     * Show legend popup for category
     * @param {string} category - Category name
     * @param {Event} event - Mouse event
     */
    showLegendPopup(category, event) {
        // Define example tags for each category (should match legacy ui.js)
        const categoryTags = {
            emotion: ['excited', 'mysterious', 'empowering', 'vulnerable', 'romantic', 'sassy'],
            energy: ['high', 'laid-back', 'vibrant', 'intimate', 'bold', 'minimal'],
            mood: ['confident', 'melancholic', 'euphoric', 'playful', 'smooth', 'dark'],
            style: ['pop', 'disco', 'alternative', 'indie', 'hip-hop', 'r&b'],
            occasion: ['dance', 'solitude', 'freedom', 'rebellion', 'self-care', 'club'],
            weather: ['golden', 'shadow', 'clarity', 'sparkle', 'quiet', 'stormy'],
            intensity: ['powerful', 'emotional', 'deep', 'fierce', 'determined', 'gentle'],
            rating: ['hit', 'viral', 'beautiful', 'anthem', 'unstoppable', 'classic'],
            tempo: ['ballad', 'anthem', 'hypnotic', 'driving', 'perfect', 'slow'],
            vibe: ['edgy', 'weightless', 'growth', 'independent', 'fragile', 'cosmic']
        };

        const tags = categoryTags[category];
        if (!tags || !this.elements.legendPopup) {
            return;
        }

        // Create popup content
        this.elements.legendPopup.innerHTML = '';
        
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #fff;';
        title.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} Tags`;

        const tagsContainer = document.createElement('div');
        tagsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.textContent = tag;
            tagElement.style.cssText = `
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                color: white;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
            `;
            tagElement.className = `legend-popup-tag tag-${category}`;
            tagsContainer.appendChild(tagElement);
        });

        this.elements.legendPopup.appendChild(title);
        this.elements.legendPopup.appendChild(tagsContainer);

        // Position and show popup
        this.updateLegendPopupPosition(event);
        this.elements.legendPopup.style.display = 'block';
        this.elements.legendPopup.style.opacity = '1';
    }

    /**
     * Hide legend popup
     */
    hideLegendPopup() {
        if (this.elements.legendPopup) {
            this.elements.legendPopup.style.display = 'none';
            setTimeout(() => {
                this.elements.legendPopup.innerHTML = '';
            }, 100);
        }
    }

    /**
     * Update legend popup position
     * @param {Event} event - Mouse event
     */
    updateLegendPopupPosition(event) {
        if (!this.elements.legendPopup) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let x = event.clientX + 15;
        let y = event.clientY - 10;

        const popupRect = this.elements.legendPopup.getBoundingClientRect();

        if (x + popupRect.width > viewportWidth) {
            x = event.clientX - popupRect.width - 15;
        }

        if (y + popupRect.height > viewportHeight) {
            y = event.clientY - popupRect.height + 10;
        }

        x = Math.max(10, x);
        y = Math.max(10, y);

        this.elements.legendPopup.style.left = `${x}px`;
        this.elements.legendPopup.style.top = `${y}px`;
    }

    /**
     * Toggle category highlight
     * @param {string} category - Category to toggle
     * @param {HTMLElement} legendItem - Legend item element
     */
    toggleCategoryHighlight(category, legendItem) {
        if (!this.validate({ category }, { category: this.validationRules.category })) {
            return;
        }

        const currentCategories = this.getState('ui.highlightedCategories') || new Set();
        
        if (currentCategories.has(category)) {
            currentCategories.delete(category);
            legendItem?.classList.remove('legend-active');
        } else {
            currentCategories.add(category);
            legendItem?.classList.add('legend-active');
        }

        this.setState('ui.highlightedCategories', currentCategories);
        this.highlightedCategories = currentCategories;

        // Emit events for other components to handle visual updates
        this.emitEvent('ui:category-highlight-changed', {
            category,
            isHighlighted: currentCategories.has(category),
            allCategories: Array.from(currentCategories)
        });
    }

    /**
     * Clear category highlights
     */
    clearCategoryHighlight() {
        const currentCategories = this.getState('ui.highlightedCategories') || new Set();
        if (currentCategories.size === 0) return;

        this.setState('ui.highlightedCategories', new Set());
        this.highlightedCategories = new Set();

        // Remove visual indicators
        const activeLegendItems = document.querySelectorAll('.legend-active');
        activeLegendItems.forEach(item => {
            item.classList.remove('legend-active');
        });

        this.emitEvent('ui:category-highlights-cleared', {
            clearedCategories: Array.from(currentCategories)
        });
    }

    /**
     * Handle highlighted categories state change
     * @param {Set} categories - New categories set
     */
    onHighlightedCategoriesChanged(categories) {
        this.emitEvent('ui:highlighted-categories-changed', {
            categories: Array.from(categories),
            count: categories.size
        });
    }

    /**
     * Get current highlighted categories
     * @returns {Set} Highlighted categories
     */
    getHighlightedCategories() {
        return this.getState('ui.highlightedCategories') || new Set();
    }

    /**
     * Check if category is highlighted
     * @param {string} category - Category to check
     * @returns {boolean} Is highlighted
     */
    isCategoryHighlighted(category) {
        const categories = this.getHighlightedCategories();
        return categories.has(category);
    }


    /**
     * Remove external track node tooltip if it exists
     */
    removeExternalTrackNodeTooltip() {
        if (this.elements.trackNodeTooltip) {
            this.elements.trackNodeTooltip.remove();
            this.elements.trackNodeTooltip = null;
        }
        
        // Clear any active timeouts
        if (this.timeouts.trackNodeShow) {
            clearTimeout(this.timeouts.trackNodeShow);
            this.timeouts.trackNodeShow = null;
        }
        if (this.timeouts.trackNodeHide) {
            clearTimeout(this.timeouts.trackNodeHide);
            this.timeouts.trackNodeHide = null;
        }
        
        this.currentActiveTooltip = null;
    }


    /**
     * Get track data from track node element
     */
    getTrackDataFromNode(trackNode) {
        // Try to get track data from various possible sources
        const titleElement = trackNode.querySelector('.title');
        const artistElement = trackNode.querySelector('.artist');
        
        if (titleElement && artistElement) {
            // Try to find tags from the node's dataset or other sources
            const title = titleElement.textContent;
            const artist = artistElement.textContent;
            
            // Look for tags in the tags-container
            const tagsContainer = trackNode.querySelector('.tags-container');
            let tags = [];
            
            if (tagsContainer) {
                const tagElements = tagsContainer.querySelectorAll('.tooltip-tag, .tag');
                tags = Array.from(tagElements).map(el => {
                    // Try to get tag from various attributes
                    return el.dataset.tag || el.textContent || el.getAttribute('data-value');
                }).filter(Boolean);
            }

            return {
                title: title,
                artist: artist,
                album: 'Unknown Album', // Track nodes might not have album info
                tags: tags
            };
        }
        
        return null;
    }


    
    /**
     * Initialize track node tooltips with external tooltip system
     */
    initializeSimpleTrackTooltips() {
        // Create external tooltip element for track nodes
        this.createTrackNodeTooltipElement();

        // Track current active tooltip
        this.currentActiveTooltip = null;

        // Add event delegation for track nodes
        document.addEventListener('mouseenter', (e) => {
            if (e.target && e.target.closest) {
                const trackNode = e.target.closest('.track-node');
                if (trackNode) {
                    this.showTrackNodeTooltip(trackNode);
                }
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            if (e.target && e.target.closest) {
                const trackNode = e.target.closest('.track-node');
                if (trackNode) {
                    this.hideTrackNodeTooltip(trackNode);
                }
            }
        }, true);
    }

    /**
     * Create external tooltip element for track nodes
     */
    createTrackNodeTooltipElement() {
        if (this.elements.trackNodeTooltip) return;

        this.elements.trackNodeTooltip = document.createElement('div');
        this.elements.trackNodeTooltip.className = 'track-node-tooltip';
        this.elements.trackNodeTooltip.style.cssText = `
            position: fixed;
            background: rgba(15, 15, 35, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 8px;
            min-width: 200px;
            max-width: 280px;
            z-index: 50000;
            display: none;
            opacity: 0;
            backdrop-filter: blur(20px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: opacity 0.2s ease;
            pointer-events: auto;
        `;
        document.body.appendChild(this.elements.trackNodeTooltip);

        // Add hover events to keep tooltip visible
        this.elements.trackNodeTooltip.addEventListener('mouseenter', () => {
            if (this.timeouts.trackNodeHide) {
                clearTimeout(this.timeouts.trackNodeHide);
                this.timeouts.trackNodeHide = null;
            }
        });

        this.elements.trackNodeTooltip.addEventListener('mouseleave', () => {
            this.hideTrackNodeTooltipImmediate();
        });
    }

    /**
     * Show track node tooltip with delay
     */
    showTrackNodeTooltip(trackNode) {
        // Hide any currently active tooltip first
        if (this.currentActiveTooltip && this.currentActiveTooltip !== trackNode) {
            this.hideTrackNodeTooltipImmediate();
        }

        // Clear any existing hide timeout
        if (this.timeouts.trackNodeHide) {
            clearTimeout(this.timeouts.trackNodeHide);
            this.timeouts.trackNodeHide = null;
        }

        // Show tooltip with delay
        this.timeouts.trackNodeShow = setTimeout(() => {
            if (!this.elements.trackNodeTooltip) return;

            // Get track data from node
            const trackData = this.getTrackDataFromNode(trackNode);
            if (trackData && trackData.tags && trackData.tags.length > 0) {
                // Render tooltip content using centralized renderer
                this.renderUnifiedTooltipContent(this.elements.trackNodeTooltip, trackData, trackNode, 'node');
                
                // Position tooltip
                this.positionTrackNodeTooltip(trackNode);
                
                // Show tooltip
                this.elements.trackNodeTooltip.style.display = 'block';
                setTimeout(() => {
                    if (this.elements.trackNodeTooltip.style.display === 'block') {
                        this.elements.trackNodeTooltip.style.opacity = '1';
                    }
                }, 10);

                this.currentActiveTooltip = trackNode;
            }
        }, this.config.tooltipDelay);
    }

    /**
     * Hide track node tooltip with delay
     */
    hideTrackNodeTooltip(trackNode) {
        // Clear any existing show timeout
        if (this.timeouts.trackNodeShow) {
            clearTimeout(this.timeouts.trackNodeShow);
            this.timeouts.trackNodeShow = null;
        }

        // Hide tooltip with delay
        this.timeouts.trackNodeHide = setTimeout(() => {
            this.hideTrackNodeTooltipImmediate();
        }, this.config.tooltipHideDelay);
    }

    /**
     * Hide track node tooltip immediately (no delay)
     */
    hideTrackNodeTooltipImmediate() {
        if (this.elements.trackNodeTooltip) {
            this.elements.trackNodeTooltip.style.opacity = '0';
            setTimeout(() => {
                if (this.elements.trackNodeTooltip.style.opacity === '0') {
                    this.elements.trackNodeTooltip.style.display = 'none';
                    this.elements.trackNodeTooltip.innerHTML = '';
                }
            }, 200);
            this.currentActiveTooltip = null;
        }
    }

    /**
     * Get track data from track node element
     */
    getTrackDataFromNode(trackNode) {
        try {
            // First try to get track data from dataset (preferred method)
            if (trackNode.dataset.track) {
                return JSON.parse(trackNode.dataset.track);
            }

            // Fallback: extract from DOM elements
            const titleElement = trackNode.querySelector('.title');
            const artistElement = trackNode.querySelector('.artist');
            
            if (titleElement && artistElement) {
                const title = titleElement.textContent;
                const artist = artistElement.textContent;
                
                // Look for tags in the tags-container
                const tagsContainer = trackNode.querySelector('.tags-container');
                let tags = [];
                
                if (tagsContainer) {
                    const tagElements = tagsContainer.querySelectorAll('.tooltip-tag, .tag');
                    tags = Array.from(tagElements).map(el => {
                        return el.dataset.tagValue || el.textContent || el.getAttribute('data-value');
                    }).filter(Boolean);
                }

                return {
                    title: title,
                    artist: artist,
                    album: 'Unknown Album',
                    tags: tags
                };
            }
        } catch (error) {
            console.warn('Error extracting track data from node:', error);
        }
        
        return null;
    }

    /**
     * Position track node tooltip
     */
    positionTrackNodeTooltip(trackNode) {
        if (!this.elements.trackNodeTooltip) return;

        const rect = trackNode.getBoundingClientRect();
        const tooltipRect = this.elements.trackNodeTooltip.getBoundingClientRect();
        
        // Position above the node by default
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let top = rect.top - tooltipRect.height - 10;
        
        // Adjust if tooltip would go off screen
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top < 10) {
            // Position below if no room above
            top = rect.bottom + 10;
        }
        
        this.elements.trackNodeTooltip.style.left = `${left}px`;
        this.elements.trackNodeTooltip.style.top = `${top}px`;
    }


    /**
     * Get track data from track node element
     */
    getTrackDataFromNode(trackNode) {
        try {
            // First try to get track data from dataset (preferred method)
            if (trackNode.dataset.track) {
                return JSON.parse(trackNode.dataset.track);
            }

            // Fallback: extract from DOM elements
            const titleElement = trackNode.querySelector('.title');
            const artistElement = trackNode.querySelector('.artist');
            
            if (titleElement && artistElement) {
                const title = titleElement.textContent;
                const artist = artistElement.textContent;
                
                // Look for tags in the tags-container
                const tagsContainer = trackNode.querySelector('.tags-container');
                let tags = [];
                
                if (tagsContainer) {
                    const tagElements = tagsContainer.querySelectorAll('.tooltip-tag, .tag');
                    tags = Array.from(tagElements).map(el => {
                        return el.dataset.tagValue || el.textContent || el.getAttribute('data-value');
                    }).filter(Boolean);
                }

                return {
                    title: title,
                    artist: artist,
                    album: 'Unknown Album',
                    tags: tags
                };
            }
        } catch (error) {
            console.warn('Error extracting track data from node:', error);
        }
        
        return null;
    }


    /**
     * Position track node tooltip
     */
    positionTrackNodeTooltip(trackNode) {
        if (!this.elements.trackNodeTooltip) return;

        const rect = trackNode.getBoundingClientRect();
        const tooltipRect = this.elements.trackNodeTooltip.getBoundingClientRect();
        
        // Position above the node by default
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let top = rect.top - tooltipRect.height - 10;
        
        // Adjust if tooltip would go off screen
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top < 10) {
            // Position below if no room above
            top = rect.bottom + 10;
        }
        
        this.elements.trackNodeTooltip.style.left = `${left}px`;
        this.elements.trackNodeTooltip.style.top = `${top}px`;
    }

    /**
     * Get color for a tag (fallback method)
     */
    getTagColor(tagWithValue) {
        // Use tagUtils if available
        if (typeof tagUtils !== 'undefined' && tagUtils.getTagColor) {
            return tagUtils.getTagColor(tagWithValue);
        }
        
        // Fallback colors
        const colors = {
            mood: '#FF6B6B',
            energy: '#4ECDC4', 
            emotion: '#45B7D1',
            style: '#96CEB4',
            vibe: '#FFEAA7',
            occasion: '#DDA0DD',
            tempo: '#98D8C8',
            weather: '#F7DC6F',
            intensity: '#BB8FCE',
            rating: '#F8C471'
        };
        
        const type = tagWithValue.includes(':') ? tagWithValue.split(':')[0] : 'unknown';
        return colors[type] || 'rgba(99, 102, 241, 0.7)';
    }


}

// Make available globally
window.UIService = UIService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIService;
}