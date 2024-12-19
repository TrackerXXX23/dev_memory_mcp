import { 
  McpRequest, 
  McpResponse, 
  ServerInfo,
  ListToolsRequest,
  ListResourcesRequest,
  CallToolRequest,
  ReadResourceRequest,
  Tool,
  Resource
} from './types.js';
import { McpError, Errors } from './errors.js';
import { randomUUID } from 'crypto';

export type RequestHandler<T = any, R = any> = (request: McpRequest<T>) => Promise<R>;

export class Server {
  private handlers: Map<string, RequestHandler> = new Map();
  private info: ServerInfo;
  private transport: Transport | null = null;

  constructor(info: ServerInfo) {
    this.info = info;
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers() {
    // List available tools
    this.setRequestHandler('list_tools', async () => ({
      tools: Array.from(this.handlers.entries())
        .filter(([method]) => method.startsWith('tool:'))
        .map(([method]) => ({
          name: method.replace('tool:', ''),
          description: 'Tool description',
          inputSchema: {}
        }))
    }));

    // List available resources
    this.setRequestHandler('list_resources', async () => ({
      resources: Array.from(this.handlers.entries())
        .filter(([method]) => method.startsWith('resource:'))
        .map(([method]) => ({
          uri: method.replace('resource:', ''),
          name: 'Resource name',
          description: 'Resource description'
        }))
    }));
  }

  public setRequestHandler<T = any, R = any>(method: string, handler: RequestHandler<T, R>) {
    this.handlers.set(method, handler);
  }

  public async handleRequest(request: McpRequest): Promise<McpResponse> {
    try {
      if (!request.jsonrpc || request.jsonrpc !== '2.0') {
        throw Errors.InvalidRequest('Invalid JSON-RPC version');
      }

      if (!request.method || typeof request.method !== 'string') {
        throw Errors.InvalidRequest('Invalid method');
      }

      // Generate a request ID if none provided
      const requestId = request.id ?? randomUUID();

      const handler = this.handlers.get(request.method);
      if (!handler) {
        throw Errors.MethodNotFound(`Method not found: ${request.method}`);
      }

      const result = await handler(request);
      return {
        jsonrpc: '2.0',
        result,
        id: requestId
      };
    } catch (error) {
      if (McpError.isInstance(error)) {
        return {
          jsonrpc: '2.0',
          error: error.toJSON(),
          id: request.id ?? randomUUID()
        };
      }

      return {
        jsonrpc: '2.0',
        error: Errors.InternalError(error instanceof Error ? error.message : 'Internal error').toJSON(),
        id: request.id ?? randomUUID()
      };
    }
  }

  public async connect(transport: Transport) {
    this.transport = transport;
    await transport.connect(this.handleRequest.bind(this));
  }

  public async close() {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }
}

export interface Transport {
  connect(handler: (request: McpRequest) => Promise<McpResponse>): Promise<void>;
  close(): Promise<void>;
}

export class StdioTransport implements Transport {
  private handler: ((request: McpRequest) => Promise<McpResponse>) | null = null;
  private requestId = 0;

  async connect(handler: (request: McpRequest) => Promise<McpResponse>) {
    this.handler = handler;

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data) => {
      try {
        const request = JSON.parse(data.toString()) as McpRequest;
        const response = await this.handler!(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        const response: McpResponse = {
          jsonrpc: '2.0',
          error: Errors.ParseError(error instanceof Error ? error.message : 'Parse error').toJSON(),
          id: String(this.requestId++)
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    });

    // Handle process termination
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  async close() {
    this.handler = null;
    process.stdin.removeAllListeners();
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  }
}
