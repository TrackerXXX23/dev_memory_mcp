import { ErrorCode } from './types.js';

export class McpError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'McpError';
    // Ensure instanceof works correctly
    Object.setPrototypeOf(this, McpError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }

  static isInstance(error: any): error is McpError {
    return error instanceof McpError || 
      (error && typeof error === 'object' && 'code' in error && 'message' in error);
  }

  static fromJSON(json: any): McpError {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid error JSON');
    }
    return new McpError(
      json.code,
      json.message,
      json.data
    );
  }
}

export function createError(code: ErrorCode, message: string, data?: any): McpError {
  return new McpError(code, message, data);
}

export const Errors = {
  ParseError: (message = 'Parse error') => 
    createError(ErrorCode.ParseError, message),
  
  InvalidRequest: (message = 'Invalid request') => 
    createError(ErrorCode.InvalidRequest, message),
  
  MethodNotFound: (message = 'Method not found') => 
    createError(ErrorCode.MethodNotFound, message),
  
  InvalidParams: (message = 'Invalid parameters') => 
    createError(ErrorCode.InvalidParams, message),
  
  InternalError: (message = 'Internal error') => 
    createError(ErrorCode.InternalError, message)
};
