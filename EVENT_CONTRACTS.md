# Event Contracts Documentation

This document defines all EventBus events used in MusicTagFlow for inter-service communication.

## Event Naming Convention
- Format: `domain:action` or `service:event`
- Examples: `playlist:track-added`, `tree:node-created`, `data:loading:complete`

## Core System Events

### Data Events

#### `data:loading:start`
**Emitter**: DataService  
**Subscribers**: UIService, StatsComponent  
**Payload**: None  
**Description**: Signals start of data loading operation

#### `data:loading:complete`
**Emitter**: DataService  
**Subscribers**: UIService, DragDropService, SearchService  
**Payload**: `{ source: string, recordCount: number }`  
**Description**: Data source initialization complete

#### `data:loading:error`
**Emitter**: DataService  
**Subscribers**: UIService  
**Payload**: `{ error: string }`  
**Description**: Data loading error occurred

#### `data:generate-tracks-with-tag`
**Emitter**: DragDropService  
**Subscribers**: DataService  
**Payload**: `{ tag: string, count: number, callback: function }`  
**Description**: Request tracks with specific tag

## Tree Events

### `tree:node-created`
**Emitter**: TreeService  
**Subscribers**: PhasesService, ClockService, StatsComponent  
**Payload**: `{ node: HTMLElement, track: object, parent: HTMLElement|null }`  
**Description**: New node added to tree visualization

### `tree:node-added`
**Emitter**: TreeService  
**Subscribers**: UIService  
**Payload**: `{ node: HTMLElement }`  
**Description**: Node successfully added to DOM

### `tree:cleared`
**Emitter**: TreeService  
**Subscribers**: PhasesService, ClockService, UIService  
**Payload**: None  
**Description**: Tree visualization cleared

### `tree:create-root-node`
**Emitter**: DragDropService  
**Subscribers**: DragDropService (bridge)  
**Payload**: `{ trackData: object, x: number, y: number, isAutoTree: boolean }`  
**Description**: Request to create root node

### `tree:create-child-node`
**Emitter**: DragDropService  
**Subscribers**: DragDropService (bridge)  
**Payload**: `{ trackData: object, parentNode: HTMLElement, connectionTag: string }`  
**Description**: Request to create child node

### `tree:add-node`
**Emitter**: TrackNodesService  
**Subscribers**: TreeService  
**Payload**: `{ node: HTMLElement, parentNode: HTMLElement|null, connectionTag: string }`  
**Description**: Add node to tree structure with positioning

## Playlist Events

### `playlist:track-added`
**Emitter**: PlaylistService  
**Subscribers**: StatsComponent, ClockService  
**Payload**: `{ track: object }`  
**Description**: Track added to playlist

### `playlist:track-removed`
**Emitter**: PlaylistService  
**Subscribers**: StatsComponent  
**Payload**: `{ track: object }`  
**Description**: Track removed from playlist

### `playlist:cleared`
**Emitter**: PlaylistService  
**Subscribers**: StatsComponent, TreeService  
**Payload**: None  
**Description**: Playlist cleared

### `playlist:clear`
**Emitter**: UI controls  
**Subscribers**: PlaylistService  
**Payload**: None  
**Description**: Request to clear playlist and tree

### `playlist:export`
**Emitter**: UI controls  
**Subscribers**: PlaylistService  
**Payload**: `{ format: string }`  
**Description**: Export playlist in specified format

## UI Events

### `ui:notification`
**Emitter**: Various services  
**Subscribers**: UIService  
**Payload**: `{ message: string, type: string }`  
**Description**: Display user notification

### `tooltip:show`
**Emitter**: Various UI elements  
**Subscribers**: UIService  
**Payload**: `{ element: HTMLElement, content: string, x: number, y: number }`  
**Description**: Show tooltip

### `tooltip:hide`
**Emitter**: Various UI elements  
**Subscribers**: UIService  
**Payload**: None  
**Description**: Hide tooltip

### `ui:drag-start`
**Emitter**: DragDropService  
**Subscribers**: UIService  
**Payload**: `{ element: HTMLElement }`  
**Description**: Drag operation started

### `ui:drag-end`
**Emitter**: DragDropService  
**Subscribers**: UIService  
**Payload**: None  
**Description**: Drag operation ended

## Tag Events

### `tags:selection-changed`
**Emitter**: TagService  
**Subscribers**: UIService, LegendService  
**Payload**: `{ selectedTags: Set }`  
**Description**: Tag selection changed

### `tags:highlight-tags`
**Emitter**: LegendService  
**Subscribers**: TagService  
**Payload**: `{ category: string }`  
**Description**: Highlight tags by category

### `tags:clear-highlights`
**Emitter**: LegendService  
**Subscribers**: TagService  
**Payload**: None  
**Description**: Clear all tag highlights

### `tags:clear`
**Emitter**: Various UI elements  
**Subscribers**: TagService  
**Payload**: None  
**Description**: Clear tag selection

### `tags:tag-clicked`
**Emitter**: containers.js  
**Subscribers**: TagService  
**Payload**: `{ element: HTMLElement }`  
**Description**: Tag element clicked

## Search Events

