/**
 * ClockService - Real-time playlist duration clock management
 * Migrated from legacy realTimeClock.js to service-based architecture
 */
class ClockService extends ServiceBase {
    constructor(stateManager, eventBus) {
        super(stateManager, eventBus);
        this.startTime = null;
        this.clockInterval = null;
        this.isRunning = false;
    }

    initialize() {
        super.initialize();
        
        // Initialize clock state
        this.setState('clock.isRunning', false);
        this.setState('clock.startTime', null);
        this.setState('clock.timeString', '00:00:00');
        
        // Subscribe to clock control events
        this.subscribeToEvent('clock:auto-start', () => this.start());
        this.subscribeToEvent('clock:stop', () => this.stop());
        this.subscribeToEvent('clock:reset', () => this.reset());
        
        // Initialize DOM elements
        this.initializeDOMElements();
    }

    /**
     * Initialize DOM elements for the clock
     * @private
     */
    initializeDOMElements() {
        // Try to get elements from AppState first
        this.clockElement = window.AppState?.realTimeClock;
        this.clockTimeElement = window.AppState?.clockTime;
        
        // If not found in AppState, try direct DOM access
        if (!this.clockElement) {
            this.clockElement = document.getElementById('realTimeClock');
        }
        if (!this.clockTimeElement) {
            this.clockTimeElement = document.getElementById('clockTime');
        }
        
        // Update AppState if elements were found
        if (this.clockElement && window.AppState) {
            window.AppState.realTimeClock = this.clockElement;
        }
        if (this.clockTimeElement && window.AppState) {
            window.AppState.clockTime = this.clockTimeElement;
        }
    }

    /**
     * Start the real-time clock
     */
    start() {
        if (this.isRunning) return;
        
        // Reinitialize DOM elements if needed
        if (!this.clockElement || !this.clockTimeElement) {
            this.initializeDOMElements();
        }
        
        this.startTime = Date.now();
        this.isRunning = true;
        
        // Update state
        this.setState('clock.isRunning', true);
        this.setState('clock.startTime', this.startTime);
        
        // Show the clock element
        if (this.clockElement) {
            this.clockElement.style.display = 'block';
        }
        
        // Start updating the clock
        this.clockInterval = setInterval(() => {
            this.updateClock();
        }, 1000);
        
        // Initial update
        this.updateClock();
        
        // Emit clock started event
        this.emitEvent('clock:started', {
            startTime: this.startTime,
            timestamp: Date.now()
        });
    }

    /**
     * Stop the real-time clock
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
            this.clockInterval = null;
        }
        
        // Update state
        this.setState('clock.isRunning', false);
        
        // Hide the clock element
        if (this.clockElement) {
            this.clockElement.style.display = 'none';
        }
        
        // Emit clock stopped event
        this.emitEvent('clock:stopped', {
            timestamp: Date.now()
        });
        
        this.reset();
    }

    /**
     * Reset the clock
     */
    reset() {
        this.startTime = null;
        this.setState('clock.startTime', null);
        this.setState('clock.timeString', '00:00:00');
        
        if (this.clockTimeElement) {
            this.clockTimeElement.textContent = '00:00:00';
        }
    }

    /**
     * Update the clock display and emit time events
     */
    updateClock() {
        if (!this.startTime || !this.clockTimeElement) return;
        
        const elapsed = Date.now() - this.startTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update DOM and state
        this.clockTimeElement.textContent = timeString;
        this.setState('clock.timeString', timeString);
        
        // Emit time events for other services to consume
        this.emitEvent('time:elapsed', {
            totalSeconds,
            minutes: Math.floor(totalSeconds / 60),
            timeString,
            timestamp: Date.now()
        });
    }

    /**
     * Get current clock status
     * @returns {Object} Clock status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            startTime: this.startTime,
            timeString: this.getState('clock.timeString')
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        super.destroy();
    }
}

// Make available globally
window.ClockService = ClockService;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClockService;
}