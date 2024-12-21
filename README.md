# Dev Memory Server

An MCP server for managing development-related memories and context. This server provides tools for storing and retrieving development notes, code snippets, tasks, and other contextual information using semantic search.

## Features

- Store development memories with content, type, and tags
- Semantic search through stored memories using OpenAI embeddings
- Persistent storage using Pinecone vector database
- MCP protocol support for integration with development tools
- Automatic metadata handling and timestamping

## Prerequisites

- Node.js and npm installed
- Pinecone account and database set up
- OpenAI API key for generating embeddings

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd dev-memory-server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables by copying .env.example to .env and filling in your values:
```bash
cp .env.example .env
```

Required environment variables:
```
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment # e.g., us-west-2
PINECONE_INDEX_NAME=dev-memory-index
OPENAI_API_KEY=your_openai_api_key
```

## Usage

1. Build the server:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

## Connecting to Other Dev Tools

To connect this memory server to another development tool that supports MCP:

1. Build the server as described above
2. Add this configuration to your tool's MCP settings file:

```json
{
  "mcpServers": {
    "dev-memory": {
      "command": "node",
      "args": ["/absolute/path/to/dev-memory-server/build/index.js"],
      "env": {
        "PINECONE_API_KEY": "your_pinecone_api_key",
        "PINECONE_ENVIRONMENT": "us-west-2",
        "PINECONE_INDEX_NAME": "dev-memory-index",
        "OPENAI_API_KEY": "your_openai_api_key"
      }
    }
  }
}
```

## Available Tools

### add_memory
Add a new memory entry to the store.

Parameters:
- `content`: The content of the memory (required)
- `type`: Type of memory e.g., "code", "note", "task" (required)
- `tags`: Array of tags for categorization (optional)

Example:
```javascript
{
  "content": "Fixed memory leak in React components by properly cleaning up event listeners in useEffect",
  "type": "code",
  "tags": ["react", "performance", "bugfix"]
}
```

### search_memories
Search through stored memories using semantic search.

Parameters:
- `query`: Search query string (required)

Example:
```javascript
{
  "query": "React performance optimizations"
}
```

## Real-World Usage Examples

1. Store bug fixes and solutions:
```javascript
add_memory({
  "content": "Fixed memory leak in React components by properly cleaning up event listeners in useEffect. Important to return cleanup function that removes listeners on unmount.",
  "type": "code",
  "tags": ["react", "performance", "bugfix", "useEffect"]
})
```

2. Track upcoming features:
```javascript
add_memory({
  "content": "Need to implement real-time data synchronization between clients. Plan to use WebSocket for live updates and fall back to polling for older browsers.",
  "type": "task",
  "tags": ["websocket", "real-time", "feature"]
})
```

3. Search for relevant information:
```javascript
search_memories({
  "query": "React cleanup patterns"
})
```

## Development

To run in development mode with automatic recompilation:

```bash
npm run dev
```

To verify Pinecone connection:
```bash
node test-pinecone.js
```

## License

MIT
