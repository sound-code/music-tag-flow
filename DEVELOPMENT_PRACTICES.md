# Development Practices for MusicTagFlow

This document outlines the development practices, code quality standards, and responsibilities for maintaining and extending the MusicTagFlow codebase.

## ⚠️ MANDATORY READING BEFORE CODE CHANGES

**This document MUST be read along with CLAUDE.md before making ANY modifications to the codebase.**

**Reading these documents ensures:**
- Understanding of the project architecture (CLAUDE.md)
- Compliance with development standards (this document)
- Consistent code quality across all contributions
- Proper implementation of features and fixes
- Avoidance of common pitfalls and anti-patterns

## Core Development Principles

### 1. Code Quality Standards

**Consistency Over Cleverness**
- Follow existing code patterns and conventions in the codebase
- Maintain consistent naming conventions (camelCase for functions/variables, PascalCase for classes)
- Preserve the modular architecture with global namespace pattern

**Readability First**
- Write self-documenting code with clear variable and function names
- Add comments only when the "why" isn't obvious from the code
- Keep functions focused on a single responsibility

**Performance Considerations**
- Minimize DOM manipulations by batching updates
- Use event delegation for dynamically created elements
- Implement debouncing for search and real-time updates
- Cache DOM queries in module initialization

### 2. Module Architecture Guidelines

**Module Independence**
- Each module should have a clear, single purpose
- Modules communicate through the global AppState or EventBus
- Avoid circular dependencies between modules
- New features should extend existing modules or create new ones, not modify core functionality

**State Management**
- All shared state must go through AppState
- Direct DOM manipulation should be contained within the responsible module
- State changes should trigger appropriate UI updates through established patterns

### 3. Error Handling & Robustness

**Defensive Programming**
- Always validate inputs, especially user-provided data
- Handle edge cases gracefully (empty arrays, null values, missing properties)
- Provide meaningful error messages to users via `Utils.showNotification()`
- Log technical errors to console for debugging

**Safe JSON Parsing**
- Use try-catch blocks when parsing JSON from datasets
- Implement the existing `safeParseTrackData()` pattern for HTML entity decoding
- Handle malformed or truncated data gracefully

### 4. User Experience Principles

**Visual Feedback**
- Provide immediate visual feedback for user actions
- Use smooth animations for state transitions
- Maintain the established animation timing patterns
- Show loading states for async operations

**Intuitive Interactions**
- Drag and drop should feel natural and responsive
- Click targets should be appropriately sized (minimum 44px for touch)
- Provide hover states and tooltips for additional information
- Maintain consistency with existing interaction patterns

### 5. Testing & Validation

**Manual Testing Checklist**
- Test drag and drop with various track types
- Verify tree generation with different tag combinations
- Test search functionality with edge cases (special characters, empty results)
- Validate playlist management operations
- Check responsive behavior at different screen sizes

**Cross-Browser Compatibility**
- Test in Chrome, Firefox, Safari, and Edge
- Ensure SVG animations work across browsers
- Verify CSS features have appropriate fallbacks

### 6. Security Considerations

**Data Sanitization**
- Sanitize user inputs before display
- Escape HTML entities in dynamic content
- Validate file paths and URLs
- Never execute user-provided code

**Local Storage**
- Store only non-sensitive data
- Implement data validation when reading from storage
- Handle storage quota exceeded errors

### 7. Performance Optimization

**Rendering Efficiency**
- Use requestAnimationFrame for smooth animations
- Implement virtual scrolling for large lists
- Debounce search inputs (already implemented)
- Lazy load resources when possible

**Memory Management**
- Clean up event listeners when removing elements
- Clear references to removed DOM nodes
- Manage the node collection size (implement limits if needed)

### 8. Code Organization

**File Structure**
```
js/
├── core/           # Core services and infrastructure
├── components/     # Reusable UI components
├── ui/            # UI-specific handlers
├── utils/         # Shared utilities
└── [modules].js   # Feature-specific modules
```

**Import Order**
1. Core infrastructure (EventBus, StateManager)
2. Services
3. State management
4. Feature modules
5. UI modules
6. Utilities

### 9. Documentation Standards

**Code Documentation**
- Document complex algorithms and non-obvious logic
- Include JSDoc comments for public APIs
- Keep README and CLAUDE.md updated with architectural changes
- Document breaking changes clearly

**Inline Comments**
- Explain "why" not "what"
- Mark TODOs with context: `// TODO: [description] - [your name] [date]`
- Flag workarounds: `// WORKAROUND: [issue description]`

### 10. Version Control Practices

**Commit Guidelines**
- Make atomic commits (one feature/fix per commit)
- Write clear, descriptive commit messages
- Follow conventional commits format when possible:
  - `feat:` new features
  - `fix:` bug fixes
  - `refactor:` code improvements
  - `docs:` documentation updates
  - `style:` formatting changes

**Branch Strategy**
- Create feature branches for new functionality
- Keep branches focused and short-lived
- Test thoroughly before merging

### 11. Accessibility Considerations

**Keyboard Navigation**
- Ensure all interactive elements are keyboard accessible
- Implement proper focus management
- Provide keyboard shortcuts for common actions

**Screen Reader Support**
- Use semantic HTML elements
- Add appropriate ARIA labels
- Ensure dynamic content updates are announced

### 12. Maintenance Responsibilities

**Code Reviews**
- Review for consistency with existing patterns
- Check for potential performance issues
- Verify error handling is comprehensive
- Ensure new code doesn't break existing functionality

**Refactoring Guidelines**
- Refactor in small, testable increments
- Maintain backward compatibility
- Document breaking changes
- Update tests and documentation

### 13. Common Pitfalls to Avoid

**DOM Manipulation**
- Don't query the DOM repeatedly in loops
- Avoid forced synchronous layouts
- Don't modify styles individually, use CSS classes

**Event Handling**
- Prevent memory leaks from unremoved listeners
- Avoid inline event handlers
- Use event delegation for dynamic content

**State Management**
- Don't bypass AppState for shared data
- Avoid storing state in the DOM
- Don't create duplicate state representations

### 14. Performance Monitoring

**Key Metrics**
- Initial load time
- Time to interactive
- Animation frame rate
- Memory usage over time

**Optimization Targets**
- Tree generation < 2 seconds for 100 nodes
- Search results < 100ms
- Smooth 60fps animations
- Memory usage stable during long sessions

### 15. Future-Proofing

**Extensibility**
- Design new features to be modular and replaceable
- Use configuration objects for customizable behavior
- Implement feature flags for experimental features
- Plan for data migration when changing formats

**Technology Considerations**
- Keep dependencies minimal
- Use standard web APIs when possible
- Plan for progressive enhancement
- Consider WebComponents for new UI components

---

## Quick Reference Checklist

Before submitting code changes, ensure:

- [ ] Code follows existing patterns and conventions
- [ ] Error handling is comprehensive
- [ ] User interactions provide appropriate feedback
- [ ] Performance impact has been considered
- [ ] Documentation is updated if needed
- [ ] Manual testing covers edge cases
- [ ] No security vulnerabilities introduced
- [ ] Accessibility is maintained or improved
- [ ] Code is ready for review

Remember: The goal is to maintain a clean, performant, and user-friendly application that can be easily extended and maintained by future developers.