/**
 * RPC SDK for creating proxies of interfaces that log method calls
 */

/**
 * Type to extract method names from an interface
 */
type MethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Type to extract methods from an interface
 */
type Methods<T> = Pick<T, MethodNames<T>>;

/**
 * Configuration options for the RPC proxy
 */
export interface RpcProxyOptions {
  /**
   * Tenant ID for authentication
   */
  tenantId: string;
  
  /**
   * API Key for authentication
   */
  apiKey: string;
  
  /**
   * Server URL for RPC calls
   */
  serverUrl: string;
  
  /**
   * Custom logger function. Defaults to console.log
   */
  logger?: (methodName: string, args: any[]) => void;
  
  /**
   * Optional namespace/prefix for logging
   */
  namespace?: string;
  
  /**
   * Whether to log return values as well
   */
  logReturnValues?: boolean;
  
  /**
   * Custom method handler that gets called after logging
   */
  onMethodCall?: (methodName: string, args: any[]) => any;
}

/**
 * RPC SDK class for creating interface proxies
 */
export class RpcSDK {
  private options: RpcProxyOptions;

  constructor(options: RpcProxyOptions) {
    // Validate required fields
    if (!options.tenantId) {
      throw new Error('tenantId is required');
    }
    if (!options.apiKey) {
      throw new Error('apiKey is required');
    }
    if (!options.serverUrl) {
      throw new Error('serverUrl is required');
    }
    
    this.options = {
      logger: (methodName, args) => console.log(`[RPC] Method: ${methodName}, Args:`, args),
      ...options
    };
  }

