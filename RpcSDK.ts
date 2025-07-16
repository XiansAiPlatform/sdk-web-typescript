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
   * API Key for authentication (required if getJwtToken is not provided)
   */
  apiKey?: string;
  
  /**
   * JWT Token for authentication (optional, used as fallback if getJwtToken fails)
   */
  jwtToken?: string;
  
  /**
   * Function to get JWT token - called for every request when using JWT authentication
   * If provided, this takes precedence over the static jwtToken
   */
  getJwtToken?: () => Promise<string> | string;
  
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
    if (!options.apiKey && !options.getJwtToken && !options.jwtToken) {
      throw new Error('Either apiKey, jwtToken, or getJwtToken callback is required');
    }
    if (options.apiKey && (options.jwtToken || options.getJwtToken)) {
      throw new Error('Cannot provide apiKey with jwtToken or getJwtToken. Please use only one authentication method.');
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
    url.searchParams.set('tenantId', this.options.tenantId);
    
    let authToken: string;
    
    if (this.options.apiKey) {
      authToken = this.options.apiKey;
      url.searchParams.set('apikey', authToken);
    } else if (this.options.getJwtToken) {
      // Always call getJwtToken() to get a fresh token
      try {
        authToken = await this.options.getJwtToken();
        url.searchParams.set('jwtToken', authToken);
      } catch (error) {
        if (this.options.logger) {
          this.options.logger('Failed to get JWT token', [error]);
        }
        throw new Error(`Failed to get JWT token: ${error}`);
      }
    } else if (this.options.jwtToken) {
      authToken = this.options.jwtToken;
      url.searchParams.set('jwtToken', authToken);
    } else {
      throw new Error('No authentication method available');
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
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
   * Updates the API key (switches to API key authentication)
   */
  updateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error('apiKey cannot be empty');
    }
    this.options.apiKey = apiKey;
    this.options.jwtToken = undefined;
  }

  /**
   * Updates the JWT token (switches to JWT token authentication)
   */
  updateJwtToken(jwtToken: string): void {
    if (!jwtToken) {
      throw new Error('jwtToken cannot be empty');
    }
    this.options.jwtToken = jwtToken;
    this.options.apiKey = undefined;
  }

  /**
   * Get the tenant ID
   */
  getTenantId(): string {
    return this.options.tenantId;
  }
  
  /**
   * Get the API key (returns undefined if using JWT token)
   */
  getApiKey(): string | undefined {
    return this.options.apiKey;
  }
  
  /**
   * Get the JWT token (returns undefined if using API key)
   */
  getJwtToken(): string | undefined {
    return this.options.jwtToken;
  }
  
  /**
   * Get the authentication type being used
   */
  getAuthType(): 'apiKey' | 'jwtToken' | 'jwtCallback' {
    if (this.options.apiKey) return 'apiKey';
    if (this.options.getJwtToken) return 'jwtCallback';
    return 'jwtToken';
  }
  
  /**
   * Get the authentication token (for static tokens only)
   * Returns undefined if using callback-based JWT authentication
   */
  getAuthToken(): string | undefined {
    return this.options.apiKey || this.options.jwtToken;
  }
  
  /**
   * Check if using callback-based JWT authentication
   */
  isUsingJwtCallback(): boolean {
    return !!this.options.getJwtToken;
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
 * // Option 1: Create RPC SDK instance with API key authentication
 * const rpcSDKWithApiKey = new RpcSDK({
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
 * // Option 2: Create RPC SDK instance with static JWT token authentication
 * const rpcSDKWithJWT = new RpcSDK({
 *   tenantId: 'my-tenant-123',
 *   jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   serverUrl: 'http://localhost:5000',
 *   namespace: 'MyApp',
 *   logReturnValues: true,
 *   logger: (method, args) => {
 *     console.log(`🔵 RPC Call: ${method}`, args);
 *   }
 * });
 * 
 * // Option 3: Create RPC SDK instance with callback-based JWT authentication (recommended)
 * const rpcSDKWithCallback = new RpcSDK({
 *   tenantId: 'my-tenant-123',
 *   serverUrl: 'http://localhost:5000',
 *   getJwtToken: async () => {
 *     // This is called for every request, so always fresh token
 *     const response = await fetch('/api/auth/token');
 *     const { token } = await response.json();
 *     return token;
 *   },
 *   namespace: 'MyApp',
 *   logReturnValues: true,
 *   logger: (method, args) => {
 *     console.log(`🔵 RPC Call: ${method}`, args);
 *   }
 * });
 * 
 * // Create a proxy for your interface with workflow (works with all auth methods)
 * const userServiceProxy = rpcSDKWithCallback.createProxy<UserService>('user-workflow', 'UserService');
 * 
 * // When you call methods, they will be logged and sent to the server
 * await userServiceProxy.getUser('123'); 
 * // Fresh token is fetched automatically for each call
 * 
 * // Check authentication type
 * console.log(`Using ${rpcSDKWithApiKey.getAuthType()} authentication`); // "apiKey"
 * console.log(`Using ${rpcSDKWithJWT.getAuthType()} authentication`); // "jwtToken"
 * console.log(`Using ${rpcSDKWithCallback.getAuthType()} authentication`); // "jwtCallback"
 * console.log(`Is using callback? ${rpcSDKWithCallback.isUsingJwtCallback()}`); // true
 * 
 * // Dynamic token updates (for static tokens only)
 * rpcSDKWithJWT.updateJwtToken('new-jwt-token-here');
 * ```
 */

export default RpcSDK;