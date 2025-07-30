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

This is a client-side only application with no build process. To develop:

```bash
# Serve the application locally
python -m http.server 8000
# or
npx serve .
# or
php -S localhost:8000
```

Then open http://localhost:8000 in your browser.

## Architecture

### Module Structure
The application uses a modular JavaScript architecture with global namespace pattern:

**Core Services** (`js/core/`):
- **ServiceManager.js** - Centralized service management and dependency injection
- **StateManager.js** - Global state management with reactive updates
- **EventBus.js** - Inter-service communication and event handling
- **UIService.js** - Tooltip management, visual effects, and category highlighting
- **TreeService.js** - Tree visualization, positioning algorithms, and SVG rendering
- **DragDropService.js** - Drag & drop functionality and auto-tree generation
- **TagService.js** - Tag selection system and multi-tag filtering
- **SearchService.js** - Real-time search functionality across tracks/artists/albums
- **PlaylistService.js** - Playlist management and export functionality

**Legacy Modules** (being migrated):
- **main.js** - Application entry point and module initialization coordinator
- **state.js** - Legacy state management (transitioning to StateManager)
- **dragDrop.js**, **tree.js**, **trackNodes.js**, **tags.js**, **search.js**, **playlist.js** - Feature modules
- **ui.js** - UI utilities and user interactions
- **utils.js** - Shared utility functions and track generation

**Music Library System** (`js/core/music-library/`):
- **MusicLibraryFacade.js** - Main interface for music library operations
- **DatabaseManager.js** - SQLite database management
- **FileScanner.js** - File system scanning and metadata extraction
- **TrackRepository.js** - Track data storage and retrieval

### Key Architecture Patterns

**Service-Based Architecture**: Core functionality organized into services managed by ServiceManager with dependency injection and lifecycle management.

**Event-Driven Communication**: Services communicate via EventBus for loose coupling and reactive updates.

**State Management**: 
- New: StateManager provides reactive state management with subscriptions
- Legacy: Global `AppState` object (being migrated to StateManager)

**Tree Generation**: 3-level automatic tree generation:
- Level 0 → Level 1: 5 nodes in perfect circle (360°)  
- Level 1 → Level 2: 3 nodes in semi-circle (180°) per parent
- Configurable via service configuration objects

**Tag System**: 10 tag categories (emotion, energy, mood, style, occasion, weather, intensity, rating, tempo, vibe) with color-coded visualization and branch connections.

**Positioning Algorithm**: Tree uses collision detection with minimum safe distances, structured concentric positioning, and automatic layout updates.

**Music Library Integration**: SQLite-based music library with file scanning, metadata extraction, and track enrichment services.

### Data Flow

**New Service-Based Flow**:
1. User drags track → `DragDropService.handleDrop()` → `TreeService.createAutoTree()`
2. Auto-generation → `TreeService.buildTreeLevel()` → `TreeService.addNode()`
3. Tree positioning → `TreeService.calculatePositions()` → `TreeService.applyPositions()`
4. SVG connections → `TreeService.drawConnection()` with animated curves
5. State updates → `StateManager.setState()` → Event emission → Service reactions

**Legacy Flow** (being migrated):
1. User drags track → `DragDrop.handleDrop()` → `createAutoTree()`
2. Auto-generation → `buildTreeLevel()` → `TrackNodes.create()` → `Tree.addNode()`
3. Tree positioning → `calculateTreePositions()` → `applyPositions()`
4. SVG connections → `drawConnection()` with animated curves

### HTML Structure
- **Sidebar**: Music library with expandable artist/album folders, search, and color legend
- **Canvas**: Main visualization area with drop zone and scrollable content
- **Controls**: Clear tree, clear tags, save playlist buttons
- **Breadcrumb**: Navigation indicator

### Styling System
- CSS custom properties for tag colors
- Backdrop blur effects and glassmorphism design
- Smooth animations for tree growth and SVG path drawing
- Responsive grid layout with fixed sidebar

## Key Implementation Details

**Track Data Format**: Each track contains `{title, artist, album, tags[]}` where tags are "type:value" strings.

**Node Positioning**: Uses polar coordinates with collision avoidance. Root positioned at canvas center, children arranged in geometric patterns.

**SVG Animations**: Curved branch connections with `stroke-dasharray` animation and color coding based on connection tags.

**Canvas Sizing**: Dynamic canvas resizing based on content bounds with generous padding for tree spread.

**Search Implementation**: Real-time filtering with word-start matching across title/artist/album fields.

## Common Modification Patterns

**Service Configuration**: Modify service-specific configs in service constructors - timing, delays, limits, visual settings.

**Adjusting Tree Structure**: 
- New: Modify `TreeService.config` - `maxLevels`, `branchesPerTag`, level-specific configurations
- Legacy: Modify `DragDrop.config` (being migrated)

**Adding Tag Types**: Update `tagValuesByType` objects in `utils.js` and color mappings in service configuration.

**Changing Node Styling**: CSS classes follow pattern `.track-node`, `.node-tag-{category}`, `.tag.{tagtype}`.

**Animation Timing**: 
- New: Controlled via service configuration objects and CSS transitions
- Legacy: Controlled via `animationDelay`, `branchDelay` in drag-drop config

**Adding New Services**: Extend `ServiceBase`, register in `ServiceManager`, follow event-driven patterns.

**State Management**: Use `StateManager.setState()` and `StateManager.getState()` for reactive updates.

## Architecture Migration Notes

The codebase is currently transitioning from a monolithic approach to a service-based architecture:

- **Core services** in `js/core/` represent the new architecture
- **Legacy modules** in `js/` root are being gradually migrated
- Both systems coexist during the transition period
- New features should use the service-based approach
- When modifying existing features, consider migrating to services

The codebase emphasizes smooth user experience with staggered animations, collision-free positioning, and intuitive drag-and-drop interactions.