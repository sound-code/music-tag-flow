/**
 * TreeService - Centralized tree structure and node management
 * Handles node creation, positioning, connections, and tree operations
 */
class TreeService extends ServiceBase {
    constructor(stateManager, eventBus, dependencies = {}) {
        super(stateManager, eventBus, dependencies);
        // Service-specific configuration (distances reduced to keep nodes on screen)
        this.config = {
            rootPosition: this.getResponsiveRootPosition(), // Dynamic root position
            minDistance: 80, // Reduced minimum distance between nodes
            maxDistance: 120, // Reduced maximum distance for connections
            collisionRadius: 50, // Reduced collision detection radius
            maxLevels: 3, // Maximum tree depth
            branchesPerTag: 3, // Number of branches per tag
            animationDelay: 200, // Animation delay between nodes
            repositionOnAdd: true, // Auto-reposition after adding nodes
            validatePositions: true // Validate positions to prevent overlaps
        };
        // Tree generation config per level (restored from original tree.js logic)
        this.levelConfigs = {
            1: { tagsPerLevel: 5 }, // Level 1: 5 nodes in circle
            2: { tagsPerLevel: 3 }  // Level 2: 3 nodes per semi-circle
        };
        
        // Original tree.js config structure
        this.treeConfig = {
            nodeRadius: 40, // Actual node radius (80px diameter / 2)
            branchLength: 120, // Clean base distance for structured layout
            angleSpread: Math.PI / 3, // 60 degrees - structured spread
            levelSpacing: 80, // Consistent spacing between levels
            minAngleSeparation: Math.PI / 8, // Minimum angle for clean separation
            collisionPadding: 30, // Increased padding to prevent overlaps
        };
        // Initialize validation rules
        this.validationRules = {
            position: (pos) => pos && typeof pos.x === 'number' && typeof pos.y === 'number',
            track: (track) => track && typeof track === 'object' && track.title,
            level: (level) => typeof level === 'number' && level >= 0 && level < this.config.maxLevels
        };
    }
    
    /**
     * Calculate responsive root position based on viewport size
     */
    getResponsiveRootPosition() {
        const canvas = document.querySelector('.mindmap-canvas');
        let width, height;
        
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
        } else {
            // Fallback to window size
            width = window.innerWidth || 800;
            height = window.innerHeight || 600;
        }
        
