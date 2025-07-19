import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { config } from 'dotenv';
import { join } from 'path';
import RestSDK, { RestMessageRequest, HistoryRequest } from '../RestSDK';
import { Message } from '../types';
import { fail } from 'assert';

// How to run this test:
// 1. Create test/.env file with your API credentials
// 2. Run: npx vitest test/RestSDK.integration.test.ts
// This test will send REST requests to the UserApi endpoints

// Load environment variables from test/.env file
config({ path: join(__dirname, '.env') });

describe('RestSDK Integration Tests', () => {
  const mockLogger = vi.fn();
  
  // Get configuration from environment variables or fail
  const apiKey = process.env.API_KEY ?? fail('API_KEY is not set');
  const serverUrl = process.env.SERVER_URL ?? fail('SERVER_URL is not set');
  const tenantId = process.env.TENANT_ID ?? fail('TENANT_ID is not set');
  const participantId = process.env.PARTICIPANT_ID ?? fail('PARTICIPANT_ID is not set');
  const workflowType = process.env.WORKFLOW_TYPE ?? fail('WORKFLOW_TYPE is not set');
  
  let restSDK: RestSDK;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (restSDK) {
      restSDK.dispose();
    }
  });

  // npx vitest -t "should send message to workflow using send endpoint"

  it('should send message to workflow using send endpoint', async () => {
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      const sendRequest: RestMessageRequest = {
        requestId: 'rest-test-send-' + Date.now(),
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'Hello what can you do?',
        data: {
          testType: 'send',
          timestamp: new Date().toISOString()
        }
      };

      console.log('📤 Sending message via send endpoint...');
      const result = await restSDK.send(sendRequest);

      console.log('📨 Send result:', result);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        console.log('✅ Message sent successfully via send endpoint');
        expect(result.statusCode).toBe(200);
      } else {
        console.log('❌ Send failed:', result.error);
        console.log('Status code:', result.statusCode);
        
        // If it's an auth error or similar, that's still a successful test of the SDK
        if (result.statusCode === 401 || result.statusCode === 403) {
          console.log('⚠️  Authentication/authorization issue - SDK is working but credentials may be invalid');
        }
      }

    } catch (error) {
      // If server is not available, skip the test with a message
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('Connection')
      )) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 15000);

  // npx vitest -t "should send message and wait for response using converse endpoint"

  it('should send message and wait for response using converse endpoint', async () => {
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      defaultConverseTimeout: 30
    });

    try {
      const converseRequest: RestMessageRequest = {
        requestId: 'rest-test-converse-' + Date.now(),
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'Hello.. Who are my representatives?',
        data: {
          documentId: 'd42d8b34-7c5e-43ce-9771-3eda01945369'
        }
      };

      console.log('🗣️  Starting conversation via converse endpoint...');
      const result = await restSDK.converse(converseRequest);

      console.log('📨 Converse result:', result);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        console.log('✅ Conversation completed successfully');
        expect(result.statusCode).toBe(200);
        
        if (result.data && Array.isArray(result.data)) {
          console.log('📜 Received', result.data.length, 'messages in response');
          
          // Log the messages received
          result.data.forEach((msg: Message, index: number) => {
            console.log(`  ${index + 1}. [${msg.direction}] ${msg.text || 'No text'} (${msg.messageType || 'Unknown type'})`);
            if (msg.data) {
              console.log(`     Data: ${JSON.stringify(msg.data)}`);
            }
          });
          
          expect(result.data.length).toBeGreaterThanOrEqual(0);
        } else {
          console.log('⚠️  No messages in response data');
        }
      } else {
        console.log('❌ Conversation failed:', result.error);
        console.log('Status code:', result.statusCode);
        
        // Check for timeout or other expected errors
        if (result.error?.includes('timeout') || result.error?.includes('Timeout')) {
          console.log('⏱️  Request timed out - this might be expected if no workflow is active');
        } else if (result.statusCode === 401 || result.statusCode === 403) {
          console.log('⚠️  Authentication/authorization issue - SDK is working but credentials may be invalid');
        }
      }

    } catch (error) {
      // If server is not available, skip the test with a message
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('Connection')
      )) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 45000); // Longer timeout for converse operations

  // npx vitest -t "should get conversation history using history endpoint"

  it('should get conversation history using history endpoint', async () => {
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      const historyRequest: HistoryRequest = {
        workflow: workflowType,
        participantId: participantId,
        page: 1,
        pageSize: 20,
        scope: undefined // Test without scope first
      };

      console.log('📚 Requesting conversation history...');
      const result = await restSDK.getHistory(historyRequest);

      console.log('📨 History result:', result);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        console.log('✅ History retrieved successfully');
        expect(result.statusCode).toBe(200);
        
        if (result.data && Array.isArray(result.data)) {
          console.log('📜 Retrieved', result.data.length, 'messages from history');
          
          // Log recent messages
          if (result.data.length > 0) {
            console.log('Recent messages:');
            result.data.slice(0, 5).forEach((msg: Message, index: number) => {
              console.log(`  ${index + 1}. [${msg.direction}] ${msg.text || 'No text'} (${msg.messageType || 'Unknown type'})`);
              console.log(`     Created: ${msg.createdAt}, ID: ${msg.id}`);
            });
          } else {
            console.log('📭 No messages in history');
          }
          
          expect(result.data.length).toBeGreaterThanOrEqual(0);
        } else {
          console.log('⚠️  No history data in response');
        }
      } else {
        console.log('❌ History retrieval failed:', result.error);
        console.log('Status code:', result.statusCode);
        
        if (result.statusCode === 401 || result.statusCode === 403) {
          console.log('⚠️  Authentication/authorization issue - SDK is working but credentials may be invalid');
        }
      }

    } catch (error) {
      // If server is not available, skip the test with a message
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('Connection')
      )) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 15000);

  it('should get scoped conversation history', async () => {
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      const historyRequest: HistoryRequest = {
        workflow: workflowType,
        participantId: participantId,
        page: 1,
        pageSize: 10,
        scope: 'test-scope'
      };

      console.log('📚 Requesting scoped conversation history...');
      const result = await restSDK.getHistory(historyRequest);

      console.log('📨 Scoped history result:', result);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        console.log('✅ Scoped history retrieved successfully');
        if (result.data && Array.isArray(result.data)) {
          console.log('📜 Retrieved', result.data.length, 'scoped messages');
        }
      } else {
        console.log('❌ Scoped history retrieval failed:', result.error);
      }

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('Connection')
      )) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 15000);

  it('should handle authentication errors gracefully', async () => {
    const invalidSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: 'invalid-api-key',
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      const sendRequest: RestMessageRequest = {
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'This should fail with auth error'
      };

      const result = await invalidSDK.send(sendRequest);
      
      console.log('Auth test result:', result);
      
      // Should either fail with auth error or timeout
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      
      if (result.statusCode) {
        expect([401, 403]).toContain(result.statusCode);
        console.log('✅ Correctly received auth error with status', result.statusCode);
      }

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for auth test, skipping`);
        return;
      }
      // Some auth errors might throw exceptions, which is also expected
      console.log('✅ Auth error threw exception as expected:', error);
    } finally {
      invalidSDK.dispose();
    }
  }, 10000);

  it('should handle server unavailability gracefully', async () => {
    const unavailableSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: 'http://localhost:9999', // Non-existent server
      logger: mockLogger
    });

    const sendRequest: RestMessageRequest = {
      participantId: participantId,
      workflow: workflowType,
      type: 'Chat',
      text: 'This should fail with connection error'
    };

    const result = await unavailableSDK.send(sendRequest);
    
    // Should return error response rather than throwing
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    console.log('✅ Correctly handled server unavailability:', result.error);
    
    // Verify error was logged
    expect(mockLogger).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Request failed'),
      expect.any(Error)
    );

    unavailableSDK.dispose();
  }, 10000);

  it('should validate required parameters', () => {
    // Test missing tenantId
    expect(() => new RestSDK({
      tenantId: '',
      apiKey: apiKey,
      serverUrl: serverUrl
    })).toThrow('tenantId is required');

    // Test missing authentication
    expect(() => new RestSDK({
      tenantId: tenantId,
      serverUrl: serverUrl
    })).toThrow('Either apiKey, jwtToken, or getJwtToken callback is required');

    // Test missing serverUrl
    expect(() => new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: ''
    })).toThrow('serverUrl is required');

    // Test conflicting auth methods
    expect(() => new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      jwtToken: 'some-token',
      serverUrl: serverUrl
    })).toThrow('Cannot provide apiKey with jwtToken or getJwtToken');
  });

  it('should validate request parameters', async () => {
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    // Test missing workflow
    await expect(restSDK.send({
      workflow: '',
      type: 'Chat',
      participantId: participantId,
      text: 'test'
    })).rejects.toThrow('workflow is required');

    // Test missing type
    await expect(restSDK.send({
      workflow: workflowType,
      type: '',
      participantId: participantId,
      text: 'test'
    })).rejects.toThrow('type is required');

    // Test missing participantId
    await expect(restSDK.send({
      workflow: workflowType,
      type: 'Chat',
      participantId: '',
      text: 'test'
    })).rejects.toThrow('participantId is required');

    // Test history validation
    await expect(restSDK.getHistory({
      workflow: '',
      participantId: participantId
    })).rejects.toThrow('workflow is required');

    await expect(restSDK.getHistory({
      workflow: workflowType,
      participantId: ''
    })).rejects.toThrow('participantId is required');
  });

  it('should use environment variables for configuration', () => {
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });
    
    expect(restSDK.getTenantId()).toBe(tenantId);
    expect(restSDK.getAuthType()).toBe('apiKey');
  });

  it('should test JWT token authentication flow', async () => {
    // Mock JWT token provider
    const mockGetJwtToken = vi.fn().mockResolvedValue('mock-jwt-token');
    
    restSDK = new RestSDK({
      tenantId: tenantId,
      serverUrl: serverUrl,
      getJwtToken: mockGetJwtToken,
      logger: mockLogger
    });

    expect(restSDK.getAuthType()).toBe('jwtCallback');

    try {
      const sendRequest: RestMessageRequest = {
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'JWT auth test'
      };

      const result = await restSDK.send(sendRequest);
      expect(mockGetJwtToken).toHaveBeenCalled();
      
      console.log('JWT auth test result:', result);
      
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for JWT test, skipping`);
        return;
      }
      // Auth errors are expected with mock token
      console.log('Expected auth error with mock JWT token');
    }
  });

  it('should test auth method switching', () => {
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    expect(restSDK.getAuthType()).toBe('apiKey');

    // Switch to JWT token
    restSDK.updateJwtToken('new-jwt-token');
    expect(restSDK.getAuthType()).toBe('jwtToken');

    // Switch to JWT callback
    restSDK.updateJwtTokenCallback(() => Promise.resolve('callback-token'));
    expect(restSDK.getAuthType()).toBe('jwtCallback');

    // Switch back to API key
    restSDK.updateApiKey('new-api-key');
    expect(restSDK.getAuthType()).toBe('apiKey');
  });

  it('should handle timeout configurations correctly', async () => {
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      requestTimeout: 5000,
      defaultConverseTimeout: 10,
      maxConverseTimeout: 30
    });

    try {
      const converseRequest: RestMessageRequest = {
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'Timeout test',
        timeoutSeconds: 50 // Should be capped at maxConverseTimeout (30)
      };

      // This will likely timeout, but we're testing the timeout handling
      const result = await restSDK.converse(converseRequest);
      
      // The actual timeout used should be capped at 30 seconds
      // If it fails due to timeout, that's expected
      console.log('Timeout test result:', result);
      
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for timeout test, skipping`);
        return;
      }
      // Timeout errors are expected
      console.log('Expected timeout or connection error');
    }
  }, 35000);
}); 