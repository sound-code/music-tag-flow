/**
 * LegendUIHandler - Handles all UI/DOM operations for legend
 * Separates presentation logic from business logic in LegendService
 */
window.LegendUIHandler = (() => {
    
    /**
     * Render legend in the DOM
     * @param {Object} categorizedTags - Tags grouped by category
     * @param {Function} onCategoryClick - Callback when category is clicked
     */
    function renderLegend(categorizedTags, onCategoryClick) {
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

        // Check if we have any categories
        const categoryCount = Object.keys(categorizedTags).length;
        if (categoryCount === 0) {
            // Show empty state message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'legend-empty';
            emptyMessage.textContent = 'No categories found. Scan music library to populate legend.';
            emptyMessage.style.cssText = `
                color: #888;
                font-style: italic;
                text-align: center;
                padding: 20px;
                margin: 10px 0;
            `;
            itemsContainer.appendChild(emptyMessage);
        } else {
            // Render each category
            Object.entries(categorizedTags).forEach(([category, tags]) => {
                renderLegendItem(itemsContainer, category, tags, onCategoryClick);
            });

            // Show total count
            const totalTags = Object.values(categorizedTags).reduce((sum, tags) => sum + tags.length, 0);
            const totalInfo = document.createElement('div');
            totalInfo.className = 'legend-total';
            totalInfo.textContent = `${categoryCount} categories, ${totalTags} tags`;
            legendContainer.appendChild(totalInfo);
        }
        
        // Emit rendered event for UI.js compatibility (multiple EventBus instances)
        if (typeof window !== 'undefined') {
            // Try global EventBus first
            if (window.EventBus && window.EventBus.emit) {
                window.EventBus.emit('legend:rendered', {
                    categories: Object.keys(categorizedTags),
                    totalItems: Object.keys(categorizedTags).length
                });
            }
            
            // Try App EventBus as fallback
            if (window.App && window.App.eventBus && window.App.eventBus.emit) {
                window.App.eventBus.emit('legend:rendered', {
                    categories: Object.keys(categorizedTags),
                    totalItems: Object.keys(categorizedTags).length
                });
            }
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
     * @param {Function} onCategoryClick - Click handler
     */
    function renderLegendItem(container, category, tags, onCategoryClick) {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.dataset.category = category;
        // Store tags in data attribute for hover popup - ensure tags are actual values, not full tag strings
        const tagValues = Array.isArray(tags) ? tags.map(tag => {
            // If tag contains ':', extract the value part; otherwise use the tag as-is
            return tag.includes(':') ? tag.split(':')[1] : tag;
        }) : [];
        legendItem.dataset.tags = JSON.stringify(tagValues);

        // Color indicator with original class structure
        const colorIndicator = document.createElement('div');
        colorIndicator.className = `legend-color legend-${category}`;
        
        // Category name
        const categoryName = document.createElement('span');
        categoryName.textContent = getCategoryDisplayName(category);
        
        // Add click handler if provided
        // NOTE: We let ui.js handle the click events through attachLegendEventHandlers
        // The onCategoryClick is only used as a fallback if ui.js is not available
        if (onCategoryClick && (!window.UI || !window.UI.attachLegendEventHandlers)) {
            legendItem.addEventListener('click', () => {
                onCategoryClick(legendItem, category, tagValues);
            });
        }
        
        // Append to item
        legendItem.appendChild(colorIndicator);
        legendItem.appendChild(categoryName);
        
        container.appendChild(legendItem);
    }

    /**
     * Handle category click in legend (SIMPLE toggle - no multi-selection logic)
     * @param {HTMLElement} legendItem - Clicked legend item
     * @param {string} category - Category name
     * @param {Array} tags - Tags for this category
     * @param {Function} onCategorySelected - Selection callback
     * @param {Function} onCategoryDeselected - Deselection callback
     */
    function handleCategoryClick(legendItem, category, tags, onCategorySelected, onCategoryDeselected) {
        // Simple toggle of individual item only (let ui.js handle multi-selection)
        const isActive = legendItem.classList.contains('legend-active');
        
        if (!isActive) {
            // Add active to clicked item
            legendItem.classList.add('legend-active');
            
            if (onCategorySelected) {
                onCategorySelected(category, tags, legendItem);
            }
        } else {
            // Remove active from this item only
            legendItem.classList.remove('legend-active');
            
            if (onCategoryDeselected) {
                onCategoryDeselected(category);
            }
        }
    }

    /**
     * Update visual category selection
     * @param {string} selectedCategory - Currently selected category
     */
    function updateCategorySelection(selectedCategory) {
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
     * @param {boolean} isVisible - Current visibility state
     */
    function toggleLegendVisibility(isVisible) {
        const legendContainer = document.querySelector('.color-legend');
        if (legendContainer) {
            legendContainer.style.display = isVisible ? 'none' : 'block';
        }
        return !isVisible; // Return new state
    }

    /**
     * Get user-friendly display name for category
     * @param {string} category - Category key
     * @returns {string} Display name
     */
    function getCategoryDisplayName(category) {
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
    
    // Public API
    return {
        renderLegend,
        renderLegendItem,
        handleCategoryClick,
        updateCategorySelection,
        toggleLegendVisibility,
        getCategoryDisplayName
    };
})();