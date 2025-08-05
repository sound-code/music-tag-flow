# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ IMPORTANT: Before Making Any Code Changes

**ALWAYS read both CLAUDE.md and DEVELOPMENT_PRACTICES.md before executing any modifications to ensure:**
- Consistency with existing architecture and patterns
- Adherence to code quality standards
- Proper error handling and robustness
- Optimal performance and user experience
- Security and accessibility compliance

## Project Overview

MusicTagFlow is a web-based musical playlist application that creates interactive mind maps from music tracks. Users drag tracks from a music library to generate tree-like visualizations based on musical tags (emotion, energy, mood, style, etc.). The application features a 3-level auto-generated tree structure with animated curved connections between nodes.

## Development Commands

This is a client-side only application that can run in both browser and Electron environments:

```bash
# Browser development (recommended for most development)
python -m http.server 8000
# or
npx serve .
# or
npm run serve      # Equivalent to python -m http.server 8000

# Electron development (for desktop app features)
npm start          # Run Electron app
npm run dev        # Run Electron with devtools

# Open http://localhost:8000 in browser for web version
```

**Important Notes**:
- No testing framework or build tools are configured - the application runs directly without compilation or bundling
- No linting or type checking configured - maintain code quality manually
- When asked to run lint/typecheck commands, ask user for the appropriate commands and suggest adding them to CLAUDE.md
- Manual testing files exist in `tests/` directory for specific functionality validation
- Use `node tests/[filename].js` to run manual tests

## Architecture

### Service-Based Architecture

The application is transitioning from a monolithic approach to a service-based architecture. Core functionality is organized into services managed by `ServiceManager` with dependency injection and lifecycle management.

**Core Services** (`js/core/`):
- **ServiceManager.js** - Centralized service management and dependency injection
- **StateManager.js** - Global state management with reactive updates
- **EventBus.js** - Inter-service communication and event handling
- **DataService.js** - Centralized data access service using MusicLibraryFacade (database-only)
- **UIService.js** - Tooltip management, visual effects, and category highlighting
- **TreeService.js** - Tree visualization, positioning algorithms, and SVG rendering
- **DragDropService.js** - Drag & drop functionality and auto-tree generation
- **TrackNodesService.js** - Track node creation, tag management, and UI interactions
- **TagService.js** - Tag selection system and multi-tag filtering
- **SearchService.js** - Real-time search functionality across tracks/artists/albums
- **PlaylistService.js** - Playlist management and export functionality
- **PhasesService.js** - Playlist phase visualization (time-based concentric circles)
- **ClockService.js** - Real-time playlist duration clock management
- **StatsService.js** - Statistics tracking and display
- **LegendService.js** - Tag color legend management

