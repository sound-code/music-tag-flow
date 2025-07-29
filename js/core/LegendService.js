/**
 * LegendService - Centralized legend management with database integration
 * Handles dynamic category display and tag interaction from database data
 */
class LegendService extends ServiceBase {
    constructor(stateManager, eventBus) {
        try {
            super(stateManager, eventBus);
            
            // Service-specific configuration (MUST be set after super() call)
            this.config = {
                maxTagsPerCategory: 15, // Increased limit for richer categories
                showEmptyCategories: false, // Hide categories with no tags
                minTagsToShow: 1, // Show categories with at least 1 tag
                refreshInterval: 0, // Auto-refresh disabled for now
                animationDelay: 100 // Stagger category animation
            };
        } catch (error) {
            throw error;
        }
        
        // Cache for performance
        this.categoryCache = null;
        this.lastCacheUpdate = 0;
        this.cacheTimeout = 60000; // 1 minute cache
        
        // Initialize validation rules
        this.validationRules = {
            category: (cat) => typeof cat === 'string' && cat.length > 0,
            tags: (tags) => Array.isArray(tags) && tags.length > 0
        };
    }

    /**
     * Initialize service and set up event listeners
     */
    initialize() {
        try {
            // Ensure config is available (ServiceBase calls initialize in constructor)
            if (!this.config) {
                this.config = {
                    maxTagsPerCategory: 15,
                    showEmptyCategories: false,
                    minTagsToShow: 1,
                    refreshInterval: 0,
                    animationDelay: 100
                };
            }
            
            // Ensure legend state exists
            if (!this.getState('legend.categories')) {
                this.setState('legend.categories', {});
            }
            if (!this.getState('legend.isVisible')) {
                this.setState('legend.isVisible', true);
            }
            if (!this.getState('legend.selectedCategory')) {
                this.setState('legend.selectedCategory', null);
            }
        } catch (error) {
            throw error;
        }

        try {
            // Subscribe to legend state changes
            this.subscribeToState('legend.categories', (categories) => {
                this.onCategoriesChanged(categories);
            });

            // Subscribe to external events
            this.subscribeToEvent('legend:refresh', () => {
                this.refreshLegend();
            });
            
            this.subscribeToEvent('legend:toggle', () => {
                this.toggleLegend();
            });
            
            this.subscribeToEvent('legend:category-select', (data) => {
                this.selectCategory(data.category);
            });
            
            this.subscribeToEvent('scan:completed', () => {
                this.invalidateCache();
                this.refreshLegend();
            });
            
            this.subscribeToEvent('data:loading:complete', () => {
                this.invalidateCache();
                this.refreshLegend();
            });
            
            this.subscribeToEvent('database:updated', () => {
                this.invalidateCache();
                this.refreshLegend();
            });

            // Auto-refresh legend
            if (this.config.refreshInterval > 0) {
                setInterval(() => {
                    this.refreshLegend();
                }, this.config.refreshInterval);
            }

            // Initialize legend display
            setTimeout(() => {
                this.refreshLegend();
            }, 2000);
            
        } catch (error) {
            // Silent error handling
        }
    }

