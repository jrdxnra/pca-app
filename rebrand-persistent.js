/**
 * IMPROVED REBRAND FITNESS SCRAPER
 * Better selector handling!
 */

// Initialize with localStorage
localStorage.rebrandData = localStorage.rebrandData || '{"categories":[],"movements":{}}';
window.rebrandData = JSON.parse(localStorage.rebrandData);

const save = () => {
  localStorage.rebrandData = JSON.stringify(window.rebrandData);
  console.log('💾 Saved to localStorage');
};

// Get all categories (run once)
if (window.rebrandData.categories.length === 0) {
  console.log('📋 Extracting categories...');
  const sidebar = document.querySelector('aside ul');
  if (sidebar) {
    sidebar.querySelectorAll('li').forEach((li) => {
      const name = li.querySelector('p')?.textContent.trim();
      const style = li.querySelector('input[type="color"]')?.getAttribute('style') || '';
      const rgb = style.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      const color = rgb ? `#${[1,2,3].map(i => parseInt(rgb[i]).toString(16).padStart(2, '0')).join('').toUpperCase()}` : '#FFFFFF';
      
      if (name && !window.rebrandData.categories.find(c => c.name === name)) {
        window.rebrandData.categories.push({ name, color });
        window.rebrandData.movements[name] = [];
      }
    });
    console.log('✅ Categories:', window.rebrandData.categories.length);
    save();
  }
} else {
  console.log('✅ Loaded', window.rebrandData.categories.length, 'categories from localStorage');
}

// Collect movements for current category
window.collectCurrent = () => {
  const cat = document.querySelector('main h3')?.textContent.trim();
  if (!cat) {
    console.log('⚠️ No category found in h3');
    return;
  }
  
  const items = document.querySelectorAll('main ul li');
  const moves = [];
  let moveIndex = 0;
  
  console.log(`🔍 Scanning ${items.length} list items for category: ${cat}`);
  
  items.forEach((li, i) => {
    // Try to find the movement name with multiple strategies
    let name = null;
    
    // Strategy 1: Look for p tags with different classes
    const pTags = li.querySelectorAll('p');
    for (const p of pTags) {
      const text = p.textContent.trim();
      // Skip the category header itself
      if (text && text !== cat && text !== 'Categories') {
        name = text;
        break;
      }
    }
    
    // Strategy 2: If no name found, skip (likely a non-movement item)
    if (!name) return;
    
    // Check if it's another category name (they appear in lists sometimes)
    const isCategory = window.rebrandData.categories.find(c => c.name === name);
    if (isCategory) {
      console.log(`⏭️ Skipping category header: ${name}`);
      return;
    }
    
    moves.push({ name, ordinal: moveIndex });
    moveIndex++;
  });
  
  if (moves.length > 0) {
    window.rebrandData.movements[cat] = moves;
    const total = Object.values(window.rebrandData.movements).reduce((s, m) => s + m.length, 0);
    console.log(`✅ ${cat}: ${moves.length} movements | Total: ${total}`);
    console.log('First 3 movements:', moves.slice(0, 3).map(m => m.name));
    save();
  } else {
    console.log(`⚠️ ${cat}: No movements found - double check the selectors`);
  }
};

// Export command
window.rebrandExport = () => {
  copy(JSON.stringify(window.rebrandData, null, 2));
  console.log('✅ Copied to clipboard!');
};

// Clear command
window.rebrandClear = () => {
  localStorage.removeItem('rebrandData');
  window.rebrandData = { categories: [], movements: {} };
  console.log('🗑️ Cleared');
};

console.log('✅ Setup complete!');
console.log('📝 To collect: Click a category, then type: collectCurrent()');
