/**
 * Real Time Clock Module
 * Manages the real-time playlist duration clock
 */

const RealTimeClock = {
    startTime: null,
    clockInterval: null,
    isRunning: false,
    
    /**
     * Initialize RealTimeClock with EventBus integration
     */
    initialize() {
        // Listen for clock events from PlaylistService
        if (window.EventBus) {
            window.EventBus.on('clock:auto-start', (data) => {
                this.start();
            });
            
            window.EventBus.on('clock:stop', () => {
                this.stop();
            });
            
            window.EventBus.on('clock:reset', () => {
                this.reset();
            });
        }
    },
    
    /**
     * Start the real-time clock
     */
    start() {
        if (this.isRunning) return;
        
        this.startTime = Date.now();
        this.isRunning = true;
        
        // Show the clock
        if (AppState.realTimeClock) {
            AppState.realTimeClock.style.display = 'block';
        }
        
        // Start updating the clock
        this.clockInterval = setInterval(() => {
            this.updateClock();
        }, 1000);
        
        // Initial update
        this.updateClock();
        
        // Emit clock started event
        if (window.EventBus) {
            window.EventBus.emit('clock:started', {
                startTime: this.startTime,
                timestamp: Date.now()
            });
        }
    },
    
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
        
        // Hide the clock
        if (AppState.realTimeClock) {
            AppState.realTimeClock.style.display = 'none';
        }
        
        // Emit clock stopped event
        if (window.EventBus) {
            window.EventBus.emit('clock:stopped', {
                timestamp: Date.now()
            });
        }
        
        this.reset();
    },
    
    /**
     * Reset the clock
     */
    reset() {
        this.startTime = null;
        if (AppState.clockTime) {
            AppState.clockTime.textContent = '00:00:00';
        }
    },
    
    /**
     * Update the clock display and emit time events
     */
    updateClock() {
        if (!this.startTime || !AppState.clockTime) return;
        
        const elapsed = Date.now() - this.startTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        AppState.clockTime.textContent = timeString;
        
        // Emit time events for other services to consume
        if (window.EventBus) {
            window.EventBus.emit('time:elapsed', {
                totalSeconds,
                minutes: Math.floor(totalSeconds / 60),
                timeString,
                timestamp: Date.now()
            });
        }
    }
};

// Make RealTimeClock available globally
window.RealTimeClock = RealTimeClock;