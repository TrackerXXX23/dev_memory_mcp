/**
 * OpenAI embeddings utilities for vector operations
 * Includes vector processing, normalization, validation, and batching
 */

import OpenAI from 'openai';
import { VectorOperationResponse, VectorData } from '../types/vector';

// OpenAI ada-002 embedding dimension
const EMBEDDING_DIMENSION = 1536;
const DEFAULT_BATCH_SIZE = 100;

export class EmbeddingsService {
  private readonly batchSize: number;
  private openai: OpenAI;

  constructor(apiKey: string, batchSize: number = DEFAULT_BATCH_SIZE) {
    this.openai = new OpenAI({ apiKey });
    this.batchSize = batchSize;
  }

  /**
   * Normalize a vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude === 0 ? vector : vector.map(val => val / magnitude);
  }

  /**
   * Validate vector dimensions and values
   */
  private validateVector(vector: number[]): VectorOperationResponse {
    if (!Array.isArray(vector)) {
      return { success: false, error: 'Invalid vector format: not an array' };
    }

    if (vector.length !== EMBEDDING_DIMENSION) {
      return { 
        success: false, 
        error: `Invalid vector dimension: expected ${EMBEDDING_DIMENSION}, got ${vector.length}` 
      };
    }

    if (!vector.every(val => typeof val === 'number' && !isNaN(val))) {
      return { success: false, error: 'Invalid vector values: non-numeric values found' };
    }

    return { success: true };
  }

  /**
   * Process a vector: validate and normalize
   */
  async processVector(vector: number[]): Promise<VectorOperationResponse & { vector?: number[] }> {
    const validation = this.validateVector(vector);
    if (!validation.success) {
      return validation;
    }

    try {
      const normalizedVector = this.normalizeVector(vector);
      return {
        success: true,
        vector: normalizedVector
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process vector'
      };
    }
  }

  /**
   * Split array into batches of specified size
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / batchSize) }, (_, i) =>
      items.slice(i * batchSize, (i + 1) * batchSize)
    );
  }

  /**
   * Generate and process embedding for a given text
   */
  async generateEmbedding(text: string): Promise<VectorOperationResponse & { embedding?: number[] }> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      const vector = response.data[0].embedding;
      const processResult = await this.processVector(vector);
      
      if (!processResult.success) {
        return processResult;
      }

      return {
        success: true,
        embedding: processResult.vector,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate embedding',
      };
    }
  }

  /**
   * Generate and process embeddings for multiple texts with batching
   */
  async generateBatchEmbeddings(texts: string[]): Promise<VectorOperationResponse & { embeddings?: number[][] }> {
    try {
      const batches = this.createBatches(texts, this.batchSize);
      const processedBatches: number[][] = [];

      for (const batch of batches) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: batch,
        });

        // Process each vector in the batch
        for (const item of response.data) {
          const processResult = await this.processVector(item.embedding);
          if (!processResult.success || !processResult.vector) {
            return {
              success: false,
              error: `Failed to process vector in batch: ${processResult.error}`
            };
          }
          processedBatches.push(processResult.vector);
        }
      }

      return {
        success: true,
        embeddings: processedBatches,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate batch embeddings',
      };
    }
  }
}
