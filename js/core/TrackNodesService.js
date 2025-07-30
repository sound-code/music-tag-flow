/**
 * TrackNodesService - Gestione centralizzata dei nodi track
 * Migrazione da trackNodes.js alla nuova architettura service-based
 */

class TrackNodesService extends ServiceBase {
    constructor(stateManager, eventBus) {
        try {
            super(stateManager, eventBus);
        } catch (error) {
            console.error('TrackNodesService: Constructor error:', error);
            throw error;
        }
        
        // Configurazione del servizio
        this.config = {
            nodeRadius: 40,
            animationDuration: 600,
            defaultPosition: { x: 0.5, y: 0.5 }, // relative to canvas
            styles: {
                neutral: 'node-neutral',
                growing: 'growing'
            },
            events: {
                nodeCreated: 'tracknode:created',
                nodeClicked: 'tracknode:clicked',
                tagAdded: 'tracknode:tag-added',
                branchesCreated: 'tracknode:branches-created'
            }
        };
        
        // Tracking per chiamate attive (evita duplicazioni)
        this.activeCalls = new Set();
        
        // Cache per template DOM riutilizzabili
        this.templates = new Map();
    }
    
    /**
     * Inizializza il servizio (sincronizzato con ServiceBase)
     */
    initialize() {
        try {
            super.initialize();
            this.setupEventListeners();
            this.prepareTemplates();
        } catch (error) {
            console.error('TrackNodesService: Initialize error:', error);
            throw error;
        }
    }
    
    /**
     * Setup event listeners per integrazione con altri servizi
     */
    setupEventListeners() {
        if (!this.eventBus || typeof this.eventBus.on !== 'function') {
            return;
        }
        
        try {
            // Solo eventi essenziali - gestione diretta per i tag click
            this.eventBus.on('app:shutdown', () => {
                this.cleanup();
            });
        } catch (error) {
            console.error('TrackNodesService: Error setting up event listeners:', error);
        }
    }
    
    /**
     * Prepara i template DOM per riutilizzo
     */
    prepareTemplates() {
        if (!this.templates) {
            this.templates = new Map();
        }
        
        try {
            const nodeTemplate = document.createElement('div');
            nodeTemplate.className = 'track-node node-neutral';
            nodeTemplate.style.cssText = 'pointer-events: auto; z-index: 100; position: absolute;';
            this.templates.set('node', nodeTemplate);
            
            const playBtnTemplate = document.createElement('button');
            playBtnTemplate.className = 'play-btn';
            this.templates.set('playButton', playBtnTemplate);
            
            const tagsTemplate = document.createElement('div');
            tagsTemplate.className = 'tags-container';
            this.templates.set('tagsContainer', tagsTemplate);
            
        } catch (error) {
            console.error('TrackNodesService: Error preparing templates:', error);
        }
    }
    
    /**
     * Crea un nodo root (primo nodo dell'albero)
     * @param {Object} trackData - Dati del track
     * @param {number} x - Posizione X (opzionale)
     * @param {number} y - Posizione Y (opzionale)
     * @returns {HTMLElement} Elemento nodo creato
     */
    createRootNode(trackData, x = null, y = null) {
        if (x === null || y === null) {
            const canvas = this.getCanvasElement();
            const canvasRect = canvas.getBoundingClientRect();
            x = x || (canvasRect.width * this.config.defaultPosition.x - this.config.nodeRadius);
            y = y || (canvasRect.height * this.config.defaultPosition.y - this.config.nodeRadius);
        }
        
        const node = this.createNode(trackData, x, y, null, null);
        
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit(this.config.events.nodeCreated, {
                node,
                trackData,
                isRoot: true,
                position: { x, y }
            });
        }
        
