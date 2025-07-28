/**
 * Unit Tests for TrackRepository
 * Tests business logic layer in isolation
 */

class MockDatabaseManager {
    constructor(ready = true) {
        this.ready = ready;
        this.tracks = [];
        this.insertCalled = false;
        this.updateArtistCalled = false;
        this.updateAlbumCalled = false;
    }

    isReady() { return this.ready; }
    
    async insertTrack(trackData) {
        this.insertCalled = true;
        this.tracks.push(trackData);
        return true;
    }

    async getAllTracks(limit) {
        return this.tracks.slice(0, limit);
    }

    async getStats() {
        return { tracks: this.tracks.length, artists: 1, albums: 1 };
    }

    async insertArtistIfNotExists(artist) {
        this.updateArtistCalled = true;
        return true;
    }

    async updateArtistTrackCount(artist) { return true; }
    async insertAlbumIfNotExists(album, artist, year) {
        this.updateAlbumCalled = true;
        return true;
    }
    async updateAlbumTrackCount(album, artist) { return true; }
}

const TrackRepository = require('../components/TrackRepository');

async function runTrackRepositoryTests() {
    console.log('🧪 TrackRepository Unit Tests\n');

    let testCount = 0;
    let passCount = 0;

    function test(name, condition) {
        testCount++;
        const status = condition ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${status} ${name}`);
        if (condition) passCount++;
    }

    try {
        // Test 1: Constructor and basic methods
        console.log('📦 Test 1: Constructor and Interface Compliance');
        const mockDb = new MockDatabaseManager();
        const repo = new TrackRepository(mockDb);

        test('Constructor initializes correctly', repo.db === mockDb);
        test('isReady() works correctly', repo.isReady() === true);
        test('Implements interface methods', 
            typeof repo.saveTrack === 'function' &&
            typeof repo.getAllTracks === 'function' &&
            typeof repo.getStats === 'function'
        );

        // Test 2: saveTrack business logic
        console.log('\n💾 Test 2: saveTrack Business Logic');
        const testTrack = {
            title: 'Test Song',
            artist: 'Test Artist',
            album: 'Test Album',
            year: 2023
        };

        const saveResult = await repo.saveTrack(testTrack);
        test('saveTrack returns true on success', saveResult === true);
        test('Database insertTrack was called', mockDb.insertCalled === true);
        test('Artist count update was called', mockDb.updateArtistCalled === true);
        test('Album count update was called', mockDb.updateAlbumCalled === true);

        // Test 3: Database not ready scenario
        console.log('\n⚠️  Test 3: Error Handling');
        const mockDbNotReady = new MockDatabaseManager(false);
        const repoNotReady = new TrackRepository(mockDbNotReady);

        try {
            await repoNotReady.saveTrack(testTrack);
            test('Throws error when DB not ready', false);
        } catch (error) {
            test('Throws error when DB not ready', error.message.includes('Database not ready'));
        }

        // Test 4: Delegation methods
        console.log('\n🔄 Test 4: Method Delegation');
        const tracks = await repo.getAllTracks(10);
        test('getAllTracks delegates correctly', Array.isArray(tracks));

        const stats = await repo.getStats();
        test('getStats delegates correctly', typeof stats === 'object' && 'tracks' in stats);

        console.log(`\n📊 TrackRepository Test Results: ${passCount}/${testCount} tests passed`);
        return passCount === testCount;

    } catch (error) {
        console.error('❌ Error in TrackRepository tests:', error);
        return false;
    }
}

module.exports = { runTrackRepositoryTests }; 