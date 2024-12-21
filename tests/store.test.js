import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { PineconeStore } from '../src/core/store.js';
describe('Store Content Encoding', () => {
    let store;
    let testMemory;
    beforeAll(async () => {
        const config = {
            apiKey: process.env.PINECONE_API_KEY || '',
            environment: process.env.PINECONE_ENVIRONMENT || '',
            indexName: process.env.PINECONE_INDEX_NAME || ''
        };
        store = new PineconeStore(config);
        await store.initialize();
    });
    beforeEach(() => {
        // Create fresh test memory before each test
        testMemory = {
            id: `test-${Date.now()}`,
            content: '',
            metadata: {
                timestamp: new Date().toISOString(),
                type: 'custom'
            }
        };
    });
    describe('Content Sanitization', () => {
        test('preserves special characters', async () => {
            testMemory.content = `
        • Bullets and em dashes — here
        🎉 Emojis
        "Smart" 'quotes'
        ♠♣♥♦ Special symbols
        αβγ Greek letters
        한글 Korean text
      `.trim();
            await store.store(testMemory);
            const retrieved = await store.find(testMemory.id);
            expect(retrieved).toBeDefined();
            expect(retrieved?.content).toContain('•');
            expect(retrieved?.content).toContain('—');
            expect(retrieved?.content).toContain('🎉');
            expect(retrieved?.content).toContain('"Smart"');
            expect(retrieved?.content).toContain('♠♣♥♦');
            expect(retrieved?.content).toContain('αβγ');
            expect(retrieved?.content).toContain('한글');
        });
        test('handles control characters correctly', async () => {
            testMemory.content = `Line breaks\n\rand control chars\t\b`;
            await store.store(testMemory);
            const retrieved = await store.find(testMemory.id);
            expect(retrieved.content).toContain('Line breaks');
            expect(retrieved.content).toContain('control chars');
            // Control characters should be sanitized but preserve readability
            expect(retrieved?.content).not.toContain('\b');
        });
        test('handles null characters', async () => {
            testMemory.content = `Test${String.fromCharCode(0x00)}content${String.fromCharCode(0x1F)}here`;
            await store.store(testMemory);
            const retrieved = await store.find(testMemory.id);
            expect(retrieved.content).toContain('Test');
            expect(retrieved.content).toContain('content');
            expect(retrieved.content).toContain('here');
            // Null characters should be removed
            expect(retrieved?.content).not.toContain(String.fromCharCode(0x00));
            expect(retrieved?.content).not.toContain(String.fromCharCode(0x1F));
        });
    });
    describe('Vector Operations', () => {
        test('finds similar content', async () => {
            testMemory.content = 'This is a unique test phrase for similarity search';
            await store.store(testMemory);
            const similar = await store.findSimilar('test phrase similarity');
            expect(similar).toBeDefined();
            expect(similar.length).toBeGreaterThan(0);
            expect(similar[0]).toHaveProperty('content');
            expect(similar[0]).toHaveProperty('metadata');
        });
        test('handles empty search results', async () => {
            const similar = await store.findSimilar('completely unrelated content that should not exist', 5);
            expect(similar).toHaveLength(0); // Should return empty array due to similarity threshold
        });
    });
    describe('Error Handling', () => {
        test('throws error for non-existent ID', async () => {
            await expect(store.find('non-existent-id')).rejects.toThrow('Vector with id non-existent-id not found');
        });
        test('validates memory structure before storing', async () => {
            const invalidMemory = {
                // Missing required id field
                content: 'test',
                metadata: {
                    timestamp: new Date().toISOString(),
                    type: 'custom'
                }
            };
            // @ts-expect-error Testing invalid memory structure
            await expect(store.store(invalidMemory)).rejects.toThrow();
        });
    });
});
//# sourceMappingURL=store.test.js.map