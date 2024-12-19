// Basic MCP types
export interface McpRequest<T = any> {
  jsonrpc: '2.0';
  method: string;
  params: T;
  id: string | number;
}

export interface McpResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: McpError;
  id: string | number;
}

export interface McpError {
  code: ErrorCode;
  message: string;
  data?: any;
}

export enum ErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603
}

// Server capabilities
export interface ServerCapabilities {
  tools?: boolean;
  resources?: boolean;
}

// Server info
export interface ServerInfo {
  name: string;
  version: string;
  capabilities?: ServerCapabilities;
}

// Tool schemas
export interface Tool {
  name: string;
  description: string;
  inputSchema: object;
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// Request schemas
export interface ListToolsRequest {
  type: 'list_tools';
}

export interface ListResourcesRequest {
  type: 'list_resources';
}

export interface CallToolRequest {
  type: 'call_tool';
  name: string;
  arguments: any;
}

export interface ReadResourceRequest {
  type: 'read_resource';
  uri: string;
}

// Response schemas
export interface ListToolsResponse {
  tools: Tool[];
}

export interface ListResourcesResponse {
  resources: Resource[];
}

export interface CallToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface ReadResourceResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text: string;
  }>;
}

// Memory types
export interface Memory {
  id: string;
  content: string;
  metadata: {
    timestamp: string;
    type: 'development' | 'conversation' | 'system';
    importance: number;
    context?: string;
    topics?: string[];
  };
  vector?: number[];
}

export interface MemoryContext {
  id: string;
  activeMemories: string[];
  metadata: {
    startTime: string;
    lastUpdate: string;
    type: string;
  };
}
