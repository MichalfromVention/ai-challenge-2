"""
ATC MCP Server - hello world scaffold.
Will become a full Air Traffic Control system for AI Challenge 2 Task 4.
"""
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("ATC")

@mcp.tool()
def ping() -> str:
    """Simple health check tool. Returns a hello message to confirm the server is running."""
    return "Hello from ATC server! 🛫 Ready for takeoff."

if __name__ == "__main__":
    mcp.run()