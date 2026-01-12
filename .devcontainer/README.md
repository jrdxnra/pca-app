# GitHub Codespaces Setup

This project is configured to run in GitHub Codespaces to avoid local resource constraints. **SSH is enabled so you can control the Codespace from Cursor's terminal.**

## Quick Start

1. **Create/Open Codespace:**
   - Go to your GitHub repository: `https://github.com/jrdxnra/pca-app`
   - Click the green "Code" button → "Codespaces" tab
   - Click "Create codespace on main" (or use existing)

2. **Wait for Setup:**
   - Codespaces will automatically:
     - Install Node.js 20
     - Run `npm install` to install dependencies
     - Set up the development environment
     - Enable SSH access

3. **Control from Cursor Terminal (Recommended):**

   **Authentication:** GitHub CLI uses your local `gh auth login` (already set up). Git and app credentials are automatically configured in Codespaces.
   
   Get your Codespace SSH command:
   ```bash
   gh codespace ssh -c upgraded-barnacle-69969jj6wrvfxqqg
   ```
   
   Or use the interactive SSH:
   ```bash
   gh codespace ssh
   # Select your codespace from the list
   ```
   
   Once connected via SSH, you can:
   ```bash
   cd /workspaces/pca-app
   npm run dev  # Start dev server
   # OR use the helper scripts:
   .devcontainer/start-dev-server.sh   # Start in background
   .devcontainer/stop-dev-server.sh    # Stop server
   
   # Git operations work automatically (no credential setup needed)
   git status
   git commit -am "message"
   git push
   ```

4. **Access the App:**
   - The dev server runs on GitHub's servers (not your laptop)
   - Port 3000 is automatically forwarded
   - Get your URL from the Codespaces browser interface (Ports tab)
   - **Right-click port 3000 → Set to "Public"** to access
   - URL format: `https://xxxxx-3000.preview.app.github.dev`

## Port Forwarding

Port 3000 is automatically forwarded when the dev server starts. **Important:** 
- Right-click port 3000 in the "Ports" tab → Set visibility to **"Public"** (defaults to private)
- Find the forwarded URL in the "Ports" tab (format: `https://xxxxx-3000.preview.app.github.dev`)
- Copy and open the URL in any browser to view your app
- The dev server runs on GitHub's servers (not your local machine), reducing CPU usage

## Environment Variables

✅ **Automatically configured!** The `.env.local` file is created automatically when the codespace is set up.

⚠️ **Important:** After starting the dev server (`npm run dev`), you'll need to:
1. Check the "Ports" tab for your Codespaces forwarded URL (e.g., `https://xxxxx-3000.preview.app.github.dev`)
2. Update `GOOGLE_REDIRECT_URI` in `.env.local` to use your Codespaces URL:
   ```
   GOOGLE_REDIRECT_URI=https://xxxxx-3000.preview.app.github.dev/api/auth/google/callback
   ```
3. Add the same URL to [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > Credentials > Your OAuth Client > Authorized redirect URIs
4. Restart the dev server after updating

## Controlling the Dev Server from Cursor

**From Cursor's terminal, connect via SSH:**

1. Connect to your Codespace:
   ```bash
   gh codespace ssh -c upgraded-barnacle-69969jj6wrvfxqqg
   ```

2. Navigate and control the server:
   ```bash
   cd /workspaces/pca-app
   
   # Start server (background):
   .devcontainer/start-dev-server.sh
   
   # Stop server:
   .devcontainer/stop-dev-server.sh
   
   # Check if running:
   pgrep -f "next dev"
   
   # View logs:
   tail -f /tmp/nextjs-dev.log
   ```

3. Or start manually (foreground - use Ctrl+C to stop):
   ```bash
   npm run dev
   ```

**Note:** The server runs on GitHub's servers, not your laptop. You control it via SSH from Cursor.

## Notes

- The devcontainer uses Node.js 20 (compatible with Next.js 16)
- All dependencies are installed automatically on first launch
- The workspace persists between sessions, so you don't need to reinstall each time

## Current Codespaces URL

**Development URL:** https://stunning-rotary-phone-44vr6x459g9hjqww-3000.app.github.dev/

*Note: This URL is specific to the current Codespace instance. If you create a new Codespace, you'll get a different URL.*
