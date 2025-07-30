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
npm run serve

# Electron development (for desktop app features)
npm start          # Run Electron app
npm run dev        # Run Electron with devtools

# Open http://localhost:8000 in browser for web version
```

**Important Notes**:
- No testing framework or build tools are configured - the application runs directly without compilation or bundling
- No linting or type checking configured - maintain code quality manually
- When asked to run lint/typecheck commands, ask user for the appropriate commands and suggest adding them to CLAUDE.md

## Architecture

### Service-Based Architecture

The application is transitioning from a monolithic approach to a service-based architecture. Core functionality is organized into services managed by `ServiceManager` with dependency injection and lifecycle management.

**Core Services** (`js/core/`):
- **ServiceManager.js** - Centralized service management and dependency injection
- **StateManager.js** - Global state management with reactive updates
- **EventBus.js** - Inter-service communication and event handling
- **UIService.js** - Tooltip management, visual effects, and category highlighting
- **TreeService.js** - Tree visualization, positioning algorithms, and SVG rendering
- **DragDropService.js** - Drag & drop functionality and auto-tree generation
- **TrackNodesService.js** - Track node creation, tag management, and UI interactions
- **TagService.js** - Tag selection system and multi-tag filtering
- **SearchService.js** - Real-time search functionality across tracks/artists/albums
- **PlaylistService.js** - Playlist management and export functionality
- **PhasesService.js** - Playlist phase visualization (time-based concentric circles)
- **StatsService.js** - Statistics tracking and display
- **LegendService.js** - Tag color legend management

**Music Library System** (`js/core/music-library/`):
- **MusicLibraryFacade.js** - Main interface for music library operations
- **DatabaseManager.js** - SQLite database management
- **FileScanner.js** - File system scanning and metadata extraction
- **TrackRepository.js** - Track data storage and retrieval

**UI Components** (`js/ui/`):
- **StatsComponent.js** - Real-time statistics display with live updates
- **LibraryToggle.js** - Library visibility toggle with EventBus integration
- **PlaylistUIHandler.js** - Playlist UI interactions and animations
- **LegendUIHandler.js** - Tag legend UI management

**Legacy Modules** (being migrated to services):
- **main.js** - Application entry point and service initialization
- **state.js** - Legacy AppState (use StateManager for new code)
- **dragDrop.js**, **tree.js**, **tags.js** - Feature facades bridging to services
- **ui.js** - UI utilities and user interactions
- **utils.js** - Shared utility functions and track generation
- **realTimeClock.js** - Clock functionality (uses global namespace pattern)

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

1. **Track Drop**: User drags track → `DragDropService.handleDrop()` → `TreeService.createAutoTree()`
2. **Tree Building**: `TreeService.buildTreeLevel()` → `TrackNodesService.createNode()` → `TreeService.addNode()`
3. **Positioning**: `TreeService.calculatePositions()` → Collision detection → `TreeService.applyPositions()`
4. **Connections**: `TreeService.drawConnection()` → SVG path with curve animation
5. **State Update**: Service methods → `StateManager.setState()` → Event emission → UI updates

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
- ✅ Centralized tooltip system in UIService
- ✅ EventBus communication patterns

**In Progress**:
- 🔄 Legacy modules acting as facades to services
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

## Data Storage

**Browser Mode**: Uses `DataSourceAdapter` with hardcoded sample data
**Electron Mode**: Uses SQLite database for persistent music library storage

Database schema includes:
- Artists, Albums, Tracks tables
- Tag associations
- Playlist metadata