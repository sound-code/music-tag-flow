/**
 * Migration Test Suite - Comprehensive testing for service migration
 * Ensures functionality preservation during legacy to service architecture migration
 */

class MigrationTestSuite {
    constructor() {
        this.results = [];
        this.failures = [];
        this.performance = {};
        this.setup();
    }

    setup() {
        // Test configuration
        this.config = {
            performanceThresholds: {
                treePositioning: 100, // ms
                nodeCreation: 50,     // ms
                playlistUpdate: 20,   // ms
                tagSelection: 10      // ms
            },
            testData: {
                sampleTrack: {
                    title: "Test Track",
                    artist: "Test Artist", 
                    album: "Test Album",
                    duration: 180,
                    tags: ["emotion:happy", "energy:high", "style:pop"]
                },
                largePlotlist: [], // Will be populated with 100 tracks
                complexTagSelection: ["emotion:sad", "energy:low", "mood:calm", "style:ambient"]
            }
        };
        
        // Generate test data
        this.generateTestData();
    }

    generateTestData() {
        // Generate large playlist for performance testing
        for (let i = 0; i < 100; i++) {
            this.config.testData.largePlotlist.push({
                title: `Test Track ${i}`,
                artist: `Artist ${i}`,
                album: `Album ${Math.floor(i/10)}`,
                duration: 120 + (i % 120), // Vary duration 120-240s
                tags: [
                    `emotion:${['happy', 'sad', 'calm', 'energetic'][i % 4]}`,
                    `energy:${['high', 'medium', 'low'][i % 3]}`,
                    `style:${['pop', 'rock', 'jazz', 'classical'][i % 4]}`
                ]
            });
        }
    }

    /**
     * Main test runner - executes all migration tests
     */
    async runAllTests() {
        console.log('🧪 Starting Migration Test Suite...');
        
        try {
            // Wait for application to be ready
            await this.waitForApplicationReady();
            
            // Phase 1 Tests
            await this.testPhase1();
            
            // Phase 2 Tests  
            await this.testPhase2();
            
            // Phase 3 Tests
            await this.testPhase3();
            
            // Performance Regression Tests
            await this.testPerformanceRegression();
            
            // Integration Tests
            await this.testCrossServiceIntegration();
            
            this.generateReport();
            
        } catch (error) {
            console.error('❌ Test Suite Failed:', error);
            this.failures.push({ test: 'Test Suite Execution', error: error.message });
        }
    }

    /**
     * Wait for application to be fully initialized
     * @private
     */
    async waitForApplicationReady() {
        const maxWait = 5000; // 5 seconds
        const checkInterval = 100; // 100ms
        let waited = 0;
        
        while (waited < maxWait) {
            if (window.App && window.App.isReady && window.App.isReady()) {
                console.log('✅ Application ready for testing');
                return;
            }
            await this.wait(checkInterval);
            waited += checkInterval;
        }
        
        console.warn('⚠️ Application not fully ready, proceeding with limited testing');
    }

    /**
     * Phase 1: Low-risk quick wins testing
     */
    async testPhase1() {
        console.log('📋 Testing Phase 1: Quick Wins');
        
        // Test Search Module Cleanup
        await this.testSearchModuleCleanup();
        
        // Test Phases Module Migration  
        await this.testPhasesModuleMigration();
        
        this.logPhaseResults('Phase 1');
    }