        return node;
    }
    
    /**
     * Crea un nodo figlio
     * @param {Object} trackData - Dati del track
     * @param {HTMLElement} parentNode - Nodo genitore
     * @param {string} connectionTag - Tag di connessione
     * @param {Function} callback - Callback opzionale
     * @returns {HTMLElement} Elemento nodo creato
     */
    createChildNode(trackData, parentNode, connectionTag, callback = null) {
        const parentLeft = parseInt(parentNode.style.left) || 0;
        const parentTop = parseInt(parentNode.style.top) || 0;
        
        const node = this.createNode(
            trackData, 
            parentLeft + 100, 
            parentTop, 
            parentNode, 
            connectionTag
        );
        
        if (callback && typeof callback === 'function') {
            callback(node);
        }
        
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit(this.config.events.nodeCreated, {
                node,
                trackData,
                parentNode,
                connectionTag,
                isRoot: false
            });
        }
        
        return node;
    }
    
    /**
     * Funzione core per creazione nodo (refactored da trackNodes.js)
     * @param {Object} track - Dati del track
     * @param {number} x - Posizione X
     * @param {number} y - Posizione Y  
     * @param {HTMLElement} parentNode - Nodo genitore opzionale
     * @param {string} connectionTag - Tag di connessione opzionale
     * @returns {HTMLElement} Elemento nodo creato
     */
    createNode(track, x, y, parentNode = null, connectionTag = null) {
        console.log('🏗️ TrackNodesService: Creating node for', track.title);
        try {
            // Ottieni riferimenti dal state
            const canvasContent = this.getCanvasContentElement();
            const appState = this.getAppState();
            
            // Clona template base nodo
            const nodeTemplate = this.templates && this.templates.get('node');
            const node = nodeTemplate ? nodeTemplate.cloneNode(false) : document.createElement('div');
            if (!nodeTemplate) {
                node.className = 'track-node node-neutral';
                node.style.cssText = 'pointer-events: auto; z-index: 100; position: absolute;';
            }
            node.id = `node-${this.generateNodeId()}`;
            
            // Setup connection tag
            if (connectionTag) {
                node.dataset.connectionTag = connectionTag;
            }
            
            // Salva track data
            node.dataset.track = JSON.stringify(track);
            
            // Setup parent relationship
            if (parentNode) {
                node.dataset.parentId = parentNode.id;
            }
            
            // Posizionamento
            node.style.left = `${x}px`;
            node.style.top = `${y}px`;
            
            // Crea elementi figlio
            const playBtn = this.createPlayButton(track);
            const title = this.createTextElement('div', 'title', track.title);
            const artist = this.createTextElement('div', 'artist', track.artist);
            const tagsContainer = this.createTagsContainer(track, node);
            
            // Assembla nodo
            node.appendChild(playBtn);
            node.appendChild(title);
            node.appendChild(artist);
            node.appendChild(tagsContainer);
            
            // Setup click handler
            this.attachClickHandler(node, track, connectionTag);
            
            // Aggiungi al DOM
            canvasContent.appendChild(node);
            
            // Aggiorna state
            this.updateAppState(node, track);
            
            // Integrazione con TreeService
            this.integrateWithTreeService(node, track, parentNode, connectionTag);
            
            // Animazione per nodi non-root
            if (parentNode) {
                this.animateNodeCreation(node);
            }
            
            return node;
            
        } catch (error) {
            console.error('TrackNodesService: Error creating node:', error);
            throw error;
        }
    }
    
    /**
     * Genera ID unico per il nodo
     * @returns {number} ID nodo
     */
    generateNodeId() {
        const appState = this.getAppState();
        return appState.incrementNodeCounter();
    }
    
    /**
     * Crea play button per un track
     * @param {Object} track - Dati track
     * @returns {HTMLElement} Play button
     */
    createPlayButton(track) {
        const playBtnTemplate = this.templates && this.templates.get('playButton');
        const playBtn = playBtnTemplate ? playBtnTemplate.cloneNode(false) : document.createElement('button');
        if (!playBtnTemplate) {
            playBtn.className = 'play-btn';
        }
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handlePlayButtonClick(playBtn, track);
        });
        return playBtn;
    }
    
    /**
     * Crea elemento testo riutilizzabile
     * @param {string} tag - Tag HTML
     * @param {string} className - Classe CSS
     * @param {string} text - Testo contenuto
     * @returns {HTMLElement} Elemento testo
     */
    createTextElement(tag, className, text) {
        const element = document.createElement(tag);
        element.className = className;
        element.textContent = text;
        return element;
    }
    
    /**
     * Ottieni riferimento canvas element
     * @returns {HTMLElement} Canvas element
     */
    getCanvasElement() {
        return document.querySelector('.mindmap-canvas') || 
               this.getAppState().canvas;
    }
    
    /**
     * Ottieni riferimento canvas content element
     * @returns {HTMLElement} Canvas content element
     */
    getCanvasContentElement() {
        return document.querySelector('.canvas-content') || 
               this.getAppState().canvasContent;
    }
    
    /**
     * Ottieni AppState (legacy compatibility)
     * @returns {Object} AppState object
     */
    getAppState() {
        return window.AppState || {};
    }
    
    /**
     * Attach click handler al nodo
     * @param {HTMLElement} node - Elemento nodo
     * @param {Object} track - Dati track
     * @param {string} connectionTag - Tag connessione
     */
    attachClickHandler(node, track, connectionTag) {
        node.addEventListener('click', async (e) => {
            // Skip se click su elementi specifici
            if (this.shouldSkipClick(e.target)) {
                return;
            }
            
            // Emit evento click
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('node:click', {
                    track: track,
                    node: node,
                    connectionTag: connectionTag || 'direct-selection'
                });
                
                this.eventBus.emit(this.config.events.nodeClicked, {
                    node,
                    track,
                    connectionTag
                });
            } else if (window.EventBus) {
                window.EventBus.emit('node:click', {
                    track: track,
                    node: node,
                    connectionTag: connectionTag || 'direct-selection'
                });
            }
        });
    }
    
    /**
     * Verifica se il click deve essere saltato
     * @param {HTMLElement} target - Target del click
     * @returns {boolean} True se skip
     */
    shouldSkipClick(target) {
        const skipClasses = [
            'play-btn', 'add-tag-btn', 'tooltip-add-tag-input', 'tag'
        ];
        
        const skipSelectors = [
            '.play-btn', '.add-tag-interface'
        ];
        
        return skipClasses.some(cls => target.classList.contains(cls)) ||
               skipSelectors.some(sel => target.closest(sel)) ||
               target.tagName === 'INPUT';
    }
    
    /**
     * Aggiorna AppState con nuovo nodo (legacy compatibility)
     * @param {HTMLElement} node - Elemento nodo
     * @param {Object} track - Dati track
     */
    updateAppState(node, track) {
        const appState = this.getAppState();
        if (appState.allNodes) {
            const nodeData = { element: node, track: track };
            
            if (appState.selectedTagForNextNode) {
                nodeData.selectedTag = appState.selectedTagForNextNode;
                appState.setSelectedTagForNextNode(null);
            }
            
            appState.allNodes.push(nodeData);
        }
    }
    
    /**
     * Integrazione con TreeService (legacy compatibility)
     * @param {HTMLElement} node - Elemento nodo
     * @param {Object} track - Dati track
     * @param {HTMLElement} parentNode - Nodo genitore
     * @param {string} connectionTag - Tag connessione
     */
    integrateWithTreeService(node, track, parentNode, connectionTag) {
        if (typeof Tree !== 'undefined' && Tree.addNode) {
            const parentId = parentNode ? parentNode.id : null;
            
            try {
                // Let Tree.addNode handle the parent validation and node management
                Tree.addNode(node.id, node, track, parentId, connectionTag);
                // Tree integration successful
            } catch (error) {
                // Error integrating with Tree service
                if (parentId && error.message && error.message.includes('parent')) {
                    try {
                        const parentTrackData = JSON.parse(parentNode.dataset.track);
                        const parentParentId = parentNode.dataset.parentId || null;
                        const parentConnectionTag = parentNode.dataset.connectionTag || null;
                        
                        Tree.addNode(parentId, parentNode, parentTrackData, parentParentId, parentConnectionTag);
                        Tree.addNode(node.id, node, track, parentId, connectionTag);
                    } catch (retryError) {
                        // Failed to add parent node, continuing without Tree integration
                    }
                }
            }
        }
    }
    
    /**
     * Anima la creazione del nodo
     * @param {HTMLElement} node - Elemento nodo
     */
    animateNodeCreation(node) {
        node.classList.add(this.config.styles.growing);
        setTimeout(() => {
            node.classList.remove(this.config.styles.growing);
        }, this.config.animationDuration);
    }
    
    /**
     * Cleanup del servizio
     */
    cleanup() {
        if (this.activeCalls) {
            this.activeCalls.clear();
        }
        if (this.templates) {
            this.templates.clear();
        }
        // Service cleaned up
    }
    
    // ========================
    // TAGS CONTAINER SYSTEM
    // ========================
    
    /**
     * Crea container per i tags di un nodo (migrato da trackNodes.js)
     * @param {Object} track - Dati track
     * @param {HTMLElement} node - Elemento nodo
     * @returns {HTMLElement} Container tags
     */
    createTagsContainer(track, node) {
        console.log('🏭 TrackNodesService: Creating tags container for', track.title);
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        // Hidden container - tags are shown via UIService tooltip system
        tagsContainer.style.display = 'none';

        // Titolo
        const title = document.createElement('div');
        title.className = 'tooltip-title';
        title.textContent = `${track.title} - ${track.artist}`;
        tagsContainer.appendChild(title);

        // Wrapper per i tags
        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'tooltip-tags';

        // Crea elementi tag
        track.tags.forEach(tagWithValue => {
            const tagElement = this.createTagElement(tagWithValue, track, node);
            tagsWrapper.appendChild(tagElement);
        });

        // Input per aggiungere nuovi tag
        const addTagInput = this.createAddTagInput(track, node, tagsContainer);
        tagsWrapper.appendChild(addTagInput);
        
        tagsContainer.appendChild(tagsWrapper);
        
        
        return tagsContainer;
    }
    
    /**
     * Crea singolo elemento tag
     * @param {string} tagWithValue - Tag completo (tipo:valore)
     * @param {Object} track - Dati track
     * @param {HTMLElement} node - Elemento nodo
     * @returns {HTMLElement} Elemento tag
     */
    createTagElement(tagWithValue, track, node) {
        // Parse tag usando utility centralizzata
        const tagInfo = this.parseTag(tagWithValue);
        const tagType = tagInfo.type;
        const tagValue = tagInfo.value;
        
        const tag = document.createElement('div');
        tag.className = `tooltip-tag tag-${tagType}`;
        tag.textContent = tagValue;
        tag.dataset.tagValue = tagWithValue;
        
        // Event handler per click su tag
        tag.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            this.handleTagElementClick(tagWithValue, node, track, tag);
        }, true);
        
        // Assicura che esistano gli stili per questa categoria
        this.ensureCategoryStyles(tagType);
        
        return tag;
    }
    
    /**
     * Crea input per aggiungere nuovi tag
     * @param {Object} track - Dati track
     * @param {HTMLElement} node - Elemento nodo
     * @param {HTMLElement} tagsContainer - Container principale
     * @returns {HTMLElement} Input element
     */
    createAddTagInput(track, node, tagsContainer) {
        const addTagInput = document.createElement('input');
        addTagInput.type = 'text';
        addTagInput.placeholder = '+';
        addTagInput.className = 'tooltip-add-tag-input';
        addTagInput.style.width = '60px';
        
        // Previeni propagazione eventi
        addTagInput.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        addTagInput.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        // Handler per Enter key
        addTagInput.addEventListener('keypress', async (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                await this.handleNewTagInput(addTagInput, track, node, tagsContainer);
            }
        });
        
        return addTagInput;
    }
    
    /**
     * Gestisce click su elemento tag
     * @param {string} tagWithValue - Tag completo
     * @param {HTMLElement} node - Elemento nodo
     * @param {Object} track - Dati track
     * @param {HTMLElement} tagElement - Elemento tag cliccato
     */
    handleTagElementClick(tagWithValue, node, track, tagElement) {
        // Previeni click multipli
        if (tagElement.dataset.processing === 'true') {
            console.log('🚫 Click già in elaborazione per:', tagWithValue);
            return;
        }
        
        tagElement.dataset.processing = 'true';
        console.log('🏷️ TrackNodesService: Tag clicked, creating branches directly', tagWithValue);
        
        // Gestisci direttamente la creazione dei branch - no eventi esterni
        this.createBranchesDirectly(tagWithValue, node).then(() => {
            // Rimuovi il flag dopo 2 secondi
            setTimeout(() => {
                tagElement.dataset.processing = 'false';
            }, 2000);
        });
    }
    
    /**
     * Gestisce input di nuovo tag
     * @param {HTMLElement} inputElement - Input element
     * @param {Object} track - Dati track
     * @param {HTMLElement} node - Elemento nodo
     * @param {HTMLElement} tagsContainer - Container tags
     */
    async handleNewTagInput(inputElement, track, node, tagsContainer) {
        const newTag = inputElement.value.trim();
        
        if (newTag && newTag.includes(':')) {
            try {
                // Aggiungi tag al nodo
                await this.addTagToNode(node, track, newTag);
                inputElement.value = '';
                
                // Refresh container ricreandolo
                const newTagsContainer = this.createTagsContainer(track, node);
                node.replaceChild(newTagsContainer, tagsContainer);
                
                // Emit evento
                if (this.eventBus && typeof this.eventBus.emit === 'function') {
                    this.eventBus.emit(this.config.events.tagAdded, {
                        node,
                        track,
                        newTag
                    });
                }
                
            } catch (error) {
                // Error adding tag
            }
        }
    }
    
    /**
     * Parse tag usando logica centralizzata
     * @param {string} tagWithValue - Tag completo
     * @returns {Object} {type, value}
     */
    parseTag(tagWithValue) {
        // Usa tagUtils se disponibile, altrimenti fallback
        if (typeof tagUtils !== 'undefined' && tagUtils.parseTag) {
            return tagUtils.parseTag(tagWithValue);
        }
        
        // Fallback parsing
        const parts = tagWithValue.split(':');
        return {
            type: parts[0] || 'unknown',
            value: parts[1] || tagWithValue
        };
    }
    
    /**
     * Assicura che esistano gli stili CSS per una categoria
     * @param {string} category - Nome categoria
     */
    ensureCategoryStyles(category) {
        // Verifica se gli stili esistono già
        const existingStyle = document.querySelector(`#category-styles-${category}`);
        if (existingStyle) return;
        
        // Ottieni colore dalla utility centralizzata
        const color = this.getTagColor(`${category}:test`);
        
        // Crea elemento style
        const style = document.createElement('style');
        style.id = `category-styles-${category}`;
        style.textContent = `
            /* Tooltip tag styles for ${category} */
            .tooltip-tag.tag-${category} {
                background: linear-gradient(135deg, ${color}, ${this.darkenColor(color, 20)});
                border-color: ${this.hexToRgba(color, 0.3)};
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .tooltip-tag.tag-${category}:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 8px ${this.hexToRgba(color, 0.4)};
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Ottieni colore per tag
     * @param {string} tag - Tag completo
     * @returns {string} Colore hex
     */
    getTagColor(tag) {
        if (typeof tagUtils !== 'undefined' && tagUtils.getTagColor) {
            return tagUtils.getTagColor(tag);
        }
        
        // Fallback colors
        const colors = {
            mood: '#FF6B6B',
            energy: '#4ECDC4', 
            emotion: '#45B7D1',
            style: '#96CEB4',
            vibe: '#FFEAA7',
            occasion: '#DDA0DD',
            tempo: '#98D8C8',
            weather: '#F7DC6F',
            intensity: '#BB8FCE',
            rating: '#F8C471'
        };
        
        const type = this.parseTag(tag).type;
        return colors[type] || '#888888';
    }
    
    /**
     * Scurisci un colore hex
     * @param {string} color - Colore hex
     * @param {number} percent - Percentuale di scurimento
     * @returns {string} Colore scurito
     */
    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    /**
     * Converti hex a rgba
     * @param {string} hex - Colore hex
     * @param {number} alpha - Valore alpha
     * @returns {string} Colore rgba
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    /**
     * Aggiorna i dati originali del track nella libreria HTML (migrato da trackNodes.js)
     * @param {Object} track - Dati track
     * @param {string} newTag - Nuovo tag da aggiungere
     */
    async updateOriginalTrackData(track, newTag) {
        // Trova l'elemento track originale nella libreria
        const trackItems = document.querySelectorAll('.track-item');
        let found = false;
        
        trackItems.forEach((item) => {
            const originalTrackData = this.safeParseTrackData(item.dataset.track);
            
            if (originalTrackData) {
                if (originalTrackData.title === track.title && 
                    originalTrackData.artist === track.artist && 
                    originalTrackData.album === track.album) {
                    
                    found = true;
                    
                    // Aggiungi il nuovo tag ai dati originali
                    if (!originalTrackData.tags.includes(newTag)) {
                        originalTrackData.tags.push(newTag);
                        // Aggiorna il dataset con i nuovi dati track
                        item.dataset.track = JSON.stringify(originalTrackData);
                    }
                }
            }
        });
        
        if (found) {
            // Persisti il tag nel database
            try {
                if (typeof DataLoader !== 'undefined' && DataLoader.addTagToTrack) {
                    await DataLoader.addTagToTrack(track, newTag);
                }
            } catch (error) {
                // Error saving tag to database
            }
        }
    }
    
    /**
     * Parse sicuro dei dati track dal dataset HTML (migrato da trackNodes.js)
     * @param {string} trackDataString - Stringa dati track grezza
     * @returns {Object|null} Dati track parsati o null se parsing fallisce
     */
    safeParseTrackData(trackDataString) {
        let cleanString = '';
        try {
            // Decodifica più completa delle entità HTML
            cleanString = trackDataString;
            
            // Crea elemento temporaneo per decodificare le entità HTML
            const tempElement = document.createElement('div');
            tempElement.innerHTML = cleanString;
            cleanString = tempElement.textContent || tempElement.innerText || '';
            
            // Sostituzioni manuali aggiuntive per problemi comuni
            cleanString = cleanString
                .replace(/&apos;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .trim();
            
            // Verifica che la stringa sembri JSON valido prima del parsing
            if (!cleanString.startsWith('{')) {
                return null;
            }
            
            // Se la stringa non finisce con }, prova a riparare JSON troncato
            if (!cleanString.endsWith('}')) {
                return null;
            }
            
            return JSON.parse(cleanString);
        } catch (error) {
            return null;
        }
    }
    
    // ========================
    // PLACEHOLDER METHODS
    // (da implementare nei prossimi step)
    // ========================
    
    /**
     * Gestisce click su play button (migrato da trackNodes.js)
     * @param {HTMLElement} playBtn - Elemento play button
     * @param {Object} track - Dati track
     */
    handlePlayButtonClick(playBtn, track) {
        // Ferma tutti gli altri player attivi
        document.querySelectorAll('.play-btn.playing, .list-play-btn.playing')
            .forEach(btn => {
                if (btn !== playBtn) {
                    btn.classList.remove('playing');
                }
            });
        
        // Toggle stato del button corrente
        playBtn.classList.toggle('playing');
        
        // Mostra notifica se in playing
        if (playBtn.classList.contains('playing')) {
            const message = `Now playing: ${track.title} by ${track.artist}`;
            
            // Emit evento per notifica
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('ui:notification', { message });
            } else if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification(message);
            }
        }
    }
    
    /**
     * Aggiunge un nuovo tag a un nodo esistente (migrato da trackNodes.js)
     * @param {HTMLElement} node - Elemento nodo
     * @param {Object} track - Dati track
     * @param {string} newTag - Nuovo tag (formato: "categoria:valore")
     */
    async addTagToNode(node, track, newTag) {
        // Aggiungi tag ai dati track se non esiste già
        if (!track.tags.includes(newTag)) {
            track.tags.push(newTag);
            
            // Aggiorna i dati originali del track solo se non è generato
            const isGenerated = track.generated || (track.id && track.id.startsWith('generated_'));
            
            if (!isGenerated) {
                await this.updateOriginalTrackData(track, newTag);
            }
        }
        
        // Aggiorna il container dei tag ricreandolo completamente
        const oldTagsContainer = node.querySelector('.tags-container');
        if (oldTagsContainer) {
            const newTagsContainer = this.createTagsContainer(track, node);
            node.replaceChild(newTagsContainer, oldTagsContainer);
        }
        
        // Assicura che esistano gli stili per la nuova categoria
        const category = this.parseTag(newTag).type;
        this.ensureCategoryStyles(category);
        
        // Il nodo mantiene sempre il colore neutrale grigio
        node.dataset.tagCategory = 'neutral';
        if (!node.classList.contains('node-neutral')) {
            node.classList.add('node-neutral');
        }
        
        // Aggiorna il dataset del nodo con i nuovi dati track
        node.dataset.track = JSON.stringify(track);
        
        // Forza refresh di eventuali tooltip aperti
        if (typeof UI !== 'undefined') {
            if (UI.tooltip && UI.tooltip.style.display === 'block') {
                UI.tooltip.style.display = 'none';
            }
            if (UI.currentHoverTarget) {
                UI.currentHoverTarget = null;
            }
        }
        
        // Mostra notifica di successo
        const message = `✅ Tag "${newTag}" added to "${track.title}"`;
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit('ui:notification', { message });
        } else if (typeof Utils !== 'undefined' && Utils.showNotification) {
            Utils.showNotification(message);
        }
    }
    
    /**
     * Crea branch direttamente per un tag - bypassa tutti i sistemi esistenti (migrato da trackNodes.js)
     * @param {string} tagValue - Valore del tag (es. "mood:confident")
     * @param {HTMLElement} sourceNode - Nodo sorgente per il branching
     */
    async createBranchesDirectly(tagValue, sourceNode) {
        console.log('🌟 createBranchesDirectly called with:', tagValue, sourceNode.id);
        
        // Previeni chiamate multiple per la stessa combinazione tag+nodo
        const callKey = `${tagValue}-${sourceNode.id}`;
        if (this.activeCalls.has(callKey)) {
            console.log('❌ Duplicate call prevented for:', callKey);
            return;
        }
        
        this.activeCalls.add(callKey);
        
        try {
            // Ottieni dati track sorgente
            const sourceTrackData = JSON.parse(sourceNode.dataset.track);
            
            // Genera ESATTAMENTE 5 track con questo tag usando DataLoader
            let relatedTracks = [];
            if (typeof DataLoader !== 'undefined' && DataLoader.generateTracksWithTag) {
                relatedTracks = await DataLoader.generateTracksWithTag(tagValue, sourceTrackData);
            }
            
            if (!relatedTracks || relatedTracks.length === 0) {
                return;
            }
            
            // Filtra track identici e prendi ESATTAMENTE 5
            const filteredTracks = relatedTracks.filter(track => 
                !(track.title === sourceTrackData.title && track.artist === sourceTrackData.artist)
            );
            
            const tracksToCreate = filteredTracks.slice(0, 5);
            
            // Crea ogni nodo con delay appropriato
            tracksToCreate.forEach((track, i) => {
                setTimeout(() => {
                    try {
                        // Crea nuovo nodo posizionato attorno al sorgente
                        const newNode = this.createNode(track, 0, 0, sourceNode, tagValue);
                        
                        // I nodi creati tramite branching non dovrebbero scatenare eventi node:click
                        // perché sono nodi automatici, non click dell'utente
                        // Basta che esistano nel DOM e nel Tree - fine
                        
                    } catch (error) {
                        // Error creating branch node
                    }
                }, i * 300); // Delay scaglionato per animazione
            });
            
            // Mostra notifica
            const tagDisplayValue = this.parseTag(tagValue).value;
            const message = `🌿 Created ${tracksToCreate.length} branches for ${tagDisplayValue}`;
            
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('ui:notification', { message });
            } else if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification(message);
            }
            
            // Emit evento per statistiche
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit(this.config.events.branchesCreated, {
                    sourceNode,
                    tagValue,
                    branchCount: tracksToCreate.length
                });
            }
            
        } catch (error) {
            // Error creating branches
        } finally {
            // Cleanup dopo 5 secondi
            setTimeout(() => {
                this.activeCalls.delete(callKey);
            }, 5000);
        }
    }
}

// Export del servizio
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackNodesService;
} else {
    window.TrackNodesService = TrackNodesService;
}