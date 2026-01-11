# GitHub Codespaces Setup

This project is configured to run in GitHub Codespaces to avoid local resource constraints.

## Quick Start

1. **Open in Codespaces:**
   - Go to your GitHub repository: `https://github.com/jrdxnra/pca-app`
   - Click the green "Code" button
   - Select "Codespaces" tab
   - Click "Create codespace on main"

2. **Wait for Setup:**
   - Codespaces will automatically:
     - Install Node.js 20
     - Run `npm install` to install dependencies
     - Set up the development environment

3. **Start the Dev Server:**
   ```bash
   npm run dev
   ```

4. **Access the App:**
   - Codespaces will automatically forward port 3000
   - Click the "Ports" tab in VS Code
   - Click the globe icon next to port 3000 to open in browser
   - Or use the forwarded URL shown in the terminal

## Port Forwarding

Port 3000 is automatically forwarded. You can:
- Access via the forwarded URL (shown in terminal)
- Use the "Ports" tab in VS Code to manage port forwarding
- Make the port public/private as needed

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

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

## Notes

- The devcontainer uses Node.js 20 (compatible with Next.js 16)
- All dependencies are installed automatically on first launch
- The workspace persists between sessions, so you don't need to reinstall each time
