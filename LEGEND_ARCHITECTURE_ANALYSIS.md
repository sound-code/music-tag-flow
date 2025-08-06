# Architecture Analysis - Service Boundaries and EventBus Patterns

## 🔍 Service Architecture Audit

### Current Service-Based Architecture Status

✅ **Services Properly Extending ServiceBase:**
- AudioPlayerService
- ClockService  
- DataService
- DragDropService
- LegendService
- PhasesService
- PlaylistService
- SearchService
- ScanService
- TagService
- TreeService
- TrackNodesService
- UIService

**Total Services:** 13 core services + music library services

## 🚨 Architecture Violations Identified

### 1. **Direct UI Handler Dependencies**

**Problem:** `PlaylistService` calls `window.PlaylistUIHandler` directly
```javascript
// VIOLATION: Direct coupling
if (window.PlaylistUIHandler) {
    window.PlaylistUIHandler.updateDisplay(entries);
}
```

**Impact:** 
- Violates event-driven architecture
- Creates tight coupling between services
- Bypasses EventBus communication

**Solution:** Convert to event-based communication:
```javascript
// CORRECT: Event-driven
this.emitEvent('playlist:updated', { entries });
```

### 2. **Service Cross-Dependencies**

**Problem:** Services access each other via `window.App?.getService()`
```javascript
// VIOLATION: Direct service access
const treeService = window.App?.getService('tree');
```

**Found in:**
- PlaylistService.js (3 occurrences)
- TrackNodesService.js (1 occurrence)  
- PlaylistUIHandler.js (1 occurrence)
- utils.js (3 occurrences)

**Impact:**
- Bypasses dependency injection
- Creates hidden dependencies
- Makes testing difficult

**Solution:** Use ServiceManager dependency injection

### 3. **Mixed Responsibilities**

**Problem:** `PlaylistUIHandler` is not a proper service
- Lives outside service architecture
- Mixing UI logic with global window object
- Manual event listener setup

## 📋 EventBus Usage Analysis

**Current EventBus Usage:** 155+ occurrences across 16 files

**Positive Patterns:**
- Services properly emit events via `this.emitEvent()`
- Event subscriptions in `initialize()` methods
- Consistent event naming conventions

**Events Catalog:**
```
playlist:*  - Playlist operations (clear, save, track-added, etc.)
tree:*      - Tree visualization events  
ui:*        - UI notifications and interactions
data:*      - Data loading and updates
search:*    - Search operations
phases:*    - Playlist phases visualization
```

## 🎯 Recommended Refactoring Plan

### Phase 1: Clean Service Boundaries
1. **Convert PlaylistUIHandler → PlaylistUIService**
   - Extend ServiceBase
   - Use EventBus for all communication
   - Register in ServiceManager

2. **Remove Direct Service Access**
   - Replace `window.App?.getService()` calls
   - Use dependency injection
   - Pure EventBus communication

### Phase 2: Event Contract Standardization  
1. **Document Event Contracts**
   - Formal event schemas
   - Required vs optional data
   - Response patterns

2. **Event Naming Consistency**
   - Standardize verb tenses
   - Clear success/error events
   - Lifecycle events (start/progress/complete)

### Phase 3: Dependency Injection
1. **ServiceManager Enhancements**
   - Proper dependency resolution
   - Service lifecycle management
   - Error handling for missing dependencies

## 🏗️ Target Architecture

```
ServiceManager
├── AudioPlayerService (deps: playlist)
├── PlaylistUIService (deps: none) 
├── PlaylistService (deps: none)
├── TreeService (deps: playlist)
├── UIService (deps: tags, tracknodes, data, tree)
└── EventBus (central communication)
```

**Communication Pattern:**
```
Service A --[event]--> EventBus --[event]--> Service B
         <--[event]--          <--[event]--
```

## 📊 Architecture Health Score

| Aspect | Current | Target |
|--------|---------|---------|
| Service Isolation | 70% | 100% |
| EventBus Usage | 85% | 95% |
| Dependency Injection | 40% | 90% |
| Single Responsibility | 80% | 95% |
| Code Duplication | 90% | 100% |

## 🔧 Implementation Guidelines

### Service Creation Checklist
- [ ] Extends ServiceBase
- [ ] Single responsibility
- [ ] Event-driven communication only
- [ ] Proper dependency declaration
- [ ] Error handling
- [ ] Cleanup in destroy()

### EventBus Best Practices
- [ ] Descriptive event names (verb:noun pattern)
- [ ] Consistent data structures
- [ ] Error event handling
- [ ] Event documentation
- [ ] Performance consideration (debouncing)

### Dependency Management
- [ ] Declare dependencies explicitly
- [ ] Avoid circular dependencies
- [ ] Use ServiceManager resolution
- [ ] Mock dependencies for testing

## 📝 Next Steps

1. **Commit Current State** ✅ (Audio Player implemented)
2. **Plan Refactoring Phases**
3. **Implement PlaylistUIService**
4. **Remove Direct Dependencies**
5. **Test Service Isolation**
6. **Update Event Contracts** (see `EVENT_CONTRACTS.md`)

## 📚 Related Documentation

- **`EVENT_CONTRACTS.md`** - Detailed event contracts and communication patterns
- **`CLAUDE.md`** - Development practices and architecture guidelines  
- **`DEVELOPMENT_PRACTICES.md`** - Code quality standards and patterns

---
*This analysis maintains the principle of service-based architecture with EventBus communication, single responsibilities, and zero code duplication.*