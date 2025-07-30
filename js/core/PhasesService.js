/**
 * PhasesService - Playlist phases view management
 * Handles the concentric circles visualization for playlist phases
 */
class PhasesService extends ServiceBase {
    constructor(stateManager, eventBus) {
        super(stateManager, eventBus);
        
        // Service configuration
        this.config = {
            animationDuration: 500, // ms
            fadeOutDuration: 300,   // ms
            enableProgressLine: true
        };
        
        // DOM element cache
        this.elements = {};
        
        // Validation rules
        this.validationRules = {
            isActive: (value) => typeof value === 'boolean'
        };
    }

    /**
     * Initialize phases service
     */
    initialize() {
        // Initialize DOM element references
        this.initializeDOMElements();
        
        // Set up EventBus subscriptions
        this.setupEventListeners();
        
        // Initialize phases state
        this.setState('phases.isActive', false);
        this.setState('phases.isAnimating', false);
    }

    /**
     * Initialize DOM element references
     */
    initializeDOMElements() {
        // Get DOM elements through direct access first, then AppState
        this.elements = {
            playlistPhasesBtn: document.getElementById('playlistPhasesBtn'),
            playlistPhasesView: document.getElementById('playlistPhasesView'),
            canvasContent: document.querySelector('.canvas-content'),
            progressLine: document.getElementById('progressLine')
        };
        
        // Elements must be found via DOM - no AppState fallbacks
        
        // Don't throw error - service can still work partially
    }

    /**
     * Set up EventBus event listeners
     */
    setupEventListeners() {
        // Listen for phases toggle requests
        this.subscribeToEvent('phases:toggle', () => {
            this.togglePhases();
        });
        
        // Listen for phases show/hide requests
        this.subscribeToEvent('phases:show', () => {
            this.showPhases();
        });
        
        this.subscribeToEvent('phases:hide', () => {
            this.hidePhases();
        });
        
        // Subscribe to phases state changes
        this.subscribeToState('phases.isActive', (isActive) => {
            this.onPhasesStateChanged(isActive);
        });
        
        // Listen for real-time clock events
        this.subscribeToEvent('clock:started', () => {
            this.handleClockStarted();
        });
        
        this.subscribeToEvent('clock:stopped', () => {
            this.handleClockStopped();
        });
        
        // Listen for time elapsed events from RealTimeClock
        this.subscribeToEvent('time:elapsed', (data) => {
            this.handleTimeElapsed(data);
        });
    }

    /**
     * Toggle phases view
     */
    togglePhases() {
        const currentState = this.getState('phases.isActive') || false;
        const newState = !currentState;
        
        // Validate input
        if (!this.validate({ isActive: newState }, { isActive: this.validationRules.isActive })) {
            return;
        }
        
        // Update state
        this.setState('phases.isActive', newState);
        
        // AppState sync removed - use EventBus for communication
        
        // Apply the change
        if (newState) {
            this.showPhases();
        } else {
            this.hidePhases();
        }
        
        // Emit toggle event
        this.emitEvent('phases:toggled', {
            isActive: newState,
            timestamp: Date.now()
        });
    }

    /**
     * Show phases view
     */
    async showPhases() {
        // Try to reinitialize DOM elements if not found
        if (!this.elements.playlistPhasesView || !this.elements.playlistPhasesBtn) {
            this.initializeDOMElements();
            if (!this.elements.playlistPhasesView || !this.elements.playlistPhasesBtn) {
                return;
            }
        }
        
        // Set animating state
        this.setState('phases.isAnimating', true);
        
        // Update button state
        this.elements.playlistPhasesBtn.classList.add('active');
        
        // Show phases view
        this.elements.playlistPhasesView.style.display = 'block';
        
        // Dim the tree background
        if (this.elements.canvasContent) {
            this.elements.canvasContent.classList.add('phases-active');
        }
        
        // Initialize progress line if clock is running
        if (this.config.enableProgressLine && this.isClockRunning()) {
            this.initializeProgressLine();
        }
        
        // Animate in
        await this.animateIn();
        
        // Clear animating state
        this.setState('phases.isAnimating', false);
        
        // Emit show event
        this.emitEvent('phases:shown', {
            timestamp: Date.now()
        });
    }

    /**
     * Hide phases view
     */
    async hidePhases() {
        // Try to reinitialize DOM elements if not found
        if (!this.elements.playlistPhasesView || !this.elements.playlistPhasesBtn) {
            this.initializeDOMElements();
            if (!this.elements.playlistPhasesView || !this.elements.playlistPhasesBtn) {
                return;
            }
        }
        
        // Set animating state
        this.setState('phases.isAnimating', true);
        
        // Update button state
        this.elements.playlistPhasesBtn.classList.remove('active');
        
        // Remove tree dimming
        if (this.elements.canvasContent) {
            this.elements.canvasContent.classList.remove('phases-active');
        }
        
        // Animate out
        await this.animateOut();
        
        // Hide phases view
        this.elements.playlistPhasesView.style.display = 'none';
        
        // Clear animating state
        this.setState('phases.isAnimating', false);
        
        // Emit hide event
        this.emitEvent('phases:hidden', {
            timestamp: Date.now()
        });
    }

    /**
     * Initialize progress line for real-time clock
     * @public
     */
    initializeProgressLine() {
        if (!this.elements.progressLine) return;
        
        // Set initial position (zero length line at center using SVG coordinates)
        this.elements.progressLine.setAttribute('x1', '400');
        this.elements.progressLine.setAttribute('y1', '400');
        this.elements.progressLine.setAttribute('x2', '400');
        this.elements.progressLine.setAttribute('y2', '400');
        this.elements.progressLine.setAttribute('stroke', '#ff6b6b'); // Start with red
    }