### `search:query:update`
**Emitter**: SearchService  
**Subscribers**: UIService  
**Payload**: `{ query: string, results: Array }`  
**Description**: Search query updated

### `search:result:clicked`
**Emitter**: SearchService  
**Subscribers**: None (internal)  
**Payload**: `{ track: object }`  
**Description**: Search result clicked

### `search:clear`
**Emitter**: UI controls  
**Subscribers**: SearchService  
**Payload**: None  
**Description**: Clear search

## Clock Events

### `clock:auto-start`
**Emitter**: PlaylistService  
**Subscribers**: ClockService  
**Payload**: None  
**Description**: Auto-start clock when first track added

### `clock:started`
**Emitter**: ClockService  
**Subscribers**: UIService  
**Payload**: None  
**Description**: Clock started

### `clock:stopped`
**Emitter**: ClockService  
**Subscribers**: UIService  
**Payload**: None  
**Description**: Clock stopped

### `clock:reset`
**Emitter**: TreeService (on clear)  
**Subscribers**: ClockService  
**Payload**: None  
**Description**: Reset clock

### `time:elapsed`
**Emitter**: ClockService  
**Subscribers**: PhasesService  
**Payload**: `{ elapsed: number, total: number, percentage: number }`  
**Description**: Time update for progress line

## Phases Events

### `phases:toggle`
**Emitter**: UI controls  
**Subscribers**: PhasesService  
**Payload**: None  
**Description**: Toggle phases view

### `phases:show`
**Emitter**: UI controls  
**Subscribers**: PhasesService  
**Payload**: None  
**Description**: Show phases view

### `phases:hide`
**Emitter**: UI controls  
**Subscribers**: PhasesService  
**Payload**: None  
**Description**: Hide phases view

### `phases:shown`
**Emitter**: PhasesService  
**Subscribers**: UIService  
**Payload**: None  
**Description**: Phases view shown

### `phases:hidden`
**Emitter**: PhasesService  
**Subscribers**: UIService  
**Payload**: None  
**Description**: Phases view hidden

## Library Events

### `library:toggle`
**Emitter**: UI controls  
**Subscribers**: UIService  
**Payload**: None  
**Description**: Toggle library visibility

### `library:artist:toggle`
**Emitter**: UI elements  
**Subscribers**: UIService  
**Payload**: `{ element: HTMLElement }`  
**Description**: Toggle artist expansion

### `library:album:toggle`
**Emitter**: UI elements  
**Subscribers**: UIService  
**Payload**: `{ element: HTMLElement }`  
**Description**: Toggle album expansion

## Container Events

### `container:track-added`
**Emitter**: containers.js  
**Subscribers**: DragDropService, PlaylistService  
**Payload**: `{ track: object, position: {x, y}, sourceNode: HTMLElement, connectionTag: string }`  
**Description**: Track added from container to tree

## Stats Events

### `stats:updated`
**Emitter**: StatsComponent  
**Subscribers**: UIService  
**Payload**: `{ stats: object }`  
**Description**: Statistics updated

### `stats:request`
**Emitter**: Various services  
**Subscribers**: StatsComponent  
**Payload**: None  
**Description**: Request stats update

## Legend Events

### `legend:category:highlight`
**Emitter**: LegendService  
**Subscribers**: UIService  
**Payload**: `{ category: string }`  
**Description**: Highlight category in tree

### `legend:category:unhighlight`
**Emitter**: LegendService  
**Subscribers**: UIService  
**Payload**: None  
**Description**: Remove category highlighting

## Service Communication Patterns

### Request-Response Pattern
For operations requiring data return:
```javascript
// Emitter
this.emitEvent('data:request-tracks', {
    tag: 'mood:happy',
    callback: (tracks) => this.processTracks(tracks)
});

// Subscriber
this.subscribeToEvent('data:request-tracks', async (data) => {
    const tracks = await this.generateTracks(data.tag);
    data.callback(tracks);
});
```

### Notification Pattern
For one-way notifications:
```javascript
// Emitter
this.emitEvent('tree:cleared');

// Subscriber
this.subscribeToEvent('tree:cleared', () => {
    this.handleTreeCleared();
});
```

### State Change Pattern
For state updates:
```javascript
// Emitter
this.emitEvent('tags:selection-changed', {
    selectedTags: new Set(['mood:happy', 'energy:high'])
});

// Subscriber
this.subscribeToEvent('tags:selection-changed', (data) => {
    this.updateUIForTags(data.selectedTags);
});
```

## Error Handling Convention

All services should emit errors using:
```javascript
this.emitEvent('service:error', {
    service: 'ServiceName',
    operation: 'operationName',
    error: error.message,
    timestamp: Date.now()
});
```

## Event Order Dependencies

Some events must be emitted in specific order:
1. `data:loading:start` → `data:loading:complete` or `data:loading:error`
2. `tree:node-created` → `tree:node-added`
3. `phases:show` → `phases:shown`
4. `clock:auto-start` → `clock:started`

## Testing Event Contracts

To test event communication:
1. Open browser console
2. Enable EventBus debugging: `window.EventBus.debug = true`
3. Monitor event flow during operations
4. Verify payload structure matches contracts