**Music Library System** (`js/core/music-library/`):
- **MusicLibraryFacade.js** - Main interface for music library operations
- **components/DatabaseManager.js** - SQLite database management with connection pooling
- **components/FileScanner.js** - File system scanning and metadata extraction
- **components/TrackRepository.js** - Track data storage and retrieval with caching
- **components/MetadataExtractor.js** - Audio file metadata parsing
- **services/TagGenerationService.js** - Automatic tag generation from metadata
- **services/TrackEnrichmentService.js** - Track data enrichment and normalization
- **container/DIContainer.js** - Dependency injection for music library components
- **interfaces/** - TypeScript-style interfaces for consistency

**UI Components** (`js/ui/`):
- **StatsComponent.js** - Real-time statistics display with live updates
- **LibraryToggle.js** - Library visibility toggle with EventBus integration
- **PlaylistUIHandler.js** - Playlist UI interactions and animations
- **LegendUIHandler.js** - Tag legend UI management

**Legacy Modules** (being migrated to services):
- **main.js** - Application entry point and service initialization
- **state.js** - Legacy AppState (use StateManager for new code)
- **ui.js** - UI utilities and user interactions
- **utils.js** - Shared utility functions and music library rendering

### Key Architecture Patterns

**Event-Driven Communication**: Services communicate via EventBus for loose coupling. Key events:
- `playlist:clear` - Clear tree visualization (keeps playlist data)  
- `playlist:track-added` - New track added to playlist
- `tree:node-created` - Node created in tree
- `tree:cleared` - Tree visualization cleared
- `ui:notification` - Display user notifications
- `tooltip:show` / `tooltip:hide` - Tooltip management
- `data:loading:complete` - Data source initialization complete
- `search:query:update` - Search query initiated
- `library:toggle` - Music library visibility toggle
- `stats:updated` - Statistics data updated
- `phases:toggle` / `phases:show` / `phases:hide` - Phases view control
- `time:elapsed` - Real-time clock updates for progress line

**State Management**: 
- Use `StateManager` for new code with reactive subscriptions
- Legacy `AppState` remains for backward compatibility
- State paths follow dot notation: `app.selectedTags`, `tree.nodes`, etc.

**Tree Generation Configuration**:
```javascript
// In TreeService.config or DragDropService.config
{
    maxLevels: 2,              // Total tree depth after root
    branchesPerTag: 1,         // Tracks per tag
    levelConfigs: {
        1: { tagsPerLevel: 5 }, // Level 1: 5 nodes in circle
        2: { tagsPerLevel: 3 }  // Level 2: 3 nodes per semi-circle
    },
    animationDelay: 400,       // Between level generation
    branchDelay: 150          // Between individual branches
}
```

**Tag System**: 10 categories with consistent color mapping:
- emotion (pink), energy (orange), mood (purple), style (blue)
- occasion (green), weather (light blue), intensity (red)
- rating (yellow), tempo (teal), vibe (indigo)

### Data Flow

1. **Data Access**: All services use `DataService` → `MusicLibraryFacade` → SQLite database (Electron only)
2. **Track Drop**: User drags track → `DragDropService.handleDrop()` → `TreeService.createAutoTree()`
3. **Tree Building**: `TreeService.buildTreeLevel()` → `TrackNodesService.createNode()` → `TreeService.addNode()`
4. **Positioning**: `TreeService.calculatePositions()` → Collision detection → `TreeService.applyPositions()`
5. **Connections**: `TreeService.drawConnection()` → SVG path with curve animation
6. **State Update**: Service methods → `StateManager.setState()` → Event emission → UI updates

### Critical Implementation Details

**Track Data Format**:
```javascript
{
    title: "Song Name",
    artist: "Artist Name", 
    album: "Album Name",
    tags: ["mood:energetic", "energy:high", "style:electronic"]
}
```

**Service Registration** (in main.js):
```javascript
serviceManager.registerService('serviceName', ServiceClass, ['dependency1', 'dependency2']);
```

**Event Subscription Pattern**:
```javascript
// In service initialize() method
this.subscribeToEvent('event:name', (data) => this.handleEvent(data));
```

**Tooltip System**: Centralized in UIService, supports both library items and track nodes with unified hover behavior and 300ms delays.

**Script Loading Order** (from index.html):
```javascript
// 1. Core Infrastructure
EventBus, StateManager, ServiceBase, ServiceManager, AppStateProxy

// 2. Core Services (order matters for dependencies)
DataService, UIService, TreeService, DragDropService, TrackNodesService, TagService,
SearchService, PlaylistService, PhasesService, ClockService, StatsService, LegendService

// 3. Legacy Modules
state.js, utils.js, ui.js

// 4. UI Components
StatsComponent, LibraryToggle, PlaylistUIHandler, LegendUIHandler

// 5. Main Application
main.js
```

## Common Modification Patterns

**Adding a New Service**:
1. Create class extending `ServiceBase` in `js/core/`
2. Register in `main.js` with dependencies
3. Implement `initialize()` method for event subscriptions
4. Use `this.stateManager` and `this.eventBus` for integration

**Modifying Tree Structure**:
- Adjust `TreeService.config` for levels, branches, timing
- Level-specific settings in `levelConfigs` object
- Animation timing via `animationDelay` and `branchDelay`

**Adding New Tag Type**:
1. Add to `tagValuesByType` in `utils.js`
2. Add color mapping in `TreeService.ensureCategoryStyles()`
3. Update any tag-specific UI components

**State Management**:
```javascript
// Get state
const tags = this.stateManager.getState('app.selectedTags');

// Set state (triggers subscriptions)
this.stateManager.setState('tree.nodes', newNodes);

// Subscribe to state changes
this.subscribeToState('app.selectedTags', (tags) => this.onTagsChanged(tags));
```

**Event Communication**:
```javascript
// Emit event
this.eventBus.emit('tree:node-created', { node, track, parent });

// Subscribe to event (in initialize())
this.subscribeToEvent('playlist:clear', () => this.clearTree());
```

## Architecture Migration Status

**Completed Migrations**:
- ✅ TrackNodes → TrackNodesService
- ✅ Search → SearchService
- ✅ Playlist → PlaylistService
- ✅ Phases → PhasesService (phases.js removed)
- ✅ RealTimeClock → ClockService (realTimeClock.js removed)
- ✅ DragDrop → DragDropService (dragDrop.js removed)
- ✅ Tags → TagService (tags.js removed)
- ✅ Tree → TreeService (tree.js completely removed)
- ✅ DataLoader/DataSourceAdapter → DataService (dataLoader.js, dataSourceAdapter.js removed)
- ✅ JSON data support removed - database-only architecture
- ✅ Centralized tooltip system in UIService
- ✅ EventBus communication patterns

**In Progress**:
- 🔄 UI → UIService migration (partially completed, legend functionality remains)
- 🔄 AppState → StateManager migration

**Migration Guidelines**:
- New features use service-based architecture
- When modifying legacy code, consider migrating to services
- Maintain backward compatibility during transition
- Update both CLAUDE.md and code comments when completing migrations

## Critical Bug Fix Patterns

**Clear Tree Functionality**: 
- `playlist:clear` event must call `PlaylistService.clearPlaylistAndTree()` (not just `clearPlaylist()`)
- This preserves playlist data while clearing visualization

**Service Initialization Order**:
- ServiceManager handles dependency resolution automatically
- Services must properly chain `super.initialize()` calls
- Event subscriptions go in `initialize()` method

**Tooltip Conflicts**:
- All tooltips managed by UIService
- Use `UIService.showTooltip()` / `hideTooltip()` 
- Never create standalone tooltip elements

**State vs Event Usage**:
- State: For data that components need to read/react to
- Events: For actions/commands that trigger behavior
- Don't use events for state synchronization

**Service Event Bridges**:
- Services may need internal bridges to handle events they emit (like DragDropService)
- Use `setupServiceBridges()` pattern to connect service events to other services
- Bridge pattern: Service emits event → Internal bridge listens → Calls appropriate service method

## Electron-Specific Features

When running in Electron:
- SQLite database support for music library (via IPC)
- File system scanning for music files
- Native file dialogs for folder selection
- Preload script provides secure IPC communication

**IPC Channels**:
- `db:executeQuery` - Execute database queries
- `db:runQuery` - Run database modifications
- `scan:directory` - Scan directory for music files
- `dialog:openDirectory` - Open folder selection dialog

**Security Configuration**:
- `contextIsolation: true`
- `nodeIntegration: false`
- Secure IPC via preload script

## Data Storage

**Database-Only Architecture**: Application now uses SQLite database exclusively through MusicLibraryFacade.

Database schema includes:
- Artists, Albums, Tracks tables  
- Tag associations
- Playlist metadata

**Service Integration**:
- `DataService` provides unified interface to all data operations
- `MusicLibraryFacade` handles database connections and queries
- Dependency injection ensures clean service architecture
- Requires Electron environment for database access

## Debugging and Development Tips

**Console Debugging**: 
- DragDropService uses 🔥 prefixed console.log for debugging
- TrackNodesService uses specific logging patterns
- Check browser console (F12) for service initialization and event flow

**Common Development Issues**:
- **Drag & Drop Not Working**: Check if DragDropService bridges are set up correctly in `setupServiceBridges()`
- **Nodes Positioning Incorrectly**: Verify TreeService positioning logic and collision detection
- **Service Not Found**: Ensure service is registered in main.js and ServiceManager has initialized
- **Events Not Firing**: Check EventBus subscriptions and service initialization order
- **Tooltip Issues**: All tooltips centralized in UIService with unified gray styling - avoid creating standalone tooltip elements
- **Tree Transparency**: Drop-zone transparency managed by `tree-active` class on body, set after first tree creation

**Manual Testing Workflow**:
1. Start local server: `python -m http.server 8000`
2. Open browser to `http://localhost:8000`
3. Open browser console (F12) for debugging
4. Test drag & drop from library to center canvas
5. Verify tree generation and node positioning
6. Test search, playlist, and other interactive features
7. Verify tooltip behavior consistency between library and nodes

**Critical Visual States**:
- Initial state: Drop-zone fully opaque, no `tree-active` class
- After first tree: Drop-zone at 0.05 opacity, `tree-active` class added to body
- Clear tree: Drop-zone returns to full opacity, `tree-active` class removed

## Recent Architecture Improvements

**Tooltip System Unification (Latest)**:
- All tooltips now centralized in UIService with consistent gray styling
- Unified positioning system for both library and node tooltips
- Removed CSS overrides that caused visual inconsistencies
- Simplified event handling to prevent tooltip stickiness issues

**Progressive Transparency System**:
- Drop-zone starts fully opaque for clear user guidance
- Automatically transitions to 0.05 opacity after first tree creation
- `tree-active` class on body element manages this state transition
- Proper cleanup when clearing trees to restore initial state

**Service Architecture Maturity**:
- All major components migrated to service-based architecture
- EventBus communication patterns established throughout
- Dependency injection via ServiceManager
- Legacy compatibility maintained during transition

## Italian Development Team Guidelines

The project follows Italian coding standards (from claude_config.json):
- Use ES6+ features (const/let, arrow functions, destructuring)
- Apply Single Responsibility Principle
- Implement proper error handling with try/catch
- Use async/await instead of callback nesting
- Maintain event namespace pattern (app:user:login, ui:button:click)
- Follow refactoring triggers: functions > 20 lines, code duplicated > 3 times