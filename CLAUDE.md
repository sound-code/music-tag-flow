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

- **main.js** - Application entry point and module initialization coordinator
- **state.js** - Centralized state management and DOM element caching
- **dragDrop.js** - Drag & drop functionality and auto-tree generation logic
- **tree.js** - Tree visualization, positioning algorithms, and SVG connection rendering
- **trackNodes.js** - Track node creation, management, and playlist integration  
- **tags.js** - Tag selection system and multi-tag filtering
- **containers.js** - Dynamic container creation for tag-based track groupings
- **search.js** - Real-time search functionality across tracks/artists/albums
- **playlist.js** - Playlist management and display
- **ui.js** - UI utilities and user interactions
- **utils.js** - Shared utility functions and track generation

### Key Architecture Patterns

**State Management**: Global `AppState` object manages all application state including nodes, containers, selected tags, and DOM references.

**Tree Generation**: 3-level automatic tree generation:
- Level 0 → Level 1: 5 nodes in perfect circle (360°)  
- Level 1 → Level 2: 3 nodes in semi-circle (180°) per parent
- Configurable via `DragDrop.config` object

**Tag System**: 10 tag categories (emotion, energy, mood, style, occasion, weather, intensity, rating, tempo, vibe) with color-coded visualization and branch connections.

**Positioning Algorithm**: Tree uses collision detection with minimum safe distances, structured concentric positioning, and automatic layout updates.

### Data Flow
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

**Adjusting Tree Structure**: Modify `DragDrop.config` - `maxLevels`, `branchesPerTag`, level-specific configurations.

**Adding Tag Types**: Update `tagValuesByType` objects in `utils.js` and color mappings in `tree.js`.

**Changing Node Styling**: CSS classes follow pattern `.track-node`, `.node-tag-{category}`, `.tag.{tagtype}`.

**Animation Timing**: Controlled via `animationDelay`, `branchDelay` in drag-drop config and CSS transitions.

The codebase emphasizes smooth user experience with staggered animations, collision-free positioning, and intuitive drag-and-drop interactions.