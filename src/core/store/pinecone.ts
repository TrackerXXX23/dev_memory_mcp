import { Pinecone } from '@pinecone-database/pinecone';
import { 
  VectorStore, 
  VectorData, 
  VectorOperationResponse, 
  VectorSearchResult,
  VectorStoreConfig,
  VectorQueryMatch,
  VectorQueryResponse 
} from '../types/vector';

const MONITORING_INTERVAL = 30000; // 30 seconds

export class PineconeStore implements VectorStore {
  private client: Pinecone | null = null;
  private index: any | null = null;
  private isConnected: boolean = false;
  private lastError: string | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isDisposed: boolean = false;

  constructor(private config: VectorStoreConfig) {}

  async initialize(): Promise<VectorOperationResponse> {
    try {
      // Clear any existing state
      await this.dispose();

      // Reset disposed flag
      this.isDisposed = false;

      // Input validation
      if (!this.config.apiKey || !this.config.environment || !this.config.indexName) {
        throw new Error('Missing required configuration');
      }

      // Initialize Pinecone client
      this.client = new Pinecone({
        apiKey: this.config.apiKey
      });

      // Get index
      this.index = this.client.index(this.config.indexName);
      
      // Test connection
      const testResult = await this.testConnection();
      if (!testResult.success) {
        return testResult;
      }

      // Start connection monitoring
      this.startConnectionMonitoring();
      
      return { success: true };
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Failed to initialize';
      return { success: false, error: this.lastError };
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected && !this.isDisposed,
      lastError: this.lastError
    };
  }

  async testConnection(): Promise<VectorOperationResponse> {
    try {
      if (!this.index || this.isDisposed) {
        throw new Error('Store not initialized or disposed');
      }

      // Test query to verify connection
      await this.index.describeIndexStats();
      
      this.isConnected = true;
      this.lastError = null;
      return { success: true };
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Connection test failed';
      return { success: false, error: this.lastError };
    }
  }

  private startConnectionMonitoring() {
    // Clear any existing interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Start new monitoring interval
    this.monitoringInterval = setInterval(async () => {
      if (this.isDisposed) {
        if (this.monitoringInterval) {
          clearInterval(this.monitoringInterval);
          this.monitoringInterval = null;
        }
        return;
      }

      try {
        await this.testConnection();
      } catch (error) {
        this.isConnected = false;
        this.lastError = error instanceof Error ? error.message : 'Connection test failed';
      }
    }, MONITORING_INTERVAL);

    // Ensure the interval is cleaned up on process exit
    process.on('beforeExit', () => {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
    });
  }

  async upsertVectors(vectors: VectorData[]): Promise<VectorOperationResponse> {
    try {
      // Input validation
      if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
        return { success: false, error: 'No vectors provided' };
      }

      // Validate vector format
      for (const vector of vectors) {
        if (!vector.id || !Array.isArray(vector.values) || vector.values.length === 0) {
          return { success: false, error: 'Invalid vector format' };
        }
      }

      // Connection check
      if (!this.isConnected || !this.index || this.isDisposed) {
        return { success: false, error: 'Not connected to Pinecone' };
      }

      // Format vectors for Pinecone
      const formattedVectors = vectors.map(v => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata ? {
          ...v.metadata,
          _updated: new Date().toISOString()
        } : {
          _updated: new Date().toISOString()
        }
      }));

      await this.index.upsert(formattedVectors);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to upsert vectors'
      };
    }
  }

  async queryVectors(
    queryVector: number[],
    options?: { topK?: number; filter?: Record<string, any> }
  ): Promise<VectorOperationResponse & { results?: VectorSearchResult[] }> {
    try {
      // Input validation
      if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
        return { success: false, error: 'Invalid query vector' };
      }

      // Connection check
      if (!this.isConnected || !this.index || this.isDisposed) {
        return { success: false, error: 'Not connected to Pinecone' };
      }

      const response = await this.index.query({
        vector: queryVector,
        topK: options?.topK || 10,
        filter: options?.filter,
        includeMetadata: true
      }) as VectorQueryResponse;

      // Handle empty results
      if (!response || !response.matches) {
        return {
          success: true,
          results: []
        };
      }

      // Map results to expected format
      return {
        success: true,
        results: response.matches.map((match: VectorQueryMatch) => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata || {}
        }))
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to query vectors'
      };
    }
  }

  async deleteVectors(ids: string[]): Promise<VectorOperationResponse> {
    try {
      // Input validation
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'No vector IDs provided' };
      }

      // Validate ID format
      if (ids.some(id => typeof id !== 'string' || !id)) {
        return { success: false, error: 'Invalid vector ID format' };
      }

      // Connection check
      if (!this.isConnected || !this.index || this.isDisposed) {
        return { success: false, error: 'Not connected to Pinecone' };
      }

      await this.index.deleteMany(ids);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete vectors'
      };
    }
  }

  async dispose(): Promise<VectorOperationResponse> {
    try {
      // Mark as disposed first to prevent new operations
      this.isDisposed = true;

      // Clear monitoring interval
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      // Reset state
      this.isConnected = false;
      this.lastError = null;
      this.client = null;
      this.index = null;

      return { success: true };
    } catch (error) {
      // Ensure resources are cleaned up even if an error occurs
      this.monitoringInterval = null;
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Failed to dispose';
      this.client = null;
      this.index = null;

      return { 
        success: false, 
        error: this.lastError 
      };
    }
  }
}
