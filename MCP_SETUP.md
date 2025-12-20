# MCP Visualization Server Setup

Your chat interface now supports MCP (Model Context Protocol) servers! The visualization server you extracted is ready to use.

## Quick Start

### 1. Ensure the MCP Server is Built

```bash
cd mcp_app
npm run build
```

### 2. Add the Visualization Server to Your Settings

In your chat interface, go to Settings and add this MCP server configuration:

**Server Configuration:**
- **Name**: Visualization Server
- **ID**: `visualization`  
- **Enabled**: ✓ (checked)
- **Transport**: `stdio`
- **Command**: `node`
- **Args**: `["/home/dupuy/codex/chat_interface/opus/mcp_app/dist/index.js"]`

> **Note**: Make sure to use the absolute path to the index.js file!

### 3. Available Tools

Once connected, you'll have access to these visualization tools:

#### 📊 `generate_random_data`
Generates random data for bar chart visualization.
- **Parameters**: 
  - `count` (optional): Number of data points (1-20, default: 5)

#### 📈 `get_sales_data` 
Retrieves quarterly sales data for visualization.
- **Parameters**:
  - `year` (optional): Year for sales data (2020-2024, default: 2024)

#### 🥧 `get_market_share`
Gets market share distribution for pie chart visualization.
- **Parameters**:
  - `industry` (optional): Industry sector (default: "tech")

## Usage Examples

In your chat, try asking:

```
"Show me some random data in a bar chart"
```

```
"Visualize quarterly sales data for 2024"
```

```
"Show me the market share for the tech industry"
```

## How It Works

1. **The AI detects** that your query needs data visualization
2. **It calls the appropriate MCP tool** (e.g., `generate_random_data`)
3. **The MCP server returns JSON data** with chart information
4. **The chat interface displays** the structured data

## UI Resources (MCP-APPS)

This server also implements the MCP-APPS pattern, which means it can provide interactive HTML UIs for visualizations. Your chat interface can be enhanced to render these UI resources directly.

The server provides two UI resources:
- `ui://charts/bar-chart` - Interactive bar chart
- `ui://charts/pie-chart` - Interactive pie chart

## Troubleshooting

### Server not connecting?

1. Check that the path to `dist/index.js` is correct and absolute
2. Verify the server builds successfully: `cd mcp_app && npm run build`
3. Check the browser console for error messages
4. Try restarting the chat interface

### Tools not showing up?

1. Make sure the server is marked as "Enabled" in settings
2. Check that the MCP feature is enabled in your settings
3. Refresh the page to force a reconnection

## Technical Details

The MCP integration uses:
- **Client**: `@modelcontextprotocol/sdk` for communicating with MCP servers
- **Transport**: `stdio` - runs the MCP server as a child process
- **Tool Execution**: Server-side API routes handle tool calls
- **Streaming**: Results are returned via JSON-RPC

## Adding More MCP Servers

You can add any MCP-compatible server using the same pattern:

1. **stdio transport** - For local Node.js/Python servers
2. **SSE transport** - For HTTP SSE endpoints  
3. **streamable-http transport** - For HTTP streaming endpoints

Just configure the appropriate transport type and connection details in your settings!