    /**
     * Check if phases view is currently active
     * @returns {boolean} Active state
     */
    isPhasesActive() {
        return this.getState('phases.isActive') || false;
    }

    /**
     * Check if phases view is currently animating
     * @returns {boolean} Animating state
     */
    isPhasesAnimating() {
        return this.getState('phases.isAnimating') || false;
    }

    /**
     * Check if real-time clock is running
     * @returns {boolean} Clock running state
     * @private
     */
    isClockRunning() {
        return window.RealTimeClock && window.RealTimeClock.isRunning;
    }

    /**
     * Animate phases view in
     * @private
     */
    animateIn() {
        return new Promise((resolve) => {
            if (!this.elements.playlistPhasesView) {
                resolve();
                return;
            }
            
            requestAnimationFrame(() => {
                this.elements.playlistPhasesView.style.opacity = '0';
                this.elements.playlistPhasesView.style.transform = 'scale(0.95)';
                this.elements.playlistPhasesView.style.transition = `all ${this.config.animationDuration}ms ease`;
                
                requestAnimationFrame(() => {
                    this.elements.playlistPhasesView.style.opacity = '1';
                    this.elements.playlistPhasesView.style.transform = 'scale(1)';
                    
                    setTimeout(resolve, this.config.animationDuration);
                });
            });
        });
    }

    /**
     * Animate phases view out
     * @private
     */
    animateOut() {
        return new Promise((resolve) => {
            if (!this.elements.playlistPhasesView) {
                resolve();
                return;
            }
            
            this.elements.playlistPhasesView.style.transition = `all ${this.config.fadeOutDuration}ms ease`;
            this.elements.playlistPhasesView.style.opacity = '0';
            this.elements.playlistPhasesView.style.transform = 'scale(0.95)';
            
            setTimeout(resolve, this.config.fadeOutDuration);
        });
    }

    /**
     * Handle phases state changes
     * @param {boolean} isActive - New active state
     * @private
     */
    onPhasesStateChanged(isActive) {
        // AppState sync removed - services communicate via EventBus
        
        // Emit state change event
        this.emitEvent('phases:state-changed', {
            isActive,
            timestamp: Date.now()
        });
    }

    /**
     * Handle real-time clock started
     * @private
     */
    handleClockStarted() {
        if (this.isPhasesActive() && this.config.enableProgressLine) {
            this.initializeProgressLine();
        }
    }

    /**
     * Handle real-time clock stopped
     * @private
     */
    handleClockStopped() {
        // Reset progress line to initial state
        if (this.elements.progressLine) {
            this.elements.progressLine.setAttribute('x1', '400');
            this.elements.progressLine.setAttribute('y1', '400');
            this.elements.progressLine.setAttribute('x2', '400');
            this.elements.progressLine.setAttribute('y2', '400');
            this.elements.progressLine.setAttribute('stroke', '#ff6b6b');
        }
    }
    
    /**
     * Handle time elapsed events from RealTimeClock
     * @param {Object} data - Time data {totalSeconds, minutes, timeString, timestamp}
     * @private
     */
    handleTimeElapsed(data) {
        // Only update progress line if phases view is active
        if (this.isPhasesActive()) {
            this.updateProgressLine(data.totalSeconds);
        }
    }
    
    /**
     * Update the progress line based on elapsed time
     * The line grows horizontally from center to the right
     * 2 minutes per circle: 0-2min (circle 1), 2-4min (circle 2), 4-6min (circle 3), 6-8min (circle 4)
     * @param {number} totalSeconds - Total elapsed seconds
     * @private
     */
    updateProgressLine(totalSeconds) {
        if (!this.elements.progressLine) return;
        
        // Calculate current radius based on time (2 minutes per phase)
        const totalMinutes = totalSeconds / 60;
        let radius;
        if (totalMinutes <= 2) {
            radius = (totalMinutes / 2) * 100; // 0-100px in 2 minutes
        } else if (totalMinutes <= 4) {
            radius = 100 + ((totalMinutes - 2) / 2) * 100; // 100-200px in next 2 minutes
        } else if (totalMinutes <= 6) {
            radius = 200 + ((totalMinutes - 4) / 2) * 100; // 200-300px in next 2 minutes
        } else if (totalMinutes <= 8) {
            radius = 300 + ((totalMinutes - 6) / 2) * 100; // 300-400px in next 2 minutes
        } else {
            radius = 400; // Cap at 400px
        }
        
        // SVG center coordinates (viewBox is 800x800, center is 400,400)
        const centerX = 400;
        const centerY = 400;
        
        // Calculate end position (horizontal line growing to the right)
        const endX = centerX + radius;
        const endY = centerY; // Keep Y constant for horizontal line
        
        // Update line position (horizontal line from center growing to the right)
        this.elements.progressLine.setAttribute('x1', centerX);
        this.elements.progressLine.setAttribute('y1', centerY);
        this.elements.progressLine.setAttribute('x2', endX);
        this.elements.progressLine.setAttribute('y2', endY);
        
        // Update line color based on current phase (changes every 2 minutes)
        let color;
        if (totalMinutes < 2) {
            color = '#ff6b6b'; // Phase 1 color (red) - 0-2 minutes
        } else if (totalMinutes < 4) {
            color = '#4ecdc4'; // Phase 2 color (teal) - 2-4 minutes
        } else if (totalMinutes < 6) {
            color = '#45b7d1'; // Phase 3 color (blue) - 4-6 minutes
        } else {
            color = '#96ceb4'; // Phase 4 color (green) - 6-8+ minutes
        }
        
        this.elements.progressLine.setAttribute('stroke', color);
    }
}

// Make available globally
window.PhasesService = PhasesService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhasesService;
}