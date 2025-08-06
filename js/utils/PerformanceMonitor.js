/**
 * Performance Monitoring Utility
 * Tracks performance metrics for optimization analysis
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.enabled = false; // Only enabled in development
        this.logThreshold = 100; // Log operations taking more than 100ms
        
        // Enable in development environments
        if (typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('debug=true')
        )) {
            this.enabled = true;
            console.log('🔬 Performance Monitor enabled');
        }
    }
    
    /**
     * Start measuring an operation
     * @param {string} name - Operation name
     * @returns {string} - Measurement ID
     */
    start(name) {
        if (!this.enabled) return null;
        
        const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = performance.now();
        
        this.metrics.set(id, {
            name,
            startTime,
            memory: this.getMemoryUsage()
        });
        
        return id;
    }
    
    /**
     * End measuring an operation
     * @param {string} id - Measurement ID from start()
     * @param {Object} metadata - Additional data to log
     */
    end(id, metadata = {}) {
        if (!this.enabled || !id) return null;
        
        const metric = this.metrics.get(id);
        if (!metric) return null;
        
        const endTime = performance.now();
        const duration = endTime - metric.startTime;
        const endMemory = this.getMemoryUsage();
        const memoryDelta = endMemory.used - metric.memory.used;
        
        const result = {
            name: metric.name,
            duration: Math.round(duration * 100) / 100,
            memory: {
                start: metric.memory,
                end: endMemory,
                delta: memoryDelta
            },
            timestamp: new Date().toISOString(),
            ...metadata
        };
        
        // Log slow operations
        if (duration > this.logThreshold) {
            console.warn(`🐌 Slow operation: ${metric.name} took ${result.duration}ms`, result);
        }
        
        // Store result for analysis
        this.storeMetric(result);
        
        // Cleanup
        this.metrics.delete(id);
        
        return result;
    }
    
    /**
     * Quick measurement wrapper
     * @param {string} name - Operation name
     * @param {Function} fn - Function to measure
     * @param {Object} metadata - Additional data
     * @returns {any} - Function result
     */
    async measure(name, fn, metadata = {}) {
        const id = this.start(name);
        try {
            const result = await fn();
            this.end(id, { success: true, ...metadata });
            return result;
        } catch (error) {
            this.end(id, { success: false, error: error.message, ...metadata });
            throw error;
        }
    }
    
    /**
     * Get current memory usage
     * @returns {Object} - Memory information
     */
    getMemoryUsage() {
        if (typeof performance.memory !== 'undefined') {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100
            };
        }
        return { used: 0, total: 0, limit: 0 };
    }
    
    /**
     * Store metric for analysis
     * @param {Object} metric - Metric data
     */
    storeMetric(metric) {
        if (!this.enabled) return;
        
        // Store in sessionStorage for analysis
        try {
            const existing = JSON.parse(sessionStorage.getItem('performance_metrics') || '[]');
            existing.push(metric);
            
            // Keep only last 1000 metrics
            if (existing.length > 1000) {
                existing.splice(0, existing.length - 1000);
            }
            
            sessionStorage.setItem('performance_metrics', JSON.stringify(existing));
        } catch (error) {
            // Ignore storage errors
        }
    }
    
    /**
     * Get performance statistics
     * @returns {Object} - Statistics summary
     */
    getStats() {
        if (!this.enabled) return null;
        
        try {
            const metrics = JSON.parse(sessionStorage.getItem('performance_metrics') || '[]');
            
            if (metrics.length === 0) {
                return { total: 0, operations: {} };
            }
            
            const stats = {
                total: metrics.length,
                timeRange: {
                    start: metrics[0]?.timestamp,
                    end: metrics[metrics.length - 1]?.timestamp
                },
                memory: this.getMemoryUsage(),
                operations: {}
            };
            
            // Group by operation name
            const byOperation = metrics.reduce((acc, metric) => {
                const name = metric.name;
                if (!acc[name]) {
                    acc[name] = [];
                }
                acc[name].push(metric);
                return acc;
            }, {});
            
            // Calculate statistics per operation
            Object.keys(byOperation).forEach(name => {
                const operationMetrics = byOperation[name];
                const durations = operationMetrics.map(m => m.duration);
                const memoryDeltas = operationMetrics.map(m => m.memory.delta);
                
                stats.operations[name] = {
                    count: operationMetrics.length,
                    duration: {
                        avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 100) / 100,
                        min: Math.min(...durations),
                        max: Math.max(...durations),
                        total: Math.round(durations.reduce((a, b) => a + b, 0) * 100) / 100
                    },
                    memory: {
                        avg: Math.round(memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length * 100) / 100,
                        total: Math.round(memoryDeltas.reduce((a, b) => a + b, 0) * 100) / 100
                    },
                    slowOperations: operationMetrics.filter(m => m.duration > this.logThreshold).length
                };
            });
            
            return stats;
        } catch (error) {
            console.error('Error getting performance stats:', error);
            return null;
        }
    }
    
    /**
     * Clear all stored metrics
     */
    clear() {
        if (!this.enabled) return;
        
        try {
            sessionStorage.removeItem('performance_metrics');
            console.log('🧹 Performance metrics cleared');
        } catch (error) {
            // Ignore storage errors
        }
    }
    
    /**
     * Print performance report to console
     */
    report() {
        if (!this.enabled) return;
        
        const stats = this.getStats();
        if (!stats || stats.total === 0) {
            console.log('📊 No performance metrics available');
            return;
        }
        
        console.group('📊 Performance Report');
        console.log(`Total operations: ${stats.total}`);
        console.log(`Memory usage: ${stats.memory.used}MB / ${stats.memory.total}MB`);
        console.log(`Time range: ${stats.timeRange.start} → ${stats.timeRange.end}`);
        
        console.group('Operations breakdown:');
        Object.keys(stats.operations)
            .sort((a, b) => stats.operations[b].duration.total - stats.operations[a].duration.total)
            .forEach(name => {
                const op = stats.operations[name];
                console.log(`${name}:`, {
                    count: op.count,
                    avgDuration: `${op.duration.avg}ms`,
                    totalTime: `${op.duration.total}ms`,
                    slowOps: op.slowOperations,
                    memoryDelta: `${op.memory.total}MB`
                });
            });
        console.groupEnd();
        console.groupEnd();
    }
}

// Create global instance
const performanceMonitor = new PerformanceMonitor();

// Make available globally
window.PerformanceMonitor = performanceMonitor;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = performanceMonitor;
}