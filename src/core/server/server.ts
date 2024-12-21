/**
 * MCP Server implementation for memory management
 */

import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Request as McpRequest,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { ContextManager } from '../context';
import { MemoryStore } from '../store';
import { VectorStore } from '../store';

export interface StandardResponse {
  success: boolean;
  data?: any;
  error?: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
}

export interface ToolResponse {
  _meta: Record<string, any>;
  content: Array<{
    type: string;
    text: string;
  }>;
}

export interface ToolRequest {
  method: string;
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

interface ToolCallParams {
  name: string;
  arguments: Record<string, any>;
}

const toolSchemas = {
  add_memory: {
    type: 'object' as const,
    properties: {
      content: {
        type: 'string',
        description: 'Content of the memory',
        minLength: 1
      },
      type: {
        type: 'string',
        description: 'Type of memory',
        enum: ['note', 'code', 'task', 'reference']
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1
        },
        description: 'Tags associated with the memory'
      },
      relationships: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            targetId: { type: 'string', minLength: 1 },
            type: { type: 'string', minLength: 1 },
            strength: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['targetId', 'type', 'strength']
        },
        description: 'Relationships to other memories'
      }
    },
    required: ['content', 'type']
  },
  search_memories: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
        minLength: 1
      },
      filter: {
        type: 'object',
        description: 'Filter criteria'
      },
      timeRange: {
        type: 'object',
        properties: {
          start: {
            type: 'number',
            description: 'Start timestamp',
            minimum: 0
          },
          end: {
            type: 'number',
            description: 'End timestamp',
            minimum: 0
          }
        },
        required: ['start', 'end'],
        description: 'Time range for filtering'
      },
      includeRelated: {
        type: 'boolean',
        description: 'Whether to include related memories'
      }
    },
    required: ['query']
  }
};

