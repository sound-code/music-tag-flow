/**
 * Unit Tests for DIContainer
 * Tests dependency injection container functionality
 */

const DIContainer = require('../container/DIContainer');

async function runDIContainerTests() {
    console.log('🧪 DIContainer Unit Tests\n');

    let testCount = 0;
    let passCount = 0;

    function test(name, condition) {
        testCount++;
        const status = condition ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${status} ${name}`);
        if (condition) passCount++;
    }

    try {
        // Test 1: Basic registration and resolution
        console.log('📦 Test 1: Basic Registration and Resolution');
        const container = new DIContainer();

        // Test singleton registration
        container.registerSingleton('testService', () => ({ id: Math.random() }), []);
        test('Singleton registration works', container.has('testService'));

        // Test transient registration
        container.registerTransient('transientService', () => ({ timestamp: Date.now() }), []);
        test('Transient registration works', container.has('transientService'));

        // Test instance registration
        const instance = { name: 'testInstance' };
        container.registerInstance('instance', instance);
        test('Instance registration works', container.has('instance'));

        // Test 2: Service resolution
        console.log('\n🔍 Test 2: Service Resolution');
        const service1 = container.resolve('testService');
        const service2 = container.resolve('testService');
        test('Singleton returns same instance', service1 === service2);

        const transient1 = container.resolve('transientService');
        const transient2 = container.resolve('transientService');
        test('Transient returns different instances', transient1 !== transient2);

        const resolvedInstance = container.resolve('instance');
        test('Instance resolution works', resolvedInstance === instance);

        // Test 3: Dependency injection
        console.log('\n🔗 Test 3: Dependency Injection');
        container.registerSingleton('dependency', () => ({ value: 'injected' }), []);
        container.registerSingleton('serviceWithDep', (dep) => ({ dependency: dep }), ['dependency']);

        const serviceWithDep = container.resolve('serviceWithDep');
        test('Dependency injection works', serviceWithDep.dependency.value === 'injected');

        // Test 4: Error handling
        console.log('\n❗ Test 4: Error Handling');
        try {
            container.resolve('nonExistentService');
            test('Throws error for missing service', false);
        } catch (error) {
            test('Throws error for missing service', error.message.includes('is not registered'));
        }

        // Test 5: Complex dependency graph
        console.log('\n🕸️  Test 5: Complex Dependencies');
        container.registerSingleton('serviceA', () => ({ name: 'A' }), []);
        container.registerSingleton('serviceB', () => ({ name: 'B' }), []);
        container.registerSingleton('serviceC', (a, b) => ({ name: 'C', deps: [a, b] }), ['serviceA', 'serviceB']);

        const serviceC = container.resolve('serviceC');
        test('Complex dependency resolution works', 
            serviceC.name === 'C' && 
            serviceC.deps.length === 2 && 
            serviceC.deps[0].name === 'A' && 
            serviceC.deps[1].name === 'B'
        );

        // Test 6: Utility methods
        console.log('\n🛠️  Test 6: Utility Methods');
        const registeredServices = container.getRegisteredServices();
        test('getRegisteredServices returns array', Array.isArray(registeredServices));
        test('getRegisteredServices includes expected services', 
            registeredServices.includes('testService') && 
            registeredServices.includes('instance')
        );

        container.clear();
        test('clear() removes all services', !container.has('testService') && !container.has('instance'));

        console.log(`\n📊 DIContainer Test Results: ${passCount}/${testCount} tests passed`);
        return passCount === testCount;

    } catch (error) {
        console.error('❌ Error in DIContainer tests:', error);
        return false;
    }
}

module.exports = { runDIContainerTests }; 