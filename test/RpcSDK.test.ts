import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import RpcSDK from '../RpcSDK';

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
globalThis.fetch = mockFetch;

// Test interface
interface TestService {
  getUser(id: string): Promise<{ id: string; name: string }>;
  updateUser(id: string, data: { name: string }): Promise<{ id: string; name: string }>;
  deleteUser(id: string): Promise<void>;
  complexMethod(arg1: string, arg2: number, arg3: { nested: boolean }): Promise<string>;
}

describe('RpcSDK', () => {
  const mockLogger = vi.fn();
  const validOptions = {
    tenantId: 'test-tenant',
    apiKey: 'test-api-key',
    serverUrl: 'http://localhost:5000',
    logger: mockLogger,
    logReturnValues: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Constructor', () => {
    it('should create instance with valid options', () => {
      const sdk = new RpcSDK(validOptions);
      expect(sdk.getTenantId()).toBe('test-tenant');
      expect(sdk.getApiKey()).toBe('test-api-key');
      expect(sdk.getServerUrl()).toBe('http://localhost:5000');
    });

    it('should throw error if tenantId is missing', () => {
      const options = { ...validOptions };
      delete (options as any).tenantId;
      
      expect(() => new RpcSDK(options as any)).toThrow('tenantId is required');
    });

    it('should throw error if apiKey is missing', () => {
      const options = { ...validOptions };
      delete (options as any).apiKey;
      
      expect(() => new RpcSDK(options as any)).toThrow('apiKey is required');
    });

    it('should throw error if serverUrl is missing', () => {
      const options = { ...validOptions };
      delete (options as any).serverUrl;
      
      expect(() => new RpcSDK(options as any)).toThrow('serverUrl is required');
    });

    it('should use default logger if none provided', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const options = { ...validOptions };
      delete (options as any).logger;
      
      const sdk = new RpcSDK(options);
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', name: 'John' }),
      } as Response);
      
      proxy.getUser('123');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[RPC] Method: test-workflow.TestService.getUser, Args:',
        ['123']
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('createProxy', () => {
    let sdk: RpcSDK;

    beforeEach(() => {
      sdk = new RpcSDK(validOptions);
    });

    it('should throw error if workflow is missing', () => {
      expect(() => sdk.createProxy<TestService>('', 'TestService')).toThrow('workflow is required');
    });

    it('should make HTTP POST request with correct URL and parameters', async () => {
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', name: 'John' }),
      } as Response);

      await proxy.getUser('123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/user/rpc?workflow=test-workflow&procedureName=getUser&apikey=test-api-key&tenantId=test-tenant',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(['123']),
        }
      );
    });

    it('should serialize multiple arguments as JSON array', async () => {
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'success',
      } as Response);

      await proxy.complexMethod('arg1', 42, { nested: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('procedureName=complexMethod'),
        expect.objectContaining({
          body: JSON.stringify(['arg1', 42, { nested: true }]),
        })
      );
    });

    it('should handle successful response and return result', async () => {
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      const expectedResult = { id: '123', name: 'John' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      } as Response);

      const result = await proxy.getUser('123');
      
      expect(result).toEqual(expectedResult);
    });

    it('should throw error on failed HTTP response', async () => {
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(proxy.getUser('123')).rejects.toThrow('RPC call failed: 404 Not Found');
    });

    it('should throw error on network failure', async () => {
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(proxy.getUser('123')).rejects.toThrow('Network error');
    });

    it('should log method calls', async () => {
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', name: 'John' }),
      } as Response);

      await proxy.getUser('123');

      expect(mockLogger).toHaveBeenCalledWith(
        'test-workflow.TestService.getUser',
        ['123']
      );
    });

    it('should log return values when enabled', async () => {
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      const expectedResult = { id: '123', name: 'John' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      } as Response);

      await proxy.getUser('123');

      expect(mockLogger).toHaveBeenCalledWith(
        'test-workflow.TestService.getUser returned',
        [expectedResult]
      );
    });

    it('should log errors when request fails', async () => {
      const proxy = sdk.createProxy<TestService>('test-workflow', 'TestService');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      try {
        await proxy.getUser('123');
      } catch (error) {
        // Expected to throw
      }

      expect(mockLogger).toHaveBeenCalledWith(
        'test-workflow.TestService.getUser failed',
        [expect.any(Error)]
      );
    });

    it('should include namespace in method name when provided', async () => {
      const sdkWithNamespace = new RpcSDK({
        ...validOptions,
        namespace: 'MyApp',
      });
      
      const proxy = sdkWithNamespace.createProxy<TestService>('test-workflow', 'TestService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', name: 'John' }),
      } as Response);

      await proxy.getUser('123');

      expect(mockLogger).toHaveBeenCalledWith(
        'MyApp.test-workflow.TestService.getUser',
        ['123']
      );
    });

    it('should use custom onMethodCall handler when provided', async () => {
      const customHandler = vi.fn().mockReturnValue('custom-result');
      const sdkWithHandler = new RpcSDK({
        ...validOptions,
        onMethodCall: customHandler,
      });
      
      const proxy = sdkWithHandler.createProxy<TestService>('test-workflow', 'TestService');
      
      const result = await proxy.getUser('123');
      
      expect(customHandler).toHaveBeenCalledWith(
        'test-workflow.TestService.getUser',
        ['123']
      );
      expect(result).toBe('custom-result');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('URL Construction', () => {
    let sdk: RpcSDK;

    beforeEach(() => {
      sdk = new RpcSDK(validOptions);
    });

    it('should construct URL with special characters in workflow name', async () => {
      const proxy = sdk.createProxy<TestService>('default:Power of Attorney Agent v1.3.1:Document Data Flow', 'TestService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', name: 'John' }),
      } as Response);

      await proxy.getUser('123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/user/rpc?workflow=default%3APower+of+Attorney+Agent+v1.3.1%3ADocument+Data+Flow&procedureName=getUser&apikey=test-api-key&tenantId=test-tenant',
        expect.any(Object)
      );
    });

    it('should handle different server URLs', async () => {
      const sdkWithDifferentUrl = new RpcSDK({
        ...validOptions,
        serverUrl: 'https://api.example.com',
      });
      
      const proxy = sdkWithDifferentUrl.createProxy<TestService>('test-workflow', 'TestService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', name: 'John' }),
      } as Response);

      await proxy.getUser('123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/user/rpc?workflow=test-workflow&procedureName=getUser&apikey=test-api-key&tenantId=test-tenant',
        expect.any(Object)
      );
    });
  });


});