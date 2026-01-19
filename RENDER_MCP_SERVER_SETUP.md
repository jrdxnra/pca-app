# Render MCP Server Setup

## Official Render MCP Server

Render has an official MCP server! This allows me to directly access Render resources.

## Setup Steps

### 1. Get Render API Key

1. Go to: https://dashboard.render.com
2. Click your profile icon (top right)
3. Go to **"Account Settings"** or **"API Keys"**
4. Click **"Create API Key"**
5. **Name it**: "Cursor MCP" or similar
6. **Copy the API key** (keep it secret!)

### 2. Configure in Cursor

MCP servers are configured in Cursor settings:

1. **Cursor** → **Settings** (or `Cmd/Ctrl + ,`)
2. Look for **"MCP"** or **"Model Context Protocol"** section
3. **Add MCP Server**:
   - **Name**: `render`
   - **Server URL/Type**: Check Render docs for exact configuration
   - **API Key**: Paste your Render API key
   - **Service ID** (optional): `srv-d5mmn8h4tr6s73cp18lg`

### 3. What I'll Be Able to Do

Once configured, I can:
- ✅ **Read logs instantly** - No need for you to share logs
- ✅ **Check deployment status** - See builds in real-time
- ✅ **View service details** - Check configuration, environment variables
- ✅ **Better debugging** - See errors immediately
- ✅ **Faster troubleshooting** - No back-and-forth needed

## Configuration Format

Based on Render's MCP server, the configuration might look like:

```json
{
  "mcpServers": {
    "render": {
      "command": "npx",
      "args": ["-y", "@renderinc/mcp-server"],
      "env": {
        "RENDER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Or it might be configured via Cursor's UI settings.

## After Setup

Once configured:
1. **I can access Render resources** directly
2. **No need to share logs** - I can read them
3. **Faster debugging** - See issues immediately
4. **Better workflow** - Instant feedback loop

## Next Steps

1. **Get Render API key** (from Render dashboard)
2. **Configure in Cursor** (Settings → MCP)
3. **Test access** - I'll try to read logs/resources
4. **Verify it works** - Check if I can see deployment status

---

## Last Updated
January 18, 2026
