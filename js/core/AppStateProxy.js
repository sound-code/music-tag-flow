/**
 * AppStateProxy - Backward compatibility layer for AppState
 * Proxies old AppState usage to new StateManager while maintaining existing API
 */
class AppStateProxy {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.setupProxy();
    }
    setupProxy() {
        // Create a proxy object that intercepts property access
        const proxy = new Proxy(this, {
            get: (target, property) => {
                // Handle method calls
                if (typeof target[property] === 'function') {
                    return target[property].bind(target);
                }
                // Handle special property mappings
                return this.stateManager.getMappedValue(property);
            },
            set: (target, property, value) => {
                this.stateManager.setMappedValue(property, value);
                return true;
            },
            has: (target, property) => {
                return this.stateManager.getMappedValue(property) !== undefined;
            }
        });
        return proxy;
    }
    // Legacy methods that need to be preserved
    incrementNodeCounter() {
        const current = this.stateManager.get('tree.nodeCounter') || 0;
        this.stateManager.set('tree.nodeCounter', current + 1);
        return current + 1;
    }
    setSelectedTagForNextNode(tag) {
        this.stateManager.set('app.selectedTagForNextNode', tag);
    }
    setCurrentMultiTagContainer(container) {
        this.stateManager.set('app.currentMultiTagContainer', container);
    }
    clearTreeState() {
        this.stateManager.transaction([
            { path: 'dom.allNodes', value: [] },
            { path: 'dom.allContainers', value: [] },
            { path: 'ui.selectedTags', value: new Set() },
            { path: 'tree.nodeCounter', value: 0 },
            { path: 'app.selectedTagForNextNode', value: null },
            { path: 'app.currentMultiTagContainer', value: null },
            { path: 'app.currentTagSourceTrack', value: null }
        ]);
    }
    clearAll() {
        this.stateManager.transaction([
            { path: 'dom.allNodes', value: [] },
            { path: 'dom.allContainers', value: [] },
            { path: 'ui.selectedTags', value: new Set() },
            { path: 'tree.nodeCounter', value: 0 },
            { path: 'app.selectedTagForNextNode', value: null },
            { path: 'app.currentMultiTagContainer', value: null },
            { path: 'app.currentTagSourceTrack', value: null },
            { path: 'playlist.entries', value: [] },
            { path: 'app.hasUsedDropZone', value: false },
            { path: 'app.isPhasesViewActive', value: false }
        ]);
    }
    // DOM initialization method
    initializeDOMReferences() {
        const domMappings = {
            'dom.canvas': document.getElementById('canvas'),
            'dom.canvasContent': document.getElementById('canvas-content'),
            'dom.breadcrumb': document.getElementById('breadcrumb'),
            'dom.dropZone': document.getElementById('drop-zone')
        };
        this.stateManager.transaction(
            Object.entries(domMappings).map(([path, element]) => ({
                path,
                value: element
            }))
        );
    }
    // Getter for DOM elements (for backward compatibility)
    get canvas() { return this.stateManager.get('dom.canvas'); }
    get canvasContent() { return this.stateManager.get('dom.canvasContent'); }
    get breadcrumb() { return this.stateManager.get('dom.breadcrumb'); }
    get dropZone() { return this.stateManager.get('dom.dropZone'); }
    // Array properties (with special handling)
    get allNodes() { 
        return this.stateManager.get('dom.allNodes') || []; 
    }
    set allNodes(value) { 
        this.stateManager.set('dom.allNodes', value); 
    }
    get allContainers() { 
        return this.stateManager.get('dom.allContainers') || []; 
    }
    set allContainers(value) { 
        this.stateManager.set('dom.allContainers', value); 
    }
    get playlistEntries() { 
        return this.stateManager.get('playlist.entries') || []; 
    }
    set playlistEntries(value) { 
        this.stateManager.set('playlist.entries', value); 
    }
    get selectedTags() { 
        return this.stateManager.get('ui.selectedTags') || new Set(); 
    }
    set selectedTags(value) { 
        this.stateManager.set('ui.selectedTags', value); 
    }
    // Other properties
    get nodeCounter() { 
        return this.stateManager.get('tree.nodeCounter') || 0; 
    }
    set nodeCounter(value) { 
        this.stateManager.set('tree.nodeCounter', value); 
    }
    get hasUsedDropZone() { 
        return this.stateManager.get('app.hasUsedDropZone') || false; 
    }
    set hasUsedDropZone(value) { 
        this.stateManager.set('app.hasUsedDropZone', value); 
    }
    get isPhasesViewActive() { 
        return this.stateManager.get('app.isPhasesViewActive') || false; 
    }
    set isPhasesViewActive(value) { 
        this.stateManager.set('app.isPhasesViewActive', value); 
    }
    get currentMultiTagContainer() { 
        return this.stateManager.get('app.currentMultiTagContainer'); 
    }
    set currentMultiTagContainer(value) { 
        this.stateManager.set('app.currentMultiTagContainer', value); 
    }
    get currentTagSourceTrack() { 
        return this.stateManager.get('app.currentTagSourceTrack'); 
    }
    set currentTagSourceTrack(value) { 
        this.stateManager.set('app.currentTagSourceTrack', value); 
    }
    get selectedTagForNextNode() { 
        return this.stateManager.get('app.selectedTagForNextNode'); 
    }
    set selectedTagForNextNode(value) { 
        this.stateManager.set('app.selectedTagForNextNode', value); 
    }
}
// Export for use in state.js
window.AppStateProxy = AppStateProxy;