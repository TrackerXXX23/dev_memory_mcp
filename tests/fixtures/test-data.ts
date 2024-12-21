import { ContextEntry, ContextMetadata } from '../../src/core/types/context';

/**
 * Test memory fixtures
 */
export const testMemories: ContextEntry[] = [
  {
    id: 'test-1',
    content: 'Test memory content 1',
    vector: Array(1536).fill(0.1),
    metadata: {
      type: 'note',
      timestamp: Date.now(),
      tags: ['test', 'fixture'],
      source: 'test-data',
      attributes: {
        priority: 'high',
        status: 'active'
      }
    }
  },
  {
    id: 'test-2',
    content: 'Test memory content 2',
    vector: Array(1536).fill(0.2),
    metadata: {
      type: 'code',
      timestamp: Date.now(),
      tags: ['test', 'code'],
      source: 'test-data',
      relationships: [
        { targetId: 'test-1', type: 'related', strength: 0.8 }
      ],
      attributes: {
        language: 'typescript',
        complexity: 'medium'
      }
    }
  },
  {
    id: 'test-3',
    content: 'Test memory content 3 with special characters: !@#$%^&*()',
    vector: Array(1536).fill(0.3),
    metadata: {
      type: 'note',
      timestamp: Date.now() - 3600000, // 1 hour ago
      tags: ['test', 'special'],
      source: 'test-data',
      attributes: {
        status: 'archived'
      }
    }
  }
];

/**
 * Test metadata fixtures
 */
export const testMetadata: ContextMetadata[] = [
  {
    type: 'note',
    timestamp: Date.now(),
    tags: ['test'],
    source: 'test-data',
    attributes: {
      priority: 'high'
    }
  },
  {
    type: 'code',
    timestamp: Date.now(),
    tags: ['test', 'code'],
    source: 'test-data',
    relationships: [
      { targetId: 'related-1', type: 'references', strength: 0.9 }
    ],
    attributes: {
      language: 'typescript'
    }
  },
  {
    type: 'note',
    timestamp: Date.now() - 7200000, // 2 hours ago
    tags: ['test', 'archived'],
    source: 'test-data',
    attributes: {
      status: 'archived'
    }
  }
];

/**
 * Test vector fixtures
 */
export const testVectors = {
  noteVector: Array(1536).fill(0.1),
  codeVector: Array(1536).fill(0.2),
  queryVector: Array(1536).fill(0.15),
  emptyVector: Array(1536).fill(0),
  randomVector: Array(1536).fill(0).map(() => Math.random()),
  // Edge cases
  sparseVector: Array(1536).fill(0).map((_, i) => i % 100 === 0 ? 1 : 0),
  denseVector: Array(1536).fill(0.999)
};

/**
 * Test request fixtures
 */
export const testRequests = {
  addMemory: {
    valid: {
      params: {
        name: 'add_memory',
        arguments: {
          content: 'Test memory content',
          type: 'note',
          tags: ['test']
        }
      }
    },
    invalid: {
      noContent: {
        params: {
          name: 'add_memory',
          arguments: {
            type: 'note'
          }
        }
      },
      invalidType: {
        params: {
          name: 'add_memory',
          arguments: {
            content: 'Test content',
            type: 123 // Invalid type
          }
        }
      },
      emptyContent: {
        params: {
          name: 'add_memory',
          arguments: {
            content: '',
            type: 'note'
          }
        }
      }
    }
  },
  searchMemories: {
    valid: {
      basic: {
        params: {
          name: 'search_memories',
          arguments: {
            query: 'test'
          }
        }
      },
      withFilter: {
        params: {
          name: 'search_memories',
          arguments: {
            query: 'test',
            filter: {
              type: 'note',
              tags: ['test']
            }
          }
        }
      },
      withTimeRange: {
        params: {
          name: 'search_memories',
          arguments: {
            query: 'test',
            timeRange: {
              start: Date.now() - 3600000,
              end: Date.now()
            }
          }
        }
      }
    },
    invalid: {
      noQuery: {
        params: {
          name: 'search_memories',
          arguments: {}
        }
      },
      invalidTimeRange: {
        params: {
          name: 'search_memories',
          arguments: {
            query: 'test',
            timeRange: {
              start: 'invalid',
              end: Date.now()
            }
          }
        }
      }
    }
  }
};

/**
 * Performance test data generator
 */
export function generateTestData(count: number, options: {
  withRelationships?: boolean;
  withTags?: boolean;
  withAttributes?: boolean;
  timeSpan?: number;
} = {}): ContextEntry[] {
  const {
    withRelationships = false,
    withTags = true,
    withAttributes = false,
    timeSpan = 24 * 60 * 60 * 1000 // 24 hours
  } = options;

  return Array(count).fill(null).map((_, i) => {
    const entry: ContextEntry = {
      id: `perf-${i}`,
      content: `Performance test content ${i}`,
      vector: Array(1536).fill(0).map(() => Math.random()),
      metadata: {
        type: i % 2 === 0 ? 'note' : 'code',
        timestamp: Date.now() - Math.floor(Math.random() * timeSpan),
        tags: withTags ? ['performance', `tag-${i % 10}`] : [],
        source: 'test-data'
      }
    };

    if (withRelationships && i > 0) {
      entry.metadata.relationships = [
        { targetId: `perf-${i - 1}`, type: 'related', strength: Math.random() }
      ];
    }

    if (withAttributes) {
      entry.metadata.attributes = {
        priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
        status: i % 2 === 0 ? 'active' : 'archived'
      };
    }

    return entry;
  });
}
