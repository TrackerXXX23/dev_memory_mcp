# Dev Memory Server

An MCP server for managing development-related memories and context. This server provides tools for storing and retrieving development notes, code snippets, tasks, and other contextual information.

## Features

- Store development memories with content, type, and tags
- Search through stored memories
- In-memory storage (file-based persistence coming soon)

## Installation

```bash
npm install
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

## Available Tools

### add_memory
Add a new memory entry to the store.

Parameters:
- `content`: The content of the memory (required)
- `type`: Type of memory e.g., "code", "note", "task" (required)
- `tags`: Array of tags for categorization (optional)

### search_memories
Search through stored memories.

Parameters:
- `query`: Search query string (required)

## Development

To run in development mode with automatic recompilation:

```bash
npm run dev
```

## License

MIT
