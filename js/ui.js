/**
 * UI Module - Facade/Bridge to UIService
 * Provides backward compatibility for legacy code
 * All functionality is delegated to UIService
 */

const UI = {
    tooltip: null,
    currentHoverTarget: null,
    showTimeout: null,
    hideTimeout: null,
    // State management for popups and interactions
    legendPopup: null,
    // Timeout management for legend popup display
    legendShowTimeout: null,
    legendHideTimeout: null,
    highlightedCategories: new Set(), // Cambiato da singola variabile a Set per selezioni multiple

    /**
     * Initialize UI functionality - delegates to UIService
     */
    initialize() {
        // Delegate to UIService
        if (window.App && window.App.getService) {
            const uiService = window.App.getService('ui');
            if (uiService) {
                // UIService is already initialized by ServiceManager
                // Setup event bridge between UIService and legacy UI
                this.setupUIServiceBridge(uiService);
                // Just run legacy-specific initialization
                this.initializeLegacyFeatures();
                return;
            }
        }
        
        // Fallback implementation (should not be reached if UIService is available)
        // Subscribe to EventBus events for reactive UI
        this.initializeEventBusIntegration();
        
        this.initializeTooltips();
        this.initializeLegendPopups();
        this.initializeVisualEffects();
        this.fixLegendTextColors();
    },
    
    /**
     * Setup bridge between UIService and legacy UI functionality
     */
    setupUIServiceBridge(uiService) {
        // UIService now handles all functionality
        // Create bridges for legacy functions that might still be called
        
        // Bridge legacy legend functions to UIService
        this.showLegendPopup = (category, event, legendItem) => {
            return uiService.showLegendPopup(category, event, legendItem);
        };
        
        this.hideLegendPopup = () => {
            return uiService.hideLegendPopup();
        };
        
        this.toggleCategoryHighlight = (category, legendItem) => {
            return uiService.toggleCategoryHighlight(category, legendItem);
        };
        
        this.clearCategoryHighlight = () => {
            return uiService.clearCategoryHighlight();
        };
        
        this.getCategoryFromLegendItem = (legendItem) => {
            return uiService.getCategoryFromLegendItem(legendItem);
        };
        
        // Bridge tooltip functions to UIService
        this.showTooltip = (trackElement, event) => {
            return uiService.showTooltip(trackElement, event);
        };
        
        this.hideTooltip = () => {
            return uiService.hideTooltip();
        };
        
        this.positionTooltipNearNode = (nodeElement) => {
            return uiService.positionTooltip ? uiService.positionTooltip(nodeElement) : null;
        };
        
        // Bridge visual effects functions to UIService
        this.handleNotificationVisualEffects = (data) => {
            return uiService.handleNotificationVisualEffects(data);
        };
        
        this.addSuccessEffect = () => {
            return uiService.addSuccessEffect();
        };
        
        this.addErrorEffect = () => {
            return uiService.addErrorEffect();
        };
        
        this.addWarningEffect = () => {
            return uiService.addWarningEffect();
        };
        
        // Bridge state properties
        this.highlightedCategories = uiService.highlightedCategories;
    },

    /**
     * Initialize legacy-specific features not in UIService
     */
    initializeLegacyFeatures() {
        // UIService now handles legend popups and tooltips, so only keep UI-specific fixes
        this.fixLegendTextColors();
    },

    /**
     * Initialize EventBus integration for reactive UI
     */
    initializeEventBusIntegration() {
        if (window.EventBus) {
            // Listen for when track items are loaded
            window.EventBus.on('data:loading:complete', () => {
                // Re-initialize tooltips after tracks are loaded
                setTimeout(() => {
                    this.refreshTooltipListeners();
                }, 100);
            });
            
            // Listen for UI notification events for visual effects
            window.EventBus.on('ui:notification', (data) => {
                this.handleNotificationVisualEffects(data);
            });
        }
    },

    /**
     * Refresh tooltip listeners for dynamically loaded content
     */
    refreshTooltipListeners() {
        // Check if track items exist now
        const trackItems = document.querySelectorAll('.track-item, .track-list-item, .track-node');
        
        if (trackItems.length > 0) {
            // Tooltips should already be working via document delegation
            // But let's make sure the tooltip element exists
            if (!this.tooltip) {
                this.createTooltipElement();
            }
        }
    },

    /**
     * Create tooltip element if it doesn't exist
     */
    createTooltipElement() {
        if (this.tooltip) return; // Already exists
        
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'track-tooltip';
        this.tooltip.style.position = 'absolute';
        this.tooltip.style.display = 'none';
        this.tooltip.style.zIndex = '1000';
        document.body.appendChild(this.tooltip);
    },

    // All legend management functions moved to UIService
    // All tooltip and visual effects functionality moved to UIService

    /**
     * Fix legend text colors to always be white
     */
    fixLegendTextColors() {
        const fixColors = () => {
            // Fix main legend category names
            document.querySelectorAll('.legend-item span').forEach(span => {
                span.style.color = '#ffffff';
                span.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';
                span.style.fontWeight = '500';
            });
            
            // Fix legend popup tags (the ones that appear on hover)
            document.querySelectorAll('.legend-popup-tag').forEach(tag => {
                tag.style.color = '#ffffff';
                tag.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';
                tag.style.fontWeight = '500';
            });
        };

        // Fix immediately
        fixColors();
        
        // Fix after DOM changes (when tree is built)
        setTimeout(fixColors, 1000);
        setTimeout(fixColors, 3000);
        
        // Set up a periodic check to maintain colors
        setInterval(fixColors, 5000);
    },

    /**
     * Toggle artist folder expansion
     * @param {HTMLElement} header - Artist header element
     */
    toggleArtist(header) {
        const artistFolder = header.parentElement;
        const icon = header.querySelector('.artist-icon');
        artistFolder.classList.toggle('expanded');
        
        // Update icon text
        if (artistFolder.classList.contains('expanded')) {
            icon.textContent = '−';
        } else {
            icon.textContent = '+';
        }
    },

    /**
     * Toggle album folder expansion
     * @param {HTMLElement} header - Album header element
     */
    toggleAlbum(header) {
        const albumFolder = header.parentElement;
        const icon = header.querySelector('.album-icon');
        albumFolder.classList.toggle('expanded');
        
        // Update icon text
        if (albumFolder.classList.contains('expanded')) {
            icon.textContent = '−';
        } else {
            icon.textContent = '+';
        }
    }
};

// Make UI functions available globally for onclick handlers
window.toggleArtist = function(header) {
    if (UI && UI.toggleArtist) {
        return UI.toggleArtist(header);
    }
};
window.toggleAlbum = function(header) {
    if (UI && UI.toggleAlbum) {
        return UI.toggleAlbum(header);
    }
};
window.clearMindmap = () => {
    // Clear via EventBus or direct service call
    if (window.EventBus) {
        window.EventBus.emit('playlist:clear');
    } else if (window.App && window.App.getService) {
        const playlistService = window.App.getService('playlist');
        if (playlistService && typeof playlistService.clearPlaylistAndTree === 'function') {
            playlistService.clearPlaylistAndTree();
        }
    }
};
window.savePlaylist = () => {
    // Save via direct service call
    if (window.App && window.App.getService) {
        const playlistService = window.App.getService('playlist');
        if (playlistService && typeof playlistService.savePlaylist === 'function') {
            playlistService.savePlaylist();
        }
    }
};

// Export scrollToNode for backward compatibility
window.scrollToNode = Utils.scrollToNode;

// Make UI object available globally for legacy module initialization
window.UI = UI;