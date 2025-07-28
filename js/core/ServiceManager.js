/**
 * ServiceManager - Central coordinator for all application services
 * Manages service lifecycle, dependencies, and inter-service communication
 */
class ServiceManager {
    constructor(stateManager, eventBus) {
        if (!stateManager || !eventBus) {
            throw new Error('ServiceManager requires StateManager and EventBus instances');
        }
        this.state = stateManager;
        this.events = eventBus;
        this.services = new Map();
        this.serviceOrder = [];
        this.isInitialized = false;
        this.isShuttingDown = false;
        // Service configuration
        this.config = {
            enableLogging: true,
            logLevel: 'info',
            shutdownTimeout: 5000,
            healthCheckInterval: 30000,
            enableHealthChecks: false
        };
    }
    /**
     * Register a service with the manager
     * @param {string} name - Service name
     * @param {Class} serviceClass - Service class constructor
     * @param {Array} dependencies - Service dependencies
     * @param {Object} options - Service options
     */
    registerService(name, serviceClass, dependencies = [], options = {}) {
        if (this.isInitialized) {
            throw new Error('Cannot register services after initialization');
        }
        if (this.services.has(name)) {
            throw new Error(`Service '${name}' is already registered`);
        }
        const serviceConfig = {
            name,
            serviceClass,
            dependencies,
            options: {
                autoStart: true,
                required: true,
                ...options
            },
            instance: null,
            status: 'registered',
            initTime: null,
            lastHealthCheck: null
        };
        this.services.set(name, serviceConfig);
    }
    /**
     * Initialize all services in dependency order
     */
    async initializeServices() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Calculate initialization order
            this.calculateServiceOrder();
            // Initialize services in order
            for (const serviceName of this.serviceOrder) {
                await this.initializeService(serviceName);
            }
            this.isInitialized = true;
            // Start health checks if enabled
            if (this.config.enableHealthChecks) {
                this.startHealthChecks();
            }
            // Emit global event
            this.events.emit('services:initialized', {
                services: this.serviceOrder,
                count: this.serviceOrder.length
            });
        } catch (error) {
            throw error;
        }
    }
    /**
     * Initialize a single service
     * @param {string} serviceName - Service name to initialize
     */
    async initializeService(serviceName) {
        const serviceConfig = this.services.get(serviceName);
        if (!serviceConfig) {
            throw new Error(`Service '${serviceName}' not found`);
        }
        if (serviceConfig.status === 'initialized') {
            return serviceConfig.instance;
        }
        try {
            // Check dependencies
            await this.checkServiceDependencies(serviceName);
            // Create service instance
            const startTime = Date.now();
            const instance = new serviceConfig.serviceClass(this.state, this.events);
            // Validate service instance
            this.validateServiceInstance(instance, serviceName);
            // Update service config
            serviceConfig.instance = instance;
            serviceConfig.status = 'initialized';
            serviceConfig.initTime = Date.now() - startTime;
            this.log('info', `Service '${serviceName}' initialized`, { 
                initTime: serviceConfig.initTime 
            });
            // Emit service-specific event
            this.events.emit(`service:${serviceName}:initialized`, { 
                service: serviceName,
                instance,
                initTime: serviceConfig.initTime
            });
            return instance;
        } catch (error) {
            serviceConfig.status = 'failed';
            this.log('error', `Failed to initialize service '${serviceName}'`, { 
                error: error.message 
            });
            if (serviceConfig.options.required) {
                throw new Error(`Required service '${serviceName}' failed to initialize: ${error.message}`);
            }
            return null;
        }
    }
    /**
     * Get a service instance
     * @param {string} serviceName - Service name
     * @returns {Object|null} Service instance
     */
    getService(serviceName) {
        const serviceConfig = this.services.get(serviceName);
        if (!serviceConfig) {
            return null;
        }
        if (serviceConfig.status !== 'initialized') {
            this.log('warn', `Service '${serviceName}' not initialized (status: ${serviceConfig.status})`);
            return null;
        }
        return serviceConfig.instance;
    }
    /**
     * Check if a service is available
     * @param {string} serviceName - Service name
     * @returns {boolean} Availability status
     */
    isServiceAvailable(serviceName) {
        const serviceConfig = this.services.get(serviceName);
        return serviceConfig && serviceConfig.status === 'initialized';
    }
    /**
     * Get all initialized services
     * @returns {Object} Map of service names to instances
     */
    getAllServices() {
        const services = {};
        for (const [name, config] of this.services) {
            if (config.status === 'initialized' && config.instance) {
                services[name] = config.instance;
            }
        }
        return services;
    }
    /**
     * Get service status information
     * @returns {Array} Array of service status objects
     */
    getServiceStatus() {
        const status = [];
        for (const [name, config] of this.services) {
            status.push({
                name,
                status: config.status,
                dependencies: config.dependencies,
                initTime: config.initTime,
                lastHealthCheck: config.lastHealthCheck,
                required: config.options.required
            });
        }
        return status;
    }
    /**
     * Shutdown all services gracefully
     */
    async shutdownServices() {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        // Stop health checks
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        // Shutdown services in reverse order
        const shutdownOrder = [...this.serviceOrder].reverse();
        for (const serviceName of shutdownOrder) {
            await this.shutdownService(serviceName);
        }
        this.isInitialized = false;
        this.isShuttingDown = false;
        this.events.emit('services:shutdown');
    }
    /**
     * Shutdown a single service
     * @param {string} serviceName - Service name
     */
    async shutdownService(serviceName) {
        const serviceConfig = this.services.get(serviceName);
        if (!serviceConfig || serviceConfig.status !== 'initialized') {
            return;
        }
        try {
            // Call destroy method if available
            if (serviceConfig.instance && typeof serviceConfig.instance.destroy === 'function') {
                await serviceConfig.instance.destroy();
            }
            serviceConfig.status = 'shutdown';
            serviceConfig.instance = null;
            this.events.emit(`service:${serviceName}:shutdown`, { service: serviceName });
        } catch (error) {
            this.log('error', `Error shutting down service '${serviceName}'`, { 
                error: error.message 
            });
        }
    }
    /**
     * Calculate service initialization order based on dependencies
     * @private
     */
    calculateServiceOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];
        const visit = (serviceName) => {
            if (visited.has(serviceName)) {
                return;
            }
            if (visiting.has(serviceName)) {
                throw new Error(`Circular dependency detected involving service '${serviceName}'`);
            }
            visiting.add(serviceName);
            const serviceConfig = this.services.get(serviceName);
            if (!serviceConfig) {
                throw new Error(`Service '${serviceName}' not found`);
            }
            // Visit dependencies first
            for (const dependency of serviceConfig.dependencies) {
                visit(dependency);
            }
            visiting.delete(serviceName);
            visited.add(serviceName);
            order.push(serviceName);
        };
        // Visit all services
        for (const serviceName of this.services.keys()) {
            visit(serviceName);
        }
        this.serviceOrder = order;
    }
    /**
     * Check if service dependencies are satisfied
     * @param {string} serviceName - Service name
     * @private
     */
    async checkServiceDependencies(serviceName) {
        const serviceConfig = this.services.get(serviceName);
        for (const dependency of serviceConfig.dependencies) {
            const depConfig = this.services.get(dependency);
            if (!depConfig) {
                throw new Error(`Dependency '${dependency}' not found for service '${serviceName}'`);
            }
            if (depConfig.status !== 'initialized') {
                throw new Error(`Dependency '${dependency}' not initialized for service '${serviceName}'`);
            }
        }
    }
    /**
     * Validate service instance
     * @param {Object} instance - Service instance
     * @param {string} serviceName - Service name
     * @private
     */
    validateServiceInstance(instance, serviceName) {
        if (!instance) {
            throw new Error(`Service '${serviceName}' constructor returned null/undefined`);
        }
        // Check if it extends ServiceBase
        if (!(instance instanceof ServiceBase)) {
        }
    }
    /**
     * Start health checks for all services
     * @private
     */
    startHealthChecks() {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthChecks();
        }, this.config.healthCheckInterval);
    }
    /**
     * Perform health checks on all services
     * @private
     */
    performHealthChecks() {
        for (const [serviceName, config] of this.services) {
            if (config.status === 'initialized' && config.instance) {
                try {
                    // Call health check method if available
                    if (typeof config.instance.healthCheck === 'function') {
                        config.instance.healthCheck();
                    }
                    config.lastHealthCheck = Date.now();
                } catch (error) {
                    this.log('warn', `Health check failed for service '${serviceName}'`, { 
                        error: error.message 
                    });
                    this.events.emit('service:health-check-failed', {
                        service: serviceName,
                        error: error.message
                    });
                }
            }
        }
    }
    /**
     * Setup default services for the application
     */
    setupDefaultServices() {
        // Register core services
        this.registerService('search', SearchService, [], {
            required: true,
            autoStart: true
        });
        this.registerService('playlist', PlaylistService, [], {
            required: true,
            autoStart: true
        });
        this.registerService('tags', TagService, [], {
            required: true,
            autoStart: true
        });
        this.registerService('tree', TreeService, [], {
            required: true,
            autoStart: true
        });
    }
    /**
     * Get service manager statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const services = Array.from(this.services.values());
        return {
            totalServices: services.length,
            initializedServices: services.filter(s => s.status === 'initialized').length,
            failedServices: services.filter(s => s.status === 'failed').length,
            averageInitTime: services
                .filter(s => s.initTime)
                .reduce((sum, s) => sum + s.initTime, 0) / services.length || 0,
            isInitialized: this.isInitialized,
            serviceOrder: this.serviceOrder
        };
    }
    /**
     * Log with ServiceManager prefix
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {*} data - Optional data
     */
    log(level, message, data = null) {
        // Logging disabled for production
    }
}
// Make available globally
window.ServiceManager = ServiceManager;
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ServiceManager;
}