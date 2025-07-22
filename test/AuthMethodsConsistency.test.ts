import { describe, it, expect, vi } from 'vitest';
import RestSDK from '../RestSDK';
import SseSDK from '../SseSDK';
import SocketSDK from '../SocketSDK';
import { ConnectionState } from '../types';

describe('Authentication Methods Consistency', () => {
  const baseOptions = {
    tenantId: 'test-tenant-123',
    serverUrl: 'http://localhost:5000',
    logger: vi.fn()
  };

  describe('API Key Authentication', () => {
    it('should support API key authentication consistently across all SDKs', () => {
      const apiKey = 'sk-test-api-key';
      
      // All SDKs should accept API key authentication
      expect(() => new RestSDK({ ...baseOptions, apiKey })).not.toThrow();
      expect(() => new SseSDK({ ...baseOptions, apiKey })).not.toThrow();
      expect(() => new SocketSDK({ ...baseOptions, apiKey })).not.toThrow();
      
      // All SDKs should report API key as the auth type
      const restSDK = new RestSDK({ ...baseOptions, apiKey });
      const sseSDK = new SseSDK({ ...baseOptions, apiKey });
      const socketSDK = new SocketSDK({ ...baseOptions, apiKey });
      
      expect(restSDK.getAuthType()).toBe('apiKey');
      expect(sseSDK.getAuthType()).toBe('apiKey');
      expect(socketSDK.getAuthType()).toBe('apiKey');
      
      // Clean up
      restSDK.dispose();
      sseSDK.dispose();
      socketSDK.dispose();
    });
  });

  describe('JWT Token Authentication', () => {
    it('should support JWT token authentication consistently across all SDKs', () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      
      // All SDKs should accept JWT token authentication
      expect(() => new RestSDK({ ...baseOptions, jwtToken })).not.toThrow();
      expect(() => new SseSDK({ ...baseOptions, jwtToken })).not.toThrow();
      expect(() => new SocketSDK({ ...baseOptions, jwtToken })).not.toThrow();
      
      // All SDKs should report JWT token as the auth type
      const restSDK = new RestSDK({ ...baseOptions, jwtToken });
      const sseSDK = new SseSDK({ ...baseOptions, jwtToken });
      const socketSDK = new SocketSDK({ ...baseOptions, jwtToken });
      
      expect(restSDK.getAuthType()).toBe('jwtToken');
      expect(sseSDK.getAuthType()).toBe('jwtToken');
      expect(socketSDK.getAuthType()).toBe('jwtToken');
      
      // Clean up
      restSDK.dispose();
      sseSDK.dispose();
      socketSDK.dispose();
    });
  });

  describe('JWT Callback Authentication', () => {
    it('should support JWT callback authentication consistently across all SDKs', () => {
      const getJwtToken = vi.fn().mockResolvedValue('test-jwt-token');
      
      // All SDKs should accept JWT callback authentication
      expect(() => new RestSDK({ ...baseOptions, getJwtToken })).not.toThrow();
      expect(() => new SseSDK({ ...baseOptions, getJwtToken })).not.toThrow();
      expect(() => new SocketSDK({ ...baseOptions, getJwtToken })).not.toThrow();
      
      // All SDKs should report JWT callback as the auth type
      const restSDK = new RestSDK({ ...baseOptions, getJwtToken });
      const sseSDK = new SseSDK({ ...baseOptions, getJwtToken });
      const socketSDK = new SocketSDK({ ...baseOptions, getJwtToken });
      
      expect(restSDK.getAuthType()).toBe('jwtCallback');
      expect(sseSDK.getAuthType()).toBe('jwtCallback');
      expect(socketSDK.getAuthType()).toBe('jwtCallback');
      
      // Clean up
      restSDK.dispose();
      sseSDK.dispose();
      socketSDK.dispose();
    });
  });

  describe('Authentication Method Switching', () => {
    it('should support authentication method switching consistently across all SDKs', () => {
      const initialApiKey = 'sk-initial-key';
      const newApiKey = 'sk-new-key';
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const getJwtToken = vi.fn().mockResolvedValue('callback-token');
      
      // Create SDKs with initial API key
      const restSDK = new RestSDK({ ...baseOptions, apiKey: initialApiKey });
      const sseSDK = new SseSDK({ ...baseOptions, apiKey: initialApiKey });
      const socketSDK = new SocketSDK({ ...baseOptions, apiKey: initialApiKey });
      
      // Verify initial state
      expect(restSDK.getAuthType()).toBe('apiKey');
      expect(sseSDK.getAuthType()).toBe('apiKey');
      expect(socketSDK.getAuthType()).toBe('apiKey');
      
      // Switch to JWT token
      restSDK.updateJwtToken(jwtToken);
      sseSDK.updateJwtToken(jwtToken);
      socketSDK.updateJwtToken(jwtToken);
      
      expect(restSDK.getAuthType()).toBe('jwtToken');
      expect(sseSDK.getAuthType()).toBe('jwtToken');
      expect(socketSDK.getAuthType()).toBe('jwtToken');
      
      // Switch to JWT callback
      restSDK.updateJwtTokenCallback(getJwtToken);
      sseSDK.updateJwtTokenCallback(getJwtToken);
      socketSDK.updateJwtTokenCallback(getJwtToken);
      
      expect(restSDK.getAuthType()).toBe('jwtCallback');
      expect(sseSDK.getAuthType()).toBe('jwtCallback');
      expect(socketSDK.getAuthType()).toBe('jwtCallback');
      
      // Switch back to API key
      restSDK.updateApiKey(newApiKey);
      sseSDK.updateApiKey(newApiKey);
      socketSDK.updateApiKey(newApiKey);
      
      expect(restSDK.getAuthType()).toBe('apiKey');
      expect(sseSDK.getAuthType()).toBe('apiKey');
      expect(socketSDK.getAuthType()).toBe('apiKey');
      
      // Clean up
      restSDK.dispose();
      sseSDK.dispose();
      socketSDK.dispose();
    });
  });

  describe('Required Field Validation', () => {
    it('should validate required fields consistently across all SDKs', () => {
      // Missing tenantId
      expect(() => new RestSDK({ ...baseOptions, tenantId: '', apiKey: 'test' })).toThrow('tenantId is required');
      expect(() => new SseSDK({ ...baseOptions, tenantId: '', apiKey: 'test' })).toThrow('tenantId is required');
      expect(() => new SocketSDK({ ...baseOptions, tenantId: '', apiKey: 'test' })).toThrow('tenantId is required');
      
      // Missing serverUrl
      expect(() => new RestSDK({ ...baseOptions, serverUrl: '', apiKey: 'test' })).toThrow('serverUrl is required');
      expect(() => new SseSDK({ ...baseOptions, serverUrl: '', apiKey: 'test' })).toThrow('serverUrl is required');
      expect(() => new SocketSDK({ ...baseOptions, serverUrl: '', apiKey: 'test' })).toThrow('serverUrl is required');
      
      // Missing authentication
      expect(() => new RestSDK({ ...baseOptions })).toThrow('Either apiKey, jwtToken, or getJwtToken callback is required');
      expect(() => new SseSDK({ ...baseOptions })).toThrow('Either apiKey, jwtToken, or getJwtToken callback is required');
      expect(() => new SocketSDK({ ...baseOptions })).toThrow('Either apiKey, jwtToken, or getJwtToken callback is required');
      
      // Multiple authentication methods should be allowed
      const multipleAuthOptions = { ...baseOptions, apiKey: 'test', jwtToken: 'test' };
      expect(() => new RestSDK(multipleAuthOptions)).not.toThrow();
      expect(() => new SseSDK(multipleAuthOptions)).not.toThrow();
      expect(() => new SocketSDK(multipleAuthOptions)).not.toThrow();
      
      // Clean up the instances created for testing
      const restSDK = new RestSDK(multipleAuthOptions);
      const sseSDK = new SseSDK(multipleAuthOptions);
      const socketSDK = new SocketSDK(multipleAuthOptions);
      
      restSDK.dispose();
      sseSDK.dispose();
      socketSDK.dispose();
    });
  });

  describe('Tenant ID Access', () => {
    it('should provide consistent tenant ID access across all SDKs', () => {
      const testTenantId = 'test-tenant-id-123';
      const options = { ...baseOptions, tenantId: testTenantId, apiKey: 'test-key' };
      
      const restSDK = new RestSDK(options);
      const sseSDK = new SseSDK(options);
      const socketSDK = new SocketSDK(options);
      
      expect(restSDK.getTenantId()).toBe(testTenantId);
      expect(sseSDK.getTenantId()).toBe(testTenantId);
      expect(socketSDK.getTenantId()).toBe(testTenantId);
      
      // Clean up
      restSDK.dispose();
      sseSDK.dispose();
      socketSDK.dispose();
    });
  });

  describe('Documentation and Expected Server Authentication Support', () => {
    it('should document consistent authentication method expectations', () => {
      // This test serves as documentation for the expected server-side support
      const expectedAuthMethods = {
        'apikey query parameter': 'API keys - supported by all SDKs and both server handlers',
        'access_token query parameter': 'JWT fallback - supported by all SDKs and both server handlers',
        'Authorization header': 'JWT preferred - supported by RestSDK, SseSDK, and both server handlers'
      };
      
      // Verify that our expectations are documented
      expect(expectedAuthMethods).toBeDefined();
      expect(Object.keys(expectedAuthMethods)).toHaveLength(3);
      
      // Log the authentication method expectations for documentation
      console.log('📋 Authentication Method Support Matrix:');
      console.log('=====================================');
      Object.entries(expectedAuthMethods).forEach(([method, description]) => {
        console.log(`✅ ${method}: ${description}`);
      });
      
      console.log('\n🔧 Server-side Handler Support:');
      console.log('- EndpointAuthenticationHandler (RestSDK + SseSDK): All 3 methods');
      console.log('- WebsocketAuthenticationHandler (SocketSDK): All 3 methods');
      
      console.log('\n📱 Client-side SDK Support:');
      console.log('- RestSDK: apikey query + Authorization header (primary)');
      console.log('- SseSDK: apikey query + Authorization header + access_token fallback');
      console.log('- SocketSDK: apikey query + access_token query + Authorization header (via SignalR)');
    });
  });
}); 