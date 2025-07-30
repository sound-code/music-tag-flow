/**
 * Tree Visualization Module - Facade/Bridge to TreeService
 * Maintains backwards compatibility while delegating to TreeService
 * Legacy tree.js functionality is now provided by TreeService
 */

const Tree = {
    // Legacy properties for backwards compatibility
    nodes: new Map(),
    connections: new Map(), 
    svgLayer: null,
    rootNode: null,
    
    // Tree layout configuration (kept for compatibility)
    config: {
        nodeRadius: 40,
        branchLength: 120,
        angleSpread: Math.PI / 3,
        levelSpacing: 80,
        minAngleSeparation: Math.PI / 8,
        collisionPadding: 30,
    },

    /**
     * Get TreeService instance
     */
    getTreeService() {
        if (window.App && window.App.getService) {
            return window.App.getService('tree');
        }
        return null;
    },

    /**
     * Sync legacy properties from TreeService
     */
    syncFromService() {
        const treeService = this.getTreeService();
        if (treeService) {
            this.nodes = treeService.nodes || new Map();
            this.connections = treeService.connections || new Map();
            this.rootNode = treeService.rootNode;
            this.svgLayer = treeService.svgLayer;
        }
    },

    /**
     * Initialize the tree visualization system - delegates to TreeService
     */
    initialize() {
        const treeService = this.getTreeService();
        if (treeService) {
            // TreeService handles initialization
            return;
        }
        // Fallback for legacy mode (minimal implementation)
        this.createSVGLayer();
        this.setupEventListeners();
    },

    /**
     * Create SVG layer for drawing connections
     */
    createSVGLayer() {
        const canvas = AppState?.canvasContent || document.querySelector('.mindmap-canvas');
        if (!canvas) return;
        
        const existingSvg = canvas.querySelector('.tree-svg');
        if (existingSvg) {
            existingSvg.remove();
        }
        
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
     * Setup event listeners
     */
    setupEventListeners() {
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
     * Add a node to the tree structure - delegates to TreeService
     * @param {string} nodeId - Unique node identifier
     * @param {HTMLElement} element - DOM element for the node
     * @param {Object} track - Track data
     * @param {string|null} parentId - Parent node ID (null for root)
     * @param {string} connectionTag - Tag that connects to parent
     */
    addNode(nodeId, element, track, parentId = null, connectionTag = null) {
        const treeService = this.getTreeService();
        if (treeService) {
            const result = treeService.addNodeWithPositioning(nodeId, element, track, parentId, connectionTag);
            this.syncFromService();
            return result;
        }
        
        // Minimal fallback - just store the node
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
        
        if (!this.rootNode) {
            this.rootNode = nodeId;
        }
        
        if (parentId && this.nodes.has(parentId)) {
            this.nodes.get(parentId).children.add(nodeId);
        }
        
        return nodeData;
    },

    /**
     * Update the entire tree layout - delegates to TreeService
     */
    updateLayout() {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.updateTreeLayout();
            this.syncFromService();
            return;
        }
        
        // Minimal fallback - no layout calculations
    },

    /**
     * Calculate positions for all nodes - delegates to TreeService
     */
    calculateTreePositions() {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.calculateTreePositions();
            this.syncFromService();
            return;
        }
        
        // Fallback - no positioning logic
    },

    /**
     * Position children of a node - delegates to TreeService
     */
    positionChildren(nodeId, startAngle, angleRange) {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.positionTreeChildren(nodeId, startAngle, angleRange);
            this.syncFromService();
            return;
        }
        
        // Fallback - no positioning logic
    },

    /**
     * Check if a position collides with existing nodes - delegates to TreeService
     */
    hasCollision(position, excludeNodeId) {
        const treeService = this.getTreeService();
        if (treeService) {
            return treeService.hasCollision(position, excludeNodeId);
        }
        
        return false; // Fallback
    },

    /**
     * Find collision-free position - delegates to TreeService
     */
    findCollisionFreePosition(parentPos, preferredAngle, baseDistance, excludeNodeId) {
        const treeService = this.getTreeService();
        if (treeService) {
            return treeService.findCollisionFreePosition(parentPos, preferredAngle, baseDistance, excludeNodeId);
        }
        
        // Fallback - return preferred position
        return {
            x: parentPos.x + Math.cos(preferredAngle) * baseDistance,
            y: parentPos.y + Math.sin(preferredAngle) * baseDistance,
            angle: preferredAngle
        };
    },

    /**
     * Validate and fix overlaps - delegates to TreeService
     */
    validateAndFixOverlaps() {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.validateAndFixOverlaps();
            this.syncFromService();
            return;
        }
        
        // Fallback - no validation logic
    },

    /**
     * Apply positions to DOM elements - delegates to TreeService
     */
    applyPositions() {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.applyTreePositions();
            return;
        }
        
        // Minimal fallback
        this.nodes.forEach((nodeData, nodeId) => {
            const { element, position } = nodeData;
            if (element && position) {
                element.style.left = `${position.x - this.config.nodeRadius}px`;
                element.style.top = `${position.y - this.config.nodeRadius}px`;
            }
        });
    },

    /**
     * Draw connection between nodes - delegates to TreeService
     */
    drawConnection(fromId, toId, tag) {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.drawTreeConnection(fromId, toId, tag);
            this.syncFromService();
            return;
        }
        
        // Fallback - no connection drawing
    },

    /**
     * Create curved path - delegates to TreeService
     */
    createCurvedPath(from, to) {
        const treeService = this.getTreeService();
        if (treeService) {
            return treeService.createTreeCurvedPath(from, to);
        }
        
        // Simple fallback - straight line
        return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    },

    /**
     * Create tag label - delegates to TreeService
     */
    createTagLabel(from, to, tag, color) {
        const treeService = this.getTreeService();
        if (treeService) {
            return treeService.createTagLabel(from, to, tag, color);
        }
        
        // Minimal fallback
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', (from.x + to.x) / 2);
        textElement.setAttribute('y', (from.y + to.y) / 2);
        textElement.textContent = tag;
        return textElement;
    },

    /**
     * Redraw all connections - delegates to TreeService
     */
    redrawAllConnections() {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.redrawTreeConnections();
            this.syncFromService();
            return;
        }
        
        // Fallback - no connection redrawing
    },

    /**
     * Remove a node from the tree - delegates to TreeService
     * @param {string} nodeId - Node ID to remove
     */
    removeNode(nodeId) {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.removeNodeEnhanced(nodeId);
            this.syncFromService();
            return;
        }
        
        // Minimal fallback
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        if (node.parent) {
            const parent = this.nodes.get(node.parent);
            if (parent) {
                parent.children.delete(nodeId);
            }
        }
        
        node.children.forEach(childId => {
            this.removeNode(childId);
        });
        
        this.nodes.delete(nodeId);
        
        if (this.rootNode === nodeId) {
            this.rootNode = this.nodes.size > 0 ? this.nodes.keys().next().value : null;
        }
    },

    /**
     * Clear entire tree - delegates to TreeService
     */
    clearTree() {
        const treeService = this.getTreeService();
        if (treeService) {
            treeService.clearTreeStructure();
            // Sync legacy properties
            this.nodes.clear();
            this.connections.clear();
            this.rootNode = null;
            this.svgLayer = null;
            return;
        }
        
        // Fallback legacy implementation
        if (this.svgLayer) {
            this.svgLayer.innerHTML = '';
        }
        
        this.nodes.clear();
        this.connections.clear();
        this.rootNode = null;
    },

    /**
     * Get suggested tags for branching from a node - delegates to TreeService
     * @param {string} nodeId - Node ID
     * @returns {Array} Array of suggested tags
     */
    getSuggestedTags(nodeId) {
        const treeService = this.getTreeService();
        if (treeService) {
            return treeService.getSuggestedTags(nodeId);
        }
        
        // Fallback legacy implementation
        const node = this.nodes.get(nodeId);
        if (!node || !node.track) return [];
        
        const usedTags = new Set();
        this.connections.forEach(connection => {
            if (connection.from === nodeId) {
                usedTags.add(connection.tag);
            }
        });
        
        return node.track.tags ? node.track.tags.filter(tag => !usedTags.has(tag)) : [];
    }
};

// Make Tree available globally
window.Tree = Tree;