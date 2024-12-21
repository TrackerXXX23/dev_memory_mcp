#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { FileMemoryStore } from './store.js';
import { Memory } from './types.js';

export class DevMemoryServer {
  private server: Server;
  private store: FileMemoryStore;

  constructor() {
    this.store = new FileMemoryStore();
    this.server = new Server(
      {
        name: 'dev-memory-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'add_memory',
          description: 'Add a new memory entry',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content of the memory',
              },
              type: {
                type: 'string',
                description: 'Type of memory (e.g., "code", "note", "task")',
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Tags associated with the memory',
              },
            },
            required: ['content', 'type'],
          },
        },
        {
          name: 'search_memories',
          description: 'Search through stored memories',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'add_memory': {
          const { content, type, tags = [] } = request.params.arguments as {
            content: string;
            type: string;
            tags?: string[];
          };

          const memory: Memory = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            content,
            metadata: {
              type,
              tags,
            },
          };

          this.store.addMemory(memory);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, memory }, null, 2),
              },
            ],
          };
        }

        case 'search_memories': {
          const { query } = request.params.arguments as { query: string };
          const results = this.store.searchMemories(query);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ results }, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Dev Memory MCP server running on stdio');
  }
}

const server = new DevMemoryServer();
server.run().catch(console.error);
