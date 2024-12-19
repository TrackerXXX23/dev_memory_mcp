#!/usr/bin/env node
import { Server } from './sdk/server.js';
import { StdioTransport } from './sdk/server.js';
import { Errors } from './sdk/errors.js';
import { randomUUID } from 'crypto';
import path from 'path';
import { FileStore } from './core/store.js';
import { DevContextManager } from './core/context.js';
import { BaseMemory, DevContext } from './core/types.js';

class DevMemoryServer {
  private server: Server;
  private store: FileStore<BaseMemory>;
  private contextManager: DevContextManager;

  constructor() {
    this.server = new Server({
      name: 'dev-memory',
      version: '0.1.0',
      capabilities: {
        tools: true,
        resources: true
      }
    });

    // Use absolute path for storage
    const storageDir = path.resolve(process.cwd(), '.dev-memory');
    console.error('Storage directory:', storageDir);
    this.store = new FileStore<BaseMemory>(storageDir);
    this.contextManager = new DevContextManager(this.store, {
      maxContextSize: 100,
      priorityThreshold: 0.7
    });
    
    this.setupHandlers();
  }

  private setupHandlers() {
    // Store context
    this.server.setRequestHandler('tool:store_context', async (request) => {
      const { context_type, content, metadata } = request.params.arguments;

      if (!context_type || !content || !metadata) {
        throw Errors.InvalidParams('Missing required parameters: context_type, content, metadata');
      }

      const memory: BaseMemory = {
        id: randomUUID(),
        content,
        metadata: {
          timestamp: new Date().toISOString(),
          type: context_type,
          ...metadata
        }
      };

      try {
        await this.store.store(memory);

        // Update development context if it's a development type
        if (context_type === 'development') {
          await this.contextManager.updateCodeContext([]);
        }

        return {
          content: [{
            type: 'text',
            text: `Context stored successfully with ID: ${memory.id}`
          }]
        };
      } catch (error) {
        throw Errors.InternalError(`Failed to store context: ${error}`);
      }
    });

    // Get context
    this.server.setRequestHandler('tool:get_context', async (request) => {
      const { query, context_type, max_results = 5 } = request.params.arguments;

      if (!query) {
        throw Errors.InvalidParams('Missing required parameter: query');
      }

      try {
        const results = await this.store.findSimilar(query, max_results);
        const filteredResults = context_type 
          ? results.filter(r => r.metadata.type === context_type)
          : results;

        // Return a simple string response
        const matchCount = filteredResults.length;
        if (matchCount === 0) {
          return {
            content: [{
              type: 'text',
              text: 'No matching contexts found.'
            }]
          };
        }

        // Create a simple text summary
        const summaryText = filteredResults
          .map(r => `Match: ${r.content.substring(0, 50).replace(/[^\x20-\x7E]/g, '')}`)
          .join('. ');

        return {
          content: [{
            type: 'text',
            text: `Found ${matchCount} match${matchCount > 1 ? 'es' : ''}. ${summaryText}`
          }]
        };
      } catch (error) {
        throw Errors.InternalError(`Failed to get context: ${error}`);
      }
    });

    // Optimize memory
    this.server.setRequestHandler('tool:optimize_memory', async (request) => {
      const { strategy } = request.params.arguments;

      if (!strategy) {
        throw Errors.InvalidParams('Missing required parameter: strategy');
      }

      try {
        const contexts = await this.contextManager.listContexts();
        let optimizedCount = 0;

        for (const contextId of contexts) {
          const context = await this.contextManager.loadContext(contextId);
          if (!context) continue;

          switch (strategy) {
            case 'compress':
              // Remove duplicate memories
              const uniqueMemories = new Set(context.activeMemories);
              context.activeMemories = Array.from(uniqueMemories);
              optimizedCount += context.activeMemories.length;
              break;
            case 'prune':
              // Remove old memories (keep last 50)
              context.activeMemories = context.activeMemories.slice(0, 50);
              optimizedCount += context.activeMemories.length;
              break;
            case 'merge':
              // TODO: Implement memory merging
              break;
            default:
              throw Errors.InvalidParams(`Invalid strategy: ${strategy}`);
          }

          await this.contextManager.saveContext(context);
        }

        return {
          content: [{
            type: 'text',
            text: `Memory optimization with strategy '${strategy}' completed. Processed ${optimizedCount} memories.`
          }]
        };
      } catch (error) {
        throw Errors.InternalError(`Failed to optimize memories: ${error}`);
      }
    });
  }

  async start() {
    const transport = new StdioTransport();
    await this.server.connect(transport);
    console.error('Dev Memory MCP server running on stdio');
  }
}

// Start server
const server = new DevMemoryServer();
server.start().catch(console.error);
