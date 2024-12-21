# Dev Memory Server

A Model Context Protocol (MCP) server for persistent development memory across projects. This server implements the MCP protocol to provide context-aware memory storage and retrieval for development workflows.

## Overview
MCP server for persistent development memory across projects. Automatically captures and organizes development context, code changes, and user interactions.

## Known Issues

### SDK Import Issues

Currently experiencing issues with importing the Model Context Protocol SDK. The main problems are:

1. **Import Path Resolution**: 
   - Original imports were using specific file paths:
     ```typescript
     import { Server } from '@modelcontextprotocol/sdk/dist/server/server.js';
     ```
   - Changed to use the package's main entry point:
     ```typescript
     import { Server } from '@modelcontextprotocol/sdk';
     ```

2. **Test Environment Setup**:
   - Tests need proper mocking of both OpenAI and Pinecone dependencies
   - Environment variables must be set before server initialization
   - Server initialization should happen through the public API (initialize request) rather than calling private methods

3. **Current Status**:
   - Working on fixing test suite to properly mock dependencies
   - Ensuring proper initialization flow in tests
   - Addressing import path issues

## Current Status
✅ **IN PROGRESS**: Working on resolving SDK import issues and test environment setup.

See [Development Notes](docs/dev-memory/Sprint-1/notes/DEVELOPMENT_NOTES.md) for implementation details.

## Quick Links
- [Development Notes](docs/dev-memory/Sprint-1/notes/DEVELOPMENT_NOTES.md) - Implementation details and progress
- [Design Document](docs/dev-memory/DESIGN.md) - System architecture
- [Implementation Guide](docs/dev-memory/Sprint-1/notes/IMPLEMENTATION_GUIDE.md) - Usage and integration

## Version
Current version: 1.0.4 (aligned with @modelcontextprotocol/sdk)

## Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Pinecone credentials

# Build the project
npm run build

# Start the server
npm start
```

## Environment Configuration
Create a `.env` file based on `.env.example`:
```env
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=dev-memory-index

# OpenAI Configuration (Required for embeddings)
OPENAI_API_KEY=your_openai_api_key_here
```

The server requires both Pinecone (for vector storage) and OpenAI (for generating embeddings) credentials to function properly.

## Project Structure
```
.
├── src/
│   ├── core/           # Core functionality
│   │   ├── store.ts    # Storage implementation
│   │   ├── context.ts  # Context management
│   │   └── types.ts    # Type definitions
│   ├── sdk/            # MCP SDK integration
│   └── index.ts        # Main server
├── docs/              # Documentation
└── scripts/           # Utility scripts
```

## Development Timeline
- ✅ Phase 1: Core Vector Store (December 2023)
  - Pinecone integration
  - Content sanitization
  - Error handling
  - Test coverage
- 🔄 Phase 2: Advanced Features (January 2024)
  - Performance benchmarking
  - Monitoring and logging
  - Migration tools
- 📅 Phase 3: Integration (February 2024)
  - Enhanced Git hooks
  - Project analytics
  - Pattern recognition

## Cline System Instructions

### Basic Setup
```bash
# Install dev-memory server
npm install dev-memory-server

# Start the server
npx dev-memory-server
```

### Cline Configuration
1. Add to your `.cline` configuration:
```json
{
  "customInstructions": {
    "devMemory": {
      "enabled": true,
      "serverName": "dev-memory",
      "contextTypes": ["development", "conversation"],
      "autoSync": true
    }
  }
}
```

2. Create `.cline/rules.ts`:
```typescript
export const rules = {
  // Load context before tasks
  beforeTask: async (task, cline) => {
    const context = await devMemory.tools.get_context({
      query: task.description,
      context_type: 'development'
    });
    
    cline.addContext('devMemory', {
      patterns: context.patterns,
      examples: context.examples,
      bestPractices: context.bestPractices
    });
  },

  // Record patterns after tasks
  afterTask: async (task, cline) => {
    await devMemory.tools.store_context({
      context_type: 'development',
      content: task.implementation,
      metadata: {
        patterns: cline.getImplementationPatterns(),
        success: task.success,
        improvements: task.improvements
      }
    });
  }
};
```

### System Capabilities
The dev-memory server provides Cline with:
- Development pattern recognition
- Code implementation history
- Project-specific guidelines
- Cross-project knowledge sharing
- Best practice recommendations

### Integration Features
1. **Automatic Context Loading**
   - Loads relevant context for each task
   - Includes similar implementations
   - Provides project conventions

2. **Pattern Learning**
   - Records successful implementations
   - Learns from code improvements
   - Builds development history

3. **Smart Assistance**
   - Suggests relevant code examples
   - Warns about potential issues
   - Recommends best practices

### Usage with Cline
Cline will automatically:
1. Load relevant context when starting tasks
2. Learn from your development patterns
3. Provide contextual assistance
4. Share knowledge across projects

### Example Interactions
```typescript
// Cline will understand your patterns
await cline.suggestImplementation('Add authentication');
// Returns relevant auth implementations from your projects

