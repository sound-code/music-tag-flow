/**
 * Main Test Runner
 * Runs all unit tests for the enterprise architecture
 */

const { runTrackRepositoryTests } = require('./TrackRepository.test');
const { runDIContainerTests } = require('./DIContainer.test');

async function runAllTests() {
    console.log('🧪 ENTERPRISE ARCHITECTURE UNIT TESTS');
    console.log('=====================================\n');

    const results = [];

    try {
        // Run TrackRepository tests
        console.log('🗃️  TRACK REPOSITORY TESTS');
        console.log('---------------------------');
        const trackRepoResult = await runTrackRepositoryTests();
        results.push({ name: 'TrackRepository', passed: trackRepoResult });

        console.log('\n');

        // Run DIContainer tests
        console.log('📦 DEPENDENCY INJECTION CONTAINER TESTS');
        console.log('----------------------------------------');
        const diContainerResult = await runDIContainerTests();
        results.push({ name: 'DIContainer', passed: diContainerResult });

        console.log('\n');

        // Summary
        console.log('📊 TEST SUMMARY');
        console.log('===============');
        
        let totalPassed = 0;
        results.forEach(result => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.name}`);
            if (result.passed) totalPassed++;
        });

        console.log(`\n🎯 Overall Result: ${totalPassed}/${results.length} test suites passed`);

        if (totalPassed === results.length) {
            console.log('\n🎉 ALL TESTS PASSED! Enterprise architecture is solid! 🏗️');
            console.log('\n✨ Architecture Quality Verified:');
            console.log('   • 🔒 Interface contracts working');
            console.log('   • 🏭 Dependency injection functional');
            console.log('   • 🎯 Business logic isolated and tested');
            console.log('   • 🛡️  Error handling robust');
            console.log('   • 🔄 Service lifecycle managed properly');
            
            process.exit(0);
        } else {
            console.log('\n❌ Some tests failed. Please review the failures above.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error running tests:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests }; 