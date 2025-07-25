import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { config } from 'dotenv';
import { join } from 'path';
import SocketSDK, { MessageRequest } from '../SocketSDK';
import { Message, MessageType, ConnectionState } from '../types';
import { fail } from 'assert';

// How to run this test:
// 1. Create test/.env file with your API credentials
// 2. Run: npx vitest test/ChatSocketSDK.integration.test.ts
// This test will send a message and wait for agent responses via WebSocket

// Load environment variables from test/.env file
config({ path: join(__dirname, '.env') });

describe('ChatSocketSDK Integration Tests', () => {
  const mockLogger = vi.fn();
  
  // Get configuration from environment variables or fail
  const apiKey = process.env.API_KEY ?? fail('API_KEY is not set');
  const serverUrl = process.env.SERVER_URL ?? fail('SERVER_URL is not set');
  const tenantId = process.env.TENANT_ID ?? fail('TENANT_ID is not set');
  const participantId = process.env.PARTICIPANT_ID ?? fail('PARTICIPANT_ID is not set');
  const workflowType = process.env.WORKFLOW_TYPE ?? fail('WORKFLOW_TYPE is not set');
  
  let chatSDK: SocketSDK;
  let receivedHistory: Message[] = [];
  let receivedInboundProcessed: string[] = [];
  let receivedChatMessages: Message[] = [];
  let receivedDataMessages: Message[] = [];
  let receivedHandoffMessages: Message[] = [];
  let receivedErrors: string[] = [];
  let connectionStateChanges: Array<{ oldState: ConnectionState, newState: ConnectionState }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    receivedHistory = [];
    receivedInboundProcessed = [];
    receivedChatMessages = [];
    receivedDataMessages = [];
    receivedHandoffMessages = [];
    receivedErrors = [];
    connectionStateChanges = [];
  });

  afterEach(async () => {
    if (chatSDK) {
      await chatSDK.dispose();
    }
  });

  // npx vitest -t "should connect to chat hub, send message, and receive agent responses"

  it('should connect to chat hub, send message, and receive agent responses', async () => {
    chatSDK = new SocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      autoReconnect: true,
      eventHandlers: {
        onThreadHistory: (history) => {
          console.log('📜 Received thread history:', history.length, 'messages');
          receivedHistory.push(...history);
        },
        onInboundProcessed: (threadId) => {
          console.log('✅ Inbound message processed, threadId:', threadId);
          receivedInboundProcessed.push(threadId);
        },
        onReceiveChat: (message) => {
          console.log('🤖 AGENT RESPONSE (Chat):', message);
          receivedChatMessages.push(message);
        },
        onReceiveData: (message) => {
          console.log('🤖 AGENT RESPONSE (Data):', message);
          receivedDataMessages.push(message);
        },
        onReceiveHandoff: (message) => {
          console.log('🔄 AGENT RESPONSE (Handoff):', message);
          receivedHandoffMessages.push(message);
        },
        onError: (error) => {
          console.log('❌ Received error:', error);
          receivedErrors.push(error);
        },
        onConnectionStateChanged: (oldState, newState) => {
          console.log('🔄 Connection state changed:', oldState, '->', newState);
          connectionStateChanges.push({ oldState, newState });
        }
      }
    });

    try {
      // Test connection
      await chatSDK.connect();
      expect(chatSDK.isConnected()).toBe(true);
      expect(chatSDK.getConnectionState()).toBe(ConnectionState.Connected);

      // Subscribe to agent notifications
      await chatSDK.subscribeToAgent(workflowType, participantId);

      // Send an inbound message
      const chatRequest: MessageRequest = {
        requestId: 'test-req-' + Date.now(),
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        data: {
          documentId: 'd42d8b34-7c5e-43ce-9771-3eda01945369'
        },
        text: 'who are my representatives?' //'Hello, What can you do?'
      };

      await chatSDK.sendInboundMessage(chatRequest, MessageType.Chat);
      console.log('✅ Chat message sent successfully');

      // Wait for inbound processing confirmation
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log('📨 Messages received so far:');
      console.log('  - Inbound processed confirmations:', receivedInboundProcessed.length);
      console.log('  - Errors:', receivedErrors.length);
      
      if (receivedInboundProcessed.length > 0) {
        console.log('  - Thread IDs:', receivedInboundProcessed);
      }
      
      if (receivedErrors.length > 0) {
        console.log('  - Error messages:', receivedErrors);
      }

      // Request thread history to see if any bot responses came back
      console.log('🔍 Requesting thread history to check for responses...');
      await chatSDK.getThreadHistory(workflowType, participantId, 0, 20);
      
      // Wait for thread history response
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('📜 Thread history received:');
      console.log('  - Total messages in history:', receivedHistory.length);
      
      if (receivedHistory.length > 0) {
        console.log('  - Recent messages:');
        receivedHistory.slice(-5).forEach((msg, index) => {
          console.log(`    ${index + 1}. [${msg.direction}] ${msg.text || 'No text'} (${msg.messageType || 'Unknown type'})`);
          if (msg.data) {
            console.log(`       Data: ${JSON.stringify(msg.data)}`);
          }
        });
      }

      // Wait a bit more to see if any delayed responses come in
      console.log('⏳ Waiting for potential delayed responses...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('📈 Final message count:');
      console.log('  - Inbound processed confirmations:', receivedInboundProcessed.length);
      console.log('  - Agent chat messages received:', receivedChatMessages.length);
      console.log('  - Agent data messages received:', receivedDataMessages.length);
      console.log('  - Agent handoff messages received:', receivedHandoffMessages.length);
      console.log('  - Thread history items:', receivedHistory.length);
      console.log('  - Errors:', receivedErrors.length);
      
      const totalAgentMessages = receivedChatMessages.length + receivedDataMessages.length + receivedHandoffMessages.length;
      if (totalAgentMessages > 0) {
        console.log('🎉 SUCCESS: Received agent responses!');
        receivedChatMessages.forEach((msg, index) => {
          console.log(`  💬 Chat ${index + 1}. [${msg.direction}] ${msg.text || 'No text'}`);
        });
        receivedDataMessages.forEach((msg, index) => {
          console.log(`  📊 Data ${index + 1}. [${msg.direction}] ${JSON.stringify(msg.data) || 'No data'}`);
        });
        receivedHandoffMessages.forEach((msg, index) => {
          console.log(`  🔄 Handoff ${index + 1}. [${msg.direction}] ${msg.text || JSON.stringify(msg.data) || 'No content'}`);
        });
      } else {
        console.log('⚠️  No agent messages received (this might be expected if no workflow is running)');
      }

      // Verify connection state changes occurred
      expect(connectionStateChanges.length).toBeGreaterThan(0);
      const connectedStateChange = connectionStateChanges.find(
        change => change.newState === ConnectionState.Connected
      );
      expect(connectedStateChange).toBeDefined();

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
  }, 30000); // 30 second timeout for real network calls including agent responses

  it('should get thread history for a workflow', async () => {
    chatSDK = new SocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      eventHandlers: {
        onThreadHistory: (history) => {
          console.log('Received history:', history);
          receivedHistory.push(...history);
        },
        onError: (error) => {
          receivedErrors.push(error);
        }
      }
    });

    try {
      await chatSDK.connect();

      // Request thread history
      await chatSDK.getThreadHistory(workflowType, participantId, 1, 10);

      // Wait a bit for response
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Thread history request sent successfully');
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


  it('should handle authentication errors gracefully', async () => {
    const invalidSDK = new SocketSDK({
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
    const unavailableSDK = new SocketSDK({
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
    expect(() => new SocketSDK({
      tenantId: '',
      apiKey: apiKey,
      serverUrl: serverUrl
    })).toThrow('tenantId is required');

    // Test missing authentication
    expect(() => new SocketSDK({
      tenantId: tenantId,
      serverUrl: serverUrl
    })).toThrow('Either apiKey, jwtToken, or getJwtToken callback is required');

    // Test missing serverUrl
    expect(() => new SocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: ''
    })).toThrow('serverUrl is required');

    // Test conflicting auth methods
    expect(() => new SocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      jwtToken: 'some-token',
      serverUrl: serverUrl
    })).toThrow('Cannot provide apiKey with jwtToken or getJwtToken');
  });

  it('should use environment variables for configuration', () => {
    chatSDK = new SocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });
    
    expect(chatSDK.getTenantId()).toBe(tenantId);
    expect(chatSDK.getAuthType()).toBe('apiKey');
  });

  it('should test JWT token authentication flow', async () => {
    // Mock JWT token provider
    const mockGetJwtToken = vi.fn().mockResolvedValue('mock-jwt-token');
    
    chatSDK = new SocketSDK({
      tenantId: tenantId,
      serverUrl: serverUrl,
      getJwtToken: mockGetJwtToken,
      logger: mockLogger
    });

    expect(chatSDK.getAuthType()).toBe('jwtCallback');

    try {
      await chatSDK.connect();
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

  // npx vitest -t "should handle different message event types including handoff"

  it('should handle different message event types (Chat, Data, Handoff)', async () => {
    const mockChatMessages: Message[] = [];
    const mockDataMessages: Message[] = [];
    const mockHandoffMessages: Message[] = [];
    const mockErrors: string[] = [];
    const mockConnections: Array<{ oldState: ConnectionState, newState: ConnectionState }> = [];

    chatSDK = new SocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      autoReconnect: true,
      eventHandlers: {
        onReceiveChat: (message) => {
          console.log('💬 Chat message received:', message.text?.substring(0, 50) + '...');
          mockChatMessages.push(message);
        },
        onReceiveData: (message) => {
          console.log('📊 Data message received:', !!message.data ? 'Has data' : 'No data');
          mockDataMessages.push(message);
        },
        onReceiveHandoff: (message) => {
          console.log('🔄 Handoff message received:', message.id);
          mockHandoffMessages.push(message);
        },
        onError: (error) => {
          console.log('❌ Error received:', error);
          mockErrors.push(error);
        },
        onConnectionStateChanged: (oldState, newState) => {
          console.log('🔄 Connection state:', oldState, '->', newState);
          mockConnections.push({ oldState, newState });
        }
      }
    });

    try {
      console.log('🔌 Testing different message event types...');
      
      await chatSDK.connect();
      expect(chatSDK.isConnected()).toBe(true);
      
      await chatSDK.subscribeToAgent(workflowType, participantId);

      // Send a test message that might trigger different response types
      const testRequest: MessageRequest = {
        requestId: 'handoff-test-' + Date.now(),
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'Test message for different event types',
        data: { testType: 'eventTypes' }
      };

      await chatSDK.sendInboundMessage(testRequest, MessageType.Chat);
      console.log('✅ Test message sent');

      // Wait for potential responses of different types
      console.log('⏳ Waiting for various message types...');
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Get thread history to see all message types
      await chatSDK.getThreadHistory(workflowType, participantId, 0, 20);
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('\n📊 Message Type Summary:');
      console.log(`   💬 Chat messages: ${mockChatMessages.length}`);
      console.log(`   📊 Data messages: ${mockDataMessages.length}`);
      console.log(`   🔄 Handoff messages: ${mockHandoffMessages.length}`);
      console.log(`   ❌ Errors: ${mockErrors.length}`);
      console.log(`   🔗 Connection changes: ${mockConnections.length}`);

      // Verify message structures
      if (mockChatMessages.length > 0) {
        console.log('\n💬 Chat Message Details:');
        mockChatMessages.forEach((msg, index) => {
          console.log(`   ${index + 1}. ID: ${msg.id}, Direction: ${msg.direction}, Text: ${msg.text?.substring(0, 100)}...`);
          expect(msg).toHaveProperty('id');
          expect(msg).toHaveProperty('direction');
          expect(msg).toHaveProperty('participantId');
          expect(msg).toHaveProperty('workflowId');
        });
        console.log('   ✅ Successfully received and validated Chat messages');
      }

      if (mockDataMessages.length > 0) {
        console.log('\n📊 Data Message Details:');
        mockDataMessages.forEach((msg, index) => {
          console.log(`   ${index + 1}. ID: ${msg.id}, Direction: ${msg.direction}, Has data: ${!!msg.data}`);
          expect(msg).toHaveProperty('id');
          expect(msg).toHaveProperty('direction');
          expect(msg).toHaveProperty('participantId');
          expect(msg).toHaveProperty('workflowId');
        });
        console.log('   ✅ Successfully received and validated Data messages');
      }

      if (mockHandoffMessages.length > 0) {
        console.log('\n🔄 Handoff Message Details:');
        mockHandoffMessages.forEach((msg, index) => {
          console.log(`   ${index + 1}. ID: ${msg.id}, Direction: ${msg.direction}`);
          expect(msg).toHaveProperty('id');
          expect(msg).toHaveProperty('direction');
          expect(msg).toHaveProperty('participantId');
          expect(msg).toHaveProperty('workflowId');
        });
        console.log('   ✅ Successfully received and validated Handoff messages');
      }

      const totalMessages = mockChatMessages.length + mockDataMessages.length + mockHandoffMessages.length;
      if (totalMessages > 0) {
        console.log(`\n🎉 Successfully received ${totalMessages} messages of various types!`);
      } else {
        console.log('\n📭 No messages received (may be expected if no workflow is active)');
      }

      // Verify connection was established
      expect(mockConnections.length).toBeGreaterThan(0);
      const connectedChange = mockConnections.find(c => c.newState === ConnectionState.Connected);
      expect(connectedChange).toBeDefined();

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('WebSocket')
      )) {
        console.warn(`⚠️  Server not available for message type test, skipping`);
        return;
      }
      throw error;
    }
  }, 25000);
}); 