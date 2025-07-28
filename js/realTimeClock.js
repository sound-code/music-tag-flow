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
     * Update the clock display
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
        
        // Update progress line if phases view is active
        if (AppState.isPhasesViewActive) {
            this.updateProgressLine(totalSeconds);
        }
    },
    
    /**
     * Update the progress line based on elapsed time
     * 1 minute per circle: 0-1min (circle 1), 1-2min (circle 2), 2-3min (circle 3), 3-4min (circle 4)
     */
    updateProgressLine(totalSeconds) {
        if (!AppState.progressLine || !AppState.playlistPhasesView) return;
        
        // Calculate current phase and progress within that phase (every 2 minutes)
        const totalMinutes = totalSeconds / 60; // Convert to minutes
        const currentPhase = Math.floor(totalMinutes / 2) + 1; // 1-4 (changes every 2 minutes)
        const progressInPhase = (totalMinutes % 2) / 2; // 0-1 (fractional part over 2 minutes)
        
        // Each circle should be reached in exactly 2 minutes
        // Circle 1 (100px) at 2 min, Circle 2 (200px) at 4 min, etc.
        let totalLength;
        if (totalMinutes <= 2) {
            totalLength = (totalMinutes / 2) * 100; // 0-100px in 2 minutes
        } else if (totalMinutes <= 4) {
            totalLength = 100 + ((totalMinutes - 2) / 2) * 100; // 100-200px in next 2 minutes
        } else if (totalMinutes <= 6) {
            totalLength = 200 + ((totalMinutes - 4) / 2) * 100; // 200-300px in next 2 minutes
        } else if (totalMinutes <= 8) {
            totalLength = 300 + ((totalMinutes - 6) / 2) * 100; // 300-400px in next 2 minutes
        } else {
            totalLength = 400; // Cap at 400px
        }
        
        // Use the exact same units as the circles (px values)
        // The circles use r="100", r="200", r="300", r="400" in the SVG
        const centerX = 50; // 50%
        const centerY = 50; // 50%
        
        // Calculate end position based on totalLength directly matching circle radii
        // We need to convert our pixel length to the same coordinate system as the circles
        let endX;
        const svgElement = AppState.playlistPhasesView.querySelector('.phases-svg');
        if (svgElement) {
            const svgRect = svgElement.getBoundingClientRect();
            const percentagePerPixel = 100 / svgRect.width; // Convert viewport width to percentage
            endX = centerX + (totalLength * percentagePerPixel);
        } else {
            // Fallback calculation
            endX = centerX + (totalLength * 0.05);
        }
        
        // Update line position (horizontal line growing to the right)
        AppState.progressLine.setAttribute('x1', `${centerX}%`);
        AppState.progressLine.setAttribute('y1', `${centerY}%`);
        AppState.progressLine.setAttribute('x2', `${endX}%`);
        AppState.progressLine.setAttribute('y2', `${centerY}%`);
        
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
        
        AppState.progressLine.setAttribute('stroke', color);
    }
};

// Make RealTimeClock available globally
window.RealTimeClock = RealTimeClock;