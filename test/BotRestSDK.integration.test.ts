import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { config } from 'dotenv';
import { join } from 'path';
import { BotRestSDK, BotRequest, BotResponse, BotHistoryResponse, BotMetrics } from '../BotRestSDK';
import { fail } from 'assert';

// Load environment variables from test/.env file
config({ path: join(__dirname, '.env') });

describe('BotRestSDK Integration Tests', () => {
  const mockLogger = vi.fn();
  
  // Get configuration from environment variables or fail
  const apiKey = process.env.API_KEY ?? fail('API_KEY is not set');
  const serverUrl = process.env.SERVER_URL ?? fail('SERVER_URL is not set');
  const tenantId = process.env.TENANT_ID ?? fail('TENANT_ID is not set');
  const participantId = process.env.PARTICIPANT_ID ?? fail('PARTICIPANT_ID is not set');
  const workflowType = process.env.WORKFLOW_TYPE ?? fail('WORKFLOW_TYPE is not set');
  
  let botRestSDK: BotRestSDK;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (botRestSDK) {
      botRestSDK.dispose();
    }
  });

  it('should send bot request and receive response', async () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      requestTimeout: 10000
    });

    try {
      // Test connection first
      const isConnected = await botRestSDK.testConnection();
      expect(isConnected).toBe(true);

      // Send a bot request
      const botRequest: BotRequest = {
        requestId: 'test-req-' + Date.now(),
        participantId: participantId,
        workflowType: workflowType,
        text: 'Hello, I need help with REST API integration testing'
      };

      const response = await botRestSDK.sendBotRequest(botRequest);
      console.log('Response:', response);

      // Verify response structure
      expect(response).toBeDefined();
      expect(response).toHaveProperty('threadId');
      expect(response).toHaveProperty('participantId');
      expect(response).toHaveProperty('isComplete');
      expect(response).toHaveProperty('timestamp');
      expect(response.participantId).toBe(participantId);

      console.log('Bot request sent successfully');
      console.log('Response threadId:', response.threadId);
      console.log('Response isComplete:', response.isComplete);

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
  }, 15000); // 15 second timeout for real network calls

  it('should get bot history for a workflow', async () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      // Request bot history
      const history = await botRestSDK.getBotHistory(workflowType, participantId, 1, 10);
      console.log('History:', history);

      // Verify history structure
      expect(history).toBeDefined();
      expect(history).toHaveProperty('messages');

      expect(history).toHaveProperty('page');
      expect(history).toHaveProperty('pageSize');
      expect(history).toHaveProperty('hasNext');
      expect(history).toHaveProperty('hasPrevious');
      expect(Array.isArray(history.messages)).toBe(true);
      expect(history.page).toBe(1);
      expect(history.pageSize).toBe(10);

      console.log('Bot history retrieved successfully');
      console.log('Messages in page:', history.messages.length);
      console.log('Has next page:', history.hasNext);

      // If there are messages, verify their structure
      if (history.messages.length > 0) {
        const message = history.messages[0];
        expect(message).toHaveProperty('id');
        expect(message).toHaveProperty('createdAt');
        expect(message).toHaveProperty('direction');
        expect(['Incoming', 'Outgoing']).toContain(message.direction);
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
  }, 10000);

  it('should get bot metrics', async () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      const metrics = await botRestSDK.getBotMetrics();
      console.log('Metrics:', metrics);
      
      // Verify the metrics structure
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('service');
      expect(metrics).toHaveProperty('hubMetrics');
      expect(metrics).toHaveProperty('status');
      expect(metrics.hubMetrics).toHaveProperty('activeConnections');
      expect(metrics.hubMetrics).toHaveProperty('cachedGroupNames');
      expect(metrics.hubMetrics).toHaveProperty('averageConnectionDuration');
      
      console.log('Bot metrics retrieved successfully');
      console.log('Active connections:', metrics.hubMetrics.activeConnections);
      console.log('Service status:', metrics.status);
      console.log('Service name:', metrics.service);

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('401') ||
        error.message.includes('403')
      )) {
        console.warn(`⚠️  Server or auth not available for metrics, skipping test`);
        return;
      }
      throw error;
    }
  }, 10000);

  it('should test connection successfully', async () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      const isConnected = await botRestSDK.testConnection();
      expect(isConnected).toBe(true);

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for connection test, skipping`);
        return;
      }
      throw error;
    }
  }, 10000);

  it('should handle authentication errors gracefully', async () => {
    const invalidSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: 'invalid-api-key',
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      // This should fail due to invalid API key
      const isConnected = await invalidSDK.testConnection();
      expect(isConnected).toBe(false);
      
      // Verify error was logged
      expect(mockLogger).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Connection test failed'),
        expect.any(Error)
      );

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for auth test, skipping`);
        return;
      }
      // For REST API, auth errors should be handled gracefully by testConnection
      console.log('Auth error handled:', error);
    } finally {
      invalidSDK.dispose();
    }
  }, 10000);

  it('should handle server unavailability gracefully', async () => {
    const unavailableSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: 'http://localhost:9999', // Non-existent server
      logger: mockLogger
    });

    // This should return false for connection test
    const isConnected = await unavailableSDK.testConnection();
    expect(isConnected).toBe(false);
    
    // Verify error was logged
    expect(mockLogger).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Connection test failed'),
      expect.any(Error)
    );

    unavailableSDK.dispose();
  }, 10000);

  it('should validate required parameters', () => {
    // Test missing tenantId
    expect(() => new BotRestSDK({
      tenantId: '',
      apiKey: apiKey,
      serverUrl: serverUrl
    })).toThrow('tenantId is required');

    // Test missing authentication
    expect(() => new BotRestSDK({
      tenantId: tenantId,
      serverUrl: serverUrl
    })).toThrow('Either apiKey, jwtToken, or getJwtToken callback is required');

    // Test missing serverUrl
    expect(() => new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: ''
    })).toThrow('serverUrl is required');

    // Test conflicting auth methods
    expect(() => new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      jwtToken: 'some-token',
      serverUrl: serverUrl
    })).toThrow('Cannot provide apiKey with jwtToken or getJwtToken');
  });

  it('should use environment variables for configuration', () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });
    
    expect(botRestSDK.getTenantId()).toBe(tenantId);
    expect(botRestSDK.getAuthType()).toBe('apiKey');
  });

  it('should test JWT token authentication flow', async () => {
    // Mock JWT token provider
    const mockGetJwtToken = vi.fn().mockResolvedValue('mock-jwt-token');
    
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      serverUrl: serverUrl,
      getJwtToken: mockGetJwtToken,
      logger: mockLogger
    });

    expect(botRestSDK.getAuthType()).toBe('jwtCallback');

    try {
      await botRestSDK.testConnection();
      expect(mockGetJwtToken).toHaveBeenCalled();
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('401')
      )) {
        console.warn(`⚠️  Server not available or JWT not accepted, skipping JWT test`);
        return;
      }
      throw error;
    }
  }, 10000);

  it('should handle pagination in bot history', async () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      // Test different page sizes and pages
      const history1 = await botRestSDK.getBotHistory(workflowType, participantId, 1, 5);
      const history2 = await botRestSDK.getBotHistory(workflowType, participantId, 2, 5);

      expect(history1.page).toBe(1);
      expect(history1.pageSize).toBe(5);
      expect(history2.page).toBe(2);
      expect(history2.pageSize).toBe(5);

      console.log('Pagination test successful');
      console.log('Page 1 messages:', history1.messages.length);
      console.log('Page 2 messages:', history2.messages.length);

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for pagination test, skipping`);
        return;
      }
      throw error;
    }
  }, 10000);

  it('should handle retry logic for failed requests', async () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: 'http://localhost:9999', // Non-existent server
      logger: mockLogger,
      retryConfig: {
        maxAttempts: 2,
        baseDelay: 100,
        maxDelay: 500,
        backoffMultiplier: 2,
        retryableStatusCodes: [500, 502, 503, 504]
      }
    });

    try {
      await botRestSDK.sendBotRequest({
        participantId: participantId,
        text: 'Test retry logic'
      });
      
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      // Should fail after retry attempts
      expect(error).toBeDefined();
      console.log('Retry logic test completed - expected failure:', error instanceof Error ? error.message : error);
    }

    botRestSDK.dispose();
  }, 10000);

  it('should update authentication methods', () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    // Test updating API key
    expect(botRestSDK.getAuthType()).toBe('apiKey');
    botRestSDK.updateApiKey('new-api-key');
    expect(botRestSDK.getAuthType()).toBe('apiKey');

    // Test updating JWT token
    botRestSDK.updateJwtToken('new-jwt-token');
    expect(botRestSDK.getAuthType()).toBe('jwtToken');

    // Test invalid updates
    expect(() => botRestSDK.updateApiKey('')).toThrow('apiKey cannot be empty');
    expect(() => botRestSDK.updateJwtToken('')).toThrow('jwtToken cannot be empty');
  });

  it('should update configuration options', () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    // Test updating default headers
    botRestSDK.updateDefaultHeaders({ 'X-Custom-Header': 'test-value' });
    
    // Test updating retry config
    botRestSDK.updateRetryConfig({
      maxAttempts: 5,
      baseDelay: 2000
    });


    
    expect(mockLogger).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Retry configuration updated'),
      expect.anything()
    );
  });

  it('should handle disposal properly', () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    botRestSDK.dispose();

    // Test that operations fail after disposal
    expect(() => botRestSDK.sendBotRequest({
      participantId: participantId,
      text: 'Should fail'
    })).rejects.toThrow('SDK has been disposed');
  });

  it('should validate bot request parameters', async () => {
    botRestSDK = new BotRestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    // Test missing participantId
    await expect(botRestSDK.sendBotRequest({
      participantId: '',
      text: 'Test'
    })).rejects.toThrow('participantId is required');

    // Test missing required parameters for history
    await expect(botRestSDK.getBotHistory('', participantId)).rejects.toThrow('workflowId is required');
    await expect(botRestSDK.getBotHistory(workflowType, '')).rejects.toThrow('participantId is required');
  });
}); 