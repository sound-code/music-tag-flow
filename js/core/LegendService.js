/**
 * LegendService - Centralized legend management with database integration
 * Handles dynamic category display and tag interaction from database data
 */
class LegendService extends ServiceBase {
    constructor(stateManager, eventBus) {
        console.log('🎨 LegendService constructor called');
        
        try {
            console.log('🎨 Calling super() with stateManager:', !!stateManager, 'eventBus:', !!eventBus);
            super(stateManager, eventBus);
            
            // Service-specific configuration (MUST be set after super() call)
            this.config = {
                maxTagsPerCategory: 10, // Limit tags shown per category
                showEmptyCategories: false, // Hide categories with no tags
                refreshInterval: 0, // Auto-refresh disabled for now
                animationDelay: 100 // Stagger category animation
            };
            
            console.log('🎨 LegendService constructor completed successfully');
        } catch (error) {
            console.error('🎨 Error in LegendService constructor:', error);
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
            console.log('🎨 LegendService.initialize() starting...');
            
            // Ensure config is available (ServiceBase calls initialize in constructor)
            if (!this.config) {
                console.log('🎨 Config not yet available from constructor, using defaults');
                this.config = {
                    maxTagsPerCategory: 10,
                    showEmptyCategories: false,
                    refreshInterval: 0,
                    animationDelay: 100
                };
            } else {
                console.log('🎨 Config available from constructor');
            }
            
            // Ensure legend state exists
            console.log('🎨 Setting up legend state...');
            if (!this.getState('legend.categories')) {
                this.setState('legend.categories', {});
            }
            if (!this.getState('legend.isVisible')) {
                this.setState('legend.isVisible', true);
            }
            if (!this.getState('legend.selectedCategory')) {
                this.setState('legend.selectedCategory', null);
            }
            console.log('🎨 Legend state setup complete');
        } catch (error) {
            console.error('🎨 Error in LegendService.initialize():', error);
            throw error;
        }

        try {
            console.log('🎨 Setting up event subscriptions...');
            
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
            
            this.subscribeToEvent('database:updated', () => {
                this.invalidateCache();
                this.refreshLegend();
            });

            console.log('🎨 Event subscriptions complete');

            // Auto-refresh legend
            if (this.config.refreshInterval > 0) {
                console.log('🎨 Setting up auto-refresh...');
                setInterval(() => {
                    this.refreshLegend();
                }, this.config.refreshInterval);
            }

            // Initialize legend display
            console.log('🎨 LegendService initializing legend display...');
            // Use setTimeout to avoid async issues with ServiceBase initialization
            setTimeout(() => {
                console.log('🎨 Auto-refreshing legend after initialization...');
                this.refreshLegend();
            }, 2000); // Increased timeout
            
            console.log('🎨 LegendService.initialize() completed successfully');
        } catch (error) {
            console.error('🎨 Error in LegendService.initialize() event setup:', error);
            // Don't throw error to prevent service manager from failing
            console.error('🎨 LegendService initialization failed but continuing...');
        }
    }

