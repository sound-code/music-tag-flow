/**
 * TreeService - Centralized tree structure and node management
 * Handles node creation, positioning, connections, and tree operations
 */
class TreeService extends ServiceBase {
    constructor(stateManager, eventBus) {
        super(stateManager, eventBus);
        // Service-specific configuration
        this.config = {
            rootPosition: { x: 400, y: 300 }, // Default root position
            minDistance: 120, // Minimum distance between nodes
            maxDistance: 200, // Maximum distance for connections
            collisionRadius: 60, // Collision detection radius
            maxLevels: 3, // Maximum tree depth
            branchesPerTag: 3, // Number of branches per tag
            animationDelay: 200, // Animation delay between nodes
            repositionOnAdd: true, // Auto-reposition after adding nodes
            validatePositions: true // Validate positions to prevent overlaps
        };
        // Tree generation config per level
        this.levelConfig = {
            0: { // Root level
                maxNodes: 1,
                angleSpread: 360,
                distance: 0
            },
            1: { // First level
                maxNodes: 5,
                angleSpread: 360,
                distance: 150
            },
            2: { // Second level
                maxNodes: 3,
                angleSpread: 180,
                distance: 120
            }
        };
        // Connection colors by tag type
        this.connectionColors = {
            emotion: '#e74c3c',
            energy: '#f39c12',
            mood: '#9b59b6',
            style: '#3498db',
            occasion: '#2ecc71',
            weather: '#1abc9c',
            intensity: '#e67e22',
            rating: '#f1c40f',
            tempo: '#34495e',
            vibe: '#95a5a6'
        };
        // Initialize validation rules
        this.validationRules = {
            position: (pos) => pos && typeof pos.x === 'number' && typeof pos.y === 'number',
            track: (track) => track && typeof track === 'object' && track.title,
            level: (level) => typeof level === 'number' && level >= 0 && level < this.config.maxLevels
        };
    }
    /**
     * Initialize service and set up event listeners
     */
    initialize() {
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
                this.createBranchNodesFromTracks(tracks, sourceNodeData, tagValue);
            }
        });
    }
    /**
     * Create branch nodes from generated tracks
     * @param {Array} tracks - Generated tracks
     * @param {Object} parentNode - Parent node data
     * @param {string} connectionTag - Connection tag
     */
    createBranchNodesFromTracks(tracks, parentNode, connectionTag) {
        const levelConfig = this.levelConfig[parentNode.level + 1];
        if (!levelConfig) {
            return;
        }
        // Calculate positions for new nodes
        const positions = this.calculateBranchPositions(
            parentNode.position,
            Math.min(tracks.length, levelConfig.maxNodes),
            levelConfig.angleSpread,
            levelConfig.distance
        );
        // Create nodes with animation delay
        tracks.slice(0, positions.length).forEach((track, index) => {
            setTimeout(() => {
                this.addNode(track, positions[index], parentNode, connectionTag);
            }, index * this.config.animationDelay);
        });
        // Emit branch creation event
        this.emitEvent('tree:branches-created', {
            parentNode: parentNode.id,
            connectionTag,
            branchCount: Math.min(tracks.length, positions.length)
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
        // Create new root at center
        const rootPosition = { ...this.config.rootPosition };
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
        // Create root node
        const rootNode = this.addNode(track, dropPosition, null, 'root');
        // Generate first level branches
        this.generateTreeLevel(rootNode, 1);
        // Clear building flag after animation
        setTimeout(() => {
            this.setState('tree.isBuilding', false);
            this.emitEvent('tree:auto-generation-complete', {
                rootTrack: track.title,
                totalNodes: this.getState('tree.nodes').length
            });
        }, this.config.animationDelay * 10);
    }
    /**
     * Generate a specific tree level
     * @param {Object} parentNode - Parent node
     * @param {number} level - Level to generate
     */
    generateTreeLevel(parentNode, level) {
        const levelConfig = this.levelConfig[level];
        if (!levelConfig || level >= this.config.maxLevels) {
            return;
        }
        // Get tags from parent track for branch creation
        const parentTags = parentNode.track.tags || [];
        const prioritizedTags = this.sortTagsByPriority(parentTags);
        // Create branches for priority tags
        prioritizedTags.slice(0, levelConfig.maxNodes).forEach((tag, index) => {
            setTimeout(() => {
                this.createBranchesForTag(tag, parentNode.element, parentNode.track);
            }, index * this.config.animationDelay);
        });
    }
    /**
     * Calculate branch positions in a pattern
     * @param {Object} centerPos - Center position
     * @param {number} count - Number of positions
     * @param {number} angleSpread - Angle spread in degrees
     * @param {number} distance - Distance from center
     * @returns {Array} Array of positions
     */
    calculateBranchPositions(centerPos, count, angleSpread, distance) {
        const positions = [];
        const startAngle = -angleSpread / 2;
        const angleStep = count > 1 ? angleSpread / (count - 1) : 0;
        for (let i = 0; i < count; i++) {
            const angle = startAngle + (i * angleStep);
            const radians = (angle * Math.PI) / 180;
            const position = {
                x: centerPos.x + Math.cos(radians) * distance,
                y: centerPos.y + Math.sin(radians) * distance
            };
            positions.push(position);
        }
        return positions;
    }
    /**
     * Validate and adjust position to prevent overlaps
     * @param {Object} position - Desired position
     * @param {string} excludeNodeId - Node to exclude from collision check
     * @returns {Object} Adjusted position
     */
    validateAndAdjustPosition(position, excludeNodeId) {
        const currentNodes = this.getState('tree.nodes') || [];
        let adjustedPos = { ...position };
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
            const hasCollision = currentNodes.some(node => {
                if (node.id === excludeNodeId) return false;
                const distance = Math.sqrt(
                    Math.pow(adjustedPos.x - node.position.x, 2) +
                    Math.pow(adjustedPos.y - node.position.y, 2)
                );
                return distance < this.config.collisionRadius;
            });
            if (!hasCollision) {
                break;
            }
            // Adjust position by small random offset
            adjustedPos.x += (Math.random() - 0.5) * 20;
            adjustedPos.y += (Math.random() - 0.5) * 20;
            attempts++;
        }
        return adjustedPos;
    }
    /**
     * Create connection between two nodes
     * @param {Object} parentNode - Parent node
     * @param {Object} childNode - Child node
     * @param {string} connectionTag - Connection tag
     */
    createConnection(parentNode, childNode, connectionTag) {
        const connection = {
            id: `connection-${parentNode.id}-${childNode.id}`,
            parentId: parentNode.id,
            childId: childNode.id,
            tag: connectionTag,
            color: this.getConnectionColor(connectionTag),
            createdAt: Date.now()
        };
        const currentConnections = this.getState('tree.connections') || [];
        this.setState('tree.connections', [...currentConnections, connection]);
        this.emitEvent('tree:connection-created', { connection });
    }
    /**
     * Get connection color based on tag
     * @param {string} connectionTag - Connection tag
     * @returns {string} Color code
     */
    getConnectionColor(connectionTag) {
        if (connectionTag.includes(':')) {
            const tagType = connectionTag.split(':')[0];
            return this.connectionColors[tagType] || '#95a5a6';
        }
        return '#95a5a6';
    }
    /**
     * Sort tags by priority
     * @param {Array} tags - Tags to sort
     * @returns {Array} Sorted tags
     */
    sortTagsByPriority(tags) {
        return tags.sort((a, b) => {
            const getPriority = (tag) => {
                const type = tag.split(':')[0];
                return this.tagPriorities[type] || 999;
            };
            return getPriority(a) - getPriority(b);
        });
    }
    // Utility methods
    findNodeByElement(element) {
        const nodes = this.getState('tree.nodes') || [];
        return nodes.find(node => node.element === element);
    }
    findNodeById(nodeId) {
        const nodes = this.getState('tree.nodes') || [];
        return nodes.find(node => node.id === nodeId);
    }
    getNodeSubtree(nodeId) {
        const nodes = this.getState('tree.nodes') || [];
        const subtree = [nodeId];
        const addChildren = (parentId) => {
            const children = nodes.filter(n => n.parentNode === parentId);
            children.forEach(child => {
                subtree.push(child.id);
                addChildren(child.id);
            });
        };
        addChildren(nodeId);
        return subtree;
    }
    addChildToParent(parentId, childId) {
        const nodes = this.getState('tree.nodes') || [];
        const updatedNodes = nodes.map(node => {
            if (node.id === parentId) {
                return {
                    ...node,
                    children: [...node.children, childId]
                };
            }
            return node;
        });
        this.setState('tree.nodes', updatedNodes);
    }
    removeConnectionsForNode(nodeId) {
        const connections = this.getState('tree.connections') || [];
        const remainingConnections = connections.filter(
            conn => conn.parentId !== nodeId && conn.childId !== nodeId
        );
        this.setState('tree.connections', remainingConnections);
    }
    optimizeTreeLayout() {
        // Placeholder for layout optimization algorithm
        this.emitEvent('tree:layout-optimized');
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
}
// Make available globally
window.TreeService = TreeService;
// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TreeService;
}