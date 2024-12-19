# Dev Memory System - Working Notes

## Package Architecture

### Core Package Structure
```
@dev-memory/core/
├── src/
│   ├── store/           # Vector and relationship storage
│   ├── context/         # Context management
│   ├── optimization/    # Memory optimization
│   ├── monitoring/      # Health and metrics
│   └── types/          # Shared types
├── package.json
└── tsconfig.json
```

### Integration Packages
```
@dev-memory/react/      # React hooks and components
@dev-memory/node/       # Node.js integration
@dev-memory/git/        # Git hooks and utilities
@dev-memory/cli/        # CLI tools
```

## Core Types

### Base Memory Types
```typescript
// Project-agnostic memory interface
interface BaseMemory {
  id: string;
  content: string;
  metadata: {
    timestamp: string;
    type: MemoryType;
    importance?: number;
    category?: string;
    topics?: string[];
  };
}

type MemoryType = 
  | 'development'
  | 'conversation'
  | 'document'
  | 'system'
  | 'custom';

// Extensible memory interface
interface EnhancedMemory<T extends Record<string, any> = {}> extends BaseMemory {
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
interface DevMemory extends EnhancedMemory<{
  codeContext: {
    files: string[];
    commits: string[];
    branch: string;
  };
}> {}

interface ChatMemory extends EnhancedMemory<{
  conversationContext: {
    participants: string[];
    thread: string;
  };
}> {}
```

### Context Management
```typescript
// Generic context interface
interface BaseContext<T extends Record<string, any> = {}> {
  id: string;
  activeMemories: string[];
  metadata: {
    startTime: string;
    lastUpdate: string;
    type: string;
  } & T;
}

// Project-specific context types
interface DevContext extends BaseContext<{
  projectInfo: {
    name: string;
    path: string;
    branch: string;
  };
  codeContext: {
    files: string[];
    dependencies: string[];
  };
}> {}

interface AgentContext extends BaseContext<{
  conversationState: {
    recentTopics: string[];
    activeProjects: string[];
    priorityContext: string[];
  };
  sessionInfo: {
    contextSwitches: number;
    continuityScore: number;
  };
}> {}
```

## Core Services

### Vector Store
```typescript
// Generic vector store interface
interface VectorStore<T extends BaseMemory> {
  initialize(): Promise<void>;
  storeVector(memory: T): Promise<void>;
  findSimilar(content: string, limit?: number): Promise<T[]>;
  delete(id: string): Promise<void>;
}

// Implementation with dependency injection
class PineconeStore<T extends BaseMemory> implements VectorStore<T> {
  constructor(
    private config: {
      environment: string;
      apiKey: string;
      namespace?: string;
    }
  ) {}

  async initialize() {
    // Initialize Pinecone client
  }

  async storeVector(memory: T) {
    // Store vectorized memory
  }
}
```

### Context Manager
```typescript
// Generic context manager
class ContextManager<T extends BaseContext, M extends BaseMemory> {
  constructor(
    private store: VectorStore<M>,
    private config: {
      maxContextSize?: number;
      priorityThreshold?: number;
    }
  ) {}

  async loadContext(id: string): Promise<T> {
    // Load and prepare context
  }

  async updateContext(context: T, memory: M): Promise<T> {
    // Update context with new memory
  }
}

// Project-specific managers
class DevContextManager extends ContextManager<DevContext, DevMemory> {
  async updateCodeContext(files: string[]) {
    // Update development context
  }
}

class AgentContextManager extends ContextManager<AgentContext, ChatMemory> {
  async maintainContinuity(currentTopic: string) {
    // Maintain conversation continuity
  }
}
```

## Integration Examples

### React Integration
```typescript
// Generic memory hook
function useMemory<T extends BaseContext, M extends BaseMemory>(
  contextManager: ContextManager<T, M>,
  config: {
    contextId: string;
    autoLoad?: boolean;
  }
) {
  const [context, setContext] = useState<T | null>(null);
  
  useEffect(() => {
    if (config.autoLoad) {
      loadContext();
    }
  }, [config.contextId]);

  return {
    context,
    loadContext,
    updateContext,
  };
}

// Project-specific hooks
function useDevMemory(projectId: string) {
  return useMemory(devContextManager, {
    contextId: projectId,
    autoLoad: true,
  });
}

function useAgentMemory(sessionId: string) {
  return useMemory(agentContextManager, {
    contextId: sessionId,
    autoLoad: true,
  });
}
```

### Git Integration
```typescript
// Generic git hook factory
function createGitHook<T extends BaseMemory>(
  store: VectorStore<T>,
  transformer: (commit: string) => Promise<T>
) {
  return async (commit: string) => {
    const memory = await transformer(commit);
    await store.storeVector(memory);
  };
}

// Project-specific hooks
const devMemoryHook = createGitHook(
  devStore,
  async (commit) => ({
    // Transform commit to DevMemory
  })
);
```

## Usage Examples

### Basic Usage
```typescript
// Initialize core services
const store = new PineconeStore({
  environment: process.env.PINECONE_ENV,
  apiKey: process.env.PINECONE_API_KEY,
});

const contextManager = new ContextManager(store, {
  maxContextSize: 1000,
  priorityThreshold: 0.7,
});

// Use in any project
const memory = await contextManager.loadContext('context-id');
```

### Project Integration
```typescript
// React project
function DevDashboard() {
  const { context, updateContext } = useDevMemory('project-1');
  
  return (
    <MemoryProvider context={context}>
      <ContextViewer />
      <MemoryList />
    </MemoryProvider>
  );
}

// Node.js project
const { DevMemoryServer } = require('@dev-memory/node');

const server = new DevMemoryServer({
  store,
  contextManager,
  port: 3000,
});

server.start();
```

## Next Steps

1. Package Structure
   - Create monorepo setup
   - Set up build pipeline
   - Configure package publishing

2. Core Implementation
   - Implement base interfaces
   - Add generic services
   - Create utility functions

3. Integration Packages
   - Build React package
   - Create Node.js package
   - Implement Git hooks

4. Documentation
   - API documentation
   - Integration guides
   - Example projects
