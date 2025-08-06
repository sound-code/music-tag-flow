/**
 * UIService - User Interface management
 * Handles tooltips, legend popups, visual effects, and category highlighting
 */
class UIService extends ServiceBase {
    constructor(stateManager, eventBus, dependencies = {}) {
        // Must call super() first in ES6+ classes
        super(stateManager, eventBus, dependencies);
        
        // Service-specific configuration
        this.config = {
            tooltipDelay: 100, // ms (reduced for faster response)
            tooltipHideDelay: 250, // ms (balanced for interaction but not too slow) 
            legendPopupDelay: 150, // ms (ridotto da 300)
            notificationEffectDuration: 300, // ms
            colorFixInterval: 5000, // ms
            // Stili centralizzati per tutti i tooltip
            tooltipBaseStyles: {
                position: 'absolute',
                background: 'rgba(45, 45, 45, 0.95)',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                zIndex: '10000',
                opacity: '0',
                display: 'none',
                maxWidth: '300px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                transition: 'opacity 0.2s ease'
            }
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
        
        // DOM Query Cache
        this.domCache = new Map();
        this.domCacheTimeout = null;
        
        // Performance optimization properties
        this.highlightUpdateFrame = null;
        
        // Cleanup tracking
        this.colorFixInterval = null;
        this.documentListeners = [];
        
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
     * Setup DOM query caching system
     */
    setupDOMCache() {
        // Clear cache periodically to avoid stale references
        this.domCacheTimeout = setInterval(() => {
            this.clearDOMCache();
        }, 30000); // Clear every 30 seconds
        
        // Clear cache on tree changes
        this.subscribeToEvent('tree:cleared', () => this.clearDOMCache());
        this.subscribeToEvent('tree:node-added', () => this.clearDOMCache(['track-node', 'branch']));
    }
    
    /**
     * Get DOM element(s) with caching
     * @param {string} selector - CSS selector
     * @param {boolean} multiple - Whether to use querySelectorAll
     * @param {boolean} noCache - Skip caching for this query
     * @returns {HTMLElement|NodeList|null}
     */
    queryDOM(selector, multiple = false, noCache = false) {
        const cacheKey = `${selector}:${multiple}`;
        
        // Return cached result if available and caching is enabled
        if (!noCache && this.domCache.has(cacheKey)) {
            return this.domCache.get(cacheKey);
        }
        
        // Perform query
        const result = multiple ? 
            document.querySelectorAll(selector) : 
            document.querySelector(selector);
        
        // Cache result if caching is enabled
        if (!noCache && result) {
            this.domCache.set(cacheKey, result);
        }
        
        return result;
    }
    
    /**
     * Clear DOM cache
     * @param {Array<string>} patterns - Optional patterns to clear (clears all if not specified)
     */
    clearDOMCache(patterns = null) {
        if (!patterns) {
            this.domCache.clear();
        } else {
            // Clear only cache entries matching patterns
            for (const [key] of this.domCache) {
                if (patterns.some(pattern => key.includes(pattern))) {
                    this.domCache.delete(key);
                }
            }
        }
    }
    
    /**
     * Add document listener with cleanup tracking
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addDocumentListener(event, handler, options = false) {
        document.addEventListener(event, handler, options);
        this.documentListeners.push({ event, handler, options });
    }

    /**
     * Helper method to apply base tooltip styles
     * @param {HTMLElement} element - Element to style
     * @param {Object} overrides - Style overrides
     */
    applyTooltipStyles(element, overrides = {}) {
        const styles = { ...this.config.tooltipBaseStyles, ...overrides };
        const cssText = Object.entries(styles)
            .map(([key, value]) => {
                // Convert camelCase to kebab-case
                const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
                return `${cssKey}: ${value}`;
            })
            .join('; ');
        element.style.cssText = cssText;
    }

    /**
     * Hide all tooltips to ensure only one is active at a time
     * @param {string} except - Type to not hide ('library', 'node', 'legend')
     */
    hideAllTooltips(except = null) {
        if (except !== 'library') {
            this.hideTooltipImmediate();
        }
        if (except !== 'node') {
            this.hideTrackNodeTooltipImmediate();
        }
        if (except !== 'legend') {
            this.hideLegendPopup();
        }
    }

    /**
     * Hide library tooltip immediately (no delay)
     */
    hideTooltipImmediate() {
        // Clear timeouts
        if (this.timeouts.show) {
            clearTimeout(this.timeouts.show);
            this.timeouts.show = null;
        }
        if (this.timeouts.hide) {
            clearTimeout(this.timeouts.hide);
            this.timeouts.hide = null;
        }

        if (this.elements.tooltip) {
            this.elements.tooltip.style.opacity = '0';
            this.elements.tooltip.style.pointerEvents = 'none';
            this.elements.tooltip.style.display = 'none';
            this.elements.tooltip.innerHTML = '';
            this.elements.tooltip.style.left = '-9999px';
            this.elements.tooltip.style.top = '-9999px';
        }
        this.currentHoverTarget = null;
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

        // Setup DOM caching
        this.setupDOMCache();
        
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
        this.subscribeToEvent('legend:attach-handlers', () => {
            this.attachLegendEventHandlers();
        });
        this.subscribeToEvent('legend:category-selected', (data) => {
            this.highlightCategory(data.category);
        });
        this.subscribeToEvent('legend:category-deselected', (data) => {
            this.clearCategoryHighlight();
        });

        // Initialize UI components
        this.initializeTooltips();
        
        // Remove any existing external track node tooltip before creating new one
        this.removeExternalTrackNodeTooltip();
        
        this.initializeSimpleTrackTooltips(); // Create track node tooltips
        
        // Initialize legend popups (migrated from ui.js)
        this.initializeLegendPopups(); 
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
        this.applyTooltipStyles(this.elements.tooltip);
        document.body.appendChild(this.elements.tooltip);

        // Tooltip hover behavior - cancel hide timeout when hovering
        this.elements.tooltip.addEventListener('mouseenter', () => {
            if (this.timeouts.hide) {
                clearTimeout(this.timeouts.hide);
                this.timeouts.hide = null;
            }
        });

        this.elements.tooltip.addEventListener('mouseleave', () => {
            // Use delayed hide to allow user to return to tooltip
            this.timeouts.hide = setTimeout(() => {
                if (!this.elements.tooltip.matches(':hover') && 
                    (!this.currentHoverTarget || !this.currentHoverTarget.matches(':hover'))) {
                    this.hideTooltip();
                }
            }, 300);
        });
    }

    /**
     * Setup tooltip event listeners
     */
    setupTooltipEventListeners() {
        this.addDocumentListener('mouseover', (e) => {
            // Solo per elementi della libreria, NON per track-node
            const trackElement = e.target.closest('.track-item, .track-list-item');
            if (trackElement && !e.target.closest('.track-node') && trackElement !== this.currentHoverTarget && trackElement.dataset.track) {
                this.currentHoverTarget = trackElement;
                this.showTooltip(trackElement, e);
            }
        });

        this.addDocumentListener('mouseout', (e) => {
            // Solo per elementi della libreria, NON per track-node
            const trackElement = e.target.closest('.track-item, .track-list-item');
            if (trackElement && !e.target.closest('.track-node') && trackElement === this.currentHoverTarget) {
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
                        // For library track items, delegate to TagService
                        const tagService = this.getService('tags');
                        if (tagService && typeof tagService.handleTagClick === 'function') {
                            const tempTag = document.createElement('div');
                            tempTag.className = `tag ${tagWithValue.split(':')[0]}`;
                            tempTag.dataset.tagValue = tagWithValue;
                            tempTag.textContent = tagValue;
                            
                            trackElement.appendChild(tempTag);
                            await tagService.handleTagClick(tempTag);
                            tempTag.remove();
                        }
                        // Don't hide tooltip for library items - keep it open for tag creation
                    } else if (tooltipType === 'node') {
                        // For tree nodes, delegate to TrackNodesService for branch creation
                        const trackNodesService = this.getService('tracknodes');
                        if (trackNodesService && typeof trackNodesService.handleTagElementClick === 'function') {
                            trackNodesService.handleTagElementClick(tagWithValue, trackElement, trackData, tagElement);
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
                            const dataService = this.getService('data');
                            if (dataService) {
                                await dataService.addTagToTrack(trackData, newTag);
                            }
                            
                            // Clear input and hide tooltip
                            addTagInput.value = '';
                            
                            if (tooltipType === 'library') {
                                this.hideTooltip();
                            } else {
                                this.hideTrackNodeTooltipImmediate();
                                
                                // For tree nodes, emit event for potential tree updates
                                const eventBus = this.getService('eventbus');
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
     * Unified tooltip positioning
     * @param {HTMLElement} tooltipElement - Tooltip element to position
     * @param {HTMLElement} targetElement - Target element to position near
     * @param {string} strategy - Positioning strategy: 'right', 'above', or 'left'
     */
    positionTooltipUnified(tooltipElement, targetElement, strategy = 'right') {
        if (!tooltipElement) return;

        const targetRect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x, y;

        if (strategy === 'above') {
            // Position above the element (for nodes) - with more distance
            x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
            y = targetRect.top - tooltipRect.height - 25; // Increased gap from 10 to 25px
        } else if (strategy === 'left') {
            // Position to the left (for nodes to avoid play button)
            const tooltipWidth = tooltipRect.width || 300; // Fallback width if not measured yet
            x = targetRect.left - tooltipWidth - 8; // Reduced gap for easier mouse movement
            y = targetRect.top;
        } else {
            // Position to the right (for library items)
            x = targetRect.right + 10;
            y = targetRect.top;
        }

        // Adjust if tooltip goes off screen
        if (strategy === 'left') {
            // For left positioning, if goes off left edge, try right side
            const tooltipWidth = tooltipRect.width || 300;
            if (x < 15) {
                x = targetRect.right + 15;
                // If right side also doesn't fit, try above
                if (x + tooltipWidth > viewportWidth) {
                    x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
                    y = targetRect.top - (tooltipRect.height || 200) - 15;
                    // If above doesn't fit, go below as last resort
                    if (y < 15) {
                        y = targetRect.bottom + 15;
                    }
                }
            }
        } else {
            // Original logic for other strategies
            if (x + tooltipRect.width > viewportWidth) {
                x = targetRect.left - tooltipRect.width - 10;
            }
            if (y < 15) {
                // For nodes, prefer right side instead of below to avoid covering play button
                if (strategy === 'above') {
                    x = targetRect.right + 15;
                    y = targetRect.top;
                    // If still doesn't fit on right, try left
                    if (x + tooltipRect.width > viewportWidth) {
                        x = targetRect.left - tooltipRect.width - 15;
                    }
                    // Only go below as last resort
                    if (x < 15) {
                        x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
                        y = targetRect.bottom + 25;
                    }
                } else {
                    y = targetRect.bottom + 10;
                }
            }
            // Final safety check for left edge
            if (x < 15) {
                x = 15;
            }
        }
        
        // Common vertical positioning adjustments
        if (y + tooltipRect.height > viewportHeight) {
            y = viewportHeight - tooltipRect.height - 10;
        }

        tooltipElement.style.left = `${x}px`;
        tooltipElement.style.top = `${y}px`;
    }

    /**
     * Position tooltip near element (library items)
     * @param {HTMLElement} element - Element to position near
     */
    positionTooltip(element) {
        this.positionTooltipUnified(this.elements.tooltip, element, 'right');
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

    /**
     * Create legend popup DOM element
     */
    createLegendPopupElement() {
        if (this.elements.legendPopup) return;

        this.elements.legendPopup = document.createElement('div');
        this.elements.legendPopup.className = 'legend-popup';
        this.applyTooltipStyles(this.elements.legendPopup, {
            position: 'fixed',
            fontSize: '12px',
            zIndex: '10001'
        });
        document.body.appendChild(this.elements.legendPopup);

        // Legend popup hover behavior
        this.elements.legendPopup.addEventListener('mouseenter', () => {
            if (this.timeouts.legendHide) {
                clearTimeout(this.timeouts.legendHide);
                this.timeouts.legendHide = null;
            }
        });

        this.elements.legendPopup.addEventListener('mouseleave', () => {
            this.hideLegendPopup();
        });
        
        // Global click handler to hide legend popup when clicking elsewhere
        this.addDocumentListener('click', (e) => {
            if (this.elements.legendPopup && 
                this.elements.legendPopup.style.display === 'block' &&
                !e.target.closest('.legend-item') && 
                !e.target.closest('.legend-popup')) {
                this.hideLegendPopup();
            }
        });
    }

    /**
     * Setup legend event listeners for dynamic legend items
     */
    setupLegendEventListeners() {
        // Listen for legend re-rendering from LegendService
        this.subscribeToEvent('legend:rendered', () => {
            setTimeout(() => {
                this.attachLegendEventHandlers();
            }, 200);
        });
        
        // Initial attachment
        setTimeout(() => {
            this.attachLegendEventHandlers();
        }, 100);
        
        // Global escape key handler for clearing highlights
        this.addDocumentListener('keydown', (e) => {
            if (e.key === 'Escape' && this.highlightedCategories.size > 0) {
                this.clearCategoryHighlight();
            }
        });

        // Global click handler for clearing highlights when clicking outside legend
        this.addDocumentListener('click', (e) => {
            const legendItem = e.target.closest('.legend-item');
            if (!legendItem && this.highlightedCategories.size > 0) {
                this.clearCategoryHighlight();
            }
        });
    }

    /**
     * Attach event handlers to legend items (can be called multiple times)
     */
    attachLegendEventHandlers() {
        const legendItems = this.queryDOM('.legend-item', true);

        legendItems.forEach((item) => {
            // Remove existing listeners to prevent duplicates
            const existingListeners = item._uiEventListeners;
            if (existingListeners) {
                existingListeners.forEach(({ event, handler }) => {
                    item.removeEventListener(event, handler);
                });
            }
            
            // Create new event handlers array
            item._uiEventListeners = [];
            
            // NOTE: Click handling is done via events from LegendService
            // We only add hover handlers here
            
            // Mouseenter handler for popup
            const mouseenterHandler = (e) => {
                // Clear all existing timeouts first
                if (this.timeouts.legendHide) {
                    clearTimeout(this.timeouts.legendHide);
                    this.timeouts.legendHide = null;
                }
                if (this.timeouts.legendShow) {
                    clearTimeout(this.timeouts.legendShow);
                    this.timeouts.legendShow = null;
                }
                
                const category = this.getCategoryFromLegendItem(item);
                if (category) {
                    // Shorter delay for more responsive feel
                    this.timeouts.legendShow = setTimeout(async () => {
                        // Double-check that mouse is still over the item
                        if (item.matches(':hover')) {
                            await this.showLegendPopup(category, e, item);
                        }
                    }, 200); // Reduced from config.legendPopupDelay
                }
            };
            item.addEventListener('mouseenter', mouseenterHandler);
            item._uiEventListeners.push({ event: 'mouseenter', handler: mouseenterHandler });
                
            // Mouseleave handler
            const mouseleaveHandler = (e) => {
                // Clear show timeout immediately
                if (this.timeouts.legendShow) {
                    clearTimeout(this.timeouts.legendShow);
                    this.timeouts.legendShow = null;
                }
                
                // Don't hide if mouse is moving to the popup
                const relatedTarget = e.relatedTarget;
                if (relatedTarget && this.elements.legendPopup && 
                    this.elements.legendPopup.contains(relatedTarget)) {
                    return; // Mouse is moving to popup, don't hide
                }
                
                // Hide with short delay
                this.timeouts.legendHide = setTimeout(() => {
                    // Final check: hide only if mouse is not over popup
                    if (!this.elements.legendPopup?.matches(':hover')) {
                        this.hideLegendPopup();
                    }
                }, 150); // Shorter delay
            };
            item.addEventListener('mouseleave', mouseleaveHandler);
            item._uiEventListeners.push({ event: 'mouseleave', handler: mouseleaveHandler });
                
            // Mousemove handler for popup positioning
            const mousemoveHandler = (e) => {
                if (this.elements.legendPopup && this.elements.legendPopup.style.display === 'block') {
                    this.updateLegendPopupPosition(e);
                }
            };
            item.addEventListener('mousemove', mousemoveHandler);
            item._uiEventListeners.push({ event: 'mousemove', handler: mousemoveHandler });
        });
    }

    /**
     * Enhanced show legend popup with real database tags
     * @param {string} category - Category name
     * @param {Event} event - Mouse event for positioning
     * @param {HTMLElement} legendItem - Legend item element
     */
    async showLegendPopup(category, event, legendItem) {
        if (!this.elements.legendPopup) {
            this.createLegendPopupElement();
        }

        // Try to get real tags from the legend item's data attribute
        let tags = null;
        let tagSource = 'none';
        
        if (legendItem && legendItem.dataset.tags) {
            try {
                tags = JSON.parse(legendItem.dataset.tags);
                if (tags && tags.length > 0) {
                    tagSource = 'database';
                }
            } catch (e) {
                console.warn('Failed to parse legend tags:', e);
            }
        }
        
        // Try to get tags from DataService if dataset is empty
        if (!tags || tags.length === 0) {
            try {
                const dataService = this.getService('data');
                if (dataService) {
                    const allTagsByCategory = await dataService.getTagsByCategory();
                    if (allTagsByCategory[category] && allTagsByCategory[category].length > 0) {
                        // Extract just the values from database tags
                        tags = allTagsByCategory[category].map(tag => {
                            return tag.includes(':') ? tag.split(':')[1] : tag;
                        });
                        tagSource = 'dataservice';
                    }
                }
            } catch (error) {
                console.warn('Error getting tags from DataService:', error);
            }
        }
        
        // NO FALLBACKS - only database data
        
        if (!tags || tags.length === 0) {
            return; // Don't show popup if no tags
        }

        // Create popup content
        this.elements.legendPopup.innerHTML = '';
        
        const title = document.createElement('div');
        title.className = 'legend-popup-title';
        title.style.cssText = `
            font-weight: bold; 
            margin-bottom: 8px; 
            color: #fff;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 4px;
        `;
        title.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} Tags`;

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'legend-popup-tags';
        tagsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = `legend-popup-tag tag-${category}`;
            tagElement.textContent = tag;
            tagElement.style.cssText = `
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 500;
                color: white;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
                cursor: pointer;
                transition: all 0.2s ease;
            `;
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
        const canvas = this.queryDOM('.mindmap-canvas');
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
        const canvas = this.queryDOM('.mindmap-canvas');
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
        const canvas = this.queryDOM('.mindmap-canvas');
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
            this.queryDOM('.legend-item span', true).forEach(span => {
                span.style.color = 'white';
                span.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';
            });

            this.queryDOM('.legend-popup-tag', true).forEach(tag => {
                tag.style.color = 'white';
                tag.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';
            });
        };

        fixColors();
        setTimeout(fixColors, 1000);
        setTimeout(fixColors, 3000);
        this.colorFixInterval = setInterval(fixColors, this.config.colorFixInterval);
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
     * Get category from legend item element - enhanced version
     * @param {HTMLElement} legendItem - Legend item element
     * @returns {string|null} Category name
     */
    getCategoryFromLegendItem(legendItem) {
        // First try to get category from dataset (preferred method from LegendService)
        if (legendItem.dataset && legendItem.dataset.category) {
            return legendItem.dataset.category;
        }
        
        // Fallback: extract from CSS class (supports any category dynamically)
        const colorElement = legendItem.querySelector('.legend-color');
        if (colorElement) {
            const classList = Array.from(colorElement.classList);
            // Look for any legend-* class (not just hardcoded ones)
            const legendClass = classList.find(cls => cls.startsWith('legend-') && cls !== 'legend-color');
            if (legendClass) {
                const category = legendClass.replace('legend-', '');
                return category;
            }
        }
        
        return null;
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
     * Highlight a category (wrapper for event-based activation)
     * @param {string} category - Category to highlight
     */
    highlightCategory(category) {
        // Find the legend item for this category
        const legendItem = document.querySelector(`.legend-item[data-category="${category}"]`);
        
        // Always call toggleCategoryHighlight - it handles the toggle logic
        if (legendItem) {
            this.toggleCategoryHighlight(category, legendItem);
        }
    }
    
    /**
     * Toggle category highlight with advanced multi-selection support
     * @param {string} category - Category to toggle
     * @param {HTMLElement} legendItem - Legend item element
     */
    toggleCategoryHighlight(category, legendItem) {
        if (!this.validate({ category }, { category: this.validationRules.category })) {
            return;
        }

        const currentCategories = this.getState('ui.highlightedCategories') || new Set();
        
        // If the category is already selected, remove it
        if (currentCategories.has(category)) {
            currentCategories.delete(category);
            legendItem?.classList.remove('legend-active');
            
            // If no more categories selected, reset everything completely
            if (currentCategories.size === 0) {
                this.resetAllNodesAndBranches();
                
                // Remove all multi-selection styles from legend
                const allLegendItems = this.queryDOM('.legend-item', true, true); // noCache for fresh data
                allLegendItems.forEach(item => {
                    item.classList.remove('legend-active', 'multi-selection');
                });
                
                // Show feedback
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification('🔄 Filtri categoria rimossi - visualizzazione normale ripristinata');
                }
                
                this.setState('ui.highlightedCategories', currentCategories);
                this.highlightedCategories = currentCategories;
                return;
            }
        } else {
            // Add the new category
            currentCategories.add(category);
            legendItem?.classList.add('legend-active');
        }

        // Update legend multi-selection styles
        this.updateLegendMultiSelectionStyles(currentCategories);

        // Recreate highlighting for all selected categories
        this.updateMultipleCategoriesHighlight(currentCategories);
        
        // Show feedback for selected categories
        const selectedCategories = Array.from(currentCategories);
        if (typeof Utils !== 'undefined' && Utils.showNotification) {
            Utils.showNotification(`📌 Categorie selezionate: ${selectedCategories.join(', ')}`);
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
     * Reset all nodes and branches to normal state
     */
    resetAllNodesAndBranches() {
        // Remove ALL highlighting classes from nodes
        const allNodes = this.queryDOM('.track-node', true, true); // noCache for accurate highlighting
        allNodes.forEach(node => {
            node.classList.remove('category-highlighted', 'category-dimmed');
        });

        // Remove highlighting from branches via TreeService
        const treeService = this.getService('tree');
        if (treeService && treeService.connections) {
            const connections = treeService.connections;
            connections.forEach((connection) => {
                if (connection.svgPath) {
                    connection.svgPath.classList.remove('branch-highlighted', 'branch-dimmed');
                }
                if (connection.textElement) {
                    connection.textElement.classList.remove('branch-text-highlighted', 'branch-text-dimmed');
                }
            });
        }

        // Clean any other highlighting elements
        const highlightedElements = this.queryDOM('.category-highlighted, .category-dimmed, .branch-highlighted, .branch-dimmed, .branch-text-highlighted, .branch-text-dimmed', true, true); // noCache
        highlightedElements.forEach(element => {
            element.classList.remove('category-highlighted', 'category-dimmed', 'branch-highlighted', 'branch-dimmed', 'branch-text-highlighted', 'branch-text-dimmed');
        });
    }

    /**
     * Update highlighting for multiple selected categories
     * @param {Set} categories - Selected categories
     */
    updateMultipleCategoriesHighlight(categories) {
        // If no categories selected, reset and exit
        if (categories.size === 0) {
            this.resetAllNodesAndBranches();
            return;
        }

        // Clear branch highlighting first
        this.clearBranchHighlight();
        
        // Highlight branches for ALL selected categories
        this.highlightMultipleCategoriesBranches(categories);
        
        // Single-pass batched DOM updates
        this.batchHighlightUpdate(categories);
    }

    /**
     * Batch highlight update for optimal performance
     * @param {Set} categories - Selected categories
     */
    batchHighlightUpdate(categories) {
        // Cancel any pending highlight update
        if (this.highlightUpdateFrame) {
            cancelAnimationFrame(this.highlightUpdateFrame);
        }
        
        this.highlightUpdateFrame = requestAnimationFrame(() => {
            const perfId = window.PerformanceMonitor?.start('UIService.batchHighlightUpdate');
            
            const allNodes = this.queryDOM('.track-node', true, true);
            const selectedNodes = new Set();
            
            // Build selected nodes set
            categories.forEach(category => {
                const categoryNodes = this.queryDOM(`.track-node.node-tag-${category}`, true, true);
                categoryNodes.forEach(node => selectedNodes.add(node));
            });
            
            // Single pass through all nodes - batch all DOM operations
            allNodes.forEach(node => {
                // Remove old classes first
                node.classList.remove('category-highlighted', 'category-dimmed');
                
                // Add appropriate new class
                if (selectedNodes.has(node)) {
                    node.classList.add('category-highlighted');
                } else {
                    node.classList.add('category-dimmed');
                }
            });
            
            window.PerformanceMonitor?.end(perfId, {
                categoriesCount: categories.size,
                totalNodes: allNodes.length,
                selectedNodes: selectedNodes.size
            });
            
            this.highlightUpdateFrame = null;
        });
    }
    
    /**
     * Update legend multi-selection styles
     * @param {Set} categories - Selected categories
     */
    updateLegendMultiSelectionStyles(categories) {
        const activeLegendItems = this.queryDOM('.legend-active', true, true); // noCache
        const isMultiSelection = categories.size > 1;
        
        activeLegendItems.forEach(item => {
            if (isMultiSelection) {
                item.classList.add('multi-selection');
            } else {
                item.classList.remove('multi-selection');
            }
        });
    }

    /**
     * Highlight branches/connections for all selected categories
     * @param {Set} categories - Selected categories
     */
    highlightMultipleCategoriesBranches(categories) {
        // Access connections from TreeService if available
        const treeService = this.getService('tree');
        if (treeService && treeService.connections) {
            const connections = treeService.connections;
            
            connections.forEach((connection) => {
                const connectionTag = connection.tag;
                
                // Extract category from tag (format "category:value")
                let tagCategory = '';
                if (typeof tagUtils !== 'undefined' && tagUtils.getTagType) {
                    tagCategory = tagUtils.getTagType(connectionTag);
                } else if (connectionTag && connectionTag.includes(':')) {
                    tagCategory = connectionTag.split(':')[0];
                }
                
                // Check if this branch belongs to one of the selected categories
                if (categories.has(tagCategory)) {
                    // Highlight this branch
                    if (connection.svgPath) {
                        connection.svgPath.classList.add('branch-highlighted');
                        connection.svgPath.classList.remove('branch-dimmed');
                    }
                    if (connection.textElement) {
                        connection.textElement.classList.add('branch-text-highlighted');
                        connection.textElement.classList.remove('branch-text-dimmed');
                    }
                } else {
                    // Dim other branches that don't belong to any selected category
                    if (connection.svgPath) {
                        connection.svgPath.classList.add('branch-dimmed');
                        connection.svgPath.classList.remove('branch-highlighted');
                    }
                    if (connection.textElement) {
                        connection.textElement.classList.add('branch-text-dimmed');
                        connection.textElement.classList.remove('branch-text-highlighted');
                    }
                }
            });
        }
    }

    /**
     * Clear highlighting from all branches
     */
    clearBranchHighlight() {
        // Remove highlighted branch classes
        const highlightedBranches = this.queryDOM('.branch-highlighted', true, true);
        highlightedBranches.forEach(branch => {
            branch.classList.remove('branch-highlighted');
        });

        const dimmedBranches = this.queryDOM('.branch-dimmed', true, true);
        dimmedBranches.forEach(branch => {
            branch.classList.remove('branch-dimmed');
        });

        // Remove highlighted branch text classes
        const highlightedBranchTexts = this.queryDOM('.branch-text-highlighted', true, true);
        highlightedBranchTexts.forEach(text => {
            text.classList.remove('branch-text-highlighted');
        });

        const dimmedBranchTexts = this.queryDOM('.branch-text-dimmed', true, true);
        dimmedBranchTexts.forEach(text => {
            text.classList.remove('branch-text-dimmed');
        });
    }

    /**
     * Clear category highlights completely
     */
    clearCategoryHighlight() {
        const currentCategories = this.getState('ui.highlightedCategories') || new Set();
        if (currentCategories.size === 0) return;

        // Use complete reset function
        this.resetAllNodesAndBranches();

        // Remove highlighting from ALL active legend items
        const activeLegendItems = this.queryDOM('.legend-active', true, true); // noCache
        activeLegendItems.forEach(item => {
            item.classList.remove('legend-active', 'multi-selection');
        });

        // Reset state
        this.setState('ui.highlightedCategories', new Set());
        this.highlightedCategories = new Set();

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
     * Helper method to get a service via dependency injection
     * @param {string} serviceName - Name of the service to get
     * @returns {Object|null} Service instance or null
     */
    getService(serviceName) {
        return this.getDependency(serviceName);
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
     * Initialize track node tooltips with external tooltip system
     */
    initializeSimpleTrackTooltips() {
        // Create external tooltip element for track nodes
        this.createTrackNodeTooltipElement();

        // Track current active tooltip
        this.currentActiveTooltip = null;

        // Add event delegation for track nodes
        this.addDocumentListener('mouseover', (e) => {
            const trackNode = e.target.closest('.track-node');
            if (trackNode && trackNode !== this.currentActiveTooltip) {
                this.showTrackNodeTooltip(trackNode);
            }
        });

        this.addDocumentListener('mouseout', (e) => {
            const trackNode = e.target.closest('.track-node');
            if (trackNode && trackNode === this.currentActiveTooltip) {
                const relatedTarget = e.relatedTarget;
                // More robust check: hide tooltip unless mouse is going to tooltip or staying within node
                if (!relatedTarget || 
                    (!trackNode.contains(relatedTarget) && 
                     !this.elements.trackNodeTooltip?.contains(relatedTarget))) {
                    // Moderate delay to allow mouse movement to tooltip
                    setTimeout(() => {
                        // Double-check that mouse is still outside both elements
                        if (this.currentActiveTooltip === trackNode && 
                            !trackNode.matches(':hover') && 
                            !this.elements.trackNodeTooltip?.matches(':hover')) {
                            this.hideTrackNodeTooltip(trackNode);
                        }
                    }, 200); // Reduced from 300ms to 200ms
                }
            }
        });
    }

    /**
     * Create external tooltip element for track nodes
     */
    createTrackNodeTooltipElement() {
        if (this.elements.trackNodeTooltip) return;

        this.elements.trackNodeTooltip = document.createElement('div');
        this.elements.trackNodeTooltip.className = 'track-node-tooltip';
        // Usa stili base identici, solo position: fixed per i nodi
        this.applyTooltipStyles(this.elements.trackNodeTooltip, {
            position: 'fixed'
        });
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
        
        // Global click handler to hide tooltips when clicking elsewhere
        this.addDocumentListener('click', (e) => {
            if (this.currentActiveTooltip && 
                !e.target.closest('.track-node') && 
                !e.target.closest('.track-node-tooltip')) {
                this.hideTrackNodeTooltipImmediate();
            }
        });
    }

    /**
     * Show track node tooltip with delay
     */
    showTrackNodeTooltip(trackNode) {
        // Clear any existing show timeout first
        if (this.timeouts.trackNodeShow) {
            clearTimeout(this.timeouts.trackNodeShow);
            this.timeouts.trackNodeShow = null;
        }

        // Clear any existing hide timeout
        if (this.timeouts.trackNodeHide) {
            clearTimeout(this.timeouts.trackNodeHide);
            this.timeouts.trackNodeHide = null;
        }

        // Hide any currently active tooltip first
        if (this.currentActiveTooltip && this.currentActiveTooltip !== trackNode) {
            this.hideTrackNodeTooltipImmediate();
        }

        // Show tooltip with delay
        this.timeouts.trackNodeShow = setTimeout(() => {
            if (!this.elements.trackNodeTooltip) return;

            // Get track data from node
            const trackData = this.getTrackDataFromNode(trackNode);
            if (trackData && trackData.tags && trackData.tags.length > 0) {
                // Render tooltip content using centralized renderer
                this.renderUnifiedTooltipContent(this.elements.trackNodeTooltip, trackData, trackNode, 'node');
                
                // Show tooltip first so we can get proper dimensions
                this.elements.trackNodeTooltip.style.display = 'block';
                this.elements.trackNodeTooltip.style.opacity = '0';
                this.elements.trackNodeTooltip.style.pointerEvents = 'auto'; // Enable clicks immediately
                
                // Position tooltip after rendering
                this.positionTrackNodeTooltip(trackNode);
                
                // Fade in tooltip
                requestAnimationFrame(() => {
                    if (this.elements.trackNodeTooltip && this.elements.trackNodeTooltip.style.display === 'block') {
                        this.elements.trackNodeTooltip.style.opacity = '1';
                    }
                });

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

        // Hide tooltip with moderate delay to allow interaction
        this.timeouts.trackNodeHide = setTimeout(() => {
            // Final check: only hide if mouse is truly outside both elements
            if (!trackNode.matches(':hover') && 
                !this.elements.trackNodeTooltip?.matches(':hover')) {
                this.hideTrackNodeTooltipImmediate();
            }
        }, 250); // Balanced delay for interaction without being too slow
    }

    /**
     * Hide track node tooltip immediately (no delay)
     */
    hideTrackNodeTooltipImmediate() {
        // Clear all timeouts first
        if (this.timeouts.trackNodeShow) {
            clearTimeout(this.timeouts.trackNodeShow);
            this.timeouts.trackNodeShow = null;
        }
        if (this.timeouts.trackNodeHide) {
            clearTimeout(this.timeouts.trackNodeHide);
            this.timeouts.trackNodeHide = null;
        }

        if (this.elements.trackNodeTooltip) {
            this.elements.trackNodeTooltip.style.opacity = '0';
            setTimeout(() => {
                if (this.elements.trackNodeTooltip && this.elements.trackNodeTooltip.style.opacity === '0') {
                    this.elements.trackNodeTooltip.style.display = 'none';
                    this.elements.trackNodeTooltip.style.pointerEvents = 'none';
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
        this.positionTooltipUnified(this.elements.trackNodeTooltip, trackNode, 'left');
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
    
    /**
     * Destroy service and cleanup all resources
     */
    destroy() {
        // Cancel any pending animation frames
        if (this.highlightUpdateFrame) {
            cancelAnimationFrame(this.highlightUpdateFrame);
            this.highlightUpdateFrame = null;
        }
        
        // Clear all intervals
        if (this.domCacheTimeout) {
            clearInterval(this.domCacheTimeout);
            this.domCacheTimeout = null;
        }
        
        if (this.colorFixInterval) {
            clearInterval(this.colorFixInterval);
            this.colorFixInterval = null;
        }
        
        // Clear all timeouts
        Object.keys(this.timeouts).forEach(key => {
            if (this.timeouts[key]) {
                clearTimeout(this.timeouts[key]);
                this.timeouts[key] = null;
            }
        });
        
        // Remove all document listeners
        this.documentListeners.forEach(({ event, handler, options }) => {
            document.removeEventListener(event, handler, options);
        });
        this.documentListeners = [];
        
        // Clear DOM cache
        this.domCache.clear();
        
        // Remove DOM elements created by this service
        if (this.elements.tooltip && this.elements.tooltip.parentNode) {
            this.elements.tooltip.parentNode.removeChild(this.elements.tooltip);
        }
        if (this.elements.legendPopup && this.elements.legendPopup.parentNode) {
            this.elements.legendPopup.parentNode.removeChild(this.elements.legendPopup);
        }
        
        // Call parent destroy
        super.destroy();
    }

}

// Make available globally
window.UIService = UIService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIService;
}