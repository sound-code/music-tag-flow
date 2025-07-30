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
        // UIService is handling tooltips, we handle legend popups
        // No additional bridge needed for now
    },

    /**
     * Initialize legacy-specific features not in UIService
     */
    initializeLegacyFeatures() {
        // Initialize legend popups with legacy data
        this.initializeLegendPopups();
        // Keep only features not handled by UIService
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

    /**
     * Handle visual effects for notifications
     */
    handleNotificationVisualEffects(data) {
        const { type } = data;
        
        // Add visual feedback for different notification types
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
    },

    /**
     * Add success visual effect
     */
    addSuccessEffect() {
        const canvas = document.querySelector('.mindmap-canvas');
        if (canvas) {
            canvas.style.filter = 'brightness(1.1) hue-rotate(120deg)';
            setTimeout(() => {
                canvas.style.filter = '';
            }, 200);
        }
    },

    /**
     * Add error visual effect
     */
    addErrorEffect() {
        const canvas = document.querySelector('.mindmap-canvas');
        if (canvas) {
            canvas.style.filter = 'brightness(1.1) hue-rotate(-30deg)';
            setTimeout(() => {
                canvas.style.filter = '';
            }, 300);
        }
    },

    /**
     * Add warning visual effect
     */
    addWarningEffect() {
        const canvas = document.querySelector('.mindmap-canvas');
        if (canvas) {
            canvas.style.filter = 'brightness(1.1) hue-rotate(30deg)';
            setTimeout(() => {
                canvas.style.filter = '';
            }, 250);
        }
    },

    /**
     * Initialize tooltip functionality for track items in library
     */
    initializeTooltips() {
        // Create tooltip element
        this.createTooltipElement();

        // Add event listeners to tooltip to keep it visible when hovering over it
        this.tooltip.addEventListener('mouseenter', () => {
            // Clear any pending hide timeout when entering tooltip
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
        });

        this.tooltip.addEventListener('mouseleave', () => {
            // Hide tooltip when leaving it
            this.currentHoverTarget = null;
            this.hideTooltip();
        });

        // Track current hover state
        this.currentHoverTarget = null;

        // Tooltip handling delegated to UIService for consistency
        // UIService handles all tooltips for track-item and track-list-item
        // CSS hover handles track-node tooltips

        document.addEventListener('mouseout', (e) => {
            const trackItem = e.target.closest('.track-item, .track-list-item, .track-node');
            if (trackItem && trackItem === this.currentHoverTarget) {
                // Check if we're actually leaving the track item (not just moving to a child)
                const relatedTarget = e.relatedTarget;
                if (!relatedTarget || (!trackItem.contains(relatedTarget) && !this.tooltip.contains(relatedTarget))) {
                    // Don't hide immediately - give user time to move to tooltip
                    setTimeout(() => {
                        // Double check if mouse is still not over node or tooltip
                        if (this.currentHoverTarget === trackItem && 
                            !trackItem.matches(':hover') && 
                            !this.tooltip.matches(':hover')) {
                            this.currentHoverTarget = null;
                            this.hideTooltip();
                        }
                    }, 150); // Small delay to allow mouse movement to tooltip
                }
            }
        });


    },

    /**
     * Initialize legend popup functionality
     */
    initializeLegendPopups() {
        // Create legend popup element
        this.legendPopup = document.createElement('div');
        this.legendPopup.className = 'legend-popup';
        this.legendPopup.style.position = 'fixed';
        this.legendPopup.style.display = 'none';
        this.legendPopup.style.zIndex = '1001';
        document.body.appendChild(this.legendPopup);

        // Add timeout management for legend popup
        this.legendShowTimeout = null;
        this.legendHideTimeout = null;

        // NO HARDCODED TAGS - All tags come from database

        // Wait for DOM to be ready, then add event listeners  
        setTimeout(() => {
            this.attachLegendEventHandlers();
        }, 100);
        
        // Listen for legend re-rendering from LegendService
        if (typeof EventBus !== 'undefined' && EventBus.on) {
            EventBus.on('legend:rendered', (data) => {
                setTimeout(() => {
                    this.attachLegendEventHandlers();
                }, 200);
            });
        } else if (typeof window !== 'undefined' && window.EventBus && window.EventBus.on) {
            window.EventBus.on('legend:rendered', (data) => {
                setTimeout(() => {
                    this.attachLegendEventHandlers();
                }, 200);
            });
        }
    },
    
    /**
     * Attach event handlers to legend items (can be called multiple times)
     */
    attachLegendEventHandlers() {
        const legendItems = document.querySelectorAll('.legend-item');

        legendItems.forEach((item, index) => {
            // PRESERVE DATASET - Don't use cloneNode which might lose data
            // Instead, remove specific event listeners if they exist
            const existingListeners = item._uiEventListeners;
            if (existingListeners) {
                existingListeners.forEach(({ event, handler }) => {
                    item.removeEventListener(event, handler);
                });
            }
            
            // Create new event handlers array
            item._uiEventListeners = [];
            
            // Add click handler for category highlighting
            const clickHandler = (e) => {
                e.preventDefault();
                const category = this.getCategoryFromLegendItem(item);
                if (category) {
                    this.toggleCategoryHighlight(category, item);
                }
            };
            item.addEventListener('click', clickHandler);
            item._uiEventListeners.push({ event: 'click', handler: clickHandler });
            
            // Add mouseenter handler
            const mouseenterHandler = (e) => {
                // Clear any pending hide timeout
                if (this.legendHideTimeout) {
                    clearTimeout(this.legendHideTimeout);
                    this.legendHideTimeout = null;
                }

                const category = this.getCategoryFromLegendItem(item);

                if (category) {
                    // Show immediately if not already showing, or with small delay
                    if (this.legendShowTimeout) {
                        clearTimeout(this.legendShowTimeout);
                    }
                    this.legendShowTimeout = setTimeout(() => {
                        this.showLegendPopup(category, e);
                    }, 100);
                }
            };
            item.addEventListener('mouseenter', mouseenterHandler);
            item._uiEventListeners.push({ event: 'mouseenter', handler: mouseenterHandler });
                
            // Add mouseleave handler
            const mouseleaveHandler = () => {
                // Clear any pending show timeout
                if (this.legendShowTimeout) {
                    clearTimeout(this.legendShowTimeout);
                    this.legendShowTimeout = null;
                }

                // Hide with delay to prevent flicker
                this.legendHideTimeout = setTimeout(() => {
                    this.hideLegendPopup();
                }, 300); // 300ms delay before hiding
            };
            item.addEventListener('mouseleave', mouseleaveHandler);
            item._uiEventListeners.push({ event: 'mouseleave', handler: mouseleaveHandler });
                
            // Add mousemove handler
            const mousemoveHandler = (e) => {
                if (this.legendPopup && this.legendPopup.style.display === 'block') {
                    this.updateLegendPopupPosition(e);
                }
            };
            item.addEventListener('mousemove', mousemoveHandler);
            item._uiEventListeners.push({ event: 'mousemove', handler: mousemoveHandler });
        });
        
        // Add hover events to the popup itself to keep it visible - only once
        if (this.legendPopup && !this.legendPopup._hasEventHandlers) {
            this.legendPopup.addEventListener('mouseenter', () => {
                // Clear hide timeout if hovering over popup
                if (this.legendHideTimeout) {
                    clearTimeout(this.legendHideTimeout);
                    this.legendHideTimeout = null;
                }
            });

            this.legendPopup.addEventListener('mouseleave', () => {
                // Hide when leaving popup
                this.legendHideTimeout = setTimeout(() => {
                    this.hideLegendPopup();
                }, 100);
            });
            
            this.legendPopup._hasEventHandlers = true;
        }

        // Aggiungi event listeners globali per rimuovere l'evidenziazione
        document.addEventListener('click', (e) => {
            // Se il click non è su un elemento della legenda, rimuovi l'evidenziazione
            const legendItem = e.target.closest('.legend-item');
            if (!legendItem && this.highlightedCategories.size > 0) {
                this.clearCategoryHighlight();
            }
        });

        document.addEventListener('keydown', (e) => {
            // Rimuovi l'evidenziazione premendo Escape
            if (e.key === 'Escape' && this.highlightedCategories.size > 0) {
                this.clearCategoryHighlight();
            }
        });
    },

    /**
     * Get category name from legend item
     * @param {HTMLElement} legendItem - The legend item element
     * @returns {string|null} - Category name
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
    },

    /**
     * Show legend popup with category tags
     * @param {string} category - Category name
     * @param {Event} event - Mouse event for positioning
     */
    showLegendPopup(category, event) {
        // First try to get tags from the legend item's data attribute (real tags from database)
        let tags = null;
        const legendItem = event.target.closest('.legend-item');
        
        if (legendItem && legendItem.dataset.tags) {
            try {
                tags = JSON.parse(legendItem.dataset.tags);
            } catch (e) {
                // Failed to parse tags
            }
        }
        
        // Show more info if no tags found
        if (!tags || tags.length === 0) {
            // Create a debug popup showing the issue
            this.createDebugPopup(category, event, 'No tags found in database for this category');
            return;
        }

        // Create popup content
        const title = document.createElement('div');
        title.className = 'legend-popup-title';
        title.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} Tags`;

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'legend-popup-tags';

        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'legend-popup-tag';
            tagElement.textContent = tag;
            tagElement.classList.add(`tag-${category}`);
            tagsContainer.appendChild(tagElement);
        });

        // Clear and populate popup
        this.legendPopup.innerHTML = '';
        this.legendPopup.appendChild(title);
        this.legendPopup.appendChild(tagsContainer);

        // Position and show popup
        this.updateLegendPopupPosition(event);
        this.legendPopup.style.display = 'block';
        this.legendPopup.style.opacity = '1'; // Set directly instead of fade animation for testing
    },

    /**
     * Hide legend popup
     */
    hideLegendPopup() {
        if (this.legendPopup) {
            this.legendPopup.style.opacity = '0';
            setTimeout(() => {
                this.legendPopup.style.display = 'none';
            }, 200);
        }
    },

    /**
     * Update legend popup position
     * @param {Event} event - Mouse event
     */
    updateLegendPopupPosition(event) {
        if (!this.legendPopup) return;

        // Use fixed positioning relative to viewport
        let x = event.clientX + 20;
        let y = event.clientY + 10;

        // Simple boundary check - keep popup in viewport
        const popupRect = this.legendPopup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // If popup would go off right edge, position it to the left of cursor
        if (x + popupRect.width > viewportWidth) {
            x = event.clientX - popupRect.width - 20;
        }

        // If popup would go off bottom edge, position it above cursor
        if (y + popupRect.height > viewportHeight) {
            y = event.clientY - popupRect.height - 10;
        }

        // Ensure popup doesn't go off left or top edges
        x = Math.max(10, x);
        y = Math.max(10, y);

        this.legendPopup.style.left = `${x}px`;
        this.legendPopup.style.top = `${y}px`;
    },

    /**
     * Create debug popup when no tags are found
     */
    createDebugPopup(category, event, message) {
        // Remove existing popup
        if (this.legendPopup) {
            this.legendPopup.remove();
        }

        // Create debug popup
        this.legendPopup = document.createElement('div');
        this.legendPopup.className = 'legend-popup debug-popup';
        this.legendPopup.style.cssText = `
            position: absolute;
            background: #ff4444;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            max-width: 200px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;

        this.legendPopup.innerHTML = `
            <div style="font-weight: bold;">${category.toUpperCase()}</div>
            <div style="margin-top: 4px;">${message}</div>
        `;

        document.body.appendChild(this.legendPopup);

        // Position popup
        this.positionPopup(this.legendPopup, event);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (this.legendPopup) {
                this.legendPopup.remove();
                this.legendPopup = null;
            }
        }, 3000);
    },

    /**
     * Toggle category highlighting - evidenzia/de-evidenzia i nodi di una categoria (supporta selezione multipla)
     * @param {string} category - Nome della categoria
     * @param {HTMLElement} legendItem - Elemento della legenda cliccato
     */
    toggleCategoryHighlight(category, legendItem) {
        // Se la categoria è già selezionata, rimuovila
        if (this.highlightedCategories.has(category)) {
            this.highlightedCategories.delete(category);
            legendItem.classList.remove('legend-active');
            
            // Se non ci sono più categorie selezionate, resetta tutto completamente
            if (this.highlightedCategories.size === 0) {
                // Resetta tutti i nodi e rami PRIMA di svuotare il set
                this.resetAllNodesAndBranches();
                
                // Rimuovi tutti gli stili multi-selezione dalla legenda
                const allLegendItems = document.querySelectorAll('.legend-item');
                allLegendItems.forEach(item => {
                    item.classList.remove('legend-active', 'multi-selection');
                });
                
                // Mostra feedback di reset
                Utils.showNotification('🔄 Filtri categoria rimossi - visualizzazione normale ripristinata');
                return;
            }
        } else {
            // Aggiungi la nuova categoria
            this.highlightedCategories.add(category);
            legendItem.classList.add('legend-active');
        }

        // Aggiorna gli stili per le selezioni multiple
        this.updateLegendMultiSelectionStyles();

        // Ricrea l'evidenziazione per tutte le categorie selezionate
        this.updateMultipleCategoriesHighlight();
        
        // Mostra feedback per le categorie selezionate
        const selectedCategories = Array.from(this.highlightedCategories);
        Utils.showNotification(`📌 Categorie selezionate: ${selectedCategories.join(', ')}`);
    },

    /**
     * Resetta completamente tutti i nodi e rami allo stato normale
     */
    resetAllNodesAndBranches() {
        // Rimuovi TUTTE le classi di evidenziazione dai nodi
        const allNodes = document.querySelectorAll('.track-node');
        allNodes.forEach(node => {
            node.classList.remove('category-highlighted', 'category-dimmed');
        });

        // Rimuovi TUTTE le classi di evidenziazione dai rami
        if (typeof Tree !== 'undefined' && Tree.connections) {
            const connections = Tree.connections;
            connections.forEach((connection, connectionId) => {
                if (connection.svgPath) {
                    connection.svgPath.classList.remove('branch-highlighted', 'branch-dimmed');
                }
                if (connection.textElement) {
                    connection.textElement.classList.remove('branch-text-highlighted', 'branch-text-dimmed');
                }
            });
        }

        // Pulisci anche eventuali altre classi di evidenziazione generiche
        const highlightedElements = document.querySelectorAll('.category-highlighted, .category-dimmed, .branch-highlighted, .branch-dimmed, .branch-text-highlighted, .branch-text-dimmed');
        highlightedElements.forEach(element => {
            element.classList.remove('category-highlighted', 'category-dimmed', 'branch-highlighted', 'branch-dimmed', 'branch-text-highlighted', 'branch-text-dimmed');
        });


    },

    /**
     * Aggiorna l'evidenziazione per tutte le categorie selezionate
     */
    updateMultipleCategoriesHighlight() {
        // Se non ci sono categorie selezionate, resetta tutto e esci
        if (this.highlightedCategories.size === 0) {
            this.resetAllNodesAndBranches();
            return;
        }

        // Prima rimuovi tutte le evidenziazioni esistenti
        const allNodes = document.querySelectorAll('.track-node');
        allNodes.forEach(node => {
            node.classList.remove('category-highlighted', 'category-dimmed');
        });
        
        // Rimuovi evidenziazione dai rami
        this.clearBranchHighlight();

                 // Trova tutti i nodi che appartengono alle categorie selezionate
        const selectedNodes = new Set();
        this.highlightedCategories.forEach(category => {
            const categoryNodes = document.querySelectorAll(`.track-node.node-tag-${category}`);
            categoryNodes.forEach(node => selectedNodes.add(node));
        });
        
        // Evidenzia i rami per TUTTE le categorie selezionate
        this.highlightMultipleCategoriesBranches();



        // Applica l'evidenziazione ai nodi selezionati
        selectedNodes.forEach(node => {
            node.classList.add('category-highlighted');
        });

        // Smussa tutti gli altri nodi
        allNodes.forEach(node => {
            if (!selectedNodes.has(node)) {
                node.classList.add('category-dimmed');
            }
        });
    },

    /**
     * Aggiorna gli stili della legenda per le selezioni multiple
     */
    updateLegendMultiSelectionStyles() {
        const activeLegendItems = document.querySelectorAll('.legend-active');
        const isMultiSelection = this.highlightedCategories.size > 1;
        
        activeLegendItems.forEach(item => {
            if (isMultiSelection) {
                item.classList.add('multi-selection');
            } else {
                item.classList.remove('multi-selection');
            }
        });
    },

    /**
     * Evidenzia i rami/connessioni per tutte le categorie selezionate
     */
    highlightMultipleCategoriesBranches() {
        // Accedi alle connessioni dal modulo Tree se disponibile
        if (typeof Tree !== 'undefined' && Tree.connections) {
            const connections = Tree.connections;
            
            connections.forEach((connection, connectionId) => {
                const connectionTag = connection.tag;
                
                // Estrai la categoria dal tag (formato "categoria:valore")
                const tagCategory = tagUtils.getTagType(connectionTag);
                
                // Verifica se questo ramo appartiene a una delle categorie selezionate
                if (this.highlightedCategories.has(tagCategory)) {
                    // Evidenzia questo ramo
                    if (connection.svgPath) {
                        connection.svgPath.classList.add('branch-highlighted');
                    }
                    if (connection.textElement) {
                        connection.textElement.classList.add('branch-text-highlighted');
                    }
                } else {
                    // Smussa gli altri rami che non appartengono a nessuna categoria selezionata
                    if (connection.svgPath) {
                        connection.svgPath.classList.add('branch-dimmed');
                    }
                    if (connection.textElement) {
                        connection.textElement.classList.add('branch-text-dimmed');
                    }
                }
            });
        }
    },

    /**
     * Evidenzia i rami/connessioni che appartengono alla categoria selezionata (funzione legacy)
     * @param {string} category - Nome della categoria
     */
    highlightCategoryBranches(category) {
        // Questa funzione è mantenuta per compatibilità ma non più utilizzata
        // La nuova logica usa highlightMultipleCategoriesBranches()
    },

    /**
     * Rimuove l'evidenziazione di tutte le categorie
     */
    clearCategoryHighlight() {
        if (this.highlightedCategories.size === 0) return;

        // Usa la funzione di reset completa
        this.resetAllNodesAndBranches();

        // Rimuovi l'evidenziazione da TUTTI gli elementi della legenda attivi
        const activeLegendItems = document.querySelectorAll('.legend-active');
        activeLegendItems.forEach(item => {
            item.classList.remove('legend-active');
        });

        // Reset dello stato
        this.highlightedCategories.clear();


    },

    /**
     * Rimuove l'evidenziazione da tutti i rami
     */
    clearBranchHighlight() {
        // Rimuovi le classi dai rami evidenziati
        const highlightedBranches = document.querySelectorAll('.branch-highlighted');
        highlightedBranches.forEach(branch => {
            branch.classList.remove('branch-highlighted');
        });

        const dimmedBranches = document.querySelectorAll('.branch-dimmed');
        dimmedBranches.forEach(branch => {
            branch.classList.remove('branch-dimmed');
        });

        // Rimuovi le classi dal testo dei rami
        const highlightedBranchTexts = document.querySelectorAll('.branch-text-highlighted');
        highlightedBranchTexts.forEach(text => {
            text.classList.remove('branch-text-highlighted');
        });

        const dimmedBranchTexts = document.querySelectorAll('.branch-text-dimmed');
        dimmedBranchTexts.forEach(text => {
            text.classList.remove('branch-text-dimmed');
        });
    },

    /**
     * Mostra feedback visivo per la categoria evidenziata  
     * @param {string} category - Nome della categoria
     * @param {number} nodeCount - Numero di nodi evidenziati
     */
    showCategoryFeedback(category, nodeCount) {
        // Crea un elemento di feedback temporaneo
        const feedback = document.createElement('div');
        feedback.className = 'category-feedback';
        feedback.textContent = `${nodeCount} nodi evidenziati per: ${category}`;
        
        // Posiziona il feedback in alto a destra
        feedback.style.position = 'fixed';
        feedback.style.top = '20px';
        feedback.style.right = '20px';
        feedback.style.zIndex = '1002';
        
        document.body.appendChild(feedback);

        // Rimuovi il feedback dopo 2 secondi
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 2000);
    },

    /**
     * Show tooltip with track tags
     * @param {HTMLElement} trackElement - The track item element
     * @param {Event} event - Mouse event for positioning
     */
    showTooltip(trackElement, event) {
        // Prevent multiple tooltips for the same element
        if (this.currentTooltipElement === trackElement) {
            return; // Already showing tooltip for this element
        }
        
        // NUCLEAR OPTION: Remove ALL tooltip-related elements from DOM
        const allTooltipElements = document.querySelectorAll('[class*="tooltip"]');
        allTooltipElements.forEach(el => {
            if (el !== this.tooltip) { // Don't remove our main tooltip element
                el.remove();
            }
        });
        
        // Hide our main tooltip
        if (this.tooltip.style.display === 'block') {
            this.tooltip.style.display = 'none';
        }
        
        this.currentTooltipElement = trackElement;
        
        // Clear any pending hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Clear any pending show timeout
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
        }

        // Show tooltip after a small delay to prevent flickering
        this.showTimeout = setTimeout(() => {
            try {
                const trackData = JSON.parse(trackElement.dataset.track);
                if (trackData.tags && trackData.tags.length > 0) {
                    // Create tooltip content
                    const title = document.createElement('div');
                    title.className = 'tooltip-title';
                    title.textContent = `${trackData.title} - ${trackData.artist}`;

                    const tagsContainer = document.createElement('div');
                    tagsContainer.className = 'tooltip-tags';

                    trackData.tags.forEach(tag => {
                        const tagElement = document.createElement('span');
                        tagElement.className = 'tooltip-tag';
                        
                        // Split tag into category and value for better display using centralized TagUtils
                        const tagInfo = tagUtils.parseTag(tag);
                        tagElement.textContent = tagInfo.value || tag;
                        tagElement.dataset.category = tagInfo.type;
                        tagElement.dataset.tagValue = tag; // Store full tag value for click handler
                        
                        // Add category-based styling
                        tagElement.classList.add(`tag-${tagInfo.type}`);
                        
                        // Add click handler to create branches like before
                        tagElement.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            
                            // Find the track node this tooltip belongs to
                            const trackNode = trackElement.closest('.track-node');
                            if (trackNode && typeof TrackNodes !== 'undefined' && TrackNodes.createBranchesForTag) {
                                // Add visual feedback
                                tagElement.classList.add('selected');
                                setTimeout(() => {
                                    tagElement.classList.remove('selected');
                                }, 1000);
                                
                                // Create branches for this tag
                                await TrackNodes.createBranchesForTag(tag, trackNode);
                                
                                // Hide tooltip after click
                                this.hideTooltip();
                            }
                        });
                        
                        // Add hover effect
                        tagElement.style.cursor = 'pointer';
                        
                        tagsContainer.appendChild(tagElement);
                    });

                    // Create add tag interface
                    const addTagSection = document.createElement('div');
                    addTagSection.className = 'tooltip-add-tag-section';
                    
                    const addTagInput = document.createElement('input');
                    addTagInput.type = 'text';
                    addTagInput.placeholder = 'categoria:valore';
                    addTagInput.className = 'tooltip-add-tag-input';
                    
                    const addTagButton = document.createElement('button');
                    addTagButton.textContent = '+';
                    addTagButton.className = 'tooltip-add-tag-btn';
                    
                    // Handle adding new tag
                    const addNewTag = async () => {
                        const tagValue = addTagInput.value.trim();
                        if (tagValue && tagValue.includes(':')) {
                            // Find the track node this tooltip belongs to
                            const trackNode = trackElement.closest('.track-node');
                            if (trackNode && typeof TrackNodes !== 'undefined' && TrackNodes.addTagToNode) {
                                await TrackNodes.addTagToNode(trackNode, trackData, tagValue);
                                addTagInput.value = '';
                                
                                // Refresh tooltip to show new tag
                                setTimeout(() => {
                                    if (this.currentHoverTarget === trackElement) {
                                        // Force refresh the tooltip content
                                        this.tooltip.style.display = 'none';
                                        setTimeout(() => {
                                            if (this.currentHoverTarget === trackElement) {
                                                this.showTooltip(trackElement, { clientX: 0, clientY: 0 });
                                            }
                                        }, 100);
                                    }
                                }, 200);
                            }
                        } else {
                            // Show error feedback briefly
                            addTagInput.style.borderColor = '#ef4444';
                            addTagInput.placeholder = 'Formato: categoria:valore';
                            setTimeout(() => {
                                addTagInput.style.borderColor = '';
                                addTagInput.placeholder = 'categoria:valore';
                            }, 2000);
                        }
                    };
                    
                    // Event listeners for add tag
                    addTagButton.addEventListener('click', addNewTag);
                    addTagInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            addNewTag();
                        }
                    });
                    
                    addTagSection.appendChild(addTagInput);
                    addTagSection.appendChild(addTagButton);

                    // Clear and populate tooltip
                    this.tooltip.innerHTML = '';
                    this.tooltip.appendChild(title);
                    this.tooltip.appendChild(tagsContainer);
                    this.tooltip.appendChild(addTagSection);

                    // Position tooltip relative to the node, not the mouse
                    this.positionTooltipNearNode(trackElement);
                    this.tooltip.style.display = 'block';
                    this.tooltip.style.opacity = '0';
                    
                    // Fade in animation
                    setTimeout(() => {
                        if (this.tooltip.style.display === 'block') {
                            this.tooltip.style.opacity = '1';
                        }
                    }, 10);
                }
                            } catch (error) {
                    // Error showing tooltip - silently fail
                }
        }, 100); // 100ms delay before showing
    },

    /**
     * Hide tooltip
     */
    hideTooltip() {
        // Clear current tooltip element
        this.currentTooltipElement = null;
        
        // Clear any pending show timeout
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }

        // Hide tooltip after a small delay to prevent flickering
        this.hideTimeout = setTimeout(() => {
            if (this.tooltip) {
                this.tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (this.tooltip.style.opacity === '0') {
                        this.tooltip.style.display = 'none';
                    }
                }, 200);
            }
        }, 50); // 50ms delay before hiding
    },

    /**
     * Position tooltip near a node element (fixed position)
     * @param {HTMLElement} nodeElement - The node element to position near
     */
    positionTooltipNearNode(nodeElement) {
        if (!this.tooltip) return;

        const nodeRect = nodeElement.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Position tooltip to the right of the node by default
        let x = nodeRect.right + 15;
        let y = nodeRect.top;

        // If tooltip would go off right edge, position to the left
        if (x + tooltipRect.width > viewportWidth) {
            x = nodeRect.left - tooltipRect.width - 15;
        }

        // If tooltip would go off bottom edge, adjust vertical position
        if (y + tooltipRect.height > viewportHeight) {
            y = viewportHeight - tooltipRect.height - 15;
        }

        // If tooltip would go off top edge, position at top
        if (y < 15) {
            y = 15;
        }

        // If tooltip would still go off left edge, position at left edge
        if (x < 15) {
            x = 15;
        }

        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
    },

    /**
     * Initialize visual effects
     */
    initializeVisualEffects() {
        // Add any other UI effects here
    },

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
        
        // Also fix colors when popup is shown (real-time)
        const originalShowPopup = this.showLegendPopup;
        this.showLegendPopup = function(category, event) {
            const result = originalShowPopup.call(this, category, event);
            // Fix colors immediately after popup is created
            setTimeout(() => {
                document.querySelectorAll('.legend-popup-tag').forEach(tag => {
                    tag.style.color = '#ffffff';
                    tag.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';
                    tag.style.fontWeight = '500';
                });
            }, 10);
            return result;
        };
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