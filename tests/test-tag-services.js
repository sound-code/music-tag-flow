/**
 * Test script for TagGenerationService and TrackEnrichmentService
 * Run with: node tests/test-tag-services.js
 */

const TagGenerationService = require('../js/core/music-library/services/TagGenerationService');
const TrackEnrichmentService = require('../js/core/music-library/services/TrackEnrichmentService');

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

// Test TagGenerationService
function testTagGenerationService() {
    logSection('Testing TagGenerationService');
    
    const tagGenService = new TagGenerationService();
    
    // Test 1: Generate synthetic tags
    log('\nTest 1: Generate synthetic tags for a track');
    const testTrack = {
        title: 'Test Song',
        artist: 'Test Artist',
        file_path: '/path/to/song.mp3',
        genre: 'Rock'
    };
    
    const syntheticTags = tagGenService.generateSyntheticTags(testTrack);
    
    log(`Generated ${syntheticTags.length} tags:`, 'green');
    
    // Group tags by category
    const tagsByCategory = {};
    syntheticTags.forEach(tag => {
        const [category, value] = tag.split(':');
        if (!tagsByCategory[category]) {
            tagsByCategory[category] = [];
        }
        tagsByCategory[category].push(value);
    });
    
    Object.entries(tagsByCategory).forEach(([category, tags]) => {
        log(`  ${category}: ${tags.join(', ')}`, 'yellow');
    });
    
    // Verify all core categories are present
    const coreCategories = tagGenService.getTagCategories().core;
    const missingCategories = coreCategories.filter(cat => !tagsByCategory[cat]);
    
    if (missingCategories.length === 0) {
        log('\n✓ All core categories are present', 'green');
    } else {
        log(`\n✗ Missing categories: ${missingCategories.join(', ')}`, 'red');
    }
    
    // Test 2: Quality tags generation
    log('\nTest 2: Quality tags for different file types');
    const fileTypes = ['song.flac', 'track.mp3', 'audio.wav', 'music.m4a'];
    
    fileTypes.forEach(filename => {
        const tags = tagGenService.generateQualityTags({ file_path: `/path/${filename}` });
        log(`  ${filename}: ${tags.join(', ')}`, 'yellow');
    });
    
    return syntheticTags.length > 20; // Should generate many tags
}

// Test TrackEnrichmentService
function testTrackEnrichmentService() {
    logSection('Testing TrackEnrichmentService');
    
    const tagGenService = new TagGenerationService();
    const enrichmentService = new TrackEnrichmentService(tagGenService);
    
    // Test 1: Enrich track with no existing tags
    log('\nTest 1: Enrich track with no existing tags');
    const track1 = {
        title: 'Song Without Tags',
        artist: 'Artist Name',
        album: 'Album Name',
        file_path: '/path/to/song.mp3'
    };
    
    const enrichedTrack1 = enrichmentService.enrichTrackData(track1);
    const tags1 = JSON.parse(enrichedTrack1.tags);
    
    log(`Track enriched with ${tags1.length} tags`, 'green');
    log(`Sample tags: ${tags1.slice(0, 5).join(', ')}...`, 'yellow');
    
    // Test 2: Enrich track with existing tags
    log('\nTest 2: Enrich track with existing tags');
    const track2 = {
        title: 'Song With Tags',
        artist: 'Another Artist',
        tags: JSON.stringify(['custom:tag1', 'custom:tag2'])
    };
    
    const enrichedTrack2 = enrichmentService.enrichTrackData(track2);
    const tags2 = JSON.parse(enrichedTrack2.tags);
    
    const hasCustomTags = tags2.includes('custom:tag1') && tags2.includes('custom:tag2');
    log(`Track has ${tags2.length} tags (includes custom: ${hasCustomTags})`, 'green');
    
    // Test 3: Parse different tag formats
    log('\nTest 3: Parse different tag formats');
    const tagFormats = [
        { input: '["tag1", "tag2"]', expected: 2 },
        { input: 'tag1,tag2,tag3', expected: 3 },
        { input: ['array', 'tags'], expected: 2 },
        { input: null, expected: 0 }
    ];
    
    tagFormats.forEach(({ input, expected }) => {
        const parsed = enrichmentService.parseExistingTags(input);
        const success = parsed.length === expected;
        log(`  ${JSON.stringify(input)} → ${parsed.length} tags ${success ? '✓' : '✗'}`, 
            success ? 'green' : 'red');
    });
    
    // Test 4: Add/Remove tags
    log('\nTest 4: Add and remove specific tags');
    const track3 = { tags: JSON.stringify(['existing:tag']) };
    
    const withAdded = enrichmentService.addTagsToTrack(track3, ['new:tag1', 'new:tag2']);
    const addedTags = JSON.parse(withAdded.tags);
    log(`  After adding: ${addedTags.length} tags`, 'green');
    
    const withRemoved = enrichmentService.removeTagsFromTrack(withAdded, ['existing:tag']);
    const removedTags = JSON.parse(withRemoved.tags);
    log(`  After removing: ${removedTags.length} tags`, 'green');
    
    // Test 5: Tag statistics
    log('\nTest 5: Track tag statistics');
    const stats = enrichmentService.getTrackTagStats(enrichedTrack1);
    log(`  Total tags: ${stats.totalTags}`, 'yellow');
    log(`  Categories: ${stats.categories}`, 'yellow');
    log(`  Category breakdown:`, 'yellow');
    Object.entries(stats.tagsByCategory).slice(0, 5).forEach(([cat, tags]) => {
        log(`    ${cat}: ${tags.length} tags`, 'blue');
    });
    
    return tags1.length > 20 && hasCustomTags;
}

// Run all tests
function runTests() {
    log('Starting Tag Services Tests', 'bright');
    
    try {
        const test1Pass = testTagGenerationService();
        const test2Pass = testTrackEnrichmentService();
        
        logSection('Test Summary');
        log(`TagGenerationService: ${test1Pass ? 'PASSED ✓' : 'FAILED ✗'}`, 
            test1Pass ? 'green' : 'red');
        log(`TrackEnrichmentService: ${test2Pass ? 'PASSED ✓' : 'FAILED ✗'}`, 
            test2Pass ? 'green' : 'red');
        
        const allPassed = test1Pass && test2Pass;
        log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`, 
            allPassed ? 'green' : 'red');
        
        process.exit(allPassed ? 0 : 1);
    } catch (error) {
        log(`\nError during tests: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Run tests
runTests();