    /**
     * Refresh legend from database
     */
    async refreshLegend() {
        try {
            console.log('🎨 Refreshing legend...');
            const categorizedTags = await this.getCategorizedTags();
            console.log('🎨 Got categorized tags:', categorizedTags);
            console.log('🎨 Number of categories:', Object.keys(categorizedTags).length);
            this.setState('legend.categories', categorizedTags);
            
            // Update UI
            console.log('🎨 About to render legend...');
            this.renderLegend(categorizedTags);
            console.log('🎨 Legend rendering completed');
            
            // Emit refresh event
            this.emitEvent('legend:refreshed', {
                categories: Object.keys(categorizedTags),
                totalTags: Object.values(categorizedTags).reduce((sum, tags) => sum + tags.length, 0),
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('🎨 Error refreshing legend:', error);
            this.emitEvent('legend:error', { error: error.message });
        }
    }

    /**
     * Get categorized tags from database with caching
     * @returns {Promise<Object>} Categorized tags
     */
    async getCategorizedTags() {
        const now = Date.now();
        
        // Return cached data if still valid
        if (this.categoryCache && (now - this.lastCacheUpdate) < this.cacheTimeout) {
            return this.categoryCache;
        }

        try {
            let categorizedTags = {};
            
            // Get tags from DataSourceAdapter
            if (window.DataSourceAdapter && window.DataSourceAdapter.getTagsByCategory) {
                console.log('🎨 Getting tags from DataSourceAdapter...');
                categorizedTags = await window.DataSourceAdapter.getTagsByCategory();
                console.log('🎨 Raw categorized tags:', categorizedTags);
                
                // If no tags from database, use fallback demo data
                if (Object.keys(categorizedTags).length === 0) {
                    console.log('🎨 No database tags, using fallback demo data...');
                    categorizedTags = this.getFallbackTags();
                }
            } else {
                console.warn('🎨 DataSourceAdapter not available, using fallback data');
                categorizedTags = this.getFallbackTags();
            }

            // Filter and limit tags per category
            const filteredCategories = {};
            Object.entries(categorizedTags).forEach(([category, tags]) => {
                if (!this.config.showEmptyCategories && tags.length === 0) {
                    return;
                }
                
                // Limit tags per category and sort them
                const limitedTags = tags
                    .sort()
                    .slice(0, this.config.maxTagsPerCategory);
                
                if (limitedTags.length > 0) {
                    filteredCategories[category] = limitedTags;
                }
            });

            // Update cache
            this.categoryCache = filteredCategories;
            this.lastCacheUpdate = now;

            return filteredCategories;
            
        } catch (error) {
            console.error('Error getting categorized tags:', error);
            // Return empty object on error
            return {};
        }
    }

    /**
     * Render legend in the DOM
     * @param {Object} categorizedTags - Tags grouped by category
     */
    renderLegend(categorizedTags) {
        console.log('🎨 renderLegend called with:', Object.keys(categorizedTags));
        const legendContainer = document.querySelector('.color-legend');
        if (!legendContainer) {
            console.warn('🎨 Legend container not found');
            return;
        }
        console.log('🎨 Legend container found');

        // Preserve existing header or create new one
        const header = legendContainer.querySelector('h4');
        const headerText = header ? header.textContent : 'Node Colors';
        console.log('🎨 Header text:', headerText);
        
        // Clear existing content
        legendContainer.innerHTML = '';
        console.log('🎨 Cleared existing content');
        
        // Recreate header
        const newHeader = document.createElement('h4');
        newHeader.textContent = headerText;
        legendContainer.appendChild(newHeader);
        console.log('🎨 Header recreated');

        // Create legend items container with original structure
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'legend-items';
        legendContainer.appendChild(itemsContainer);
        console.log('🎨 Items container created');

        // Render each category in the original format
        console.log('🎨 About to render', Object.keys(categorizedTags).length, 'categories');
        Object.entries(categorizedTags).forEach(([category, tags], index) => {
            console.log(`🎨 Rendering category ${index + 1}/${Object.keys(categorizedTags).length}: ${category} (${tags.length} tags)`);
            setTimeout(() => {
                this.renderLegendItem(itemsContainer, category, tags);
            }, index * this.config.animationDelay);
        });

        // Show total count
        const totalTags = Object.values(categorizedTags).reduce((sum, tags) => sum + tags.length, 0);
        if (totalTags > 0) {
            const totalInfo = document.createElement('div');
            totalInfo.className = 'legend-total';
            totalInfo.textContent = `${Object.keys(categorizedTags).length} categories, ${totalTags} tags`;
            legendContainer.appendChild(totalInfo);
        }
    }

    /**
     * Render a legend item in the original format with hover functionality
     * @param {HTMLElement} container - Container element
     * @param {string} category - Category name
     * @param {Array} tags - Array of tag values
     */
    renderLegendItem(container, category, tags) {
        console.log(`🎨 renderLegendItem: ${category} with ${tags.length} tags`);
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.dataset.category = category;

        // Color indicator with original class structure
        const colorIndicator = document.createElement('div');
        colorIndicator.className = `legend-color legend-${category}`;
        console.log(`🎨 Color indicator classes: ${colorIndicator.className}`);
        
        // Category name
        const categoryName = document.createElement('span');
        categoryName.textContent = this.getCategoryDisplayName(category);
        console.log(`🎨 Category display name: ${categoryName.textContent}`);
        
        // Append to item
        legendItem.appendChild(colorIndicator);
        legendItem.appendChild(categoryName);

        // Add click handler for category selection
        legendItem.addEventListener('click', (e) => {
            this.handleCategoryClick(legendItem, category, tags);
        });

        console.log(`🎨 Appending legend item for ${category} to container`);
        container.appendChild(legendItem);
        console.log(`🎨 Legend item for ${category} added successfully`);
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

    /**
     * Fallback tags for demo/testing when database is empty
     */
    getFallbackTags() {
        return {
            emotion: ['happy', 'sad', 'energetic', 'romantic', 'nostalgic'],
            energy: ['high', 'medium', 'low'],
            mood: ['bright', 'dark', 'neutral', 'melancholic', 'uplifting'],
            style: ['rock', 'pop', 'electronic', 'jazz', 'classical'],
            genre: ['alternative', 'indie', 'blues', 'folk', 'ambient'],
            intensity: ['powerful', 'gentle', 'moderate', 'intense', 'calm'],
            tempo: ['upbeat', 'slow', 'mid', 'fast', 'relaxed'],
            vibe: ['chill', 'emotional', 'groovy', 'atmospheric', 'dreamy'],
            rating: ['discovered', 'favorite', 'liked', 'new'],
            occasion: ['modern', 'retro', 'party', 'study', 'workout'],
            weather: ['sunny', 'rainy', 'night', 'morning', 'cloudy'],
            era: ['modern', '2010s', '2000s', '90s', 'classic'],
            format: ['flac', 'mp3', 'wav', 'aac'],
            quality: ['lossless', 'high', 'cd', 'lossy'],
            bitrate: ['320k', '256k', '192k', '128k'],
            source: ['ffprobe', 'musicbrainz', 'lastfm'],
            other: ['studio', 'live', 'remix', 'acoustic', 'instrumental']
        };
    }
}

// Make available globally
window.LegendService = LegendService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LegendService;
}