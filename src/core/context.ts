import { BaseContext, BaseMemory, DevContext } from './types.js';
import { Store } from './store.js';
import path from 'path';
import fs from 'fs';

export interface ContextManagerConfig {
  maxContextSize?: number;
  priorityThreshold?: number;
}

export class ContextManager<T extends BaseContext, M extends BaseMemory> {
  private baseDir: string;
  private initialized: boolean = false;

  constructor(
    private store: Store<M>,
    private config: ContextManagerConfig = {}
  ) {
    this.baseDir = path.join(process.cwd(), '.dev-memory');
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const contextDir = path.join(this.baseDir, 'context');
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }

    this.initialized = true;
  }

  async loadContext(id: string): Promise<T | null> {
    await this.initialize();

    const contextPath = path.join(this.baseDir, 'context', `${id}.json`);
    
    if (!fs.existsSync(contextPath)) {
      return null;
    }

    const content = await fs.promises.readFile(contextPath, 'utf-8');
    return JSON.parse(content);
  }

  async saveContext(context: T): Promise<void> {
    await this.initialize();

    const contextPath = path.join(this.baseDir, 'context', `${context.id}.json`);
    await fs.promises.writeFile(
      contextPath,
      JSON.stringify(context, null, 2),
      'utf-8'
    );
  }

  async updateContext(context: T, memory: M): Promise<T> {
    // Store the memory first
    await this.store.store(memory);

    // Update context with new memory
    context.activeMemories = [
      memory.id,
      ...context.activeMemories.slice(0, (this.config.maxContextSize || 100) - 1)
    ];

    context.metadata.lastUpdate = new Date().toISOString();

    // Save updated context
    await this.saveContext(context);

    return context;
  }

  async createContext(id: string, type: string): Promise<T> {
    const baseContext: BaseContext = {
      id,
      activeMemories: [],
      metadata: {
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        type
      }
    };

    // Cast to T since we're creating a base context
    const context = baseContext as T;

    await this.saveContext(context);
    return context;
  }

  async deleteContext(id: string): Promise<void> {
    await this.initialize();

    const contextPath = path.join(this.baseDir, 'context', `${id}.json`);
    if (fs.existsSync(contextPath)) {
      await fs.promises.unlink(contextPath);
    }
  }

  async listContexts(): Promise<string[]> {
    await this.initialize();

    const files = await fs.promises.readdir(path.join(this.baseDir, 'context'));
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }
}

// Project-specific context manager
export class DevContextManager extends ContextManager<DevContext, BaseMemory> {
  async updateCodeContext(files: string[]): Promise<void> {
    let context = await this.loadContext('development');
    if (!context) {
      context = await this.createContext('development', 'development');
      (context as DevContext).projectInfo = {
        name: path.basename(process.cwd()),
        path: process.cwd(),
        branch: 'main' // TODO: Get actual git branch
      };
      (context as DevContext).codeContext = {
        files: [],
        dependencies: []
      };
      await this.saveContext(context);
    }

    // Update code context
    (context as DevContext).codeContext.files = files;

    const memory: BaseMemory = {
      id: Date.now().toString(),
      content: `Updated code context with files: ${files.join(', ')}`,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'development',
        importance: 3
      }
    };

    await this.updateContext(context, memory);
  }
}