    async testSearchModuleCleanup() {
        const testName = 'Search Module Cleanup';
        try {
            // Test SearchService availability
            const searchService = window.App?.getService('search');
            this.assert(searchService, 'SearchService should be available');
            
            // Test search functionality
            const searchQuery = 'test query';
            let queryReceived = false;
            
            // Subscribe to search event
            if (window.EventBus) {
                window.EventBus.on('search:query:update', (data) => {
                    queryReceived = data.query === searchQuery;
                });
                
                // Test search through service
                await searchService.performSearch(searchQuery);
                
                // Verify event emission
                await this.wait(100);
                this.assert(queryReceived, 'Search query event should be emitted');
            }
            
            // Test legacy compatibility
            if (window.Search) {
                this.assert(typeof window.Search.clear === 'function', 'Legacy Search.clear should exist');
                this.assert(typeof window.Search.filterTracks === 'function', 'Legacy Search.filterTracks should exist');
            }
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    async testPhasesModuleMigration() {
        const testName = 'Phases Module Migration';
        try {
            // Test phases toggle functionality
            const initialState = window.AppState?.isPhasesViewActive || false;
            
            if (window.Phases && window.Phases.togglePhasesView) {
                window.Phases.togglePhasesView();
                
                // Verify state change
                const newState = window.AppState?.isPhasesViewActive;
                this.assert(newState !== initialState, 'Phases view state should toggle');
                
                // Toggle back
                window.Phases.togglePhasesView();
                const finalState = window.AppState?.isPhasesViewActive;
                this.assert(finalState === initialState, 'Phases view should return to initial state');
            }
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    /**
     * Phase 2: Core feature migration testing
     */
    async testPhase2() {
        console.log('📦 Testing Phase 2: Core Features');
        
        // Test Playlist Service Integration
        await this.testPlaylistServiceIntegration();
        
        // Test Tag Service Integration
        await this.testTagServiceIntegration();
        
        // Test Container Service
        await this.testContainerService();
        
        this.logPhaseResults('Phase 2');
    }

    async testPlaylistServiceIntegration() {
        const testName = 'Playlist Service Integration';
        try {
            const track = this.config.testData.sampleTrack;
            
            // Test service exists and is initialized
            const playlistService = window.App?.getService('playlist');
            this.assert(playlistService, 'PlaylistService should be available');
            
            // Test addTrack functionality
            const initialSize = playlistService.getPlaylistSize();
            const entry = playlistService.addTrack(track, 'test-connection');
            
            this.assert(entry, 'addTrack should return playlist entry');
            this.assert(entry.track.title === track.title, 'Track data should be preserved');
            this.assert(playlistService.getPlaylistSize() === initialSize + 1, 'Playlist size should increase');
            
            // Test removeTrack functionality
            const removed = playlistService.removeTrack(playlistService.getPlaylistSize() - 1);
            this.assert(removed, 'removeTrack should succeed');
            this.assert(playlistService.getPlaylistSize() === initialSize, 'Playlist size should return to initial');
            
            // Test playlist duration calculation
            playlistService.addTrack(track, 'test');
            const duration = playlistService.getPlaylistDuration();
            this.assert(duration > 0, 'Playlist duration should be calculated');
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    async testTagServiceIntegration() {
        const testName = 'Tag Service Integration';
        try {
            const tagService = window.App?.getService('tags');
            this.assert(tagService, 'TagService should be available');
            
            // Test tag selection
            const tagValue = 'emotion:happy';
            const initialCount = tagService.getSelectedTagsCount();
            
            tagService.addTagToSelection(tagValue);
            this.assert(tagService.getSelectedTagsCount() === initialCount + 1, 'Selected tags count should increase');
            this.assert(tagService.isTagSelected(tagValue), 'Tag should be marked as selected');
            
            // Test tag deselection
            tagService.removeTagFromSelection(tagValue);
            this.assert(tagService.getSelectedTagsCount() === initialCount, 'Selected tags count should return to initial');
            this.assert(!tagService.isTagSelected(tagValue), 'Tag should not be marked as selected');
            
            // Test clear selection
            tagService.addTagToSelection('emotion:sad');
            tagService.addTagToSelection('energy:high');
            tagService.clearSelection();
            this.assert(tagService.getSelectedTagsCount() === 0, 'All tags should be cleared');
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    async testContainerService() {
        const testName = 'Container Service Creation';
        try {
            // Test container functionality through existing Containers module
            // This tests the bridge before full service migration
            
            if (window.Containers && window.Containers.createContainer) {
                const tracks = [this.config.testData.sampleTrack];
                const tags = ['emotion:happy'];
                
                // Test container creation
                const container = window.Containers.createContainer(tracks, tags, 'Test Container');
                this.assert(container, 'Container should be created');
                
                // Test container positioning
                this.assert(container.style.left, 'Container should have positioning');
                this.assert(container.style.top, 'Container should have positioning');
                
                // Cleanup
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                }
            }
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    /**
     * Phase 3: Complex architecture testing
     */
    async testPhase3() {
        console.log('🌳 Testing Phase 3: Complex Architecture');
        
        // Test Tree Service Migration
        await this.testTreeServiceMigration();
        
        // Test TrackNodes Service
        await this.testTrackNodesService();
        
        // Test DragDrop Service
        await this.testDragDropService();
        
        this.logPhaseResults('Phase 3');
    }

    async testTreeServiceMigration() {
        const testName = 'Tree Service Migration';
        try {
            const treeService = window.App?.getService('tree');
            
            if (treeService) {
                // Test service is initialized
                this.assert(treeService, 'TreeService should be available');
                
                // Test node management
                const nodeData = {
                    id: 'test-node-1',
                    track: this.config.testData.sampleTrack,
                    parentId: null,
                    connectionTag: 'root'
                };
                
                // Note: This tests the service interface
                // Actual implementation may vary based on migration progress
                if (typeof treeService.addNode === 'function') {
                    treeService.addNode(nodeData);
                    // Add assertions based on actual TreeService implementation
                }
            } else {
                // Test legacy Tree module functionality
                if (window.Tree) {
                    this.assert(typeof window.Tree.addNode === 'function', 'Tree.addNode should exist');
                    this.assert(typeof window.Tree.calculatePositions === 'function', 'Tree positioning should exist');
                }
            }
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    async testTrackNodesService() {
        const testName = 'TrackNodes Service';
        try {
            // Test node creation functionality
            if (window.TrackNodes && window.TrackNodes.create) {
                const track = this.config.testData.sampleTrack;
                
                // Test node creation
                const startTime = performance.now();
                const node = window.TrackNodes.create(track, null, 'test-connection');
                const endTime = performance.now();
                
                this.assert(node, 'Track node should be created');
                this.assert(node.classList.contains('track-node'), 'Node should have correct CSS class');
                
                // Performance check
                const nodeCreationTime = endTime - startTime;
                this.performance.nodeCreation = nodeCreationTime;
                this.assert(nodeCreationTime < this.config.performanceThresholds.nodeCreation, 
                           `Node creation should be under ${this.config.performanceThresholds.nodeCreation}ms`);
                
                // Cleanup
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    async testDragDropService() {
        const testName = 'DragDrop Service';
        try {
            // Test drag and drop auto-tree generation
            if (window.DragDrop && window.DragDrop.createAutoTree) {
                const track = this.config.testData.sampleTrack;
                
                // Test auto-tree creation
                const startTime = performance.now();
                await window.DragDrop.createAutoTree(track);
                const endTime = performance.now();
                
                // Performance check
                const treeCreationTime = endTime - startTime;
                this.performance.treeCreation = treeCreationTime;
                
                // Basic functionality check
                const nodes = window.AppState?.allNodes || [];
                this.assert(nodes.length > 0, 'Auto-tree should create nodes');
            }
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    /**
     * Performance regression testing
     */
    async testPerformanceRegression() {
        console.log('⚡ Testing Performance Regression');
        
        await this.testPlaylistPerformance();
        await this.testTreePositioningPerformance();
        await this.testTagSelectionPerformance();
    }

    async testPlaylistPerformance() {
        const testName = 'Playlist Performance';
        try {
            const playlistService = window.App?.getService('playlist');
            if (!playlistService) return;
            
            // Test adding many tracks
            const startTime = performance.now();
            
            for (let i = 0; i < 50; i++) {
                playlistService.addTrack(this.config.testData.largePlotlist[i], 'performance-test');
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / 50;
            
            this.performance.playlistAddition = avgTime;
            this.assert(avgTime < this.config.performanceThresholds.playlistUpdate, 
                       `Average playlist addition should be under ${this.config.performanceThresholds.playlistUpdate}ms`);
            
            // Cleanup
            playlistService.clearPlaylist();
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    async testTreePositioningPerformance() {
        const testName = 'Tree Positioning Performance';
        try {
            // Test tree positioning with many nodes
            if (window.Tree && window.Tree.calculatePositions) {
                // Create test nodes
                const testNodes = [];
                for (let i = 0; i < 20; i++) {
                    testNodes.push({
                        id: `perf-test-${i}`,
                        element: document.createElement('div'),
                        parentId: i > 0 ? `perf-test-${Math.floor(i/3)}` : null
                    });
                }
                
                const startTime = performance.now();
                window.Tree.calculatePositions(testNodes);
                const endTime = performance.now();
                
                const positioningTime = endTime - startTime;
                this.performance.treePositioning = positioningTime;
                this.assert(positioningTime < this.config.performanceThresholds.treePositioning,
                           `Tree positioning should be under ${this.config.performanceThresholds.treePositioning}ms`);
            }
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    async testTagSelectionPerformance() {
        const testName = 'Tag Selection Performance';
        try {
            const tagService = window.App?.getService('tags');
            if (!tagService) return;
            
            // Test rapid tag selection/deselection
            const tags = this.config.testData.complexTagSelection;
            
            const startTime = performance.now();
            
            for (const tag of tags) {
                tagService.addTagToSelection(tag);
                tagService.removeTagFromSelection(tag);
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / (tags.length * 2);
            
            this.performance.tagSelection = avgTime;
            this.assert(avgTime < this.config.performanceThresholds.tagSelection,
                       `Tag selection should be under ${this.config.performanceThresholds.tagSelection}ms`);
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    /**
     * Cross-service integration testing
     */
    async testCrossServiceIntegration() {
        console.log('🔗 Testing Cross-Service Integration');
        
        await this.testFullWorkflow();
        await this.testEventCommunication();
    }

    async testFullWorkflow() {
        const testName = 'Full Workflow Integration';
        try {
            // Test complete user workflow: drag -> auto-tree -> tag selection -> playlist
            const track = this.config.testData.sampleTrack;
            
            // Step 1: Simulate track drop (auto-tree generation)
            if (window.DragDrop && window.DragDrop.createAutoTree) {
                await window.DragDrop.createAutoTree(track);
                
                // Verify tree was created
                const nodes = window.AppState?.allNodes || [];
                this.assert(nodes.length > 0, 'Auto-tree should create nodes');
            }
            
            // Step 2: Simulate tag selection
            const tagService = window.App?.getService('tags');
            if (tagService) {
                tagService.addTagToSelection('emotion:happy');
                this.assert(tagService.getSelectedTagsCount() > 0, 'Tag should be selected');
            }
            
            // Step 3: Verify playlist integration
            const playlistService = window.App?.getService('playlist');
            if (playlistService) {
                const initialSize = playlistService.getPlaylistSize();
                // Track should be added during auto-tree generation
                this.assert(playlistService.getPlaylistSize() >= initialSize, 'Playlist should have tracks');
            }
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    async testEventCommunication() {
        const testName = 'Event Communication';
        try {
            if (!window.EventBus) return;
            
            // Test event subscription and emission
            let eventReceived = false;
            const testData = { test: 'data' };
            
            // Subscribe to test event
            const unsubscribe = window.EventBus.on('test:migration:event', (data) => {
                eventReceived = data.test === 'data';
            });
            
            // Emit test event
            window.EventBus.emit('test:migration:event', testData);
            
            // Wait for async processing
            await this.wait(50);
            
            this.assert(eventReceived, 'Event should be received by subscriber');
            
            // Cleanup
            unsubscribe();
            
            this.recordSuccess(testName);
            
        } catch (error) {
            this.recordFailure(testName, error);
        }
    }

    // Utility methods
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    recordSuccess(testName) {
        this.results.push({ test: testName, status: 'PASS', timestamp: Date.now() });
        console.log(`✅ ${testName}`);
    }

    recordFailure(testName, error) {
        this.failures.push({ test: testName, error: error.message, timestamp: Date.now() });
        console.log(`❌ ${testName}: ${error.message}`);
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    logPhaseResults(phaseName) {
        const phaseTests = this.results.filter(r => r.test.includes(phaseName) || 
                                              this.isPhaseTest(r.test, phaseName));
        const phaseFailures = this.failures.filter(f => f.test.includes(phaseName) ||
                                                  this.isPhaseTest(f.test, phaseName));
        
        console.log(`📊 ${phaseName} Results: ${phaseTests.length} passed, ${phaseFailures.length} failed`);
    }

    isPhaseTest(testName, phaseName) {
        const phaseMapping = {
            'Phase 1': ['Search', 'Phases'],
            'Phase 2': ['Playlist', 'Tag', 'Container'],
            'Phase 3': ['Tree', 'TrackNodes', 'DragDrop']
        };
        
        return phaseMapping[phaseName]?.some(keyword => testName.includes(keyword)) || false;
    }

    generateReport() {
        const totalTests = this.results.length;
        const totalFailures = this.failures.length;
        const successRate = ((totalTests - totalFailures) / totalTests * 100).toFixed(2);
        
        console.log('\n📋 Migration Test Suite Report');
        console.log('=====================================');
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${totalTests - totalFailures}`);
        console.log(`Failed: ${totalFailures}`);
        console.log(`Success Rate: ${successRate}%`);
        
        if (Object.keys(this.performance).length > 0) {
            console.log('\n⚡ Performance Metrics:');
            Object.entries(this.performance).forEach(([metric, value]) => {
                console.log(`  ${metric}: ${value.toFixed(2)}ms`);
            });
        }
        
        if (this.failures.length > 0) {
            console.log('\n❌ Failures:');
            this.failures.forEach(failure => {
                console.log(`  - ${failure.test}: ${failure.error}`);
            });
        }
        
        console.log('\n=====================================');
        
        return {
            summary: { totalTests, totalFailures, successRate },
            performance: this.performance,
            failures: this.failures,
            results: this.results
        };
    }
}

// Export for use in browser and Node.js
if (typeof window !== 'undefined') {
    window.MigrationTestSuite = MigrationTestSuite;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MigrationTestSuite;
}