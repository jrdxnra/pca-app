# Correct Render MCP Server Configuration for Cursor

## Your Render API Key
**rnd_dSBX5zUkoLhzx323VBpthQhs4hj8**

## Correct Configuration

Render uses a **hosted MCP server** (URL-based), not an npm package.

### Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer rnd_dSBX5zUkoLhzx323VBpthQhs4hj8"
      }
    }
  }
}
```

## Setup Steps

### 1. Create/Edit MCP Config File

The file should be at: `~/.cursor/mcp.json`

If it doesn't exist, create it with the JSON above.

If it already exists, add the `"render"` entry to the `mcpServers` object.

### 2. Restart Cursor

After saving the file, restart Cursor for the MCP server to connect.

### 3. Set Your Workspace

Once connected, I'll need to set the Render workspace. You can tell me:
- "Set my Render workspace to [workspace-name]"

Or I can list available workspaces first.

## What I'll Be Able to Do

Once configured:
- ✅ **Read logs instantly** - No need to share logs
- ✅ **Check deployment status** - See builds in real-time
- ✅ **List services** - See all your Render services
- ✅ **View service details** - Check configuration
- ✅ **Update environment variables** - Modify service config
- ✅ **Query databases** - Read-only SQL queries
- ✅ **View metrics** - Performance data

## Example Prompts I Can Use

- "Pull the most recent error-level logs for pca-app"
- "What's the deployment status of pca-app?"
- "List all services in my workspace"
- "Show me the build logs for the latest deployment"

## After Setup

1. **Save the config file** (`~/.cursor/mcp.json`)
2. **Restart Cursor**
3. **Set workspace** (I'll help with this)
4. **Test connection** - I'll try to list services or check logs

---

## Last Updated
January 18, 2026
