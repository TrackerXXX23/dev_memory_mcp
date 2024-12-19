import fs from 'fs';
import path from 'path';
import { BaseMemory } from './types.js';

// Generic store interface
export interface Store<T extends BaseMemory> {
  initialize(): Promise<void>;
  store(memory: T): Promise<void>;
  find(id: string): Promise<T | null>;
  findSimilar(content: string, limit?: number): Promise<T[]>;
  delete(id: string): Promise<void>;
}

// File-based store implementation
export class FileStore<T extends BaseMemory> implements Store<T> {
  private baseDir: string;
  private initialized: boolean = false;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const dirs = ['interactions', 'metadata', 'logs'];
    for (const dir of dirs) {
      const dirPath = path.join(this.baseDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    this.initialized = true;
  }

  async store(memory: T): Promise<void> {
    try {
      // Create base directory if it doesn't exist
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }

      // Create a simple filename
      const filename = `memory-${Date.now()}.json`;
      const filePath = path.join(this.baseDir, filename);

      console.error('Writing to:', filePath);

      // Write directly to file
      const data = JSON.stringify({
        id: memory.id,
        content: memory.content,
        metadata: memory.metadata
      }, null, 2);

      fs.writeFileSync(filePath, data, 'utf8');
      console.error('Write successful');

      // Verify file exists
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        console.error('File content:', content);
      } else {
        throw new Error('File not written');
      }
    } catch (error) {
      console.error('Detailed error in store():', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace',
        baseDir: this.baseDir,
        initialized: this.initialized
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async find(id: string): Promise<T | null> {
    await this.initialize();

    const files = await fs.promises.readdir(path.join(this.baseDir, 'interactions'));
    const file = files.find(f => f.includes(id));

    if (!file) return null;

    const content = await fs.promises.readFile(
      path.join(this.baseDir, 'interactions', file),
      'utf-8'
    );

    const parsed = JSON.parse(content);
    // Sanitize content when reading
    return {
      ...parsed,
      content: parsed.content.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''),
      metadata: {
        ...parsed.metadata,
        timestamp: parsed.metadata.timestamp
      }
    };
  }

  async findSimilar(content: string, limit: number = 5): Promise<T[]> {
    await this.initialize();

    const files = await fs.promises.readdir(path.join(this.baseDir, 'interactions'));
    const memories: T[] = [];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(
          path.join(this.baseDir, 'interactions', file),
          'utf-8'
        );
        const parsed = JSON.parse(content);
        
        // Sanitize each memory object
        const sanitizedMemory = {
          ...parsed,
          content: parsed.content.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''),
          metadata: {
            ...parsed.metadata,
            timestamp: parsed.metadata.timestamp
          }
        } as T;

        memories.push(sanitizedMemory);
      } catch (error) {
        console.error(`Error reading memory file ${file}:`, error);
        continue;
      }
    }

    // Simple text similarity for now
    // TODO: Implement better similarity matching
    return memories
      .sort((a, b) => {
        const scoreA = this.similarity(content, a.content);
        const scoreB = this.similarity(content, b.content);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    await this.initialize();

    const files = await fs.promises.readdir(path.join(this.baseDir, 'interactions'));
    const file = files.find(f => f.includes(id));

    if (file) {
      await fs.promises.unlink(path.join(this.baseDir, 'interactions', file));
    }
  }

  private similarity(a: string, b: string): number {
    // Simple Jaccard similarity
    const setA = new Set(a.toLowerCase().split(/\W+/));
    const setB = new Set(b.toLowerCase().split(/\W+/));
    
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return intersection.size / union.size;
  }
}
