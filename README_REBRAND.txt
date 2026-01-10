═══════════════════════════════════════════════════════════
        REBRAND FITNESS SCRAPER - FIXED VERSION
═══════════════════════════════════════════════════════════

📁 FILE: rebrand-persistent.js ⭐ THE ONLY ONE YOU NEED

⚠️ IMPORTANT: If you already ran the old version:
   1. First run: rebrandClear() in console
   2. Then start fresh with new version

HOW TO USE:
──────────
1. Login to https://app.rebrandfitness.com/movements
2. Open browser console (F12)
3. Run: rebrandClear() to start fresh
4. Open rebrand-persistent.js in your editor
5. Copy ALL of it
6. Paste into console, press Enter

FOR EACH CATEGORY:
──────────────────
1. Click a category in the sidebar
2. Type: collectCurrent()
3. Press Enter
4. Check console shows real movement names (not categories!)
5. Repeat for all categories

WHEN DONE:
──────────
Type: rebrandExport()

THEN:
─────
1. Go to your PCA app
2. Visit: /admin/import-rebrand
3. Paste the JSON
4. Click Import!

✅ Survives page refreshes (saves to localStorage)
✅ Auto-saves after each collection
✅ Shows progress counter
✅ Better at filtering out category names