export class Server {
  // Expose server instance for testing
  public readonly server: McpServer;
  private contextManager: ContextManager;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
    this.server = new McpServer(
      {
        name: 'dev-memory-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {
            add_memory: {
              description: 'Add a new memory entry',
              inputSchema: toolSchemas.add_memory
            },
            search_memories: {
              description: 'Search through stored memories',
              inputSchema: toolSchemas.search_memories
            }
          }
        }
      }
    );

    this.setupRequestHandlers();
  }

  private setupRequestHandlers() {
    // Handle tool listing requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      _meta: {},
      tools: [
        {
          name: 'add_memory',
          description: 'Add a new memory entry',
          inputSchema: toolSchemas.add_memory
        },
        {
          name: 'search_memories',
          description: 'Search through stored memories',
          inputSchema: toolSchemas.search_memories
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        await this.validateToolRequest(request);
        const params: ToolCallParams = {
          name: request.params.name,
          arguments: request.params.arguments || {}
        };

        return this.handleToolCall(params);
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  private async validateToolRequest(request: McpRequest): Promise<void> {
    if (!request.params?.name) {
      throw new McpError(ErrorCode.InvalidParams, 'Missing tool name');
    }

    if (!request.params?.arguments) {
      throw new McpError(ErrorCode.InvalidParams, 'Missing tool arguments');
    }

    const schema = toolSchemas[request.params.name as keyof typeof toolSchemas];
    if (!schema) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }

    // Validate against schema
    await this.validateAgainstSchema(request.params.arguments, schema);
  }

  private async validateAgainstSchema(data: any, schema: any): Promise<void> {
    // Basic type validation
    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null) {
        throw new McpError(ErrorCode.InvalidParams, 'Expected object type');
      }

      // Required fields
      for (const required of schema.required || []) {
        if (!(required in data)) {
          throw new McpError(ErrorCode.InvalidParams, `Missing required field: ${required}`);
        }
      }

      // Property validation
      for (const [key, value] of Object.entries(data)) {
        const propSchema = schema.properties[key];
        if (propSchema) {
          await this.validateAgainstSchema(value, propSchema);
        }
      }
    }

    // Array validation
    if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        throw new McpError(ErrorCode.InvalidParams, 'Expected array type');
      }

      for (const item of data) {
        await this.validateAgainstSchema(item, schema.items);
      }
    }

    // String validation
    if (schema.type === 'string') {
      if (typeof data !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'Expected string type');
      }

      if (schema.minLength && data.length < schema.minLength) {
        throw new McpError(ErrorCode.InvalidParams, `String too short (min: ${schema.minLength})`);
      }

      if (schema.enum && !schema.enum.includes(data)) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid value. Expected one of: ${schema.enum.join(', ')}`);
      }
    }

    // Number validation
    if (schema.type === 'number') {
      if (typeof data !== 'number') {
        throw new McpError(ErrorCode.InvalidParams, 'Expected number type');
      }

      if (schema.minimum !== undefined && data < schema.minimum) {
        throw new McpError(ErrorCode.InvalidParams, `Number too small (min: ${schema.minimum})`);
      }

      if (schema.maximum !== undefined && data > schema.maximum) {
        throw new McpError(ErrorCode.InvalidParams, `Number too large (max: ${schema.maximum})`);
      }
    }
  }

  private createStandardResponse(data?: any, error?: { code: ErrorCode; message: string; details?: any }): StandardResponse {
    return {
      success: !error,
      ...(data && { data }),
      ...(error && { error })
    };
  }

  private handleError(error: unknown): ToolResponse {
    let standardError: StandardResponse;

    if (error instanceof McpError) {
      standardError = this.createStandardResponse(undefined, {
        code: error.code,
        message: error.message
      });
    } else {
      standardError = this.createStandardResponse(undefined, {
        code: ErrorCode.InternalError,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }

    return {
      _meta: {},
      content: [{ type: 'text', text: JSON.stringify(standardError) }]
    };
  }

  // Helper method for testing
  async processToolRequest(request: ToolRequest): Promise<ToolResponse> {
    try {
      await this.validateToolRequest(request as McpRequest);
      const params: ToolCallParams = {
        name: request.params.name,
        arguments: request.params.arguments
      };

      return this.handleToolCall(params);
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async handleToolCall(params: ToolCallParams): Promise<ToolResponse> {
    try {
      let response: StandardResponse;

      switch (params.name) {
        case 'add_memory': {
          const { content, type, tags = [], relationships = [] } = params.arguments;

          // Generate unique ID and timestamp
          const id = crypto.randomUUID();
          const timestamp = Date.now();

          // Add context with proper metadata
          const result = await this.contextManager.addContext({
            id,
            content,
            metadata: {
              type,
              tags,
              relationships,
              timestamp,
              attributes: {
                created: timestamp,
                updated: timestamp
              }
            }
          });

          if (!result.success) {
            throw new McpError(
              ErrorCode.InternalError,
              result.error || 'Failed to add memory'
            );
          }

          response = this.createStandardResponse({
            id,
            content,
            metadata: {
              type,
              tags,
              relationships,
              timestamp,
              attributes: {
                created: timestamp,
                updated: timestamp
              }
            }
          });
          break;
        }

        case 'search_memories': {
          const { query, filter, timeRange, includeRelated = true } = params.arguments;

          const result = await this.contextManager.retrieveContext(query, {
            filter,
            timeRange,
            includeRelated,
            includeMetadata: true
          });

          if (!result.success) {
            throw new McpError(
              ErrorCode.InternalError,
              result.error || 'Failed to search memories'
            );
          }

          response = this.createStandardResponse({
            memories: result.contexts?.map(c => ({
              id: c.entry.id,
              content: c.entry.content,
              metadata: {
                ...c.entry.metadata,
                score: c.score
              }
            })) || []
          });
          break;
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${params.name}`
          );
      }

      return {
        _meta: {},
        content: [{ type: 'text', text: JSON.stringify(response) }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async connect(transport: any) {
    await this.server.connect(transport);
  }

  async close() {
    await this.server.close();
  }
}
