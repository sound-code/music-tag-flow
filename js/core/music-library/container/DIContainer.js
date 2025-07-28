/**
 * Dependency Injection Container
 * Manages service registration, resolution, and lifecycle
 */
class DIContainer {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
    }

    /**
     * Register a service as a singleton
     * @param {string} name - Service name
     * @param {Function} factory - Factory function that creates the service
     * @param {Array} dependencies - Array of dependency names
     */
    registerSingleton(name, factory, dependencies = []) {
        this.services.set(name, {
            type: 'singleton',
            factory,
            dependencies,
            instance: null
        });
        return this;
    }

    /**
     * Register a service as transient (new instance each time)
     * @param {string} name - Service name
     * @param {Function} factory - Factory function that creates the service
     * @param {Array} dependencies - Array of dependency names
     */
    registerTransient(name, factory, dependencies = []) {
        this.services.set(name, {
            type: 'transient',
            factory,
            dependencies
        });
        return this;
    }

    /**
     * Register an existing instance
     * @param {string} name - Service name
     * @param {*} instance - Service instance
     */
    registerInstance(name, instance) {
        this.singletons.set(name, instance);
        return this;
    }

    /**
     * Resolve a service by name
     * @param {string} name - Service name
     * @returns {*} Service instance
     */
    resolve(name) {
        // Check if it's a registered instance
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }

        // Check if it's a registered service
        if (!this.services.has(name)) {
            throw new Error(`Service '${name}' is not registered`);
        }

        const service = this.services.get(name);

        // For singletons, return existing instance if available
        if (service.type === 'singleton' && service.instance) {
            return service.instance;
        }

        // Resolve dependencies
        const dependencies = service.dependencies.map(dep => this.resolve(dep));

        // Create instance
        const instance = service.factory(...dependencies);

        // Store singleton instance
        if (service.type === 'singleton') {
            service.instance = instance;
        }

        return instance;
    }

    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name) || this.singletons.has(name);
    }

    /**
     * Clear all registrations
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
    }

    /**
     * Get all registered service names
     * @returns {Array<string>}
     */
    getRegisteredServices() {
        return [
            ...Array.from(this.services.keys()),
            ...Array.from(this.singletons.keys())
        ];
    }
}

module.exports = DIContainer; 