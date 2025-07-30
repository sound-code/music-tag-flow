/**
 * Test script for refactored TrackRepository with new services
 * Run with: node tests/test-track-repository-refactored.js
 */

const { createInitializedContainer } = require('../js/core/music-library/container/ServiceRegistration');
const path = require('path');
const fs = require('fs');

// Console colors for better output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    log(`\n${'='.repeat(50)}`, 'blue');
    log(title, 'bright');
    log('='.repeat(50), 'blue');
}

// Create a test database in memory
async function setupTestEnvironment() {
    const testDbPath = ':memory:'; // Use in-memory SQLite for testing
    
    try {
        const container = await createInitializedContainer(testDbPath);
        return container;
    } catch (error) {
        log(`Failed to setup test environment: ${error.message}`, 'red');
        throw error;
    }
}

// Test saving tracks with enrichment
async function testTrackSavingWithEnrichment(container) {
    logSection('Testing Track Saving with Enrichment');
    
    const trackRepository = container.resolve('trackRepository');
    const enrichmentService = container.resolve('trackEnrichmentService');
    
    // Test 1: Save a track without existing tags
    log('\nTest 1: Save track without existing tags');
    const track1 = {
        title: 'Test Song 1',
        artist: 'Test Artist',
        album: 'Test Album',
        file_path: '/path/to/song1.mp3',
        duration: 180,
        file_size: 3145728
    };
    
    const saved1 = await trackRepository.saveTrack(track1);
    log(`Track saved: ${saved1}`, saved1 ? 'green' : 'red');
    
    // Verify track was saved and enriched
    const allTracks = await trackRepository.getAllTracks();
    if (allTracks.length > 0) {
        const savedTrack = allTracks[0];
        const tags = JSON.parse(savedTrack.tags);
        log(`Saved track has ${tags.length} tags`, 'green');
        log(`Sample tags: ${tags.slice(0, 5).join(', ')}...`, 'yellow');
    }
    
    // Test 2: Save a track with existing tags
    log('\nTest 2: Save track with existing tags');
    const track2 = {
        title: 'Test Song 2',
        artist: 'Test Artist',
        album: 'Test Album',
        file_path: '/path/to/song2.flac',
        tags: JSON.stringify(['custom:mytag', 'mood:happy']),
        duration: 240,
        file_size: 52428800
    };
    
    const saved2 = await trackRepository.saveTrack(track2);
    log(`Track saved: ${saved2}`, saved2 ? 'green' : 'red');
    
    // Verify both tracks
    const allTracksAfter = await trackRepository.getAllTracks();
    log(`\nTotal tracks in database: ${allTracksAfter.length}`, 'blue');
    
    // Check if custom tags were preserved
    const track2Saved = allTracksAfter.find(t => t.title === 'Test Song 2');
    if (track2Saved) {
        const tags2 = JSON.parse(track2Saved.tags);
        const hasCustomTag = tags2.includes('custom:mytag');
        log(`Custom tag preserved: ${hasCustomTag}`, hasCustomTag ? 'green' : 'red');
        log(`Track 2 has ${tags2.length} total tags`, 'green');
    }
    
    return saved1 && saved2;
}

// Test repository statistics
async function testRepositoryStats(container) {
    logSection('Testing Repository Statistics');
    
    const trackRepository = container.resolve('trackRepository');
    
    const stats = await trackRepository.getStats();
    log(`\nDatabase Statistics:`, 'blue');
    log(`  Tracks: ${stats.tracks}`, 'yellow');
    log(`  Artists: ${stats.artists}`, 'yellow');
    log(`  Albums: ${stats.albums}`, 'yellow');
    log(`  Unique Tags: ${stats.uniqueTags.length}`, 'yellow');
    
    if (stats.uniqueTags.length > 0) {
        log(`\nTag Categories Found:`, 'blue');
        const categories = new Set();
        stats.uniqueTags.forEach(tag => {
            const [category] = tag.split(':');
            if (category) categories.add(category);
        });
        
        Array.from(categories).sort().forEach(cat => {
            const count = stats.uniqueTags.filter(t => t.startsWith(cat + ':')).length;
            log(`  ${cat}: ${count} unique values`, 'yellow');
        });
    }
    
    return stats.tracks === 2; // We saved 2 tracks
}

// Test that services are properly wired
async function testServiceIntegration(container) {
    logSection('Testing Service Integration');
    
    // Verify all services are registered
    const services = [
        'databaseManager',
        'tagGenerationService', 
        'trackEnrichmentService',
        'trackRepository'
    ];
    
    let allRegistered = true;
    services.forEach(serviceName => {
        try {
            const service = container.resolve(serviceName);
            log(`✓ ${serviceName} is registered and accessible`, 'green');
        } catch (error) {
            log(`✗ ${serviceName} is NOT registered: ${error.message}`, 'red');
            allRegistered = false;
        }
    });
    
    // Test that TrackRepository has enrichment service
    const trackRepo = container.resolve('trackRepository');
    const hasEnrichmentService = trackRepo.enrichmentService !== null;
    log(`\nTrackRepository has enrichment service: ${hasEnrichmentService}`, 
        hasEnrichmentService ? 'green' : 'red');
    
    return allRegistered && hasEnrichmentService;
}

// Run all tests
async function runTests() {
    log('Starting TrackRepository Integration Tests', 'bright');
    
    let container;
    try {
        // Setup test environment
        container = await setupTestEnvironment();
        
        // Run tests
        const test1Pass = await testServiceIntegration(container);
        const test2Pass = await testTrackSavingWithEnrichment(container);
        const test3Pass = await testRepositoryStats(container);
        
        logSection('Test Summary');
        log(`Service Integration: ${test1Pass ? 'PASSED ✓' : 'FAILED ✗'}`, 
            test1Pass ? 'green' : 'red');
        log(`Track Saving with Enrichment: ${test2Pass ? 'PASSED ✓' : 'FAILED ✗'}`, 
            test2Pass ? 'green' : 'red');
        log(`Repository Statistics: ${test3Pass ? 'PASSED ✓' : 'FAILED ✗'}`, 
            test3Pass ? 'green' : 'red');
        
        const allPassed = test1Pass && test2Pass && test3Pass;
        log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`, 
            allPassed ? 'green' : 'red');
        
        // Cleanup
        if (container) {
            const dbManager = container.resolve('databaseManager');
            dbManager.close();
        }
        
        process.exit(allPassed ? 0 : 1);
    } catch (error) {
        log(`\nError during tests: ${error.message}`, 'red');
        console.error(error);
        
        // Cleanup on error
        if (container) {
            try {
                const dbManager = container.resolve('databaseManager');
                dbManager.close();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        
        process.exit(1);
    }
}

// Run tests
runTests();