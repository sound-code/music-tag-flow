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
        this.initializeSimpleTrackTooltips();
        
        // Remove any existing external track node tooltip
        this.removeExternalTrackNodeTooltip();
        
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
     * Render tooltip content
     * @param {Object} trackData - Track data
     * @param {HTMLElement} trackElement - Track element
     */
    renderTooltipContent(trackData, trackElement) {
        this.elements.tooltip.innerHTML = '';

        // Title
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #fff;';
        title.textContent = `${trackData.title} - ${trackData.artist}`;

        // Tags container
        const tagsContainer = document.createElement('div');
        tagsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;';

        trackData.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.textContent = tagUtils.getTagValue(tag);
            tagElement.style.cssText = `
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            `;

            const tagInfo = tagUtils.parseTag(tag);
            tagElement.className = `tooltip-tag tag-${tagInfo.type}`;

            // Tag click handler
            tagElement.addEventListener('click', async (e) => {
                e.stopPropagation();
                this.emitEvent('tag:click-from-tooltip', {
                    tag,
                    trackElement,
                    trackData
                });
                this.hideTooltip();
            });

            tagsContainer.appendChild(tagElement);
        });

        this.elements.tooltip.appendChild(title);
        this.elements.tooltip.appendChild(tagsContainer);
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
     * Initialize track node tooltip functionality with delay management
     */
    initializeTrackNodeTooltips() {
        // Use JavaScript to manage hover delays while keeping CSS tooltip styling
        document.addEventListener('mouseenter', (e) => {
            const trackNode = e.target.closest('.track-node');
            if (trackNode) {
                this.showTrackNodeTooltipWithDelay(trackNode);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            const trackNode = e.target.closest('.track-node');
            if (trackNode) {
                this.hideTrackNodeTooltipWithDelay(trackNode);
            }
        }, true);

        // Keep tooltip visible when hovering over it
        document.addEventListener('mouseenter', (e) => {
            const tagsContainer = e.target.closest('.tags-container');
            if (tagsContainer) {
                this.keepTooltipVisible(tagsContainer);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            const tagsContainer = e.target.closest('.tags-container');
            if (tagsContainer) {
                this.hideTooltipFromContainer(tagsContainer);
            }
        }, true);

        // Hide tooltip when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.track-node') && !e.target.closest('.tags-container')) {
                this.hideTrackNodeTooltipImmediate();
            }
        });

        // Hide all tooltips when scrolling
        document.addEventListener('scroll', () => {
            this.hideTrackNodeTooltipImmediate();
        }, true);
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
     * Create external tooltip element for track nodes
     */
    createTrackNodeTooltipElement() {
        if (this.elements.trackNodeTooltip) return;

        this.elements.trackNodeTooltip = document.createElement('div');
        this.elements.trackNodeTooltip.className = 'track-node-tooltip';
        this.elements.trackNodeTooltip.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, rgba(15, 15, 35, 0.98) 0%, rgba(30, 30, 60, 0.98) 100%);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            padding: 16px;
            min-width: 200px;
            max-width: 320px;
            z-index: 50000;
            display: none;
            opacity: 0;
            backdrop-filter: blur(20px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(99, 102, 241, 0.1);
            transition: opacity 0.2s ease;
            pointer-events: auto;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
                // Render tooltip content
                this.renderTrackNodeTooltipContent(trackData, trackNode);
                
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
     * Render track node tooltip content
     */
    renderTrackNodeTooltipContent(trackData, trackNode) {
        if (!this.elements.trackNodeTooltip) return;

        this.elements.trackNodeTooltip.innerHTML = '';

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
        tagsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';

        if (trackData.tags && trackData.tags.length > 0) {
            trackData.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tooltip-tag';
                tagElement.style.cssText = `
                    padding: 2px 5px;
                    border-radius: 4px;
                    font-size: 8px;
                    font-weight: 500;
                    color: white;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                    line-height: 1;
                    background: rgba(99, 102, 241, 0.7);
                `;
                tagElement.textContent = tag;

                // Add click handler
                tagElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.emitEvent('tag:click-from-track-node-tooltip', {
                        tag,
                        trackNode,
                        trackData
                    });
                    this.hideTrackNodeTooltipImmediate();
                });

                tagsContainer.appendChild(tagElement);
            });
        }

        this.elements.trackNodeTooltip.appendChild(title);
        this.elements.trackNodeTooltip.appendChild(tagsContainer);
    }

    /**
     * Show track node tooltip with delay (CSS-based)
     */
    showTrackNodeTooltipWithDelay(trackNode) {
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
            const tagsContainer = trackNode.querySelector('.tags-container');
            if (tagsContainer) {
                tagsContainer.classList.add('show-tooltip');
                this.currentActiveTooltip = trackNode;
            }
        }, this.config.tooltipDelay);
    }

    /**
     * Hide track node tooltip with delay (CSS-based)
     */
    hideTrackNodeTooltipWithDelay(trackNode) {
        // Clear any existing show timeout
        if (this.timeouts.trackNodeShow) {
            clearTimeout(this.timeouts.trackNodeShow);
            this.timeouts.trackNodeShow = null;
        }

        // Hide tooltip with delay
        this.timeouts.trackNodeHide = setTimeout(() => {
            const tagsContainer = trackNode.querySelector('.tags-container');
            if (tagsContainer && !tagsContainer.matches(':hover')) {
                tagsContainer.classList.remove('show-tooltip');
                if (this.currentActiveTooltip === trackNode) {
                    this.currentActiveTooltip = null;
                }
            }
        }, this.config.tooltipHideDelay);
    }

    /**
     * Keep tooltip visible when hovering over it
     */
    keepTooltipVisible(tagsContainer) {
        // Clear any hide timeout
        if (this.timeouts.trackNodeHide) {
            clearTimeout(this.timeouts.trackNodeHide);
            this.timeouts.trackNodeHide = null;
        }
        // Ensure tooltip stays visible
        tagsContainer.classList.add('show-tooltip');
    }

    /**
     * Hide tooltip when leaving container
     */
    hideTooltipFromContainer(tagsContainer) {
        // Hide immediately when leaving tooltip area
        setTimeout(() => {
            if (!tagsContainer.matches(':hover') && !tagsContainer.closest('.track-node').matches(':hover')) {
                tagsContainer.classList.remove('show-tooltip');
                this.currentActiveTooltip = null;
            }
        }, 50);
    }

    /**
     * Simple tooltip positioning on hover
     */
    initializeSimpleTooltips() {
        document.addEventListener('mouseenter', (e) => {
            const trackNode = e.target.closest('.track-node');
            if (trackNode) {
                const tagsContainer = trackNode.querySelector('.tags-container');
                if (tagsContainer) {
                    this.positionTooltipSimple(tagsContainer, trackNode);
                }
            }
        }, true);
    }
    
    /**
     * Super simple track tooltip system with external tooltip
     */
    initializeSimpleTrackTooltips() {
        // Create ONE external tooltip for all nodes
        const externalTooltip = document.createElement('div');
        externalTooltip.className = 'external-track-tooltip';
        externalTooltip.style.cssText = `
            position: fixed;
            display: none;
            background: rgba(15, 15, 35, 0.95);
            border-radius: 8px;
            padding: 8px;
            z-index: 999999999;
            min-width: 200px;
            max-width: 280px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            pointer-events: auto;
            color: white;
            font-size: 12px;
        `;
        document.body.appendChild(externalTooltip);

        let showTimeout = null;
        let hideTimeout = null;
        let currentNode = null;

        // Show tooltip on hover
        document.addEventListener('mouseenter', (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;
            
            const trackNode = e.target.closest('.track-node');
            if (trackNode) {
                clearTimeout(hideTimeout);
                currentNode = trackNode;

                showTimeout = setTimeout(() => {
                    const tagsContainer = trackNode.querySelector('.tags-container');
                    if (tagsContainer) {
                        // Copy content to external tooltip
                        externalTooltip.innerHTML = tagsContainer.innerHTML;
                        
                        // Ensure all tags have data-tag-value attribute
                        this.fixTooltipTagAttributes(externalTooltip);
                        
                        // Re-attach event listeners to tags
                        this.attachTooltipEventListeners(externalTooltip, trackNode);
                        
                        // Position below node
                        const rect = trackNode.getBoundingClientRect();
                        externalTooltip.style.left = `${rect.left + rect.width/2 - 140}px`;
                        externalTooltip.style.top = `${rect.bottom + 10}px`;
                        
                        externalTooltip.style.display = 'block';
                    }
                }, 300);
            }
        }, true);

        // Hide tooltip on leave
        document.addEventListener('mouseleave', (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;
            
            const trackNode = e.target.closest('.track-node');
            if (trackNode === currentNode || e.target === externalTooltip) {
                clearTimeout(showTimeout);
                
                hideTimeout = setTimeout(() => {
                    if (!externalTooltip.matches(':hover')) {
                        externalTooltip.style.display = 'none';
                        currentNode = null;
                    }
                }, 200);
            }
        }, true);

        // Keep tooltip visible when hovering over it
        externalTooltip.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
        });

        externalTooltip.addEventListener('mouseleave', () => {
            externalTooltip.style.display = 'none';
            currentNode = null;
        });
    }

    /**
     * Fix tag attributes in tooltip to ensure they work with Tags.toggleSelection
     */
    fixTooltipTagAttributes(tooltip) {
        const tagElements = tooltip.querySelectorAll('.tag, .tooltip-tag');
        tagElements.forEach(tagElement => {
            // If tag doesn't have data-tag-value, create it from textContent
            if (!tagElement.dataset.tagValue) {
                const tagText = tagElement.textContent || tagElement.getAttribute('data-tag');
                if (tagText) {
                    // Try to parse as category:value or use as-is
                    if (tagText.includes(':')) {
                        tagElement.dataset.tagValue = tagText;
                    } else {
                        // Try to find the full tag from the track's tags
                        const trackData = this.getTrackDataFromTooltipContext(tooltip);
                        if (trackData && trackData.tags) {
                            const fullTag = trackData.tags.find(tag => 
                                tag.includes(':') && tag.split(':')[1] === tagText
                            );
                            if (fullTag) {
                                tagElement.dataset.tagValue = fullTag;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Get track data context for tooltip
     */
    getTrackDataFromTooltipContext(tooltip) {
        // Find the current node being displayed
        const allNodes = document.querySelectorAll('.track-node');
        for (const node of allNodes) {
            if (node.dataset.track) {
                try {
                    return JSON.parse(node.dataset.track);
                } catch (e) {
                    continue;
                }
            }
        }
        return null;
    }

    /**
     * Attach event listeners to tags and input in external tooltip
     */
    attachTooltipEventListeners(tooltip, trackNode) {
        // Get track data from node's dataset (same as original system)
        let trackData = null;
        try {
            if (trackNode.dataset.track) {
                trackData = JSON.parse(trackNode.dataset.track);
            }
        } catch (error) {
            console.warn('Error parsing track data from node:', error);
            return;
        }
        
        if (!trackData) {
            console.warn('No track data found in node');
            return;
        }
        
        // Add click listeners to tags
        const tagElements = tooltip.querySelectorAll('.tag, .tooltip-tag');
        console.log('🔍 Found', tagElements.length, 'tag elements in tooltip');
        
        tagElements.forEach((tagElement, index) => {
            console.log(`🏷️ Tag ${index}:`, {
                textContent: tagElement.textContent,
                dataset: tagElement.dataset,
                className: tagElement.className
            });
            
            tagElement.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                console.log('🖱️ Tag clicked:', {
                    textContent: tagElement.textContent,
                    tagValue: tagElement.dataset.tagValue,
                    hasTagsModule: typeof Tags !== 'undefined',
                    hasToggleSelection: typeof Tags !== 'undefined' && Tags.toggleSelection
                });
                
                // Check if tag is inside track node (crucial for node generation)
                const parentTrackNode = tagElement.closest('.track-node');
                console.log('🏠 Parent track node found:', !!parentTrackNode);
                
                // Use existing Tags.toggleSelection system
                if (typeof Tags !== 'undefined' && Tags.toggleSelection) {
                    console.log('🚀 Calling Tags.toggleSelection with:', tagElement);
                    
                    // IMPORTANT: The tag needs to be inside a track-node for branch creation
                    if (!parentTrackNode) {
                        console.warn('⚠️ Tag is not inside a track-node, moving it there temporarily');
                        // Temporarily append to track node for the click
                        trackNode.appendChild(tagElement);
                    }
                    
                    await Tags.toggleSelection(tagElement);
                    console.log('✅ Tags.toggleSelection completed');
                } else {
                    console.error('❌ Tags.toggleSelection not available');
                }
                
                // Hide tooltip after click
                tooltip.style.display = 'none';
            });
        });
        
        // Add functionality to input field if present
        let inputElement = tooltip.querySelector('.tooltip-add-tag-input');
        console.log('📝 Input field found in tooltip:', !!inputElement);
        
        // If no input field exists, create one
        if (!inputElement) {
            console.log('➕ Creating input field manually');
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.placeholder = '+';
            inputElement.className = 'tooltip-add-tag-input';
            inputElement.style.cssText = `
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                color: white;
                background: rgba(0, 100, 255, 0.8);
                border: 2px solid rgba(255, 255, 255, 0.8);
                outline: none;
                transition: all 0.2s ease;
                cursor: text;
                text-transform: none;
                letter-spacing: 0.02em;
                line-height: 1.2;
                width: 100px;
                height: 24px;
                margin-top: 8px;
                display: block;
                position: relative;
                z-index: 999999;
                pointer-events: auto;
            `;
            tooltip.appendChild(inputElement);
            console.log('➕ Input element appended to tooltip:', inputElement);
        }
        
        if (inputElement) {
            console.log('🎯 Input element event listener attached');
            
            // Debug: Add focus event to test if input is working
            inputElement.addEventListener('focus', () => {
                console.log('🔍 Input field focused');
            });
            
            inputElement.addEventListener('blur', () => {
                console.log('🔍 Input field blurred');
            });
            
            inputElement.addEventListener('input', (e) => {
                console.log('🔍 Input value changed:', e.target.value);
            });
            
            inputElement.addEventListener('keydown', (e) => {
                console.log('⌨️ Keydown in tooltip input:', e.key);
            });
            
            // FORCE TEST: Add a test button to directly call addTagToNode
            const testButton = document.createElement('button');
            testButton.textContent = 'TEST';
            testButton.style.cssText = `
                background: red;
                color: white;
                border: none;
                padding: 2px 4px;
                margin-left: 5px;
                cursor: pointer;
            `;
            testButton.addEventListener('click', async (e) => {
                console.log('🧪 TEST BUTTON CLICKED - forcing addTagToNode call');
                const testTag = 'test:debug';
                
                if (typeof TrackNodes !== 'undefined' && TrackNodes.addTagToNode) {
                    console.log('🔧 TrackNodes.addTagToNode is available, calling...');
                    await TrackNodes.addTagToNode(trackNode, trackData, testTag);
                } else {
                    console.error('❌ TrackNodes.addTagToNode not available');
                }
            });
            
            tooltip.appendChild(testButton);
            
            inputElement.addEventListener('keypress', async (e) => {
                console.log('⌨️ Key pressed in tooltip input:', e.key);
                if (e.key === 'Enter') {
                    console.log('↩️ Enter key detected');
                    const newTag = e.target.value.trim();
                    console.log('🏷️ New tag value:', newTag);
                    if (newTag && newTag.includes(':')) {
                        console.log('✅ Tag format valid (contains :)');
                        // Use existing TrackNodes.addTagToNode system
                        if (typeof TrackNodes !== 'undefined' && TrackNodes.addTagToNode) {
                            console.log('🔧 TrackNodes.addTagToNode is available');
                            console.log('💾 Adding tag to database:', {
                                newTag,
                                trackData: {
                                    title: trackData.title,
                                    artist: trackData.artist,
                                    album: trackData.album,
                                    isGenerated: trackData.generated || (trackData.id && trackData.id.startsWith('generated_'))
                                }
                            });
                            
                            await TrackNodes.addTagToNode(trackNode, trackData, newTag);
                            
                            console.log('✅ TrackNodes.addTagToNode completed');
                            
                            // Force refresh tooltip with latest track data
                            setTimeout(() => {
                                try {
                                    // Get the updated track data from the node
                                    const updatedTrackData = JSON.parse(trackNode.dataset.track);
                                    
                                    // Get updated tags container or recreate
                                    const updatedTagsContainer = trackNode.querySelector('.tags-container');
                                    if (updatedTagsContainer) {
                                        tooltip.innerHTML = updatedTagsContainer.innerHTML;
                                        
                                        // Ensure all tags have proper data attributes
                                        this.fixTooltipTagAttributes(tooltip);
                                        
                                        // Re-attach all event listeners with updated data
                                        this.attachTooltipEventListeners(tooltip, trackNode);
                                        
                                        console.log('✅ Tooltip refreshed with updated tags:', updatedTrackData.tags);
                                    }
                                } catch (error) {
                                    console.error('❌ Error refreshing tooltip:', error);
                                }
                            }, 100); // Small delay to ensure DOM updates are complete
                        } else {
                            console.error('❌ TrackNodes.addTagToNode not available');
                        }
                        
                        e.target.value = '';
                    } else {
                        console.warn('⚠️ Invalid tag format. Must contain ":" (e.g., "mood:happy")');
                    }
                } else {
                    console.log('ℹ️ Key other than Enter pressed:', e.key);
                }
            });
        }
    }

}

// Make available globally
window.UIService = UIService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIService;
}