# Cursor MCP Server Configuration for Render

## Your Render API Key
**rnd_dSBX5zUkoLhzx323VBpthQhs4hj8**

⚠️ **Keep this secret!** Don't commit it to the repo.

## How to Configure in Cursor

MCP servers are configured in **Cursor's application settings**, not in the codebase.

### Step 1: Open Cursor Settings

1. **Cursor** → **Settings** (or `Cmd/Ctrl + ,`)
2. Look for **"MCP"** or **"Model Context Protocol"** section
3. Or search for "MCP" in settings

### Step 2: Add Render MCP Server

The configuration format should be something like:

```json
{
  "mcpServers": {
    "render": {
      "command": "npx",
      "args": ["-y", "@renderinc/mcp-server"],
      "env": {
        "RENDER_API_KEY": "rnd_dSBX5zUkoLhzx323VBpthQhs4hj8"
      }
    }
  }
}
```

Or in Cursor's UI:
- **Server Name**: `render`
- **Command**: `npx -y @renderinc/mcp-server`
- **Environment Variable**: `RENDER_API_KEY` = `rnd_dSBX5zUkoLhzx323VBpthQhs4hj8`

### Step 3: Restart Cursor

After adding the MCP server, restart Cursor for it to take effect.

## Alternative: Use Render CLI

If MCP setup is complex, we can use Render CLI instead:

```bash
# Set API key as environment variable
export RENDER_API_KEY="rnd_dSBX5zUkoLhzx323VBpthQhs4hj8"

# Then I can use render CLI commands
render logs --service srv-d5mmn8h4tr6s73cp18lg
```

## What I'll Be Able to Do After Setup

Once MCP is configured:
- ✅ **Read logs instantly** - No need for you to share logs
- ✅ **Check deployment status** - See builds in real-time  
- ✅ **View service details** - Check configuration
- ✅ **Better debugging** - See errors immediately

## Testing

After you configure it in Cursor settings:
1. Restart Cursor
2. I'll try to access Render resources
3. We can test by checking logs or deployment status

---

## Security Note

⚠️ **API Key is sensitive** - Don't commit this file or share the key publicly.

---

## Last Updated
January 18, 2026
