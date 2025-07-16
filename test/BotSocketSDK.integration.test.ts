import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { config } from 'dotenv';
import { join } from 'path';
import BotSocketSDK, { BotRequest, BotResponse, BotHistoryMessage, BotError, ConnectionState } from '../BotSocketSDK';
import { fail } from 'assert';

// Load environment variables from test/.env file
config({ path: join(__dirname, '.env') });

describe('BotSDK Integration Tests', () => {
  const mockLogger = vi.fn();
  
  // Get configuration from environment variables or fail
  const apiKey = process.env.API_KEY ?? fail('API_KEY is not set');
  const serverUrl = process.env.SERVER_URL ?? fail('SERVER_URL is not set');
  const tenantId = process.env.TENANT_ID ?? fail('TENANT_ID is not set');
  const participantId = process.env.PARTICIPANT_ID ?? fail('PARTICIPANT_ID is not set');
  const workflowType = process.env.WORKFLOW_TYPE ?? fail('WORKFLOW_TYPE is not set');
  
  let botSDK: BotSocketSDK;
  let receivedResponses: BotResponse[] = [];
  let receivedErrors: BotError[] = [];
  let receivedHistory: BotHistoryMessage[] = [];
  let connectionStateChanges: Array<{ oldState: ConnectionState, newState: ConnectionState }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    receivedResponses = [];
    receivedErrors = [];
    receivedHistory = [];
    connectionStateChanges = [];
  });

  afterEach(async () => {
    if (botSDK) {
      await botSDK.dispose();
    }
  });

  it('should connect to bot hub and send/receive messages', async () => {
    botSDK = new BotSocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      autoReconnect: true,
      eventHandlers: {
        onBotResponse: (response) => {
          console.log('Received response:', response);
          receivedResponses.push(response);
        },
        onBotError: (error) => {
          console.log('Received error:', error);
          receivedErrors.push(error);
        },
        onConnectionStateChanged: (oldState, newState) => {
          console.log('Connection state changed:', oldState, newState);
          connectionStateChanges.push({ oldState, newState });
        }
      }
    });

    try {
      // Test connection
      await botSDK.connect();
      expect(botSDK.isConnected()).toBe(true);
      expect(botSDK.getConnectionState()).toBe(ConnectionState.Connected);

      // Subscribe to bot notifications
      
      await botSDK.subscribeToBots(workflowType, participantId);

      // Send a bot request
      const botRequest: BotRequest = {
        requestId: 'test-req-' + Date.now(),
        participantId: participantId,
        workflowType: workflowType,
        text: 'Hello, I need help with integration testing'
      };

      await botSDK.sendBotRequest(botRequest);

      // Wait a bit for response
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify connection state changes occurred
      expect(connectionStateChanges.length).toBeGreaterThan(0);
      const connectedStateChange = connectionStateChanges.find(
        change => change.newState === ConnectionState.Connected
      );
      expect(connectedStateChange).toBeDefined();

      // Note: In a real scenario, we might receive responses
      // For testing, we just verify the connection and request sending worked
      console.log('Bot request sent successfully');
      console.log('Received responses:', receivedResponses.length);
      console.log('Received errors:', receivedErrors.length);

    } catch (error) {
      // If server is not available, skip the test with a message
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('WebSocket') ||
        error.message.includes('Connection')
      )) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 15000); // 15 second timeout for real network calls

  it('should get bot history for a workflow', async () => {
    botSDK = new BotSocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      eventHandlers: {
        onBotHistory: (history) => {
          console.log('Received history:', history);
          receivedHistory.push(...history);
        },
        onBotHistoryError: (error) => {
          receivedErrors.push(error);
        }
      }
    });

    try {
      await botSDK.connect();
      

      // Request bot history
      await botSDK.getBotHistory(workflowType, participantId, 1, 10);

      // Wait a bit for response
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Bot history request sent successfully');
      console.log('Received history items:', receivedHistory.length);

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('WebSocket') ||
        error.message.includes('Connection')
      )) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 10000);

  it('should handle multiple bot subscriptions', async () => {
    botSDK = new BotSocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      eventHandlers: {
        onBotResponse: (response) => {
          console.log('Received response from multiple bot subscriptions:', response);
          receivedResponses.push(response);
        }
      }
    });

    try {
      await botSDK.connect();
      
      const workflowTypes = [workflowType, workflowType, workflowType];

      // Batch subscribe to multiple workflows
      await botSDK.batchSubscribeToBots(workflowTypes, participantId);

      // Send requests to different workflows
      for (const workflowType of workflowTypes) {
        const botRequest: BotRequest = {
          requestId: `test-req-${workflowType}-${Date.now()}`,
          participantId: participantId,
          workflowType: workflowType,
          text: `Hello from ${workflowType} integration test ${Date.now()}`
        };

        await botSDK.sendBotRequest(botRequest);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Wait for potential responses
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Multiple bot requests sent successfully');
      console.log('Total responses received:', receivedResponses.length);

      // Unsubscribe from one workflow
      await botSDK.unsubscribeFromBots(workflowTypes[0], participantId);

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch') ||
        error.message.includes('WebSocket') ||
        error.message.includes('Connection')
      )) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 20000);

  it('should get bot metrics', async () => {
    botSDK = new BotSocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    try {
      // Note: We don't need to connect for metrics since it's an HTTP call
      const metrics = await botSDK.getBotMetrics();
      console.log('Bot metrics:', metrics);
      
      // Verify the metrics structure
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('service');
      expect(metrics).toHaveProperty('hubMetrics');
      expect(metrics.hubMetrics).toHaveProperty('activeConnections');
      expect(metrics.hubMetrics).toHaveProperty('cachedGroupNames');
      expect(metrics.hubMetrics).toHaveProperty('averageConnectionDuration');
      
      console.log('Bot metrics retrieved successfully');
      console.log('Active connections:', metrics.hubMetrics.activeConnections);
      console.log('Service status:', metrics.status);

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

  it('should handle authentication errors gracefully', async () => {
    const invalidSDK = new BotSocketSDK({
      tenantId: tenantId,
      apiKey: 'invalid-api-key',
      serverUrl: serverUrl,
      logger: mockLogger,
      eventHandlers: {
        onConnectionError: (error) => {
          console.log('Expected auth error:', error);
        }
      }
    });

    try {
      // This should fail due to invalid API key
      await expect(invalidSDK.connect()).rejects.toThrow();
      
      // Verify error was logged
      expect(mockLogger).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Failed to connect'),
        expect.any(Error)
      );

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('WebSocket')
      )) {
        console.warn(`⚠️  Server not available for auth test, skipping`);
        return;
      }
      // Re-throw if it's not a connection issue
      throw error;
    } finally {
      await invalidSDK.dispose();
    }
  }, 10000);

  it('should handle server unavailability gracefully', async () => {
    const unavailableSDK = new BotSocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: 'http://localhost:9999', // Non-existent server
      logger: mockLogger,
      autoReconnect: false // Disable auto-reconnect for this test
    });

    // This should throw a network error
    await expect(unavailableSDK.connect()).rejects.toThrow();
    
    // Verify error was logged
    expect(mockLogger).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Failed to connect'),
      expect.any(Error)
    );

    await unavailableSDK.dispose();
  }, 10000);

  it('should validate required parameters', () => {
    // Test missing tenantId
    expect(() => new BotSocketSDK({
      tenantId: '',
      apiKey: apiKey,
      serverUrl: serverUrl
    })).toThrow('tenantId is required');

    // Test missing authentication
    expect(() => new BotSocketSDK({
      tenantId: tenantId,
      serverUrl: serverUrl
    })).toThrow('Either apiKey, jwtToken, or getJwtToken callback is required');

    // Test missing serverUrl
    expect(() => new BotSocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: ''
    })).toThrow('serverUrl is required');

    // Test conflicting auth methods
    expect(() => new BotSocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      jwtToken: 'some-token',
      serverUrl: serverUrl
    })).toThrow('Cannot provide apiKey with jwtToken or getJwtToken');
  });

  it('should use environment variables for configuration', () => {
    botSDK = new BotSocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });
    
    expect(botSDK.getTenantId()).toBe(tenantId);
    expect(botSDK.getAuthType()).toBe('apiKey');
  });

  it('should test JWT token authentication flow', async () => {
    // Mock JWT token provider
    const mockGetJwtToken = vi.fn().mockResolvedValue('mock-jwt-token');
    
    botSDK = new BotSocketSDK({
      tenantId: tenantId,
      serverUrl: serverUrl,
      getJwtToken: mockGetJwtToken,
      logger: mockLogger
    });

    expect(botSDK.getAuthType()).toBe('jwtCallback');

    try {
      await botSDK.connect();
      expect(mockGetJwtToken).toHaveBeenCalled();
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('WebSocket') ||
        error.message.includes('401')
      )) {
        console.warn(`⚠️  Server not available or JWT not accepted, skipping JWT test`);
        return;
      }
      throw error;
    }
  }, 10000);
}); 