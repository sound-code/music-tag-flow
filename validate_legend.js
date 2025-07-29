// Simple validation script to check if legend functionality works
// Run this in browser console

console.log('🔍 Validating legend functionality...');

// Check if SimpleLegendService exists
if (typeof SimpleLegendService !== 'undefined') {
    console.log('✅ SimpleLegendService class is available');
    
    // Check if instance exists
    if (window.simpleLegendService) {
        console.log('✅ SimpleLegendService instance exists');
        console.log('📊 Service state:', {
            isInitialized: window.simpleLegendService.isInitialized
        });
    } else {
        console.log('❌ SimpleLegendService instance not found');
    }
} else {
    console.log('❌ SimpleLegendService class not available');
}

// Check TagUtils
if (typeof tagUtils !== 'undefined') {
    console.log('✅ TagUtils is available');
    
    // Test tag parsing
    const testTag = 'emotion:happy';
    const parsed = tagUtils.parseTag(testTag);
    console.log('🏷️ Test tag parsing:', testTag, '=>', parsed);
    
    const color = tagUtils.getTagColor(testTag);
    console.log('🎨 Test tag color:', testTag, '=>', color);
} else {
    console.log('❌ TagUtils not available');
}

// Check DataSourceAdapter
if (typeof DataSourceAdapter !== 'undefined') {
    console.log('✅ DataSourceAdapter is available');
    
    // Test tag category method
    if (typeof DataSourceAdapter.getTagsByCategory === 'function') {
        console.log('✅ getTagsByCategory method exists');
        
        // Try to get tags
        DataSourceAdapter.getTagsByCategory()
            .then(tags => {
                console.log('📊 Available tag categories:', Object.keys(tags));
                console.log('📊 Tag counts per category:', 
                    Object.entries(tags).map(([cat, tagList]) => `${cat}: ${tagList.length}`));
            })
            .catch(error => {
                console.error('❌ Error getting tags:', error);
            });
    } else {
        console.log('❌ getTagsByCategory method not found');
    }
} else {
    console.log('❌ DataSourceAdapter not available');
}

// Check legend DOM
const legendContainer = document.querySelector('.color-legend');
if (legendContainer) {
    console.log('✅ Legend container found');
    console.log('📄 Legend content preview:', legendContainer.innerHTML.substring(0, 200) + '...');
} else {
    console.log('❌ Legend container not found');
}

console.log('🔍 Validation complete');