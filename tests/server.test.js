import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorCode } from '@modelcontextprotocol/sdk/dist/shared/errors.js';
import { DevMemoryServer } from '../src/index.js';
// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.PINECONE_API_KEY = 'test-key';
process.env.PINECONE_ENVIRONMENT = 'test-env';
process.env.PINECONE_INDEX_NAME = 'test-index';
// Mock OpenAI
vi.mock('openai', () => {
    const mockEmbeddings = {
        create: vi.fn().mockResolvedValue({
            data: [{ embedding: new Array(1536).fill(0) }]
        })
    };
    return {
        default: vi.fn().mockImplementation(() => ({
            embeddings: mockEmbeddings
        }))
    };
});
// Mock Pinecone
vi.mock('@pinecone-database/pinecone', () => {
    const mockIndex = {
        upsert: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockResolvedValue({
            matches: [
                {
                    id: 'test-id',
                    score: 0.9,
                    values: new Array(1536).fill(0),
                    metadata: {
                        type: 'development',
                        content: 'test content',
                        path: '/test/path',
                        language: 'typescript'
                    }
                }
            ]
        }),
        fetch: vi.fn().mockResolvedValue({
            vectors: {
                'test-id': {
                    id: 'test-id',
                    values: new Array(1536).fill(0),
                    metadata: {
                        type: 'development',
                        content: 'test content',
                        path: '/test/path',
                        language: 'typescript'
                    }
                }
            }
        }),
        deleteOne: vi.fn().mockResolvedValue({})
    };
    return {
        Pinecone: vi.fn().mockImplementation(() => ({
            index: vi.fn().mockReturnValue(mockIndex)
        }))
    };
});
// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));
// Mock transport for testing
class MockTransport {
    constructor(server) {
        this.server = server;
    }
    async send(request) {
        return this.server.handleRequest(request);
    }
}
describe('DevMemoryServer', () => {
    let server;
    let transport;
    beforeEach(async () => {
        vi.clearAllMocks();
        server = new DevMemoryServer();
        transport = new MockTransport(server);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
    describe('initialize', () => {
        it('should initialize successfully', async () => {
            const request = {
                jsonrpc: '2.0',
                id: '1',
                method: 'initialize',
                params: {
                    capabilities: {
                        memory: {
                            store: true,
                            query: true,
                            delete: true
                        }
                    }
                }
            };
            const response = await transport.send(request);
            expect(response.result).toBeDefined();
            expect(response.error).toBeUndefined();
        });
        it('should handle initialization errors', async () => {
            const request = {
                jsonrpc: '2.0',
                id: '1',
                method: 'initialize',
                params: {
                    capabilities: {}
                }
            };
            const response = await transport.send(request);
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe(ErrorCode.InvalidParams);
        });
    });
    describe('memory operations', () => {
        beforeEach(async () => {
            // Initialize server before each test
            await transport.send({
                jsonrpc: '2.0',
                id: '1',
                method: 'initialize',
                params: {
                    capabilities: {
                        memory: {
                            store: true,
                            query: true,
                            delete: true
                        }
                    }
                }
            });
        });
        it('should store memory', async () => {
            const request = {
                jsonrpc: '2.0',
                id: '2',
                method: 'memory/store',
                params: {
                    content: 'test content',
                    metadata: {
                        type: 'development',
                        path: '/test/path',
                        language: 'typescript'
                    }
                }
            };
            const response = await transport.send(request);
            expect(response.result).toBeDefined();
            expect(response.error).toBeUndefined();
        });
        it('should query memory', async () => {
            const request = {
                jsonrpc: '2.0',
                id: '3',
                method: 'memory/query',
                params: {
                    content: 'test query',
                    limit: 5
                }
            };
            const response = await transport.send(request);
            expect(response.result).toBeDefined();
            expect(response.error).toBeUndefined();
            expect(Array.isArray(response.result)).toBe(true);
        });
        it('should delete memory', async () => {
            const request = {
                jsonrpc: '2.0',
                id: '4',
                method: 'memory/delete',
                params: {
                    id: 'test-id'
                }
            };
            const response = await transport.send(request);
            expect(response.result).toBeDefined();
            expect(response.error).toBeUndefined();
        });
    });
});
//# sourceMappingURL=server.test.js.map