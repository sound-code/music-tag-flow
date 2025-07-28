/**
 * Tree Visualization Module
 * Handles tree-like visualization with curved branches and organic positioning
 */

const Tree = {
    // Tree structure to track node relationships
    nodes: new Map(), // nodeId -> { element, track, children: Set, parent: nodeId|null, depth: number, angle: number, position: {x, y} }
    connections: new Map(), // connectionId -> { from: nodeId, to: nodeId, tag: string, svgPath: element }
    svgLayer: null,
    rootNode: null,
    
    // Tree layout configuration
    config: {
        nodeRadius: 40, // Actual node radius (80px diameter / 2)
        branchLength: 120, // Clean base distance for structured layout
        angleSpread: Math.PI / 3, // 60 degrees - structured spread
        levelSpacing: 80, // Consistent spacing between levels
        minAngleSeparation: Math.PI / 8, // Minimum angle for clean separation
        collisionPadding: 30, // Increased padding to prevent overlaps (was 20)
    },

    /**
     * Initialize the tree visualization system
     */
    initialize() {
        this.createSVGLayer();
        this.setupEventListeners();
    },

    /**
     * Create SVG layer for drawing connections
     */
    createSVGLayer() {
        const canvas = AppState.canvasContent;
        
        // Remove existing SVG if present
        const existingSvg = canvas.querySelector('.tree-svg');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // Create new SVG layer
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('tree-svg');
        svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
        `;
        
        canvas.insertBefore(svg, canvas.firstChild);
        this.svgLayer = svg;
    },

    /**
     * Add a node to the tree structure
     * @param {string} nodeId - Unique node identifier
     * @param {HTMLElement} element - DOM element for the node
     * @param {Object} track - Track data
     * @param {string|null} parentId - Parent node ID (null for root)
     * @param {string} connectionTag - Tag that connects to parent
     */
    addNode(nodeId, element, track, parentId = null, connectionTag = null) {
        const nodeData = {
            element,
            track,
            children: new Set(),
            parent: parentId,
            depth: parentId ? this.nodes.get(parentId).depth + 1 : 0,
            angle: 0,
            position: { x: 0, y: 0 },
            connectionTag
        };
        
        this.nodes.set(nodeId, nodeData);
        
        // Set as root if it's the first node
        if (!this.rootNode) {
            this.rootNode = nodeId;
        }
        
        // Add to parent's children
        if (parentId && this.nodes.has(parentId)) {
            this.nodes.get(parentId).children.add(nodeId);
        }
        
        // Update layout for all nodes
        this.updateLayout();
        
        // Draw connection to parent
        if (parentId && connectionTag) {
            this.drawConnection(parentId, nodeId, connectionTag);
        }
    },

    /**
     * Update the entire tree layout
     */
    updateLayout() {
        if (!this.rootNode) return;
        
        // Calculate positions using tree layout algorithm
        this.calculateTreePositions();
        
        // Apply positions to DOM elements
        this.applyPositions();
        
        // Validate and fix any remaining overlaps
        this.validateAndFixOverlaps();
        
        // Redraw all connections
        this.redrawAllConnections();
        
        // Update canvas size
        Utils.updateCanvasSize();
    },

    /**
     * Validate tree layout and fix any remaining overlaps
     */
    validateAndFixOverlaps() {
        let hasOverlaps = true;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (hasOverlaps && attempts < maxAttempts) {
            hasOverlaps = false;
            const nodePositions = Array.from(this.nodes.entries());
            let overlapCount = 0;
            
            for (let i = 0; i < nodePositions.length; i++) {
                for (let j = i + 1; j < nodePositions.length; j++) {
                    const [nodeId1, node1] = nodePositions[i];
                    const [nodeId2, node2] = nodePositions[j];
                    
                    if (!node1.position || !node2.position) continue;
                    
                    const dx = node1.position.x - node2.position.x;
                    const dy = node1.position.y - node2.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = (this.config.nodeRadius * 2) + this.config.collisionPadding;
                    
                    if (distance < minDistance) {
                        hasOverlaps = true;
                        overlapCount++;
                        
                        // Move the deeper node away from the shallower one
                        const moveNode = node1.depth > node2.depth ? node1 : node2;
                        const otherNode = moveNode === node1 ? node2 : node1;
                        
                        // Calculate separation vector
                        const separationAngle = Math.atan2(
                            moveNode.position.y - otherNode.position.y,
                            moveNode.position.x - otherNode.position.x
                        );
                        
                        // Move the node to minimum safe distance
                        const safeDistance = minDistance + 10; // Extra buffer
                        moveNode.position.x = otherNode.position.x + Math.cos(separationAngle) * safeDistance;
                        moveNode.position.y = otherNode.position.y + Math.sin(separationAngle) * safeDistance;
                        
                        // Update the node's angle to match new position
                        if (moveNode.parent) {
                            const parent = this.nodes.get(moveNode.parent);
                            if (parent && parent.position) {
                                moveNode.angle = Math.atan2(
                                    moveNode.position.y - parent.position.y,
                                    moveNode.position.x - parent.position.x
                                );
                            }
                        }
                    }
                }
            }
            
            
            attempts++;
        }
        
        // Apply corrected positions to DOM
        this.applyPositions();
    },

    /**
     * Calculate positions for all nodes using tree layout algorithm
     */
    calculateTreePositions() {
        if (!this.rootNode) return;
        
        const root = this.nodes.get(this.rootNode);
        
        // Position root at center for structured 3-level layout
        const canvasRect = AppState.canvas.getBoundingClientRect();
        
        // Calculate expected tree radius for 3-level structure (more compact)
        const expectedTreeRadius = 320; // Reduced from 400 for 3-level tree
        
        // Center the root with adequate margins
        const centerX = Math.max(expectedTreeRadius, Math.min(canvasRect.width - expectedTreeRadius, canvasRect.width / 2));
        const centerY = Math.max(expectedTreeRadius, Math.min(canvasRect.height - expectedTreeRadius, canvasRect.height / 2));
        
        root.position = {
            x: centerX,
            y: centerY
        };
        root.angle = 0; // Neutral starting angle
        
        // Build simplified 3-level tree structure
        this.positionChildren(this.rootNode, 0, Math.PI * 2);
    },

    /**
     * Position children of a node recursively with collision detection
     * @param {string} nodeId - Parent node ID
     * @param {number} startAngle - Starting angle for children
     * @param {number} angleRange - Angular range to distribute children within
     */
    positionChildren(nodeId, startAngle, angleRange) {
        const node = this.nodes.get(nodeId);
        const children = Array.from(node.children);
        
        if (children.length === 0) return;
        
        // Calculate minimum safe distance based on node size and collision padding
        const minSafeDistance = (this.config.nodeRadius * 2) + this.config.collisionPadding;
        
        // Calculate required angle separation to prevent overlaps
        const baseDistance = this.config.branchLength + (node.depth * this.config.levelSpacing);
        
        // Structured concentric positioning system
        let effectiveAngleRange, angleStep, customStartAngle;
        
        if (node.depth === 0) {
            // Level 0 → Level 1: Perfect symmetric circle around root
            effectiveAngleRange = Math.PI * 2; // Full 360° circle
            angleStep = effectiveAngleRange / children.length; // Equal distribution
            // For perfect symmetry, start from top and distribute evenly
            customStartAngle = -Math.PI / 2; // Start from top (12 o'clock)
        } else if (node.depth === 1) {
            // Level 1 → Level 2: 3 nodes in semi-circle above each parent (FINAL LEVEL)
            effectiveAngleRange = Math.PI; // 180° semi-circle
            angleStep = children.length > 1 ? effectiveAngleRange / (children.length - 1) : 0;
            
            // Position semi-circle above parent, extending outward
            const parentAngle = node.angle;
            customStartAngle = parentAngle - effectiveAngleRange / 2;
        } else {
            // Level 2+: Should not exist anymore, but fallback for safety
            effectiveAngleRange = Math.PI / 6; // 30° focused range
            angleStep = 0;
            
            const parentAngle = node.angle;
            customStartAngle = parentAngle - effectiveAngleRange / 2;
        }
        
        // Position children with precise, ordered spacing
        children.forEach((childId, index) => {
            const child = this.nodes.get(childId);
            
            // Calculate preferred child angle precisely
            let preferredAngle;
            if (children.length === 1) {
                // Single child: center of range
                preferredAngle = customStartAngle + effectiveAngleRange / 2;
            } else {
                // Multiple children: evenly distributed
                preferredAngle = customStartAngle + (index * angleStep);
            }
            
            // Calculate initial distance - clear separation between levels
            let baseDistance;
            switch(node.depth) {
                case 0: baseDistance = 180; break; // Root to Level 1: larger distance for clear separation
                case 1: baseDistance = 120; break; // Level 1 to Level 2: smaller distance to distinguish levels
                default: baseDistance = 100; break; // Fallback (should not be used)
            }
            
            // For level 1 nodes, use perfect symmetric positioning
            // For other levels, use collision detection
            let finalPos;
            if (node.depth === 0) {
                // Level 1: Perfect symmetric circle - no collision detection
                finalPos = {
                    x: node.position.x + Math.cos(preferredAngle) * baseDistance,
                    y: node.position.y + Math.sin(preferredAngle) * baseDistance,
                    angle: preferredAngle
                };
            } else {
                // Other levels: Use collision detection
                finalPos = this.findCollisionFreePosition(
                    node.position, 
                    preferredAngle, 
                    baseDistance, 
                    childId
                );
            }
            
            child.angle = finalPos.angle;
            child.position = { x: finalPos.x, y: finalPos.y };
            
            // Recursively position next level with structured ranges
            let childAngleRange;
            switch(child.depth) {
                case 1: childAngleRange = Math.PI; break;        // Semi-circle for level 2 (FINAL)
                default: childAngleRange = Math.PI / 8; break;   // Fallback (should not be used)
            }
            
            this.positionChildren(childId, finalPos.angle - childAngleRange/2, childAngleRange);
        });
    },

    /**
     * Check if a position collides with existing nodes
     * @param {Object} position - Position to check {x, y}
     * @param {string} excludeNodeId - Node ID to exclude from collision check
     * @returns {boolean} True if collision detected
     */
    hasCollision(position, excludeNodeId) {
        const minDistance = (this.config.nodeRadius * 2) + this.config.collisionPadding;
        
        for (const [nodeId, nodeData] of this.nodes) {
            if (nodeId === excludeNodeId || !nodeData.position) continue;
            
            const dx = position.x - nodeData.position.x;
            const dy = position.y - nodeData.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
                return true;
            }
        }
        return false;
    },

    /**
     * Find a collision-free position around a parent node
     * @param {Object} parentPos - Parent position {x, y}
     * @param {number} preferredAngle - Preferred angle
     * @param {number} baseDistance - Base distance from parent
     * @param {string} excludeNodeId - Node to exclude from collision check
     * @returns {Object} Collision-free position {x, y, angle}
     */
    findCollisionFreePosition(parentPos, preferredAngle, baseDistance, excludeNodeId) {
        // Try preferred position first
        let testAngle = preferredAngle;
        let testDistance = baseDistance;
        
        // Maximum attempts to find a good position
        const maxAttempts = 20;
        const angleStep = Math.PI / 10; // 18 degrees
        const distanceStep = 20;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Try current angle at increasing distances
            for (let distTry = 0; distTry < 5; distTry++) {
                const currentDistance = testDistance + (distTry * distanceStep);
                const testPos = {
                    x: parentPos.x + Math.cos(testAngle) * currentDistance,
                    y: parentPos.y + Math.sin(testAngle) * currentDistance
                };
                
                if (!this.hasCollision(testPos, excludeNodeId)) {
                    return {
                        x: testPos.x,
                        y: testPos.y,
                        angle: testAngle
                    };
                }
            }
            
            // Try angles around the preferred angle
            if (attempt % 2 === 0) {
                testAngle = preferredAngle + (Math.ceil(attempt / 2) * angleStep);
            } else {
                testAngle = preferredAngle - (Math.ceil(attempt / 2) * angleStep);
            }
        }
        
        // Fallback: return preferred position with extended distance
        return {
            x: parentPos.x + Math.cos(preferredAngle) * (baseDistance + 100),
            y: parentPos.y + Math.sin(preferredAngle) * (baseDistance + 100),
            angle: preferredAngle
        };
    },

    /**
     * Apply calculated positions to DOM elements
     */
    applyPositions() {
        this.nodes.forEach((nodeData, nodeId) => {
            const { element, position } = nodeData;
            if (element && position) {
                element.style.left = `${position.x - this.config.nodeRadius}px`;
                element.style.top = `${position.y - this.config.nodeRadius}px`;
            }
        });
        
        Utils.updateCanvasSize();
    },

    /**
     * Draw a curved connection between two nodes
     * @param {string} fromId - Source node ID
     * @param {string} toId - Target node ID
     * @param {string} tag - Connection tag
     */
    drawConnection(fromId, toId, tag) {
        const fromNode = this.nodes.get(fromId);
        const toNode = this.nodes.get(toId);
        
        if (!fromNode || !toNode || !this.svgLayer) return;
        
        const connectionId = `${fromId}-${toId}`;
        
        // Remove existing connection
        const existingConnection = this.connections.get(connectionId);
        if (existingConnection) {
            if (existingConnection.svgPath) {
                existingConnection.svgPath.remove();
            }
            if (existingConnection.textElement) {
                existingConnection.textElement.remove();
            }
        }
        
        // Create curved path between nodes
        const path = this.createCurvedPath(fromNode.position, toNode.position);
        
        // Create SVG path element
        const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svgPath.setAttribute('d', path);
        
        // Clean, uniform branch styling
        const fromDepth = fromNode.depth || 0;
        
        // Consistent branch thickness based on level
        let strokeWidth;
        switch(fromDepth) {
            case 0: strokeWidth = 3; break;   // Root connections
            case 1: strokeWidth = 2.5; break; // First level
            case 2: strokeWidth = 2; break;   // Second level  
            default: strokeWidth = 1.5; break; // Third level+
        }
        
        // Use tag colors for all connections - more colorful and clear
        const branchColor = this.getTagColor(tag);
        
        svgPath.setAttribute('stroke', branchColor);
        svgPath.setAttribute('stroke-width', strokeWidth);
        svgPath.setAttribute('fill', 'none');
        svgPath.setAttribute('opacity', '0.8');
        svgPath.setAttribute('stroke-linecap', 'round');
        svgPath.setAttribute('stroke-linejoin', 'round');
        svgPath.classList.add('tree-branch');
        
        // Clean animation with consistent timing
        const pathLength = svgPath.getTotalLength();
        svgPath.style.strokeDasharray = pathLength;
        svgPath.style.strokeDashoffset = pathLength;
        
        // Structured animation timing based on level
        const animationDelay = fromDepth * 0.2;
        svgPath.style.animationDelay = `${animationDelay}s`;
        svgPath.style.animation = 'drawBranch 0.8s ease-out forwards';
        
        this.svgLayer.appendChild(svgPath);
        
        // Create text label for the tag
        const tagText = this.createTagLabel(fromNode.position, toNode.position, tag, branchColor);
        this.svgLayer.appendChild(tagText);
        
        // Store connection
        this.connections.set(connectionId, {
            from: fromId,
            to: toId,
            tag,
            svgPath,
            textElement: tagText
        });
    },

    /**
     * Create a curved path between two points
     * @param {Object} from - Start position {x, y}
     * @param {Object} to - End position {x, y}
     * @returns {string} SVG path string
     */
    createCurvedPath(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Simple, clean curved connections for structured layout
        const angle = Math.atan2(dy, dx);
        
        // Single control point for clean, minimal curve
        const midX = from.x + dx * 0.5;
        const midY = from.y + dy * 0.5;
        
        // Gentle curve perpendicular to the line
        const perpAngle = angle + Math.PI / 2;
        const curveOffset = distance * 0.15; // Gentle curve amount
        
        const controlX = midX + Math.cos(perpAngle) * curveOffset;
        const controlY = midY + Math.sin(perpAngle) * curveOffset;
        
        // Simple quadratic curve for clean appearance
        return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
    },

    /**
     * Create a text label for a tag on a branch
     * @param {Object} from - Start position {x, y}
     * @param {Object} to - End position {x, y}
     * @param {string} tag - Tag string (type:value)
     * @param {string} color - Text color
     * @returns {SVGElement} SVG text element
     */
    createTagLabel(from, to, tag, color) {
        // Calculate midpoint of the connection
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        // Extract just the tag value (after the colon)
        const tagValue = tag.split(':')[1] || tag;
        
        // Create SVG text element
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', midX);
        textElement.setAttribute('y', midY);
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('fill', color);
        textElement.setAttribute('font-size', '11px');
        textElement.setAttribute('font-weight', '600');
        textElement.setAttribute('font-family', 'Inter, sans-serif');
        textElement.setAttribute('opacity', '0.9');
        textElement.classList.add('branch-label');
        
        // Add background for better readability
        textElement.style.textShadow = '0 0 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6)';
        textElement.style.stroke = 'rgba(0,0,0,0.5)';
        textElement.style.strokeWidth = '0.5px';
        textElement.style.paintOrder = 'stroke fill';
        
        textElement.textContent = tagValue;
        
        return textElement;
    },

    /**
     * Get color for a tag type
     * @param {string} tag - Tag string (type:value)
     * @returns {string} Color value
     */
    getTagColor(tag) {
        const tagType = tag.split(':')[0];
        
        // Centralized color system matching CSS definitions
        const colors = {
            emotion: '#ec4899',    // Pink gradient primary color
            energy: '#f59e0b',     // Orange gradient primary color
            mood: '#8b5cf6',       // Purple gradient primary color
            style: '#06b6d4',      // Cyan gradient primary color
            occasion: '#10b981',   // Green gradient primary color
            weather: '#6366f1',    // Blue gradient primary color  
            intensity: '#ef4444',  // Red gradient primary color
            rating: '#fbbf24',     // Yellow gradient primary color
            tempo: '#a855f7',      // Purple gradient primary color
            vibe: '#14b8a6'        // Teal gradient primary color
        };
        
        // If color exists, return it
        if (colors[tagType]) {
            return colors[tagType];
        }
        
        // Generate consistent color for new categories
        return this.generateColorForCategory(tagType);
    },

    /**
     * Generate a consistent color for a new category
     * @param {string} category - Category name
     * @returns {string} Hex color code
     */
    generateColorForCategory(category) {
        // Use a simple hash to generate consistent colors
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Generate HSL color with good saturation and lightness
        const hue = Math.abs(hash % 360);
        const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
        const lightness = 50 + (Math.abs(hash >> 8) % 15); // 50-65%
        
        // Convert HSL to hex
        return this.hslToHex(hue, saturation, lightness);
    },

    /**
     * Convert HSL to hex color
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @returns {string} Hex color code
     */
    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c/2;
        let r = 0, g = 0, b = 0;
        
        if (0 <= h && h < 60) {
            r = c; g = x; b = 0;
        } else if (60 <= h && h < 120) {
            r = x; g = c; b = 0;
        } else if (120 <= h && h < 180) {
            r = 0; g = c; b = x;
        } else if (180 <= h && h < 240) {
            r = 0; g = x; b = c;
        } else if (240 <= h && h < 300) {
            r = x; g = 0; b = c;
        } else if (300 <= h && h < 360) {
            r = c; g = 0; b = x;
        }
        
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },

    /**
     * Redraw all connections
     */
    redrawAllConnections() {
        // Clear existing paths
        if (this.svgLayer) {
            this.svgLayer.innerHTML = '';
        }
        
        // Redraw all connections
        this.connections.forEach((connection, connectionId) => {
            this.drawConnection(connection.from, connection.to, connection.tag);
        });
    },

    /**
     * Remove a node from the tree
     * @param {string} nodeId - Node ID to remove
     */
    removeNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // Remove connections involving this node
        this.connections.forEach((connection, connectionId) => {
            if (connection.from === nodeId || connection.to === nodeId) {
                if (connection.svgPath) {
                    connection.svgPath.remove();
                }
                if (connection.textElement) {
                    connection.textElement.remove();
                }
                this.connections.delete(connectionId);
            }
        });
        
        // Remove from parent's children
        if (node.parent) {
            const parent = this.nodes.get(node.parent);
            if (parent) {
                parent.children.delete(nodeId);
            }
        }
        
        // Recursively remove children
        node.children.forEach(childId => {
            this.removeNode(childId);
        });
        
        // Remove from tree
        this.nodes.delete(nodeId);
        
        // Update root if necessary
        if (this.rootNode === nodeId) {
            this.rootNode = this.nodes.size > 0 ? this.nodes.keys().next().value : null;
        }
        
        // Update layout
        this.updateLayout();
    },

    /**
     * Clear entire tree
     */
    clearTree() {
        // Clear SVG
        if (this.svgLayer) {
            this.svgLayer.innerHTML = '';
        }
        
        // Clear data structures
        this.nodes.clear();
        this.connections.clear();
        this.rootNode = null;
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add CSS animation for branch drawing
        const style = document.createElement('style');
        style.textContent = `
            @keyframes drawBranch {
                to {
                    stroke-dashoffset: 0;
                }
            }
            
            .tree-branch {
                transition: stroke 0.3s ease;
            }
            
            .tree-branch:hover {
                stroke-width: 5;
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * Get suggested tags for branching from a node
     * @param {string} nodeId - Node ID
     * @returns {Array} Array of suggested tags
     */
    getSuggestedTags(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node || !node.track) return [];
        
        // Return tags from the track that aren't already used for connections
        const usedTags = new Set();
        this.connections.forEach(connection => {
            if (connection.from === nodeId) {
                usedTags.add(connection.tag);
            }
        });
        
        return node.track.tags.filter(tag => !usedTags.has(tag));
    }
};

// Make Tree available globally
window.Tree = Tree; 