/**
 * SimpleLegendService - Simplified legend management without ServiceBase
 * Just to get the functionality working first
 */
class SimpleLegendService {
    constructor() {
        this.isInitialized = false;
        console.log('🎨 SimpleLegendService created');
    }

    async initialize() {
        console.log('🎨 SimpleLegendService initializing...');
        
        try {
            await this.refreshLegend();
            this.isInitialized = true;
            console.log('🎨 SimpleLegendService initialized successfully');
        } catch (error) {
            console.error('🎨 Error initializing SimpleLegendService:', error);
        }
    }

    async refreshLegend() {
        try {
            console.log('🎨 Refreshing legend...');
            const categorizedTags = await this.getCategorizedTags();
            console.log('🎨 Got categorized tags:', categorizedTags);
            
            // Update UI
            this.renderLegend(categorizedTags);
            
        } catch (error) {
            console.error('🎨 Error refreshing legend:', error);
        }
    }

    async getCategorizedTags() {
        try {
            let categorizedTags = {};
            
            // Get tags from DataSourceAdapter
            if (window.DataSourceAdapter && window.DataSourceAdapter.getTagsByCategory) {
                console.log('🎨 Getting tags from DataSourceAdapter...');
                categorizedTags = await window.DataSourceAdapter.getTagsByCategory();
                console.log('🎨 Raw categorized tags:', categorizedTags);
            } else {
                console.warn('🎨 DataSourceAdapter not available');
            }

            // Filter and limit tags per category
            const filteredCategories = {};
            Object.entries(categorizedTags).forEach(([category, tags]) => {
                if (tags.length === 0) return;
                
                // Limit tags per category and sort them
                const limitedTags = tags.sort().slice(0, 10);
                
                if (limitedTags.length > 0) {
                    filteredCategories[category] = limitedTags;
                }
            });

            return filteredCategories;
            
        } catch (error) {
            console.error('🎨 Error getting categorized tags:', error);
            return {};
        }
    }

    renderLegend(categorizedTags) {
        const legendContainer = document.querySelector('.color-legend');
        if (!legendContainer) {
            console.warn('🎨 Legend container not found');
            return;
        }

        console.log('🎨 Rendering legend with categories:', Object.keys(categorizedTags));

        // Clear existing content except header
        const header = legendContainer.querySelector('h4');
        legendContainer.innerHTML = '';
        if (header) {
            legendContainer.appendChild(header);
        } else {
            const newHeader = document.createElement('h4');
            newHeader.textContent = 'Tag Categories';
            legendContainer.appendChild(newHeader);
        }

        // Create legend items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'legend-items';
        legendContainer.appendChild(itemsContainer);

        // Render each category
        Object.entries(categorizedTags).forEach(([category, tags]) => {
            this.renderCategoryBox(itemsContainer, category, tags);
        });

        // Show total count
        const totalTags = Object.values(categorizedTags).reduce((sum, tags) => sum + tags.length, 0);
        if (totalTags > 0) {
            const totalInfo = document.createElement('div');
            totalInfo.className = 'legend-total';
            totalInfo.textContent = `${Object.keys(categorizedTags).length} categories, ${totalTags} tags`;
            legendContainer.appendChild(totalInfo);
        }

        console.log('🎨 Legend rendered successfully');
    }

    renderCategoryBox(container, category, tags) {
        const categoryBox = document.createElement('div');
        categoryBox.className = 'legend-category-box';
        categoryBox.dataset.category = category;

        // Category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'legend-category-header';
        
        const colorIndicator = document.createElement('div');
        colorIndicator.className = `legend-color legend-${category}`;
        colorIndicator.style.backgroundColor = tagUtils.getTagColor(`${category}:sample`);
        
        const categoryName = document.createElement('span');
        categoryName.className = 'legend-category-name';
        categoryName.textContent = this.getCategoryDisplayName(category);
        
        const categoryCount = document.createElement('span');
        categoryCount.className = 'legend-category-count';
        categoryCount.textContent = `(${tags.length})`;

        categoryHeader.appendChild(colorIndicator);
        categoryHeader.appendChild(categoryName);
        categoryHeader.appendChild(categoryCount);

        // Tags list (collapsible)
        const tagsList = document.createElement('div');
        tagsList.className = 'legend-tags-list';
        tagsList.style.display = 'none'; // Start collapsed

        tags.forEach(tagValue => {
            const tagItem = document.createElement('span');
            tagItem.className = 'legend-tag-item';
            tagItem.textContent = tagValue;
            tagItem.dataset.tagValue = `${category}:${tagValue}`;
            
            // Add click handler for tag interaction
            tagItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleTagClick(tagItem, `${category}:${tagValue}`);
            });
            
            tagsList.appendChild(tagItem);
        });

        // Toggle functionality
        categoryHeader.addEventListener('click', () => {
            const isExpanded = tagsList.style.display !== 'none';
            
            if (isExpanded) {
                tagsList.style.display = 'none';
                categoryBox.classList.remove('expanded');
            } else {
                tagsList.style.display = 'block';
                categoryBox.classList.add('expanded');
            }
        });

        categoryBox.appendChild(categoryHeader);
        categoryBox.appendChild(tagsList);
        container.appendChild(categoryBox);
    }

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

    handleTagClick(tagElement, tagValue) {
        console.log('🎨 Tag clicked:', tagValue);
        
        // Delegate to TagService if available
        if (window.App && window.App.getService) {
            const tagService = window.App.getService('tags');
            if (tagService && typeof tagService.handleTagClick === 'function') {
                tagService.handleTagClick(tagElement, tagValue);
            }
        }

        // Visual feedback
        tagElement.classList.add('clicked');
        setTimeout(() => {
            tagElement.classList.remove('clicked');
        }, 300);
    }
}

// Make available globally
window.SimpleLegendService = SimpleLegendService;