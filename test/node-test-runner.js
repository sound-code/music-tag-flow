#!/usr/bin/env node

/**
 * Node.js Test Runner for MusicTagFlow Migration
 * Automated testing environment for CI/CD and command-line testing
 */

const fs = require('fs');
const path = require('path');

// Mock browser environment for Node.js testing
global.window = {};
global.document = {
    getElementById: () => null,
    createElement: () => ({ 
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        style: {},
        addEventListener: () => {},
        parentNode: null
    }),
    querySelectorAll: () => []
};

// Performance mock for Node.js
global.performance = {
    now: () => Date.now()
};

// Console capture for test output
class TestConsole {
    constructor() {
        this.logs = [];
        this.errors = [];
    }
    
    log(...args) {
        this.logs.push(args.join(' '));
        console.log(...args);
    }
    
    error(...args) {
        this.errors.push(args.join(' '));
        console.error(...args);
    }
    
    clear() {
        this.logs = [];
        this.errors = [];
    }
    
    getLogs() {
        return this.logs;
    }
    
    getErrors() {
        return this.errors;
    }
}

class NodeTestRunner {
    constructor() {
        this.testConsole = new TestConsole();
        this.results = {
            phases: {},
            overall: null,
            timestamp: new Date().toISOString()
        };
        
        // Load core dependencies
        this.loadDependencies();
    }
    
    loadDependencies() {
        console.log('📦 Loading MusicTagFlow dependencies...');
        
        try {
            // Mock minimal required functionality first
            this.mockBrowserAPIs();
            
            // Load test suite only (services will be mocked)
            require('./migration-test-suite.js');
            
            console.log('✅ Dependencies loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load dependencies:', error.message);
            console.log('ℹ️  Running in limited mock mode for basic testing');
        }
    }
    
    mockBrowserAPIs() {
        // Mock EventBus global
        global.EventBus = {
            on: () => () => {},
            emit: () => {},
            off: () => {}
        };
        
        // Mock basic App structure
        global.App = {
            getService: (name) => {
                switch(name) {
                    case 'playlist':
                        return {
                            addTrack: () => ({ track: {}, order: 0 }),
                            removeTrack: () => true,
                            getPlaylistSize: () => 0,
                            getPlaylistDuration: () => 0,
                            clearPlaylist: () => {}
                        };
                    case 'tags':
                        return {
                            addTagToSelection: () => {},
                            removeTagFromSelection: () => {},
                            getSelectedTagsCount: () => 0,
                            isTagSelected: () => false,
                            clearSelection: () => {}
                        };
                    case 'tree':
                        return {
                            addNode: () => {},
                            getNodeCount: () => 0
                        };
                    default:
                        return null;
                }
            }
        };
        
        // Mock AppState
        global.AppState = {
            allNodes: [],
            playlistEntries: [],
            selectedTags: new Set(),
            isPhasesViewActive: false
        };
        
        // Mock other required globals
        global.Search = {
            handleSearch: () => {}
        };
        
        global.Phases = {
            togglePhasesView: () => {
                global.AppState.isPhasesViewActive = !global.AppState.isPhasesViewActive;
            }
        };
        
        global.TrackNodes = {
            create: () => ({
                classList: { contains: () => true },
                parentNode: null
            })
        };
        
        global.Tree = {
            addNode: () => {},
            calculatePositions: () => {}
        };
        
        global.DragDrop = {
            createAutoTree: async () => {
                global.AppState.allNodes.push({ id: 'test-node' });
            }
        };
        
        global.Containers = {
            createContainer: () => ({
                style: { left: '100px', top: '100px' },
                parentNode: { removeChild: () => {} }
            })
        };
    }
    
    async runTests() {
        console.log('🧪 Starting MusicTagFlow Migration Tests in Node.js Environment');
        console.log('='.repeat(70));
        
        try {
            // Initialize test suite
            const testSuite = new MigrationTestSuite();
            
            // Override console to capture output
            const originalConsole = { log: console.log, error: console.error };
            console.log = this.testConsole.log.bind(this.testConsole);
            console.error = this.testConsole.error.bind(this.testConsole);
            
            // Run all tests
            await testSuite.runAllTests();
            
            // Restore console
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            
            // Get results
            const results = testSuite.generateReport();
            this.results.overall = results;
            
            // Generate detailed report
            this.generateDetailedReport(results);
            
            // Exit with appropriate code
            const exitCode = results.summary.totalFailures > 0 ? 1 : 0;
            process.exit(exitCode);
            
        } catch (error) {
            console.error('❌ Test suite execution failed:', error);
            process.exit(1);
        }
    }
    
