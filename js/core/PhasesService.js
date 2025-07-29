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
        
        // Set initial position (zero length line at center)
        this.elements.progressLine.setAttribute('x1', '50%');
        this.elements.progressLine.setAttribute('y1', '50%');
        this.elements.progressLine.setAttribute('x2', '50%');
        this.elements.progressLine.setAttribute('y2', '50%');
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
        // Could reset progress line or perform cleanup
    }
}

// Make available globally
window.PhasesService = PhasesService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhasesService;
}