// Get project-specific guidelines
await cline.getProjectGuidelines();
// Returns guidelines based on project history

// Check implementation against patterns
await cline.validateCode(implementation);
// Validates against learned patterns
```

## MCP Server Capabilities

The dev-memory server exposes the following MCP tools:

1. **store_context**
   - Store development context with metadata
   - Automatically generates vector embeddings
   - Supports special characters and rich content

2. **get_context**
   - Find similar development patterns
   - Filter by metadata (project, category, etc.)
   - Returns relevant code examples and best practices

3. **find_similar**
   - Search for similar content across projects
   - Configurable similarity threshold
   - Supports metadata filtering

## Dependencies
- @modelcontextprotocol/sdk: ^1.0.4
- @pinecone-database/pinecone: ^4.0.0
- dotenv: ^16.4.7
- node-cache: ^5.1.2
- openai: ^4.24.1
- winston: ^3.11.0
- zod: ^3.22.4

## Development

Build:
```bash
npm run build
```

Test:
```bash
npm test
```

## Contact
- Status: Active - Core functionality complete
- Next Phase: Advanced features and monitoring
- Location: /Users/chetpaslawski/Documents/VS Code Projects/dev-memory-server

## Version Information
- Server Version: 1.0.4
- MCP Protocol Version: 1.0.4
- SDK: @modelcontextprotocol/sdk ^1.0.4

## Features
- Full MCP protocol compliance with version 1.0.4
- Semantic search using Pinecone vector store
- Context-aware memory storage and retrieval
- Development-focused memory organization
- Type-safe request/response handling
- Streaming support for large context operations

## Quick Start

### Installation
```bash
npm install
```

### Environment Setup
Create a `.env` file with:
```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=us-west-2
PINECONE_INDEX=your_pinecone_index
OPENAI_API_KEY=your_openai_api_key
```

### Start Server
```bash
npm start
```

### Connect with VS Code
```bash
code -r --command "cline.connectToMcpServer" "stdio:npm start"
```

## Server Capabilities

### Memory Types
- `development`: Code and development context
- `conversation`: Discussion and communication logs
- `document`: Documentation and references
- `system`: System configuration and settings
- `custom`: User-defined context types

### Operations
1. **Store Context**
   ```typescript
   {
     id?: string;
     content: string;
     context_type: MemoryType;
     metadata: {
       importance?: number;
       category?: string;
       topics?: string[];
       source?: string;
       project?: string;
     }
   }
   ```

2. **Query Context**
   - Semantic search using OpenAI embeddings
   - Metadata filtering
   - Relevance scoring
   - Configurable result limits

3. **Memory Optimization**
   - Automatic deduplication
   - Importance-based retention
   - Context compression
   - TTL support

## Architecture

### Components
1. **MCP Server**
   - Protocol version: 1.0.4
   - Typed request/response handling
   - Capability negotiation
   - Transport: stdio

2. **Memory Store**
   - Pinecone vector database
   - Dimension: 1536
   - Namespace support
   - Cache layer with TTL

3. **Context Manager**
   - OpenAI embeddings
   - Context type validation
   - Metadata management
   - Search optimization

## Status
- Version: 1.0.4 (Stable)
- Protocol: Fully compliant with MCP 1.0.4
- Status: Production-ready
- Active Development: Yes

## License
MIT License - See LICENSE file for details
