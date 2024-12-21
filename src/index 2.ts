#!/usr/bin/env node
import { config } from 'dotenv';
import logger from './utils/logger.js';
import { PineconeStore } from './core/store.js';
import { DevContextManager } from './core/context.js';
import { Server, StdioServerTransport } from '@modelcontextprotocol/sdk/server';
import { InitializeRequestSchema, ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/shared/schemas';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/shared/errors';
import type { JSONRPCRequest } from '@modelcontextprotocol/sdk/shared/jsonrpc';
import { BaseMemory } from './core/types.js';
import { MemoryType } from './core/types.js';

interface StoreContextArguments {
  id?: string;
  content: string;
  context_type: MemoryType;
  metadata: {
    importance?: number;
    category?: string;
    topics?: string[];
    source?: string;
    project?: string;
  };
}

const isValidMemoryType = (type: string): type is MemoryType => {
  return ['development', 'conversation', 'document', 'system', 'custom'].includes(type);
};

// Load environment variables
config();

export class DevMemoryServer {
  private server: Server;
  private store: PineconeStore<BaseMemory> | null = null;
  private contextManager: DevContextManager | null = null;
  private initialized = false;

  constructor() {
    this.server = new Server(
      {
        name: 'dev-memory',
        version: '1.0.4',
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Pinecone store
      this.store = new PineconeStore<BaseMemory>({
        apiKey: process.env.PINECONE_API_KEY || '',
        environment: process.env.PINECONE_ENVIRONMENT || '',
        indexName: process.env.PINECONE_INDEX_NAME || '',
        namespace: 'development'
      }, {
        enabled: true,
        ttl: 3600,
        maxSize: 1000
      });
      await this.store.initialize();
      
      // Initialize context manager
      this.contextManager = new DevContextManager(this.store);
      this.initialized = true;
      
      logger.info('Server initialization complete');
    } catch (error) {
      logger.error('Server initialization failed:', error);
      this.initialized = false;
      throw error;
    }
  }

  private setupHandlers(): void {
    // Initialize handler
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      logger.debug('Handling initialize request');
      await this.initialize();
      return {
        protocolVersion: '1.0',
        serverInfo: {
          name: 'dev-memory',
          version: '1.0.4'
        },
        capabilities: {
          resources: {},
          tools: {}
        }
      };
    });

    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      logger.debug('Handling list_tools request');
      if (!this.initialized || !this.contextManager) {
        throw new Error('Server not initialized');
      }
      return {
        tools: [
          {
            name: 'store_context',
            description: 'Store development context in memory',
            inputSchema: {
              type: 'object',
              properties: {
                context_type: {
                  type: 'string',
                  description: 'Type of context (e.g. development, interaction)'
                },
                content: {
                  type: 'string',
                  description: 'Content to store'
                },
                metadata: {
                  type: 'object',
                  description: 'Additional metadata'
                }
              },
              required: ['context_type', 'content', 'metadata']
            }
          }
        ]
      };
    });

    // Store context handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.debug('Handling store_context request');
      if (!this.initialized || !this.store) {
        throw new Error('Server not initialized');
      }

      const rawArgs = request.params.arguments as Record<string, unknown>;
      if (!rawArgs?.content || typeof rawArgs.content !== 'string' ||
          !rawArgs?.context_type || typeof rawArgs.context_type !== 'string' ||
          !isValidMemoryType(rawArgs.context_type)) {
        throw new Error('Invalid arguments for store_context');
      }

      const args: StoreContextArguments = {
        id: typeof rawArgs.id === 'string' ? rawArgs.id : undefined,
        content: rawArgs.content,
        context_type: rawArgs.context_type,
        metadata: typeof rawArgs.metadata === 'object' ? rawArgs.metadata as StoreContextArguments['metadata'] : {}
      };

      try {
        const memory: BaseMemory = {
          id: args.id || `mem-${Date.now()}`,
          content: args.content,
          metadata: {
            type: args.context_type,
            timestamp: new Date().toISOString(),
            ...args.metadata
          }
        };
        await this.store.store(memory);
        return { success: true, id: memory.id };
      } catch (error) {
        logger.error('Failed to store context:', error);
        throw error;
      }
    });
  }

  public async handleRequest(request: JSONRPCRequest): Promise<any> {
    try {
      switch (request.method) {
        case 'initialize':
          // Initialize server if not already initialized
          if (!this.initialized) {
            await this.initialize();
          }
          return {
            protocolVersion: '1.0',
            serverInfo: {
              name: 'dev-memory',
              version: '1.0.4'
            },
            capabilities: {
              resources: {},
              tools: {}
            }
          };

        case 'list_tools':
          if (!this.initialized || !this.contextManager) {
            throw new McpError(ErrorCode.ServerNotInitialized, 'Server not initialized');
          }
          return {
            tools: [
              {
                name: 'store_context',
                description: 'Store development context in memory'
              },
              {
                name: 'get_context',
                description: 'Retrieve context based on query'
              },
              {
                name: 'optimize_memory',
                description: 'Optimize memory storage'
              }
            ]
          };

        case 'tools/call':
          if (!this.initialized || !this.store) {
            throw new McpError(ErrorCode.ServerNotInitialized, 'Server not initialized');
          }

          const { name, arguments: args } = request.params;
          
          switch (name) {
            case 'store_context':
              if (!args?.content || !args?.context_type || !isValidMemoryType(args.context_type)) {
                throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for store_context');
              }

              try {
                const memory: BaseMemory = {
                  id: args.id || `mem-${Date.now()}`,
                  content: args.content,
                  metadata: {
                    type: args.context_type,
                    timestamp: new Date().toISOString(),
                    ...args.metadata
                  }
                };

                await this.store.store(memory);
                return { success: true, id: memory.id };
              } catch (error) {
                throw new McpError(
                  ErrorCode.InternalError,
                  `Failed to store context: ${error instanceof Error ? error.message : String(error)}`
                );
              }

            case 'get_context':
              if (!args?.query) {
                throw new McpError(ErrorCode.InvalidParams, 'Query is required');
              }

              try {
                const results = await this.store.findSimilar(args.query, args.max_results || 5);
                return { matches: results };
              } catch (error) {
                throw new McpError(
                  ErrorCode.InternalError,
                  `Failed to get context: ${error instanceof Error ? error.message : String(error)}`
                );
              }

            case 'optimize_memory':
              return { success: true, strategy: args?.strategy || 'compress' };

            default:
              throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
          }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown method: ${request.method}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  public async start(): Promise<void> {
    logger.info('Starting Dev Memory server...');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Dev Memory MCP server running on stdio');
  }
}

// Start server
const server = new DevMemoryServer();
server.start().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
});
