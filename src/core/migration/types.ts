import { ContextEntry } from '../types/context';
import { VectorData } from '../types/vector';

export interface MigrationProgress {
  total: number;
  processed: number;
  failed: number;
  errors: MigrationError[];
  startTime: Date;
  endTime?: Date;
}

export interface MigrationError {
  id: string;
  error: string;
  data?: any;
}

export interface MigrationOptions {
  batchSize?: number;
  validateOnly?: boolean;
  rollbackOnError?: boolean;
}

export interface MigrationResult {
  success: boolean;
  progress: MigrationProgress;
  rollbackRequired: boolean;
}

export interface MigrationSnapshot {
  timestamp: Date;
  progress: MigrationProgress;
  state: 'in_progress' | 'completed' | 'failed' | 'rolled_back';
}

export interface MigrationTransformer {
  memoryToVector(memory: ContextEntry): Promise<VectorData>;
  vectorToMemory(vector: VectorData): Promise<ContextEntry>;
  validate(memory: ContextEntry, vector: VectorData): Promise<boolean>;
}
