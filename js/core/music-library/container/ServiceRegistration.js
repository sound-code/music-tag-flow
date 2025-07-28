const DIContainer = require('./DIContainer');

// Import services
const DatabaseManager = require('../components/DatabaseManager');
const MetadataExtractor = require('../components/MetadataExtractor');
const FileScanner = require('../components/FileScanner');
const TrackRepository = require('../components/TrackRepository');
const ScanService = require('../components/ScanService');

/**
 * Configure and register all services in the DI container
 * @param {string} dbPath - Optional database path
 * @returns {DIContainer} Configured container
 */
function configureServices(dbPath = null) {
    const container = new DIContainer();

    // Infrastructure Layer (Singletons)
    container.registerSingleton('databaseManager', () => new DatabaseManager(dbPath), []);
    container.registerSingleton('metadataExtractor', () => new MetadataExtractor(), []);
    container.registerSingleton('fileScanner', () => new FileScanner(), []);

    // Repository Layer (Singletons)
    container.registerSingleton('trackRepository', (db) => new TrackRepository(db), ['databaseManager']);

    // Service Layer (Singletons)
    container.registerSingleton('scanService', (repo, scanner, extractor) => 
        new ScanService(repo, scanner, extractor), 
        ['trackRepository', 'fileScanner', 'metadataExtractor']
    );

    return container;
}

/**
 * Create a fully initialized service container
 * @param {string} dbPath - Optional database path
 * @returns {Promise<DIContainer>} Initialized container
 */
async function createInitializedContainer(dbPath = null) {
    const container = configureServices(dbPath);

    // Initialize services that need async initialization
    const dbManager = container.resolve('databaseManager');
    const metadataExtractor = container.resolve('metadataExtractor');

    const dbReady = await dbManager.init();
    if (!dbReady) {
        throw new Error('Failed to initialize database');
    }

    const metadataReady = await metadataExtractor.init();
    if (!metadataReady) {
        throw new Error('Failed to initialize metadata extractor');
    }

    return container;
}

module.exports = {
    configureServices,
    createInitializedContainer,
    DIContainer
}; 