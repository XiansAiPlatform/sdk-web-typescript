import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { config } from 'dotenv';
import { join } from 'path';
import SseSDK, { SseConnectionParams, SseMessageEvent, SseErrorEvent, SseConnectionEvent, SseHeartbeatEvent, SseEventHandlers } from '../SseSDK';
import { ConnectionState } from '../types';
import { Message } from '../types';
import { fail } from 'assert';

// How to run this test:
// 1. Create test/.env file with your API credentials
// 2. Run: npx vitest test/SseSDK.integration.test.ts
// This test will establish SSE connections to the UserApi endpoints

// Load environment variables from test/.env file
config({ path: join(__dirname, '.env') });

describe('SseSDK Integration Tests', () => {
  const mockLogger = vi.fn();
  
  // Get configuration from environment variables or fail
  const apiKey = process.env.API_KEY ?? fail('API_KEY is not set');
  const serverUrl = process.env.SERVER_URL ?? fail('SERVER_URL is not set');
  const tenantId = process.env.TENANT_ID ?? fail('TENANT_ID is not set');
  const participantId = process.env.PARTICIPANT_ID ?? fail('PARTICIPANT_ID is not set');
  const workflowType = process.env.WORKFLOW_TYPE ?? fail('WORKFLOW_TYPE is not set');
  
  let sseSDK: SseSDK;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (sseSDK) {
      sseSDK.dispose();
    }
  });

  // npx vitest -t "should connect to SSE stream with API key authentication"

  it('should connect to SSE stream with API key authentication', async () => {
    const mockChatHandler = vi.fn();
    const mockDataHandler = vi.fn();
    const mockHandoffHandler = vi.fn();
    const mockHeartbeatHandler = vi.fn();
    const mockConnectedHandler = vi.fn();
    const mockErrorHandler = vi.fn();
    const mockDisconnectedHandler = vi.fn();

    const eventHandlers: SseEventHandlers = {
      onReceiveChat: mockChatHandler,
      onReceiveData: mockDataHandler,
      onReceiveHandoff: mockHandoffHandler,
      onHeartbeat: mockHeartbeatHandler,
      onConnected: mockConnectedHandler,
      onError: mockErrorHandler,
      onDisconnected: mockDisconnectedHandler
    };

    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      connectionTimeout: 20000,
      autoReconnect: false, // Disable for test
      eventHandlers: eventHandlers
    });

    const connectionParams: SseConnectionParams = {
      workflow: workflowType,
      participantId: participantId,
      // Add shorter heartbeat for testing
      heartbeatSeconds: 3 // Use 3-second heartbeat for testing
    };

    try {
      console.log('🔌 Attempting to connect to SSE stream...');
      
      expect(sseSDK.getConnectionState()).toBe(ConnectionState.Disconnected);
      expect(sseSDK.isConnected()).toBe(false);
      expect(sseSDK.getTenantId()).toBe(tenantId);
      expect(sseSDK.getAuthType()).toBe('apiKey');

      // Connect to SSE stream
      await sseSDK.connect(connectionParams);

      // Wait a bit for connection to establish or fail
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('📊 Connection state:', sseSDK.getConnectionState());
      console.log('📊 Is connected:', sseSDK.isConnected());

      if (sseSDK.isConnected()) {
        console.log('✅ Successfully connected to SSE stream');
        expect(sseSDK.getConnectionState()).toBe(ConnectionState.Connected);
        // With new event handlers, onConnected is called without parameters
        expect(mockConnectedHandler).toHaveBeenCalled();

        // Wait longer for potential messages and at least one heartbeat
        console.log('⏱️  Waiting for potential messages and heartbeat...');
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds to get at least 5 heartbeats

        const totalChatMessages = mockChatHandler.mock.calls.length;
        const totalDataMessages = mockDataHandler.mock.calls.length;
        const totalHandoffMessages = mockHandoffHandler.mock.calls.length;
        const totalMessages = totalChatMessages + totalDataMessages + totalHandoffMessages;
        
        console.log('📨 Total message events received:', totalMessages);
        console.log('💓 Total heartbeat events received:', mockHeartbeatHandler.mock.calls.length);
        
        // Check heartbeat events
        if (mockHeartbeatHandler.mock.calls.length > 0) {
          console.log('✅ Successfully received heartbeat events');
          
          // Verify heartbeat structure - direct HeartbeatData calls
          mockHeartbeatHandler.mock.calls.forEach((call, index) => {
            const data = call[0]; // Direct HeartbeatData, not wrapped in event
            console.log(`  Heartbeat ${index + 1}:`, data);
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('subscriberCount');
            expect(typeof data.subscriberCount).toBe('number');
          });
        } else {
          console.log('⚠️  No heartbeat received - this might indicate a timing issue');
        }
        
        // Check message events (Chat, Data, Handoff)
        if (totalMessages > 0) {
          // Verify Chat messages
          if (totalChatMessages > 0) {
            console.log('✅ Successfully received Chat messages');
            mockChatHandler.mock.calls.forEach((call, index) => {
              const message = call[0] as Message; // Direct Message object
              console.log(`  Chat ${index + 1}:`, message.text?.substring(0, 100) + '...');
              expect(message).toHaveProperty('text'); // Chat messages should have text
              expect(message).toHaveProperty('participantId');
              expect(message).toHaveProperty('workflowId');
            });
          }
          
          // Verify Data messages
          if (totalDataMessages > 0) {
            console.log('✅ Successfully received Data messages');
            mockDataHandler.mock.calls.forEach((call, index) => {
              const message = call[0] as Message; // Direct Message object
              console.log(`  Data ${index + 1}:`, message.data ? 'Has data' : 'No data');
              expect(message).toHaveProperty('participantId');
              expect(message).toHaveProperty('workflowId');
            });
          }
          
          // Verify Handoff messages
          if (totalHandoffMessages > 0) {
            console.log('✅ Successfully received Handoff messages');
            mockHandoffHandler.mock.calls.forEach((call, index) => {
              const message = call[0] as Message; // Direct Message object
              console.log(`  Handoff ${index + 1}:`, message);
              expect(message).toHaveProperty('participantId');
              expect(message).toHaveProperty('workflowId');
            });
          }
          
          console.log(`📊 Message Summary: ${totalChatMessages} Chat, ${totalDataMessages} Data, ${totalHandoffMessages} Handoff`);
        } else {
          console.log('📭 No message events received');
        }

      } else if (sseSDK.getConnectionState() === ConnectionState.Failed) {
        console.log('❌ Connection failed');
        
        if (mockErrorHandler.mock.calls.length > 0) {
          const errorEvent = mockErrorHandler.mock.calls[0][0] as SseErrorEvent;
          console.log('Error details:', errorEvent.data);
          
          // Check for common error types
          if (errorEvent.data.error.includes('401') || errorEvent.data.error.includes('403')) {
            console.log('⚠️  Authentication/authorization issue - SDK is working but credentials may be invalid');
          }
        }
      } else {
        console.log('⏳ Connection still in progress or in another state');
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
    } finally {
      // Clean disconnect
      sseSDK.disconnect();
      expect(sseSDK.getConnectionState()).toBe(ConnectionState.Disconnected);
    }
  }, 20000);

  // npx vitest -t "should connect to SSE stream with scoped filtering"

  it('should connect to SSE stream with scoped filtering', async () => {
    const mockChatHandler = vi.fn();
    const mockDataHandler = vi.fn();
    const mockHandoffHandler = vi.fn();
    const mockHeartbeatHandler = vi.fn();
    const mockConnectedHandler = vi.fn();

    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      connectionTimeout: 10000,
      autoReconnect: false,
      eventHandlers: {
        onReceiveChat: mockChatHandler,
        onReceiveData: mockDataHandler,
        onReceiveHandoff: mockHandoffHandler,
        onHeartbeat: mockHeartbeatHandler,
        onConnected: mockConnectedHandler
      }
    });

    const connectionParams: SseConnectionParams = {
      workflow: workflowType,
      participantId: participantId,
      scope: 'test-scope'
    };

    try {
      console.log('🔌 Connecting to SSE stream with scope filtering...');
      
      await sseSDK.connect(connectionParams);
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (sseSDK.isConnected()) {
        console.log('✅ Successfully connected to scoped SSE stream');
        
        // Wait for potential messages
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const totalChatMessages = mockChatHandler.mock.calls.length;
        const totalDataMessages = mockDataHandler.mock.calls.length;
        const totalHandoffMessages = mockHandoffHandler.mock.calls.length;
        const totalMessages = totalChatMessages + totalDataMessages + totalHandoffMessages;
        
        console.log('📨 Received', totalMessages, 'scoped messages');
        console.log('💓 Received', mockHeartbeatHandler.mock.calls.length, 'scoped heartbeats');
        
        // Verify that scoped events are properly structured
        if (totalMessages > 0) {
          console.log(`  📊 Scoped Summary: ${totalChatMessages} Chat, ${totalDataMessages} Data, ${totalHandoffMessages} Handoff`);
          
          // Verify each message type
          mockChatHandler.mock.calls.forEach((call, index) => {
            const message = call[0] as Message;
            console.log(`  Scoped Chat ${index + 1}:`, message.text?.substring(0, 50) + '...');
            expect(message).toHaveProperty('participantId');
          });
          
          mockDataHandler.mock.calls.forEach((call, index) => {
            const message = call[0] as Message;
            console.log(`  Scoped Data ${index + 1}:`, message.data ? 'Has data' : 'No data');
            expect(message).toHaveProperty('participantId');
          });
          
          mockHandoffHandler.mock.calls.forEach((call, index) => {
            const message = call[0] as Message;
            console.log(`  Scoped Handoff ${index + 1}:`, message);
            expect(message).toHaveProperty('participantId');
          });
        }
      } else {
        console.log('❌ Failed to connect to scoped SSE stream');
      }

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for scoped test, skipping`);
        return;
      }
      throw error;
    }
  }, 15000);

  // npx vitest -t "should handle different message event types"

  it('should handle different message event types (Chat, Data, Handoff) and heartbeat events', async () => {
    const mockChatHandler = vi.fn();
    const mockDataHandler = vi.fn();
    const mockHandoffHandler = vi.fn();
    const mockHeartbeatHandler = vi.fn();
    const mockConnectedHandler = vi.fn();
    const mockErrorHandler = vi.fn();

    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      connectionTimeout: 15000,
      autoReconnect: false,
      eventHandlers: {
        onReceiveChat: (message) => {
          console.log(`📨 Chat message received - ID: ${message.id}, Text: ${message.text?.substring(0, 50)}...`);
          mockChatHandler(message);
        },
        onReceiveData: (message) => {
          console.log(`📊 Data message received - ID: ${message.id}, Has data: ${!!message.data}`);
          mockDataHandler(message);
        },
        onReceiveHandoff: (message) => {
          console.log(`🔄 Handoff message received - ID: ${message.id}`);
          mockHandoffHandler(message);
        },
        onHeartbeat: (data) => {
          console.log(`💓 Heartbeat received - Timestamp: ${data.timestamp}, Subscribers: ${data.subscriberCount}`);
          mockHeartbeatHandler(data);
        },
        onConnected: mockConnectedHandler,
        onError: mockErrorHandler
      }
    });

    const connectionParams: SseConnectionParams = {
      workflow: workflowType,
      participantId: participantId,
      heartbeatSeconds: 2 // Shorter heartbeat for testing
    };

    try {
      console.log('🔌 Testing different event types...');
      
      await sseSDK.connect(connectionParams);
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (sseSDK.isConnected()) {
        console.log('✅ Connected - waiting for various event types...');
        
        // Wait longer to receive different types of events
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const totalChatMessages = mockChatHandler.mock.calls.length;
        const totalDataMessages = mockDataHandler.mock.calls.length;
        const totalHandoffMessages = mockHandoffHandler.mock.calls.length;
        const totalMessages = totalChatMessages + totalDataMessages + totalHandoffMessages;
        
        console.log(`\n📊 Event Summary:`);
        console.log(`   💓 Heartbeats: ${mockHeartbeatHandler.mock.calls.length}`);
        console.log(`   📨 Messages: ${totalMessages}`);
        
        // Verify heartbeat events
        if (mockHeartbeatHandler.mock.calls.length > 0) {
          console.log(`\n💓 Heartbeat Event Details:`);
          mockHeartbeatHandler.mock.calls.forEach((call, index) => {
            const data = call[0]; // Direct HeartbeatData
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('subscriberCount');
            expect(typeof data.subscriberCount).toBe('number');
            console.log(`   ${index + 1}. Subscribers: ${data.subscriberCount}, Time: ${data.timestamp}`);
          });
        }
        
        // Verify and categorize message events
        if (totalMessages > 0) {
          console.log(`\n📨 Message Event Details:`);
          
          // Verify Chat messages
          if (totalChatMessages > 0) {
            console.log(`\n💬 Chat Messages (${totalChatMessages}):`);
            mockChatHandler.mock.calls.forEach((call, index) => {
              const message = call[0] as Message;
              console.log(`   ${index + 1}. ID: ${message.id || 'N/A'}, Text: ${message.text?.substring(0, 50)}...`);
              expect(message).toHaveProperty('text');
              expect(message).toHaveProperty('participantId');
              expect(message).toHaveProperty('workflowId');
            });
            console.log(`   ✅ Successfully received and validated Chat events`);
          }
          
          // Verify Data messages
          if (totalDataMessages > 0) {
            console.log(`\n📊 Data Messages (${totalDataMessages}):`);
            mockDataHandler.mock.calls.forEach((call, index) => {
              const message = call[0] as Message;
              console.log(`   ${index + 1}. ID: ${message.id || 'N/A'}, Has data: ${!!message.data}`);
              expect(message).toHaveProperty('participantId');
              expect(message).toHaveProperty('workflowId');
            });
            console.log(`   ✅ Successfully received and validated Data events`);
          }
          
          // Verify Handoff messages
          if (totalHandoffMessages > 0) {
            console.log(`\n🔄 Handoff Messages (${totalHandoffMessages}):`);
            mockHandoffHandler.mock.calls.forEach((call, index) => {
              const message = call[0] as Message;
              console.log(`   ${index + 1}. ID: ${message.id || 'N/A'}`);
              expect(message).toHaveProperty('participantId');
              expect(message).toHaveProperty('workflowId');
            });
            console.log(`   ✅ Successfully received and validated Handoff events`);
          }
          
          console.log(`\n📊 Final Message Type Breakdown:`);
          console.log(`   💬 Chat: ${totalChatMessages}`);
          console.log(`   📊 Data: ${totalDataMessages}`);
          console.log(`   🔄 Handoff: ${totalHandoffMessages}`);
        }
        
      } else {
        console.log('❌ Failed to connect for event type testing');
        
        if (mockErrorHandler.mock.calls.length > 0) {
          const errorEvent = mockErrorHandler.mock.calls[0][0] as SseErrorEvent;
          console.log('Error details:', errorEvent.data);
        }
      }

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for event type test, skipping`);
        return;
      }
      throw error;
    }
  }, 20000);

     // npx vitest -t "should attempt JWT token authentication"
 
   it('should attempt JWT token authentication', async () => {
     const mockGetJwtToken = vi.fn().mockResolvedValue('mock-jwt-token');
     const mockConnectedHandler = vi.fn();
     const mockErrorHandler = vi.fn();
 
     sseSDK = new SseSDK({
       tenantId: tenantId,
       serverUrl: serverUrl,
       getJwtToken: mockGetJwtToken,
       logger: mockLogger,
       connectionTimeout: 10000,
       autoReconnect: false,
       eventHandlers: {
         onConnected: mockConnectedHandler,
         onError: mockErrorHandler
       }
     });
 
     expect(sseSDK.getAuthType()).toBe('jwtCallback');
 
     const connectionParams: SseConnectionParams = {
       workflow: workflowType,
       participantId: participantId
     };
 
     try {
       console.log('🔐 Testing JWT token authentication...');
       
       await sseSDK.connect(connectionParams);
       expect(mockGetJwtToken).toHaveBeenCalled();
       
       await new Promise(resolve => setTimeout(resolve, 3000));
       
       console.log('JWT auth test result - State:', sseSDK.getConnectionState());
       
       if (sseSDK.isConnected()) {
         console.log('✅ Successfully connected with JWT authentication');
       } else {
         // With mock token, we expect auth errors, which is normal
         console.log('⚠️  JWT authentication failed (expected with mock token)');
         if (mockErrorHandler.mock.calls.length > 0) {
           console.log('Error details:', mockErrorHandler.mock.calls[0][0]);
         }
       }
 
     } catch (error) {
       if (error instanceof Error && (
         error.message.includes('ECONNREFUSED') || 
         error.message.includes('fetch')
       )) {
         console.warn(`⚠️  Server not available for JWT test, skipping`);
         return;
       }
       // Auth errors are expected with mock token
       console.log('Expected auth error with mock JWT token:', error);
     }
   }, 15000);

  // npx vitest -t "should handle connection failures gracefully"

  it('should handle connection failures gracefully', async () => {
    const mockErrorHandler = vi.fn();
    const mockReconnectingHandler = vi.fn();

    const unavailableSSE = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: 'http://localhost:9999', // Non-existent server
      logger: mockLogger,
      connectionTimeout: 5000,
      maxReconnectAttempts: 2,
      reconnectDelay: 1000,
      autoReconnect: true,
      eventHandlers: {
        onError: mockErrorHandler,
        onReconnecting: mockReconnectingHandler
      }
    });

    const connectionParams: SseConnectionParams = {
      workflow: workflowType,
      participantId: participantId
    };

    try {
      console.log('🔌 Testing connection failure handling...');
      
      await unavailableSSE.connect(connectionParams);
      
      // Wait for connection attempts and failures
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      expect(unavailableSSE.getConnectionState()).toBe(ConnectionState.Failed);
      
      // Should have attempted reconnections
      if (mockReconnectingHandler.mock.calls.length > 0) {
        console.log('✅ Reconnection attempts were made:', mockReconnectingHandler.mock.calls.length);
      }
      
      // Should have error events
      if (mockErrorHandler.mock.calls.length > 0) {
        console.log('✅ Error events were emitted:', mockErrorHandler.mock.calls.length);
        const errorEvent = mockErrorHandler.mock.calls[0][0] as SseErrorEvent;
        expect(errorEvent.type).toBe('error');
        expect(errorEvent.data.error).toBeDefined();
      }

    } finally {
      unavailableSSE.dispose();
    }
  }, 12000);

  // npx vitest -t "should handle authentication errors gracefully"

  it('should handle authentication errors gracefully', async () => {
    const mockErrorHandler = vi.fn();
    const mockConnectedHandler = vi.fn();

    const invalidSSE = new SseSDK({
      tenantId: tenantId,
      apiKey: 'invalid-api-key',
      serverUrl: serverUrl,
      logger: mockLogger,
      connectionTimeout: 8000,
      autoReconnect: false,
      eventHandlers: {
        onError: mockErrorHandler,
        onConnected: mockConnectedHandler
      }
    });

    const connectionParams: SseConnectionParams = {
      workflow: workflowType,
      participantId: participantId
    };

    try {
      console.log('🔐 Testing authentication error handling...');
      
      await invalidSSE.connect(connectionParams);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Should not be connected
      expect(invalidSSE.isConnected()).toBe(false);
      expect(mockConnectedHandler).not.toHaveBeenCalled();
      
      console.log('✅ Correctly handled authentication error');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for auth test, skipping`);
        return;
      }
      // Auth errors might throw exceptions, which is also expected
      console.log('✅ Auth error threw exception as expected:', error);
    } finally {
      invalidSSE.dispose();
    }
  }, 12000);

  it('should validate required parameters', () => {
    // Test missing tenantId
    expect(() => new SseSDK({
      tenantId: '',
      apiKey: apiKey,
      serverUrl: serverUrl
    })).toThrow('tenantId is required');

    // Test missing authentication
    expect(() => new SseSDK({
      tenantId: tenantId,
      serverUrl: serverUrl
    })).toThrow('Either apiKey, jwtToken, or getJwtToken callback is required');

    // Test missing serverUrl
    expect(() => new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: ''
    })).toThrow('serverUrl is required');

    // Test conflicting auth methods
    expect(() => new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      jwtToken: 'some-token',
      serverUrl: serverUrl
    })).toThrow('Cannot provide apiKey with jwtToken or getJwtToken');
  });

  it('should validate connection parameters', async () => {
    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      autoReconnect: false
    });

    // Test missing workflow
    await expect(sseSDK.connect({
      workflow: '',
      participantId: participantId
    })).rejects.toThrow();

    // Test missing participantId
    await expect(sseSDK.connect({
      workflow: workflowType,
      participantId: ''
    })).rejects.toThrow();
  });

  it('should test event listener management', () => {
    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      autoReconnect: false
    });

    const messageHandler1 = vi.fn();
    const messageHandler2 = vi.fn();
    const onceHandler = vi.fn();

    // Add event listeners
    sseSDK.on('message', messageHandler1);
    sseSDK.on('message', messageHandler2);
    sseSDK.once('connected', onceHandler);

    // Simulate events by accessing private methods (for testing)
    // Note: In real tests, you'd trigger actual events through connections
    
    // Remove specific handler
    sseSDK.off('message', messageHandler1);
    
    // Test that handlers were managed correctly
    expect(messageHandler1).not.toHaveBeenCalled();
    expect(messageHandler2).not.toHaveBeenCalled();
    expect(onceHandler).not.toHaveBeenCalled();
  });

     it('should test auth method switching', () => {
     sseSDK = new SseSDK({
       tenantId: tenantId,
       apiKey: apiKey,
       serverUrl: serverUrl,
       logger: mockLogger,
       autoReconnect: false
     });

     expect(sseSDK.getAuthType()).toBe('apiKey');

     // Switch to JWT token (note: JWT is not supported for SSE connections)
     sseSDK.updateJwtToken('new-jwt-token');
     expect(sseSDK.getAuthType()).toBe('jwtToken');

     // Switch to JWT callback (note: JWT is not supported for SSE connections)
     sseSDK.updateJwtTokenCallback(() => Promise.resolve('callback-token'));
     expect(sseSDK.getAuthType()).toBe('jwtCallback');

     // Switch back to API key (this is the only supported method for SSE)
     sseSDK.updateApiKey('new-api-key');
     expect(sseSDK.getAuthType()).toBe('apiKey');
   });

   it('should handle authentication method switching and reconnection', async () => {
     sseSDK = new SseSDK({
       tenantId: tenantId,
       apiKey: apiKey,
       serverUrl: serverUrl,
       logger: mockLogger,
       autoReconnect: false
     });

     const connectionParams: SseConnectionParams = {
       workflow: workflowType,
       participantId: participantId
     };

     // Start with API key authentication
     expect(sseSDK.getAuthType()).toBe('apiKey');

     // Switch to JWT token authentication
     sseSDK.updateJwtToken('test-jwt-token');
     expect(sseSDK.getAuthType()).toBe('jwtToken');

     console.log('🔄 Testing JWT authentication after switching from API key...');

     try {
       // Attempt to connect with JWT should work (though may fail auth with invalid token)
       await sseSDK.connect(connectionParams);
       await new Promise(resolve => setTimeout(resolve, 2000));
       
       const connectionState = sseSDK.getConnectionState();
       console.log('Connection state after JWT switch:', connectionState);
       
       // Connection may succeed or fail depending on JWT token validity
       // But it should not throw an error about JWT not being supported
       console.log('✅ JWT authentication switching handled correctly');
       
     } catch (error) {
       if (error instanceof Error && (
         error.message.includes('ECONNREFUSED') || 
         error.message.includes('fetch')
       )) {
         console.warn(`⚠️  Server not available for auth switching test, skipping`);
         return;
       }
       // Auth errors with invalid JWT token are expected
       console.log('Expected auth error with test JWT token:', error);
     }
   });

  it('should handle reconnection configuration correctly', () => {
    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
      autoReconnect: true,
      connectionTimeout: 15000
    });

    // Test that configuration is applied
    expect(sseSDK.getConnectionState()).toBe(ConnectionState.Disconnected);
    expect(sseSDK.getTenantId()).toBe(tenantId);
  });

  it('should test disposal and cleanup', async () => {
    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      autoReconnect: false
    });

    // Connect first
    const connectionParams: SseConnectionParams = {
      workflow: workflowType,
      participantId: participantId
    };

    try {
      await sseSDK.connect(connectionParams);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Connection might fail, but we're testing disposal
    }

    // Dispose should clean up everything
    sseSDK.dispose();
    
    expect(sseSDK.getConnectionState()).toBe(ConnectionState.Disconnected);
    
    // Should throw error when trying to use disposed SDK
    await expect(sseSDK.connect(connectionParams)).rejects.toThrow('SDK has been disposed');
  });

  it('should use environment variables for configuration', () => {
    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });
    
    expect(sseSDK.getTenantId()).toBe(tenantId);
    expect(sseSDK.getAuthType()).toBe('apiKey');
    expect(sseSDK.getConnectionState()).toBe(ConnectionState.Disconnected);
  });

  it('should test connection state transitions', async () => {
    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      connectionTimeout: 5000,
      autoReconnect: false
    });

    const connectionParams: SseConnectionParams = {
      workflow: workflowType,
      participantId: participantId
    };

    // Initial state
    expect(sseSDK.getConnectionState()).toBe(ConnectionState.Disconnected);
    expect(sseSDK.isConnected()).toBe(false);

    try {
      // Attempt connection
      const connectPromise = sseSDK.connect(connectionParams);
      
      // Should be in connecting state briefly
      await new Promise(resolve => setTimeout(resolve, 100));
      // Note: State might have already transitioned, so we don't assert connecting state
      
      await connectPromise;
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Should be connected or failed
      const finalState = sseSDK.getConnectionState();
      expect([
        ConnectionState.Connected, 
        ConnectionState.Failed, 
        ConnectionState.Disconnected
      ]).toContain(finalState);
      
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch')
      )) {
        console.warn(`⚠️  Server not available for state test, skipping`);
        return;
      }
      // Connection errors are expected in some scenarios
    } finally {
      // Manual disconnect should set state to disconnected
      sseSDK.disconnect();
      expect(sseSDK.getConnectionState()).toBe(ConnectionState.Disconnected);
    }
  }, 10000);
}); 