  /**
   * Makes an HTTP POST request to the server
   */
  private async makeRpcCall(workflow: string, procedureName: string, args: any[]): Promise<any> {
    const url = new URL(`${this.options.serverUrl}/api/user/rpc`);
    url.searchParams.set('workflow', workflow);
    url.searchParams.set('procedureName', procedureName);
    url.searchParams.set('apikey', this.options.apiKey);
    url.searchParams.set('tenantId', this.options.tenantId);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`RPC call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Creates a proxy object that implements the given interface.
   * All method calls on the proxy will be logged and forwarded to the server.
   * 
   * @template T The interface type to proxy
   * @param workflow The workflow identifier
   * @param interfaceName Optional name for the interface (for logging purposes)
   * @returns A proxy object that implements interface T
   */
  createProxy<T extends object>(workflow: string, interfaceName?: string): T {
    if (!workflow) {
      throw new Error('workflow is required');
    }
    
    const handler: ProxyHandler<any> = {
      get: (target, prop: string | symbol) => {
        // Only intercept function calls
        if (typeof prop === 'string') {
          return async (...args: any[]) => {
            // Build the full method name for logging
            const fullMethodName = this.options.namespace 
              ? `${this.options.namespace}.${workflow}.${interfaceName || 'Interface'}.${prop}`
              : `${workflow}.${interfaceName || 'Interface'}.${prop}`;

            // Log the method call with tenant and workflow context
            if (this.options.logger) {
              this.options.logger(fullMethodName, args);
            }

            // If custom handler is provided, use it instead of making RPC call
            if (this.options.onMethodCall) {
              const result = this.options.onMethodCall(fullMethodName, args);
              
              // Log return value if enabled
              if (this.options.logReturnValues && this.options.logger) {
                this.options.logger(`${fullMethodName} returned`, [result]);
              }
              
              return result;
            }

            // Make RPC call to server
            try {
              const result = await this.makeRpcCall(workflow, prop, args);
              
              // Log return value if enabled
              if (this.options.logReturnValues && this.options.logger) {
                this.options.logger(`${fullMethodName} returned`, [result]);
              }
              
              return result;
            } catch (error) {
              if (this.options.logger) {
                this.options.logger(`${fullMethodName} failed`, [error]);
              }
              throw error;
            }
          };
        }
        
        return undefined;
      }
    };

    // Create an empty object and wrap it with a proxy
    return new Proxy({}, handler) as T;
  }

  /**
   * Creates a proxy with a specific implementation backing it.
   * Method calls will be logged before being forwarded to the implementation.
   * 
   * @template T The interface type to proxy
   * @param workflow The workflow identifier
   * @param implementation The actual implementation to forward calls to
   * @param interfaceName Optional name for the interface (for logging purposes)
   * @returns A proxy object that logs calls and forwards to the implementation
   */
  wrapImplementation<T extends object>(workflow: string, implementation: T, interfaceName?: string): T {
    if (!workflow) {
      throw new Error('workflow is required');
    }
    
    const handler: ProxyHandler<T> = {
      get: (target, prop: string | symbol) => {
        const value = target[prop as keyof T];
        
        // Only intercept function calls
        if (typeof value === 'function') {
          return (...args: any[]) => {
            // Build the full method name for logging
            const fullMethodName = this.options.namespace 
              ? `${this.options.namespace}.${workflow}.${interfaceName || 'Implementation'}.${String(prop)}`
              : `${workflow}.${interfaceName || 'Implementation'}.${String(prop)}`;

            // Log the method call with tenant and workflow context
            if (this.options.logger) {
              this.options.logger(fullMethodName, args);
            }

            // Call the actual implementation
            const result = value.apply(target, args);

            // Log return value if enabled
            if (this.options.logReturnValues && this.options.logger) {
              this.options.logger(`${fullMethodName} returned`, [result]);
            }

            return result;
          };
        }
        
        return value;
      }
    };

    return new Proxy(implementation, handler);
  }

  /**
   * Creates multiple proxies at once from a map of interfaces
   * 
   * @param workflow The workflow identifier
   * @param interfaces Map of interface names to create proxies for
   * @returns Map of interface names to their proxy objects
   */
  createProxies<T extends Record<string, any>>(workflow: string, interfaces: (keyof T)[]): { [K in keyof T]: T[K] } {
    if (!workflow) {
      throw new Error('workflow is required');
    }
    
    const proxies: any = {};
    
    for (const interfaceName of interfaces) {
      proxies[interfaceName] = this.createProxy(workflow, String(interfaceName));
    }
    
    return proxies;
  }
  
  /**
   * Get the tenant ID
   */
  getTenantId(): string {
    return this.options.tenantId;
  }
  
  /**
   * Get the API key
   */
  getApiKey(): string {
    return this.options.apiKey;
  }
  
  /**
   * Get the server URL
   */
  getServerUrl(): string {
    return this.options.serverUrl;
  }
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Define your interface
 * interface UserService {
 *   getUser(id: string): Promise<User>;
 *   updateUser(id: string, data: Partial<User>): Promise<User>;
 *   deleteUser(id: string): Promise<void>;
 * }
 * 
 * // Create RPC SDK instance with authentication and server URL
 * const rpcSDK = new RpcSDK({
 *   tenantId: 'my-tenant-123',
 *   apiKey: 'sk-1234567890',
 *   serverUrl: 'http://localhost:5000',
 *   namespace: 'MyApp',
 *   logReturnValues: true,
 *   logger: (method, args) => {
 *     console.log(`🔵 RPC Call: ${method}`, args);
 *   }
 * });
 * 
 * // Create a proxy for your interface with workflow
 * const userServiceProxy = rpcSDK.createProxy<UserService>('user-workflow', 'UserService');
 * 
 * // When you call methods, they will be logged and sent to the server
 * await userServiceProxy.getUser('123'); 
 * // Logs: 🔵 RPC Call: MyApp.user-workflow.UserService.getUser ['123']
 * // Makes POST to: http://localhost:5000/api/user/rpc?workflow=user-workflow&procedureName=getUser&apikey=sk-1234567890&tenantId=my-tenant-123
 * // Body: ["123"]
 * 
 * await userServiceProxy.updateUser('123', { name: 'John' });
 * // Logs: 🔵 RPC Call: MyApp.user-workflow.UserService.updateUser ['123', { name: 'John' }]
 * // Makes POST to: http://localhost:5000/api/user/rpc?workflow=user-workflow&procedureName=updateUser&apikey=sk-1234567890&tenantId=my-tenant-123
 * // Body: ["123", { "name": "John" }]
 * ```
 */

export default RpcSDK; 