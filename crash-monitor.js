/**
 * Crash Monitor - Sistema di monitoraggio per identificare crash
 */

const CrashMonitor = {
    startTime: Date.now(),
    eventCount: 0,
    memoryCheckInterval: null,
    
    initialize() {
        console.log('🔍 CrashMonitor initialized');
        
        // Monitora gli eventi DOM
        this.monitorDOMEvents();
        
        // Monitora la memoria ogni 5 secondi
        this.monitorMemory();
        
        // Monitora errori non catturati
        this.monitorUncaughtErrors();
        
        // Monitora i timer e gli intervalli
        this.monitorTimers();
    },
    
    monitorDOMEvents() {
        let eventCount = 0;
        const eventTypes = ['click', 'dragstart', 'dragend', 'drop', 'dragover'];
        
        eventTypes.forEach(eventType => {
            document.addEventListener(eventType, (e) => {
                eventCount++;
                console.log(`🔍 ${eventType} on:`, e.target.tagName, e.target.className);
                
                if (eventCount % 50 === 0) {
                    console.log(`🔍 Event count (${eventType}): ${eventCount}`);
                }
            }, true);
        });
    },
    
    monitorMemory() {
        this.memoryCheckInterval = setInterval(() => {
            if (performance.memory) {
                const memory = performance.memory;
                const used = Math.round(memory.usedJSHeapSize / 1024 / 1024);
                const total = Math.round(memory.totalJSHeapSize / 1024 / 1024);
                const limit = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
                
                console.log(`🔍 Memory: ${used}MB used / ${total}MB total / ${limit}MB limit`);
                
                // Warning se la memoria è alta
                if (used > limit * 0.8) {
                    console.warn('🔍 HIGH MEMORY USAGE WARNING!');
                }
            }
        }, 5000);
    },
    
    monitorUncaughtErrors() {
        window.addEventListener('error', (event) => {
            console.error('🔍 UNCAUGHT ERROR:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🔍 UNHANDLED PROMISE REJECTION:', event.reason);
        });
    },
    
    monitorTimers() {
        // Override setTimeout e setInterval per tracking
        const originalSetTimeout = window.setTimeout;
        const originalSetInterval = window.setInterval;
        const originalClearTimeout = window.clearTimeout;
        const originalClearInterval = window.clearInterval;
        
        let timeoutCount = 0;
        let intervalCount = 0;
        const activeTimers = new Set();
        
        window.setTimeout = function(...args) {
            timeoutCount++;
            const id = originalSetTimeout.apply(this, args);
            activeTimers.add({type: 'timeout', id, created: Date.now()});
            
            if (timeoutCount % 10 === 0) {
                console.log(`🔍 Active timeouts: ${timeoutCount}, intervals: ${intervalCount}`);
            }
            
            return id;
        };
        
        window.setInterval = function(...args) {
            intervalCount++;
            const id = originalSetInterval.apply(this, args);
            activeTimers.add({type: 'interval', id, created: Date.now()});
            
            console.log(`🔍 New interval created, total: ${intervalCount}`);
            return id;
        };
        
        window.clearTimeout = function(id) {
            originalClearTimeout.call(this, id);
            // Remove from tracking
        };
        
        window.clearInterval = function(id) {
            originalClearInterval.call(this, id);
            intervalCount--;
            console.log(`🔍 Interval cleared, remaining: ${intervalCount}`);
        };
    },
    
    getStats() {
        const uptime = Date.now() - this.startTime;
        return {
            uptime: Math.round(uptime / 1000) + 's',
            eventCount: this.eventCount,
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB'
            } : 'not available'
        };
    },
    
    shutdown() {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
        }
    }
};

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CrashMonitor.initialize());
} else {
    CrashMonitor.initialize();
}

window.CrashMonitor = CrashMonitor;