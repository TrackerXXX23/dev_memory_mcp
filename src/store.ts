import { Memory, MemoryStore } from './types.js';

export class FileMemoryStore implements MemoryStore {
  memories: Memory[] = [];

  constructor() {}

  addMemory(memory: Memory): void {
    this.memories.push(memory);
  }

  getMemories(): Memory[] {
    return this.memories;
  }

  searchMemories(query: string): Memory[] {
    const lowercaseQuery = query.toLowerCase();
    return this.memories.filter(memory => 
      memory.content.toLowerCase().includes(lowercaseQuery) ||
      memory.metadata.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }
}