    /**
     * Refresh legend from database
     */
    async refreshLegend() {
        try {
            const categorizedTags = await this.getCategorizedTags();
            this.setState('legend.categories', categorizedTags);
            
            // Update UI
            this.renderLegend(categorizedTags);
            
            // Emit refresh event
            this.emitEvent('legend:refreshed', {
                categories: Object.keys(categorizedTags),
                totalTags: Object.values(categorizedTags).reduce((sum, tags) => sum + tags.length, 0),
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.emitEvent('legend:error', { error: error.message });
        }
    }

    /**
     * Get categorized tags from database with caching
     * @returns {Promise<Object>} Categorized tags
     */
    async getCategorizedTags() {
        const now = Date.now();
        
        // DEBUG: Always fetch fresh data for now to debug the issue
        // Return cached data if still valid and not empty
        // if (this.categoryCache && 
        //     (now - this.lastCacheUpdate) < this.cacheTimeout &&
        //     Object.keys(this.categoryCache).length > 0) {
        //     return this.categoryCache;
        // }

        try {
            let categorizedTags = {};
            
            // Get tags from DataSourceAdapter - ONLY DATABASE CONTENT
            if (window.DataSourceAdapter && window.DataSourceAdapter.getTagsByCategory) {
                categorizedTags = await window.DataSourceAdapter.getTagsByCategory();
                
            } else {
                categorizedTags = {};
            }

            // SHOW ALL CATEGORIES - Remove restrictive filtering
            const filteredCategories = {};
            Object.entries(categorizedTags).forEach(([category, tags]) => {
                // Show all categories that exist, even if empty
                if (tags && Array.isArray(tags)) {
                    // Limit tags per category and sort them
                    const limitedTags = tags
                        .sort()
                        .slice(0, this.config.maxTagsPerCategory);
                    
                    // Always show category if it has any tags (ignore empty categories)
                    if (limitedTags.length > 0) {
                        filteredCategories[category] = limitedTags;
                    }
                }
            });


            // Always update cache with latest data
            this.categoryCache = filteredCategories;
            this.lastCacheUpdate = now;

            return filteredCategories;
            
        } catch (error) {
            // Return empty object on error - NO HARDCODED FALLBACKS
            return {};
        }
    }

    /**
     * Render legend in the DOM
     * @param {Object} categorizedTags - Tags grouped by category
     */
    renderLegend(categorizedTags) {
        const legendContainer = document.querySelector('.color-legend');
        if (!legendContainer) {
            return;
        }

        // Preserve existing header or create new one
        const header = legendContainer.querySelector('h4');
        const headerText = header ? header.textContent : 'Node Colors';
        
        // Clear existing content
        legendContainer.innerHTML = '';
        
        // Recreate header
        const newHeader = document.createElement('h4');
        newHeader.textContent = headerText;
        legendContainer.appendChild(newHeader);

        // Create legend items container with original structure
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'legend-items';
        legendContainer.appendChild(itemsContainer);

        // Render each category without animation delay
        Object.entries(categorizedTags).forEach(([category, tags]) => {
            this.renderLegendItem(itemsContainer, category, tags);
        });

        // Show total count
        const totalTags = Object.values(categorizedTags).reduce((sum, tags) => sum + tags.length, 0);
        if (totalTags > 0) {
            const totalInfo = document.createElement('div');
            totalInfo.className = 'legend-total';
            totalInfo.textContent = `${Object.keys(categorizedTags).length} categories, ${totalTags} tags`;
            legendContainer.appendChild(totalInfo);
        }
        
        // Notify UI.js that legend has been rendered so it can attach event handlers
        this.emitEvent('legend:rendered', {
            categories: Object.keys(categorizedTags),
            totalItems: Object.keys(categorizedTags).length
        });
        
        // Also try direct global EventBus as fallback
        if (typeof window !== 'undefined' && window.EventBus) {
            window.EventBus.emit('legend:rendered', {
                categories: Object.keys(categorizedTags),
                totalItems: Object.keys(categorizedTags).length
            });
        }
        
        // Direct fallback - call UI.js directly if available
        setTimeout(() => {
            if (typeof window !== 'undefined' && window.UI && window.UI.attachLegendEventHandlers) {
                window.UI.attachLegendEventHandlers();
            }
        }, 100);
    }

    /**
     * Render a legend item in the original format with hover functionality
     * @param {HTMLElement} container - Container element
     * @param {string} category - Category name
     * @param {Array} tags - Array of tag values
     */
    renderLegendItem(container, category, tags) {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.dataset.category = category;
        // Store tags in data attribute for hover popup
        legendItem.dataset.tags = JSON.stringify(tags);

        // Color indicator with original class structure
        const colorIndicator = document.createElement('div');
        colorIndicator.className = `legend-color legend-${category}`;
        
        // Category name
        const categoryName = document.createElement('span');
        categoryName.textContent = this.getCategoryDisplayName(category);
        
        // Append to item
        legendItem.appendChild(colorIndicator);
        legendItem.appendChild(categoryName);

        // Don't add event handlers here - let UI.js handle all legend interactions
        // This maintains compatibility with existing multi-tag selection and hover effects
        
        container.appendChild(legendItem);
    }

    /**
     * Handle category click in legend
     * @param {HTMLElement} legendItem - Clicked legend item
     * @param {string} category - Category name
     * @param {Array} tags - Tags for this category
     */
    handleCategoryClick(legendItem, category, tags) {
        // Toggle active state
        const isActive = legendItem.classList.contains('legend-active');
        
        // Remove active from all items
        document.querySelectorAll('.legend-item').forEach(item => {
            item.classList.remove('legend-active');
        });
        
        if (!isActive) {
            // Add active to clicked item
            legendItem.classList.add('legend-active');
            
            // Emit category selection event
            this.emitEvent('legend:category-selected', {
                category: category,
                tags: tags,
                element: legendItem
            });
        } else {
            // If was active, deselect
            this.emitEvent('legend:category-deselected', {
                category: category
            });
        }
    }


    /**
     * Select a category
     * @param {string} category - Category to select
     */
    selectCategory(category) {
        const currentSelected = this.getState('legend.selectedCategory');
        
        if (currentSelected === category) {
            // Deselect if already selected
            this.setState('legend.selectedCategory', null);
        } else {
            this.setState('legend.selectedCategory', category);
        }

        this.updateCategorySelection();
    }

    /**
     * Update visual category selection
     */
    updateCategorySelection() {
        const selectedCategory = this.getState('legend.selectedCategory');
        const categoryBoxes = document.querySelectorAll('.legend-category-box');
        
        categoryBoxes.forEach(box => {
            const category = box.dataset.category;
            if (category === selectedCategory) {
                box.classList.add('selected');
            } else {
                box.classList.remove('selected');
            }
        });
    }

    /**
     * Toggle legend visibility
     */
    toggleLegend() {
        const isVisible = this.getState('legend.isVisible');
        this.setState('legend.isVisible', !isVisible);
        
        const legendContainer = document.querySelector('.color-legend');
        if (legendContainer) {
            legendContainer.style.display = isVisible ? 'none' : 'block';
        }
    }

    /**
     * Get user-friendly display name for category
     * @param {string} category - Category key
     * @returns {string} Display name
     */
    getCategoryDisplayName(category) {
        const displayNames = {
            other: 'Technical',
            format: 'Format',
            quality: 'Quality', 
            bitrate: 'Bitrate',
            source: 'Source',
            era: 'Era',
            emotion: 'Emotion',
            energy: 'Energy',
            mood: 'Mood',
            style: 'Style',
            genre: 'Genre',
            intensity: 'Intensity',
            tempo: 'Tempo',
            vibe: 'Vibe',
            rating: 'Rating',
            occasion: 'Occasion',
            weather: 'Weather'
        };
        
        return displayNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    /**
     * Invalidate cache
     */
    invalidateCache() {
        this.categoryCache = null;
        this.lastCacheUpdate = 0;
    }

    /**
     * Force refresh legend ignoring cache
     */
    async forceRefreshLegend() {
        this.invalidateCache();
        return this.refreshLegend();
    }

    // Getters
    getLegendCategories() {
        return this.getState('legend.categories') || {};
    }

    getSelectedCategory() {
        return this.getState('legend.selectedCategory');
    }

    isLegendVisible() {
        return this.getState('legend.isVisible') || false;
    }

    /**
     * Handle categories changes
     * @private
     */
    onCategoriesChanged(categories) {
        this.emitEvent('legend:categories-changed', {
            categories: Object.keys(categories),
            totalTags: Object.values(categories).reduce((sum, tags) => sum + tags.length, 0)
        });
    }

}

// Make available globally
window.LegendService = LegendService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LegendService;
}