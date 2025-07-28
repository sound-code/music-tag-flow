/**
 * State Management Module
 * Manages global application state and DOM element references
 */

// Global state management
let allNodes = [];
let nodeCounter = 0;
let allContainers = [];
let selectedTagForNextNode = null;
let selectedTags = new Set(); // Set to store selected tags
let currentMultiTagContainer = null; // Current container showing multi-tag results
let currentTagSourceTrack = null; // Track which node the current tag selections came from
let playlistEntries = []; // Separate playlist entries from tree nodes
let hasUsedDropZone = false; // Flag per tracciare se il drop-zone è mai stato usato
let isPhasesViewActive = false; // Flag for playlist phases view
let currentPlaylistTime = 0; // Current playlist time in minutes
let rootNodeColor = null; // Color category for the root node - all nodes will use this color

// Cache DOM elements
const canvas = document.querySelector('.mindmap-canvas');
const canvasContent = document.querySelector('.canvas-content');
const dropZone = document.querySelector('.drop-zone');
const breadcrumb = document.getElementById('breadcrumb');
const searchField = document.getElementById('searchField');
const clearSearchBtn = document.getElementById('clearSearch');
const searchResults = document.getElementById('searchResults');
const searchResultsList = document.getElementById('searchResultsList');
const musicLibrary = document.getElementById('musicLibrary');
// DOM elements that will be initialized later
let playlistPhasesBtn = null;
let playlistPhasesView = null;
let realTimeClock = null;
let clockTime = null;
let progressLine = null;

// Export state and DOM references for other modules
window.AppState = {
    // State variables
    allNodes,
    nodeCounter,
    allContainers,
    selectedTagForNextNode,
    selectedTags,
    currentMultiTagContainer,
    currentTagSourceTrack,
    playlistEntries,
    hasUsedDropZone,
    isPhasesViewActive,
    currentPlaylistTime,
    rootNodeColor,
    
    // DOM elements
    canvas,
    canvasContent,
    dropZone,
    breadcrumb,
    searchField,
    clearSearchBtn,
    searchResults,
    searchResultsList,
    musicLibrary,
    playlistPhasesBtn,
    playlistPhasesView,
    realTimeClock,
    clockTime,
    progressLine,
    
    // State mutators
    incrementNodeCounter: () => ++nodeCounter,
    setNodeCounter: (value) => nodeCounter = value,
    setSelectedTagForNextNode: (tag) => selectedTagForNextNode = tag,
    setCurrentMultiTagContainer: (container) => currentMultiTagContainer = container,
    setCurrentTagSourceTrack: (track) => currentTagSourceTrack = track,
    setHasUsedDropZone: (value) => hasUsedDropZone = value,
    setIsPhasesViewActive: (value) => {
        isPhasesViewActive = value;
        AppState.isPhasesViewActive = value;
    },
    setCurrentPlaylistTime: (time) => {
        currentPlaylistTime = time;
        AppState.currentPlaylistTime = time;
    },
    setRootNodeColor: (color) => {
        rootNodeColor = color;
        AppState.rootNodeColor = color;
    },
    
    // Clear all state
    clearState: () => {
        allNodes.length = 0;
        allContainers.length = 0;
        selectedTags.clear();
        nodeCounter = 0;
        selectedTagForNextNode = null;
        currentMultiTagContainer = null;
        currentTagSourceTrack = null;
        playlistEntries.length = 0;
        hasUsedDropZone = false;
        isPhasesViewActive = false;
        currentPlaylistTime = 0;
        rootNodeColor = null;
    },
    
    // Clear only tree state, keep playlist and clock running
    clearTreeState: () => {
        allNodes.length = 0;
        allContainers.length = 0;
        selectedTags.clear();
        nodeCounter = 0;
        selectedTagForNextNode = null;
        currentMultiTagContainer = null;
        currentTagSourceTrack = null;
        hasUsedDropZone = false;
        rootNodeColor = null;
        // Keep: playlistEntries, isPhasesViewActive, currentPlaylistTime
    },
    
    // Initialize DOM elements for phases
    initializePhasesElements: () => {
        playlistPhasesBtn = document.getElementById('playlistPhasesBtn');
        playlistPhasesView = document.getElementById('playlistPhasesView');
        realTimeClock = document.getElementById('realTimeClock');
        clockTime = document.getElementById('clockTime');
        progressLine = document.getElementById('progressLine');
        
        // Update the exported references
        AppState.playlistPhasesBtn = playlistPhasesBtn;
        AppState.playlistPhasesView = playlistPhasesView;
        AppState.realTimeClock = realTimeClock;
        AppState.clockTime = clockTime;
        AppState.progressLine = progressLine;
    },
    
    /**
     * Initialize EventBus listeners for AppState synchronization
     */
    initializeEventBusListeners: () => {
        if (window.EventBus) {
            // Listen for playlist entries sync from PlaylistService
            window.EventBus.on('playlist:entries-sync', (data) => {
                // Sync with legacy AppState structure
                playlistEntries.length = 0;
                playlistEntries.push(...data.entries);
            });
        }
    }
}; 