        // Position root at center with safe margins
        const margin = 150; // Safe margin from edges
        return {
            x: Math.max(margin, Math.min(width - margin, width / 2)),
            y: Math.max(margin, Math.min(height - margin, height / 2))
        };
    }
    
    /**
     * Initialize service and set up event listeners
     */
    initialize() {
        // Initialize tree structure Maps
        this.nodes = new Map();
        this.connections = new Map();
        this.svgLayer = null;
        this.rootNode = null;
        
        // Create SVG layer immediately
        this.createTreeSVGLayer();
        
        // Ensure tree state exists
        if (!this.getState('tree.nodes')) {
            this.setState('tree.nodes', []);
        }
        if (!this.getState('tree.connections')) {
            this.setState('tree.connections', []);
        }
        if (!this.getState('tree.rootNode')) {
            this.setState('tree.rootNode', null);
        }
        if (!this.getState('tree.nodeCounter')) {
            this.setState('tree.nodeCounter', 0);
        }
        // Subscribe to tree state changes
        this.subscribeToState('tree.nodes', (nodes) => {
            this.onTreeNodesChanged(nodes);
        });
        this.subscribeToState('tree.rootNode', (rootNode) => {
            this.onRootNodeChanged(rootNode);
        });
        // Subscribe to external events
        this.subscribeToEvent('tree:add-node', (data) => {
            this.addNode(data.track, data.position, data.parentNode, data.connectionTag);
        });
        this.subscribeToEvent('tree:remove-node', (data) => {
            this.removeNode(data.nodeId);
        });
        this.subscribeToEvent('tree:clear', () => {
            this.clearTree();
        });
        this.subscribeToEvent('tree:create-branches', (data) => {
            this.createBranchesForTag(data.tagValue, data.sourceNode, data.trackData);
        });
        this.subscribeToEvent('tree:recenter-request', (data) => {
            this.recenterTree(data.track, data.node, data.connectionTag);
        });
        this.subscribeToEvent('tree:auto-generate', (data) => {
            this.generateAutoTree(data.track, data.dropPosition);
        });
    }
    /**
     * Add a node to the tree
     * @param {Object} track - Track data
     * @param {Object} position - Node position {x, y}
     * @param {Object} parentNode - Parent node (null for root)
     * @param {string} connectionTag - Connection tag
     * @returns {Object} Created node data
     */
    addNode(track, position, parentNode = null, connectionTag = 'direct') {
        // Validate inputs
        this.validate({ track, position }, {
            track: this.validationRules.track,
            position: this.validationRules.position
        });
        // Generate unique node ID
        const nodeCounter = this.getState('tree.nodeCounter') || 0;
        const nodeId = `node-${nodeCounter + 1}`;
        this.setState('tree.nodeCounter', nodeCounter + 1);
        // Create node data
        const nodeData = {
            id: nodeId,
            track: { ...track },
            position: { ...position },
            parentNode: parentNode ? parentNode.id : null,
            connectionTag,
            level: parentNode ? parentNode.level + 1 : 0,
            children: [],
            element: null, // Will be set by UI
            createdAt: Date.now(),
            visible: true
        };
        // Validate position to prevent overlaps
        if (this.config.validatePositions) {
            nodeData.position = this.validateAndAdjustPosition(nodeData.position, nodeData.id);
        }
        // Add to tree
        const currentNodes = this.getState('tree.nodes') || [];
        const newNodes = [...currentNodes, nodeData];
        this.setState('tree.nodes', newNodes);
        // Set as root if first node
        if (!this.getState('tree.rootNode')) {
            this.setState('tree.rootNode', nodeData);
        }
        // Update parent's children list
        if (parentNode) {
            this.addChildToParent(parentNode.id, nodeData.id);
            this.createConnection(parentNode, nodeData, connectionTag);
        }
        // Emit events
        this.emitEvent('tree:node-added', {
            nodeData,
            isRoot: !parentNode,
            treeSize: newNodes.length
        });
        // Auto-reposition if enabled
        if (this.config.repositionOnAdd && newNodes.length > 1) {
            this.optimizeTreeLayout();
        }
        return nodeData;
    }
    /**
     * Remove a node from the tree
     * @param {string} nodeId - Node ID to remove
     * @returns {boolean} Success status
     */
    removeNode(nodeId) {
        const currentNodes = this.getState('tree.nodes') || [];
        const nodeToRemove = currentNodes.find(n => n.id === nodeId);
        if (!nodeToRemove) {
            return false;
        }
        // Don't remove root node if it has children
        const isRoot = this.getState('tree.rootNode')?.id === nodeId;
        if (isRoot && nodeToRemove.children.length > 0) {
            return false;
        }
        // Remove node and its children recursively
        const nodesToRemove = this.getNodeSubtree(nodeId);
        const remainingNodes = currentNodes.filter(n => !nodesToRemove.includes(n.id));
        this.setState('tree.nodes', remainingNodes);
        // Update root if removed
        if (isRoot) {
            this.setState('tree.rootNode', null);
        }
        // Remove connections
        this.removeConnectionsForNode(nodeId);
        // Emit event
        this.emitEvent('tree:node-removed', {
            removedNodeId: nodeId,
            removedSubtree: nodesToRemove,
            remainingCount: remainingNodes.length
        });
        return true;
    }
    /**
     * Clear the entire tree
     */
    clearTree() {
        const currentNodes = this.getState('tree.nodes') || [];
        const wasEmpty = currentNodes.length === 0;
        if (!wasEmpty) {
            this.updateState([
                { path: 'tree.nodes', value: [] },
                { path: 'tree.connections', value: [] },
                { path: 'tree.rootNode', value: null },
                { path: 'tree.nodeCounter', value: 0 }
            ]);
            this.emitEvent('tree:cleared', { previousNodeCount: currentNodes.length });
        }
    }
    /**
     * Create branches for a specific tag
     * @param {string} tagValue - Tag value for branches
     * @param {HTMLElement} sourceNode - Source node element
     * @param {Object} trackData - Source track data
     */
    async createBranchesForTag(tagValue, sourceNode, trackData) {
        // Find source node in tree
        const sourceNodeData = this.findNodeByElement(sourceNode);
        if (!sourceNodeData) {
            return;
        }
        // Check level limits
        if (sourceNodeData.level >= this.config.maxLevels - 1) {
            return;
        }
        // Generate tracks for the tag
        this.emitEvent('data:generate-tag-tracks', {
            tagValue,
            count: this.config.branchesPerTag,
            excludeTrack: trackData,
            callback: (tracks) => {
                // Create nodes directly using addNodeWithPositioning
                tracks.forEach((track, index) => {
                    setTimeout(() => {
                        const nodeId = `node-${Date.now()}-${index}`;
                        this.addNodeWithPositioning(nodeId, null, track, sourceNodeData.id, tagValue);
                    }, index * this.config.animationDelay);
                });
            }
        });
    }
    /**
     * Recenter tree on a specific track
     * @param {Object} track - Track to center on
     * @param {HTMLElement} node - Node element
     * @param {string} connectionTag - Connection tag
     */
    recenterTree(track, node, connectionTag) {
        // Clear current tree
        this.clearTree();
        // Create new root at responsive center position
        const rootPosition = this.getResponsiveRootPosition();
        this.addNode(track, rootPosition, null, connectionTag);
        // Emit recenter event
        this.emitEvent('tree:recentered', {
            newRoot: track,
            connectionTag
        });
    }
    /**
     * Generate automatic tree from dropped track
     * @param {Object} track - Dropped track
     * @param {Object} dropPosition - Drop position
     */
    generateAutoTree(track, dropPosition) {
        // Set building flag
        this.setState('tree.isBuilding', true);
        // Use responsive root position instead of drop position to keep tree centered
        const rootPosition = this.getResponsiveRootPosition();
        const rootNode = this.addNode(track, rootPosition, null, 'root');
        // Tree generation is now handled by addNodeWithPositioning automatically
        // Clear building flag after animation
        setTimeout(() => {
            this.setState('tree.isBuilding', false);
            this.emitEvent('tree:auto-generation-complete', {
                rootTrack: track.title,
                totalNodes: this.getState('tree.nodes').length
            });
        }, this.config.animationDelay * 10);
    }
    // Getters
    getTreeNodes() {
        return this.getState('tree.nodes') || [];
    }
    getTreeConnections() {
        return this.getState('tree.connections') || [];
    }
    getRootNode() {
        return this.getState('tree.rootNode');
    }
    getNodeCount() {
        return this.getTreeNodes().length;
    }
    getTreeDepth() {
        const nodes = this.getTreeNodes();
        return nodes.reduce((maxLevel, node) => Math.max(maxLevel, node.level), 0);
    }
    /**
     * Handle tree nodes changes
     * @private
     */
    onTreeNodesChanged(nodes) {
        this.emitEvent('tree:nodes-changed', {
            nodes,
            count: nodes.length,
            depth: this.getTreeDepth()
        });
    }
    /**
     * Handle root node changes
     * @private
     */
    onRootNodeChanged(rootNode) {
        this.emitEvent('tree:root-changed', { rootNode });
    }

    /**
     * Enhanced addNode method with positioning (replaces legacy version)
     * @param {string} nodeId - Unique node identifier  
     * @param {HTMLElement} element - DOM element for the node
     * @param {Object} track - Track data
     * @param {string|null} parentId - Parent node ID (null for root)
     * @param {string} connectionTag - Tag that connects to parent
     */
    addNodeWithPositioning(nodeId, element, track, parentId = null, connectionTag = null) {
        const nodeData = {
            element,
            track,
            children: new Set(),
            parent: parentId,
            depth: parentId ? (this.nodes.get(parentId)?.depth + 1 || 1) : 0,
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
        this.updateTreeLayout();
        
        // Draw connection to parent
        if (parentId && connectionTag) {
            this.drawTreeConnection(parentId, nodeId, connectionTag);
        }
        
        return nodeData;
    }

    /**
     * Update the entire tree layout with proper positioning
     */
    updateTreeLayout() {
        if (!this.rootNode || !this.nodes) return;
        
        // Calculate positions using tree layout algorithm
        this.calculateTreePositions();
        
        // Apply positions to DOM elements
        this.applyTreePositions();
        
        // Validate and fix any remaining overlaps
        this.validateTreeOverlaps();
        
        // Redraw all connections
        this.redrawTreeConnections();
        
        // Update canvas size
        if (typeof Utils !== 'undefined' && Utils.updateCanvasSize) {
            Utils.updateCanvasSize();
        }
    }

    /**
     * Calculate positions for all nodes using tree layout algorithm (EXACT original logic)
     */
    calculateTreePositions() {
        if (!this.rootNode || !this.nodes) return;
        
        const root = this.nodes.get(this.rootNode);
        if (!root) return;
        
        // Position root at center for structured 3-level layout (ORIGINAL LOGIC)
        const canvas = this.getState('dom.canvas') || document.querySelector('.mindmap-canvas');
        const canvasRect = canvas ? canvas.getBoundingClientRect() : { width: 800, height: 600 };
        
        // Calculate expected tree radius for 3-level structure (ORIGINAL VALUE)
        const expectedTreeRadius = 320; // EXACT original value
        
        // Center the root with adequate margins (ORIGINAL LOGIC)
        const centerX = Math.max(expectedTreeRadius, Math.min(canvasRect.width - expectedTreeRadius, canvasRect.width / 2));
        const centerY = Math.max(expectedTreeRadius, Math.min(canvasRect.height - expectedTreeRadius, canvasRect.height / 2));
        
        root.position = {
            x: centerX,
            y: centerY
        };
        root.angle = 0; // Neutral starting angle
        
        // Build simplified 3-level tree structure (ORIGINAL CALL)
        this.positionTreeChildren(this.rootNode, 0, Math.PI * 2);
    }

    /**
     * Position children of a node recursively (restored original tree.js logic)
     * @param {string} nodeId - Parent node ID
     * @param {number} startAngle - Starting angle for children
     * @param {number} angleRange - Angular range to distribute children within
     */
    positionTreeChildren(nodeId, startAngle, angleRange) {
        const node = this.nodes.get(nodeId);
        const children = Array.from(node.children);
        
        if (children.length === 0) return;
        
        // Calculate minimum safe distance based on node size and collision padding (ORIGINAL)
        const minSafeDistance = (this.treeConfig.nodeRadius * 2) + this.treeConfig.collisionPadding;
        
        // Calculate required angle separation to prevent overlaps (ORIGINAL)
        const baseDistance = this.treeConfig.branchLength + (node.depth * this.treeConfig.levelSpacing);
        
        // Structured concentric positioning system (original tree.js logic)
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
            
            // Calculate initial distance - EXACT ORIGINAL FORMULA
            // baseDistance was already calculated above as: branchLength + (depth * levelSpacing)
            // This gives: depth 0 = 120, depth 1 = 120+80 = 200
            // But original had fixed overrides, let me use the EXACT original values:
            let finalBaseDistance;
            switch(node.depth) {
                case 0: finalBaseDistance = 180; break; // Root to Level 1: EXACT original value
                case 1: finalBaseDistance = 120; break; // Level 1 to Level 2: EXACT original value  
                default: finalBaseDistance = 100; break; // Fallback (should not be used)
            }
            
            // For level 1 nodes, use perfect symmetric positioning
            // For other levels, use collision detection
            let finalPos;
            if (node.depth === 0) {
                // Level 1: Perfect symmetric circle - no collision detection (ORIGINAL)
                finalPos = {
                    x: node.position.x + Math.cos(preferredAngle) * finalBaseDistance,
                    y: node.position.y + Math.sin(preferredAngle) * finalBaseDistance,
                    angle: preferredAngle
                };
            } else {
                // Other levels: Use collision detection (ORIGINAL)
                finalPos = this.findTreeCollisionFreePosition(
                    node.position, 
                    preferredAngle, 
                    finalBaseDistance, 
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
            
            this.positionTreeChildren(childId, finalPos.angle - childAngleRange/2, childAngleRange);
        });
    }

    /**
     * Find a collision-free position around a parent node (original tree.js logic)
     * @param {Object} parentPos - Parent position {x, y}
     * @param {number} preferredAngle - Preferred angle
     * @param {number} baseDistance - Base distance from parent
     * @param {string} excludeNodeId - Node to exclude from collision check
     * @returns {Object} Collision-free position {x, y, angle}
     */
    findTreeCollisionFreePosition(parentPos, preferredAngle, baseDistance, excludeNodeId) {
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
                
                if (!this.hasTreeCollision(testPos, excludeNodeId)) {
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
    }

    /**
     * Check if a position collides with existing nodes (original tree.js logic)
     * @param {Object} position - Position to check {x, y}
     * @param {string} excludeNodeId - Node ID to exclude from collision check
     * @returns {boolean} True if collision detected
     */
    hasTreeCollision(position, excludeNodeId) {
        const minDistance = (this.treeConfig.nodeRadius * 2) + this.treeConfig.collisionPadding;
        
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
    }

    /**
     * Apply calculated positions to DOM elements
     */
    applyTreePositions() {
        if (!this.nodes) return;
        
        this.nodes.forEach((nodeData, nodeId) => {
            const { element, position } = nodeData;
            if (element && position) {
                // Center the node on its position
                const nodeRadius = 40; // Standard node radius
                element.style.left = `${position.x - nodeRadius}px`;
                element.style.top = `${position.y - nodeRadius}px`;
                element.style.position = 'absolute';
            }
        });
    }

    /**
     * Validate tree layout and fix any remaining overlaps (original tree.js logic)
     */
    validateTreeOverlaps() {
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
                    const minDistance = (this.treeConfig.nodeRadius * 2) + this.treeConfig.collisionPadding;
                    
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
        this.applyTreePositions();
    }

    /**
     * Draw connection between two nodes
     * @param {string} fromId - Source node ID
     * @param {string} toId - Target node ID  
     * @param {string} tag - Connection tag
     */
    drawTreeConnection(fromId, toId, tag) {
        const fromNode = this.nodes.get(fromId);
        const toNode = this.nodes.get(toId);
        
        if (!fromNode || !toNode || !fromNode.position || !toNode.position) {
            return;
        }

        // Create SVG layer if needed
        if (!this.svgLayer) {
            this.createTreeSVGLayer();
        }

        if (!this.svgLayer) {
            return;
        }

        const connectionId = `${fromId}-${toId}`;
        
        // Remove existing connection
        const existingConnection = this.connections.get(connectionId);
        if (existingConnection && existingConnection.svgPath) {
            existingConnection.svgPath.remove();
        }

        // Create curved path
        const path = this.createTreeCurvedPath(fromNode.position, toNode.position);
        
        // Create SVG path element
        const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svgPath.setAttribute('d', path);
        
        // Better styling for visibility
        const branchColor = (typeof tagUtils !== 'undefined') ? tagUtils.getTagColor(tag) : '#4a90e2';
        svgPath.setAttribute('stroke', branchColor);
        svgPath.setAttribute('stroke-width', '3');
        svgPath.setAttribute('fill', 'none');
        svgPath.setAttribute('opacity', '0.9');
        svgPath.setAttribute('stroke-linecap', 'round');
        svgPath.classList.add('tree-branch');
        
        this.svgLayer.appendChild(svgPath);
        
        // Create text label for the tag
        const tagText = this.createTreeTagLabel(fromNode.position, toNode.position, tag, branchColor);
        if (tagText) {
            this.svgLayer.appendChild(tagText);
        }
        
        // Store connection
        this.connections.set(connectionId, {
            from: fromId,
            to: toId,
            tag,
            svgPath,
            textElement: tagText
        });
    }

    /**
     * Create SVG layer for connections
     */
    createTreeSVGLayer() {
        // Try multiple selectors to find the canvas
        const canvas = document.querySelector('.mindmap-canvas') || 
                      document.querySelector('.canvas-content') ||
                      document.querySelector('#canvas') ||
                      document.body;
        
        if (!canvas) {
            return;
        }
        
        // Remove existing SVG
        const existingSvg = canvas.querySelector('.tree-svg');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // Create new SVG
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
        
        // Insert SVG as first child or append if no children
        if (canvas.firstChild) {
            canvas.insertBefore(svg, canvas.firstChild);
        } else {
            canvas.appendChild(svg);
        }
        
        this.svgLayer = svg;
    }

    /**
     * Create curved path between two points
     * @param {Object} from - Start position {x, y}
     * @param {Object} to - End position {x, y}
     * @returns {string} SVG path string
     */
    createTreeCurvedPath(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Simple curved path
        const midX = from.x + dx * 0.5;
        const midY = from.y + dy * 0.5;
        
        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;
        const curveOffset = distance * 0.15;
        
        const controlX = midX + Math.cos(perpAngle) * curveOffset;
        const controlY = midY + Math.sin(perpAngle) * curveOffset;
        
        return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
    }

    /**
     * Create a text label for a tag on a branch
     * @param {Object} from - Start position {x, y}
     * @param {Object} to - End position {x, y}
     * @param {string} tag - Tag string (type:value)
     * @param {string} color - Text color
     * @returns {SVGElement} SVG text element
     */
    createTreeTagLabel(from, to, tag, color) {
        // Calculate midpoint of the connection
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        // Extract just the tag value using centralized TagUtils
        const tagValue = (typeof tagUtils !== 'undefined') ? tagUtils.getTagValue(tag) : tag;
        
        // Create SVG text element
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', midX);
        textElement.setAttribute('y', midY);
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('fill', color);
        textElement.setAttribute('font-size', '12px');
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
    }

    /**
     * Redraw all connections
     */
    redrawTreeConnections() {
        if (!this.svgLayer || !this.connections) return;
        
        // Clear existing paths
        this.svgLayer.innerHTML = '';
        
        // Redraw all connections
        this.connections.forEach((connection, connectionId) => {
            this.drawTreeConnection(connection.from, connection.to, connection.tag);
        });
    }

    /**
     * Clear the tree structure
     */
    clearTreeStructure() {
        // Clear SVG
        if (this.svgLayer) {
            this.svgLayer.innerHTML = '';
        }
        
        // Clear data structures
        if (this.nodes) this.nodes.clear();
        if (this.connections) this.connections.clear();
        this.rootNode = null;
    }
}
// Make available globally
window.TreeService = TreeService;
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TreeService;
}