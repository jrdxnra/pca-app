const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    console.log('Navigating to Schedule page...');
    await page.goto('http://localhost:3000/schedule', { waitUntil: 'networkidle0' });
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });

    console.log('Waiting for grid to load...');
    // Wait for a cell in the workout column (the one with the handler)
    // We target a specific empty cell. 
    // The workout column cells are the second child in the grid row div.
    // They have class "p-0 cursor-pointer transition-colors relative overflow-visible"
    // and are rendered inside the map loop.
    
    // Let's try to click a cell in the middle of the view (e.g. 9am)
    // We can use x/y coordinates or try to find a specific element.
    // The grid structure is roughly:
    // .grid-cols-8 > (time col) + 7 * (day col)
    // Inside day col: .space-y-0 > row div > (event col) + (workout col)
    
    // We'll click the 10th row (roughly 9-10am?)
    
    // Selector strategy: find all workout cells and click one that is empty
    const cells = await page.$$('div[class*="p-0 cursor-pointer"][style*="height: 24px"]');
    console.log('[TEST] Found ' + cells.length + ' potential cells');
    
    // Filter for workout cells (they are usually the second child, or we can check content)
    // The workout cell has text "-" if empty and is the second div in the flex row
    
    // Actually, let's just click one that has "-" text
    const emptyCells = await page.$x("//div[contains(text(), '-')]");
    console.log('[TEST] Found ' + emptyCells.length + ' empty workout cells');

    if (emptyCells.length > 0) {
      console.log('Clicking an empty cell...');
      await emptyCells[10].click(); // Click the 10th one (arbitrary mid-day)
      
      // Wait a bit for react state updates
      await new Promise(r => setTimeout(r, 1000));
      
      console.log('Checking for dialog...');
      // Check if QuickWorkoutBuilderDialog is open
      // It usually has "Create Workout" or similar text
      const dialog = await page.$x("//div[contains(@role, 'dialog')]");
      if (dialog.length > 0) {
        console.log('[SUCCESS] Dialog found!');
        // Get dialog content
        const content = await page.evaluate(el => el.textContent, dialog[0]);
        console.log('Dialog content preview:', content.substring(0, 100));
      } else {
        console.log('[FAILURE] Dialog NOT found after click');
      }
    } else {
        console.log('[FAILURE] No empty cells found with "-" text');
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
})();
