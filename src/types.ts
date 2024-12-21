export interface Memory {
  id: string;
  timestamp: number;
  content: string;
  metadata: {
    type: string;
    tags: string[];
    [key: string]: any;
  };
}

export interface MemoryStore {
  memories: Memory[];
  addMemory(memory: Memory): void;
  getMemories(): Memory[];
  searchMemories(query: string): Memory[];
}
