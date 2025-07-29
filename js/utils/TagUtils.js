/**
 * TagUtils - Centralizzata gestione dei tags dell'applicazione
 * Elimina la duplicazione di codice per parsing, colori, validazione tags
 */

class TagUtils {
    constructor() {
        // Definizione colori tags centralizzata
        this.tagColors = {
            emotion: '#ff6b6b',    // Rosso
            energy: '#4ecdc4',     // Turchese
            mood: '#45b7d1',       // Blu
            style: '#96ceb4',      // Verde
            occasion: '#feca57',   // Giallo
            weather: '#ff9ff3',    // Rosa
            intensity: '#54a0ff',  // Blu intenso
            rating: '#5f27cd',     // Viola
            tempo: '#00d2d3',      // Ciano
            vibe: '#ff6348',       // Arancione
            genre: '#2ed573',      // Verde chiaro
            era: '#ffa502',        // Arancione scuro
            source: '#747d8c',     // Grigio
            format: '#a4b0be',     // Grigio chiaro
            quality: '#57606f',    // Grigio scuro
            bitrate: '#2f3542'     // Grigio molto scuro
        };

        // Priorità tags per ordinamento
        this.tagPriorities = {
            emotion: 1,
            energy: 2,
            mood: 3,
            style: 4,
            genre: 5,
            intensity: 6,
            tempo: 7,
            vibe: 8,
            rating: 9,
            occasion: 10,
            weather: 11,
            era: 12,
            quality: 13,
            format: 14,
            bitrate: 15,
            source: 16
        };
    }

    /**
     * Parse un tag nel formato "categoria:valore"
     * @param {string} tag - Tag da parsare
     * @returns {Object} {type: string, value: string, isValid: boolean}
     */
    parseTag(tag) {
        if (!tag || typeof tag !== 'string') {
            return { type: '', value: tag || '', isValid: false };
        }

        const parts = tag.split(':');
        if (parts.length >= 2) {
            return {
                type: parts[0].trim(),
                value: parts.slice(1).join(':').trim(), // Handle values with colons
                isValid: true
            };
        }

        // Tag senza categoria (fallback)
        return {
            type: 'other',
            value: tag.trim(),
            isValid: false
        };
    }

    /**
     * Ottieni solo il tipo di un tag
     * @param {string} tag - Tag completo
     * @returns {string} Tipo del tag
     */
    getTagType(tag) {
        return this.parseTag(tag).type;
    }

    /**
     * Ottieni solo il valore di un tag
     * @param {string} tag - Tag completo  
     * @returns {string} Valore del tag
     */
    getTagValue(tag) {
        return this.parseTag(tag).value;
    }

    /**
     * Verifica se un tag è valido (formato categoria:valore)
     * @param {string} tag - Tag da verificare
     * @returns {boolean} True se il tag è valido
     */
    isValidTag(tag) {
        return this.parseTag(tag).isValid;
    }

    /**
     * Ottieni il colore di un tag basato sulla sua categoria
     * @param {string} tag - Tag completo
     * @returns {string} Colore esadecimale
     */
    getTagColor(tag) {
        const type = this.getTagType(tag);
        return this.tagColors[type] || '#95a5a6'; // Grigio di default
    }

    /**
     * Ottieni la priorità di un tag per l'ordinamento
     * @param {string} tag - Tag completo
     * @returns {number} Priorità (numero più basso = priorità più alta)
     */
    getTagPriority(tag) {
        const type = this.getTagType(tag);
        return this.tagPriorities[type] || 999;
    }

    /**
     * Ordina un array di tags per priorità
     * @param {Array<string>} tags - Array di tags
     * @returns {Array<string>} Tags ordinati per priorità
     */
    sortTagsByPriority(tags) {
        return tags.sort((a, b) => this.getTagPriority(a) - this.getTagPriority(b));
    }

    /**
     * Raggruppa tags per categoria
     * @param {Array<string>} tags - Array di tags
     * @returns {Object} Oggetto con categorie come chiavi e array di valori
     */
    groupTagsByType(tags) {
        const grouped = {};
        
        tags.forEach(tag => {
            const parsed = this.parseTag(tag);
            if (!grouped[parsed.type]) {
                grouped[parsed.type] = [];
            }
            grouped[parsed.type].push(parsed.value);
        });

        return grouped;
    }

    /**
     * Parse tags da stringa del database (JSON o delimitatori)
     * @param {string|Array} tagsData - Dati tags dal database
     * @returns {Array<string>} Array di tags parsati
     */
    parseTagsFromDatabase(tagsData) {
        if (!tagsData) return [];
        
        // Se è già un array, ritorna così com'è
        if (Array.isArray(tagsData)) {
            return tagsData;
        }

        try {
            // Prova a parsare come JSON
            const parsed = JSON.parse(tagsData);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return [];
        } catch (e) {
            // Se non è JSON, tratta come stringa con delimitatori
            const tagString = tagsData.toString();
            return tagString
                .split(/[\n,;|\\]/)
                .map(tag => tag.trim())
                .filter(tag => tag && tag !== '\\');
        }
    }

    /**
     * Crea un tag formattato per la visualizzazione
     * @param {string} tag - Tag completo
     * @returns {string} Tag formattato per UI
     */
    formatTagForDisplay(tag) {
        const parsed = this.parseTag(tag);
        return parsed.isValid ? parsed.value : tag;
    }

    /**
     * Filtra tags per categoria specifica
     * @param {Array<string>} tags - Array di tags
     * @param {string} category - Categoria da filtrare
     * @returns {Array<string>} Tags della categoria specificata
     */
    filterTagsByCategory(tags, category) {
        return tags.filter(tag => this.getTagType(tag) === category);
    }

    /**
     * Trova tags che iniziano con una categoria specifica
     * @param {Array<string>} tags - Array di tags
     * @param {string} categoryPrefix - Prefisso categoria (es. "mood:")
     * @returns {Array<string>} Tags che corrispondono
     */
    findTagsWithCategoryPrefix(tags, categoryPrefix) {
        const prefix = categoryPrefix.endsWith(':') ? categoryPrefix : categoryPrefix + ':';
        return tags.filter(tag => tag.startsWith(prefix));
    }

    /**
     * Verifica se due tags appartengono alla stessa categoria
     * @param {string} tag1 - Primo tag
     * @param {string} tag2 - Secondo tag
     * @returns {boolean} True se stessa categoria
     */
    isSameCategory(tag1, tag2) {
        return this.getTagType(tag1) === this.getTagType(tag2);
    }
}

// Crea istanza globale
const tagUtils = new TagUtils();

// Export per moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagUtils;
    module.exports.tagUtils = tagUtils;
}

// Disponibile globalmente nel browser
if (typeof window !== 'undefined') {
    window.TagUtils = TagUtils;
    window.tagUtils = tagUtils;
}