    async runPhaseTests(phase) {
        console.log(`🧪 Running Phase ${phase} Tests`);
        console.log('='.repeat(40));
        
        try {
            const testSuite = new MigrationTestSuite();
            
            switch(phase) {
                case 1:
                    await testSuite.testPhase1();
                    break;
                case 2:
                    await testSuite.testPhase2();
                    break;
                case 3:
                    await testSuite.testPhase3();
                    break;
                default:
                    throw new Error(`Invalid phase: ${phase}`);
            }
            
            const results = testSuite.generateReport();
            this.results.phases[`phase${phase}`] = results;
            
            return results;
            
        } catch (error) {
            console.error(`❌ Phase ${phase} tests failed:`, error);
            throw error;
        }
    }
    
    generateDetailedReport(results) {
        console.log('\n📊 DETAILED TEST REPORT');
        console.log('='.repeat(70));
        
        // Summary
        console.log(`📋 Test Summary:`);
        console.log(`   Total Tests: ${results.summary.totalTests}`);
        console.log(`   Passed: ${results.summary.totalTests - results.summary.totalFailures}`);
        console.log(`   Failed: ${results.summary.totalFailures}`);
        console.log(`   Success Rate: ${results.summary.successRate}%`);
        
        // Performance metrics
        if (Object.keys(results.performance).length > 0) {
            console.log(`\n⚡ Performance Metrics:`);
            Object.entries(results.performance).forEach(([metric, value]) => {
                console.log(`   ${metric}: ${value.toFixed(2)}ms`);
            });
        }
        
        // Test details
        console.log(`\n📝 Test Results:`);
        results.results.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`   ${status} ${result.test}`);
        });
        
        // Failures
        if (results.failures.length > 0) {
            console.log(`\n❌ Failures:`);
            results.failures.forEach(failure => {
                console.log(`   - ${failure.test}: ${failure.error}`);
            });
        }
        
        // Recommendations
        this.generateRecommendations(results);
        
        // Save report to file
        this.saveReportToFile(results);
    }
    
    generateRecommendations(results) {
        console.log(`\n💡 Recommendations:`);
        
        const successRate = parseFloat(results.summary.successRate);
        
        if (successRate >= 95) {
            console.log('   🎉 Excellent! Migration is ready to proceed.');
            console.log('   ✅ All critical functionality is working correctly.');
        } else if (successRate >= 80) {
            console.log('   ⚠️  Good progress, but some issues need attention.');
            console.log('   🔧 Review failed tests before proceeding with migration.');
        } else {
            console.log('   🚨 Migration readiness is low. Address failures first.');
            console.log('   ❌ Do not proceed with migration until success rate > 80%.');
        }
        
        // Performance recommendations
        const perfIssues = [];
        Object.entries(results.performance).forEach(([metric, value]) => {
            const thresholds = {
                playlistAddition: 20,
                treePositioning: 100,
                tagSelection: 10,
                nodeCreation: 50
            };
            
            if (thresholds[metric] && value > thresholds[metric]) {
                perfIssues.push(`${metric} (${value.toFixed(2)}ms > ${thresholds[metric]}ms)`);
            }
        });
        
        if (perfIssues.length > 0) {
            console.log(`   ⚡ Performance concerns: ${perfIssues.join(', ')}`);
        }
    }
    
    saveReportToFile(results) {
        const reportPath = path.join(__dirname, `test-report-${Date.now()}.json`);
        
        const report = {
            timestamp: this.results.timestamp,
            environment: 'Node.js',
            version: process.version,
            results: results,
            logs: this.testConsole.getLogs(),
            errors: this.testConsole.getErrors()
        };
        
        try {
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`\n💾 Report saved to: ${reportPath}`);
        } catch (error) {
            console.error(`❌ Failed to save report: ${error.message}`);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const runner = new NodeTestRunner();
    
    if (args.length === 0) {
        // Run all tests
        await runner.runTests();
    } else {
        const command = args[0];
        
        switch(command) {
            case 'phase1':
            case 'phase2': 
            case 'phase3':
                const phase = parseInt(command.replace('phase', ''));
                await runner.runPhaseTests(phase);
                break;
                
            case 'all':
                await runner.runTests();
                break;
                
            case 'help':
                console.log('MusicTagFlow Migration Test Runner');
                console.log('');
                console.log('Usage:');
                console.log('  node node-test-runner.js [command]');
                console.log('');
                console.log('Commands:');
                console.log('  all     Run all migration tests (default)');
                console.log('  phase1  Run Phase 1 tests (Search, Phases)');
                console.log('  phase2  Run Phase 2 tests (Playlist, Tags, Container)');
                console.log('  phase3  Run Phase 3 tests (Tree, TrackNodes, DragDrop)');
                console.log('  help    Show this help message');
                break;
                
            default:
                console.error(`Unknown command: ${command}`);
                console.error('Use "help" for usage information');
                process.exit(1);
        }
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = NodeTestRunner;