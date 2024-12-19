// Base memory types
export interface BaseMemory {
  id: string;
  content: string;
  metadata: {
    timestamp: string;
    type: MemoryType;
    importance?: number;
    category?: string;
    topics?: string[];
    source?: string;
  };
}

export type MemoryType = 
  | 'development'
  | 'conversation'
  | 'document'
  | 'system'
  | 'custom';

// Enhanced memory interface
export interface EnhancedMemory<T extends Record<string, any> = {}> extends BaseMemory {
  contextType: MemoryType;
  relationships: {
    relatedMemories: string[];
    customRelations?: Record<string, string[]>;
  } & T;
  persistence: {
    priority: number;
    expiresAt?: string;
    lastAccessed: string;
    accessCount: number;
  };
}

// Project-specific memory types
export interface DevMemory extends EnhancedMemory<{
  codeContext: {
    files: string[];
    commits: string[];
    branch: string;
  };
}> {}

// Context management types
export interface BaseContext<T extends Record<string, any> = {}> {
  id: string;
  activeMemories: string[];
  metadata: {
    startTime: string;
    lastUpdate: string;
    type: string;
  } & T;
}

export interface DevContext extends BaseContext {
  projectInfo: {
    name: string;
    path: string;
    branch: string;
  };
  codeContext: {
    files: string[];
    dependencies: string[];
  };
}
