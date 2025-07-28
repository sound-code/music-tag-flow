/**
 * Playlist Phases Module - Pure Facade/Bridge to PhasesService
 * Provides backward compatibility for legacy code
 * All functionality is delegated to PhasesService
 */

const PlaylistPhases = {
    /**
     * Toggle between tree view and phases view
     */
    toggle() {
        // Delegate to PhasesService
        if (window.App && window.App.getService) {
            const phasesService = window.App.getService('phases');
            if (phasesService && typeof phasesService.togglePhases === 'function') {
                phasesService.togglePhases();
                return;
            }
        }
        
        // Fallback implementation (should not be reached if PhasesService is available)
        AppState.setIsPhasesViewActive(!AppState.isPhasesViewActive);
        
        if (AppState.isPhasesViewActive) {
            this.show();
        } else {
            this.hide();
        }
    },
    
    /**
     * Show the phases view
     */
    show() {
        // Delegate to PhasesService
        if (window.App && window.App.getService) {
            const phasesService = window.App.getService('phases');
            if (phasesService && typeof phasesService.showPhases === 'function') {
                phasesService.showPhases();
                return;
            }
        }
        
        // This should not be reached if PhasesService is available
    },
    
    /**
     * Hide the phases view
     */
    hide() {
        // Delegate to PhasesService
        if (window.App && window.App.getService) {
            const phasesService = window.App.getService('phases');
            if (phasesService && typeof phasesService.hidePhases === 'function') {
                phasesService.hidePhases();
                return;
            }
        }
        
        // This should not be reached if PhasesService is available
    },
    
    /**
     * Initialize the progress line when opening phases view
     * Legacy method - now handled by PhasesService
     */
    initializeProgressLine() {
        // Delegate to PhasesService
        if (window.App && window.App.getService) {
            const phasesService = window.App.getService('phases');
            if (phasesService && typeof phasesService.initializeProgressLine === 'function') {
                phasesService.initializeProgressLine();
                return;
            }
        }
        
        // This should not be reached if PhasesService is available
    },
    
    // Legacy property for compatibility
    timeUpdateInterval: null
};

/**
 * Global function to toggle playlist phases (called from HTML)
 */
function togglePlaylistPhases() {
    // Try to use PhasesService directly
    if (window.App && window.App.getService) {
        const phasesService = window.App.getService('phases');
        if (phasesService && typeof phasesService.togglePhases === 'function') {
            phasesService.togglePhases();
            return;
        }
    }
    
    // Fallback to legacy PlaylistPhases
    if (PlaylistPhases && PlaylistPhases.toggle) {
        PlaylistPhases.toggle();
    }
}

// Make PlaylistPhases available globally
window.PlaylistPhases = PlaylistPhases;