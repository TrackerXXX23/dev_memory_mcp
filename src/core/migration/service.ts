import { ContextEntry } from '../types/context';
import { VectorData } from '../types/vector';
import { 
  MigrationOptions, 
  MigrationProgress, 
  MigrationResult, 
  MigrationSnapshot,
  MigrationTransformer 
} from './types';
import { DefaultMigrationTransformer } from './transformer';
import { VectorStore } from '../store';

const DEFAULT_BATCH_SIZE = 50;

/**
 * Handles the migration process from file-based storage to vector storage
 */
export class MigrationService {
  private transformer: MigrationTransformer;
  private vectorStore: VectorStore;
  private snapshots: MigrationSnapshot[] = [];

  constructor(
    openAiApiKey: string,
    vectorStore: VectorStore,
    transformer?: MigrationTransformer
  ) {
    this.transformer = transformer || new DefaultMigrationTransformer(openAiApiKey);
    this.vectorStore = vectorStore;
  }

  /**
   * Initialize migration progress tracking
   */
  private initializeProgress(total: number): MigrationProgress {
    return {
      total,
      processed: 0,
      failed: 0,
      errors: [],
      startTime: new Date(),
    };
  }

  /**
   * Take a snapshot of the current migration state
   */
  private takeSnapshot(progress: MigrationProgress, state: MigrationSnapshot['state']) {
    const snapshot: MigrationSnapshot = {
      timestamp: new Date(),
      progress: { ...progress },
      state,
    };
    this.snapshots.push(snapshot);
  }

  /**
   * Process a batch of memories
   */
  private async processBatch(
    memories: ContextEntry[],
    progress: MigrationProgress,
    options: MigrationOptions
  ): Promise<VectorData[]> {
    const vectors: VectorData[] = [];

    for (const memory of memories) {
      try {
        // Transform memory to vector format
        const vector = await this.transformer.memoryToVector(memory);

        // Validate transformation
        const isValid = await this.transformer.validate(memory, vector);
        if (!isValid) {
          throw new Error('Validation failed: Data integrity check failed');
        }

        if (!options.validateOnly) {
          vectors.push(vector);
        }

        progress.processed++;
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          id: memory.id,
          error: error instanceof Error ? error.message : 'Unknown error during processing',
          data: memory,
        });

        if (options.rollbackOnError) {
          throw error;
        }
      }
    }

    return vectors;
  }

  /**
   * Perform rollback of migrated data
   */
  private async rollback(vectors: VectorData[]): Promise<void> {
    // Delete migrated vectors from store
    for (const vector of vectors) {
      await this.vectorStore.deleteVectors([vector.id]);
    }
  }

  /**
   * Execute the migration process
   */
  async migrate(
    memories: ContextEntry[],
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    const progress = this.initializeProgress(memories.length);
    const migratedVectors: VectorData[] = [];

    this.takeSnapshot(progress, 'in_progress');

    try {
      // Process in batches
      for (let i = 0; i < memories.length; i += batchSize) {
        const batch = memories.slice(i, i + batchSize);
        const vectors = await this.processBatch(batch, progress, options);

        if (!options.validateOnly) {
          // Store vectors in batches
          await this.vectorStore.upsertVectors(vectors);
          migratedVectors.push(...vectors);
        }

        this.takeSnapshot(progress, 'in_progress');
      }

      progress.endTime = new Date();
      this.takeSnapshot(progress, 'completed');

      return {
        success: progress.failed === 0,
        progress,
        rollbackRequired: false,
      };
    } catch (error) {
      progress.endTime = new Date();
      this.takeSnapshot(progress, 'failed');

      if (options.rollbackOnError && migratedVectors.length > 0) {
        await this.rollback(migratedVectors);
        this.takeSnapshot(progress, 'rolled_back');
      }

      return {
        success: false,
        progress,
        rollbackRequired: options.rollbackOnError === true,
      };
    }
  }

  /**
   * Get migration snapshots for monitoring
   */
  getSnapshots(): MigrationSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get the latest migration snapshot
   */
  getLatestSnapshot(): MigrationSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }
}
