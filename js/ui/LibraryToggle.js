window.LibraryToggle = (() => {
    let isShowingScan = false;
    let uniqueTags = [];
    
    function init() {
        const toggleButton = document.getElementById('toggleScanButton');
        const libraryContent = document.getElementById('libraryContent');
        const scanContent = document.getElementById('scanContent');
        
        if (!toggleButton || !libraryContent || !scanContent) {
            console.error('LibraryToggle: Required elements not found');
            return;
        }
        
        toggleButton.addEventListener('click', toggleView);
        
        // Subscribe to events to update tags list
        if (window.App && window.App.eventBus) {
            window.App.eventBus.on('scan:completed', () => {
                updateTagsList();
            });
            
            window.App.eventBus.on('database:cleared', () => {
                updateTagsList();
            });
        }
    }
    
    function toggleView() {
        const libraryContent = document.getElementById('libraryContent');
        const scanContent = document.getElementById('scanContent');
        const toggleButton = document.getElementById('toggleScanButton');
        const colorLegend = document.querySelector('.color-legend');
        const playlistPhasesLink = document.querySelector('.playlist-phases-link');
        
        isShowingScan = !isShowingScan;
        
        if (isShowingScan) {
            libraryContent.style.display = 'none';
            scanContent.style.display = 'block';
            if (colorLegend) colorLegend.style.display = 'none';
            if (playlistPhasesLink) playlistPhasesLink.style.display = 'none';
            toggleButton.querySelector('.toggle-icon').textContent = '📚';
            toggleButton.title = 'Back to Library';
            
            // Notify that scan view is now visible
            if (window.App && window.App.eventBus) {
                window.App.eventBus.emit('scan:viewShown');
            }
        } else {
            libraryContent.style.display = 'block';
            scanContent.style.display = 'none';
            if (colorLegend) colorLegend.style.display = 'block';
            if (playlistPhasesLink) playlistPhasesLink.style.display = 'block';
            toggleButton.querySelector('.toggle-icon').textContent = '⚙️';
            toggleButton.title = 'Scan Settings';
        }
    }
    
    async function updateTagsList() {
        try {
            // Get only uniqueTags for tags list rendering
            const stats = await window.DataSourceAdapter.getStats();
            
            if (stats.uniqueTags) {
                uniqueTags = stats.uniqueTags;
                renderTagsList();
            }
        } catch (error) {
            console.error('Failed to update tags list:', error);
        }
    }
    
    function renderTagsList() {
        const listContent = document.getElementById('tagsListContent');
        if (!listContent) return;
        
        // Clear existing content
        listContent.innerHTML = '';
        
        if (uniqueTags.length === 0) {
            listContent.innerHTML = '<p class="no-tags-message">No tags found in the database.</p>';
            return;
        }
        
        // Sort tags alphabetically
        const sortedTags = [...uniqueTags].sort();
        
        // Group tags by type using centralized TagUtils
        const tagsByType = window.tagUtils.groupTagsByType(sortedTags);
        
        // Create grouped display
        Object.entries(tagsByType).forEach(([type, values]) => {
            const typeGroup = document.createElement('div');
            typeGroup.className = 'tag-type-group';
            
            const typeHeader = document.createElement('div');
            typeHeader.className = 'tag-type-header';
            typeHeader.textContent = type;
            typeGroup.appendChild(typeHeader);
            
            const tagsList = document.createElement('div');
            tagsList.className = 'tags-list';
            
            values.forEach(value => {
                const tagItem = document.createElement('span');
                tagItem.className = 'tag-item';
                tagItem.textContent = value;
                tagsList.appendChild(tagItem);
            });
            
            typeGroup.appendChild(tagsList);
            listContent.appendChild(typeGroup);
        });
    }
    
    return {
        init,
        updateTagsList
    };
})();