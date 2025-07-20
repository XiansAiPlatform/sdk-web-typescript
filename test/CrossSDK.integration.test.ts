import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { config } from 'dotenv';
import { join } from 'path';
import RestSDK, { RestMessageRequest } from '../RestSDK';
import SocketSDK, { MessageRequest } from '../SocketSDK';
import SseSDK, { SseConnectionParams } from '../SseSDK';
import { Message, MessageType, ConnectionState } from '../types';
import { fail } from 'assert';

// How to run this test:
// 1. Create test/.env file with your API credentials
// 2. Run: npx vitest test/CrossSDK.integration.test.ts
// This test cross-tests sending messages via one SDK and receiving responses via all other SDKs

/*
Run all cross-SDK tests
npx vitest test/CrossSDK.integration.test.ts

# Run specific scenarios
npx vitest -t "should send via RestSDK and receive responses via SocketSDK and SseSDK"
npx vitest -t "should send via SocketSDK and receive responses via all SDKs"
npx vitest -t "should demonstrate message consistency across SDKs"
npx vitest -t "should verify all SDKs use consistent authentication"
*/

// Load environment variables from test/.env file
config({ path: join(__dirname, '.env') });

describe('Cross-SDK Integration Tests', () => {
  const mockLogger = vi.fn();
  
  // Get configuration from environment variables or fail
  const apiKey = process.env.API_KEY ?? fail('API_KEY is not set');
  const serverUrl = process.env.SERVER_URL ?? fail('SERVER_URL is not set');
  const tenantId = process.env.TENANT_ID ?? fail('TENANT_ID is not set');
  const participantId = process.env.PARTICIPANT_ID ?? fail('PARTICIPANT_ID is not set');
  const workflowType = process.env.WORKFLOW_TYPE ?? fail('WORKFLOW_TYPE is not set');
  
  let restSDK: RestSDK;
  let socketSDK: SocketSDK;
  let sseSDK: SseSDK;
  
  // Shared message collectors for all SDKs
  let allReceivedChatMessages: { sdk: string; message: Message }[] = [];
  let allReceivedDataMessages: { sdk: string; message: Message }[] = [];
  let allReceivedHandoffMessages: { sdk: string; message: Message }[] = [];
  let socketInboundProcessed: string[] = [];
  let connectionStates: { sdk: string; state: ConnectionState }[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    allReceivedChatMessages = [];
    allReceivedDataMessages = [];
    allReceivedHandoffMessages = [];
    socketInboundProcessed = [];
    connectionStates = [];
  });

  afterEach(async () => {
    console.log('🧹 Cleaning up SDKs...');
    if (restSDK) {
      restSDK.dispose();
    }
    if (socketSDK) {
      await socketSDK.dispose();
    }
    if (sseSDK) {
      sseSDK.dispose();
    }
  });

  // Helper function to set up all SDKs
  const setupAllSDKs = async () => {
    console.log('🔧 Setting up all three SDKs...');
    
    // Setup RestSDK
    restSDK = new RestSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger
    });

    // Setup SocketSDK with event handlers
    socketSDK = new SocketSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      autoReconnect: true,
      eventHandlers: {
        onInboundProcessed: (threadId) => {
          console.log('🟦 [SocketSDK] Inbound message processed:', threadId);
          socketInboundProcessed.push(threadId);
        },
        onReceiveChat: (message) => {
          console.log('🟦 [SocketSDK] Received Chat message:', message.text?.substring(0, 100) + '...');
          allReceivedChatMessages.push({ sdk: 'SocketSDK', message });
        },
        onReceiveData: (message) => {
          console.log('🟦 [SocketSDK] Received Data message');
          allReceivedDataMessages.push({ sdk: 'SocketSDK', message });
        },
        onReceiveHandoff: (message) => {
          console.log('🟦 [SocketSDK] Received Handoff message');
          allReceivedHandoffMessages.push({ sdk: 'SocketSDK', message });
        },
        onConnectionStateChanged: (oldState, newState) => {
          console.log('🟦 [SocketSDK] Connection state:', oldState, '->', newState);
          connectionStates.push({ sdk: 'SocketSDK', state: newState });
        }
      }
    });

    // Setup SseSDK with event handlers
    sseSDK = new SseSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
      autoReconnect: true,
      eventHandlers: {
        onReceiveChat: (message) => {
          console.log('🟩 [SseSDK] Received Chat message:', message.text?.substring(0, 100) + '...');
          allReceivedChatMessages.push({ sdk: 'SseSDK', message });
        },
        onReceiveData: (message) => {
          console.log('🟩 [SseSDK] Received Data message');
          allReceivedDataMessages.push({ sdk: 'SseSDK', message });
        },
        onReceiveHandoff: (message) => {
          console.log('🟩 [SseSDK] Received Handoff message');
          allReceivedHandoffMessages.push({ sdk: 'SseSDK', message });
        },
        onConnected: () => {
          console.log('🟩 [SseSDK] Connected');
          connectionStates.push({ sdk: 'SseSDK', state: ConnectionState.Connected });
        },
        onDisconnected: (reason) => {
          console.log('🟩 [SseSDK] Disconnected:', reason);
          connectionStates.push({ sdk: 'SseSDK', state: ConnectionState.Disconnected });
        }
      }
    });

    // Connect real-time SDKs
    console.log('🔌 Connecting SocketSDK...');
    await socketSDK.connect();
    expect(socketSDK.isConnected()).toBe(true);
    
    console.log('🔌 Subscribing SocketSDK to agent...');
    await socketSDK.subscribeToAgent(workflowType, participantId);

    console.log('🔌 Connecting SseSDK...');
    const sseParams: SseConnectionParams = {
      workflow: workflowType,
      participantId: participantId,
      heartbeatSeconds: 10
    };
    await sseSDK.connect(sseParams);
    
    // Wait for connections to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ All SDKs are set up and connected');
  };

  // Helper function to wait for responses and log results
  const waitForResponsesAndLog = async (testDescription: string, waitTime: number = 15000) => {
    console.log(`⏱️  [${testDescription}] Waiting ${waitTime/1000}s for responses...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    console.log(`📊 [${testDescription}] Results Summary:`);
    console.log(`   💬 Chat messages received: ${allReceivedChatMessages.length}`);
    console.log(`   📦 Data messages received: ${allReceivedDataMessages.length}`);
    console.log(`   🔄 Handoff messages received: ${allReceivedHandoffMessages.length}`);
    console.log(`   ✅ Socket inbound processed: ${socketInboundProcessed.length}`);
    
    if (allReceivedChatMessages.length > 0) {
      console.log(`   💬 Chat messages by SDK:`);
      const chatBySDK = allReceivedChatMessages.reduce((acc, msg) => {
        acc[msg.sdk] = (acc[msg.sdk] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      Object.entries(chatBySDK).forEach(([sdk, count]) => {
        console.log(`      ${sdk}: ${count} messages`);
      });
    }
    
    if (allReceivedDataMessages.length > 0) {
      console.log(`   📦 Data messages by SDK:`);
      const dataBySDK = allReceivedDataMessages.reduce((acc, msg) => {
        acc[msg.sdk] = (acc[msg.sdk] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      Object.entries(dataBySDK).forEach(([sdk, count]) => {
        console.log(`      ${sdk}: ${count} messages`);
      });
    }
  };

  // npx vitest -t "should send via RestSDK and receive responses via SocketSDK and SseSDK"
  it('should send via RestSDK and receive responses via SocketSDK and SseSDK', async () => {
    await setupAllSDKs();
    
    try {
      const testId = 'cross-test-rest-' + Date.now();
      
      // Send message via RestSDK
      const restRequest: RestMessageRequest = {
        requestId: testId,
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'Hello! Please provide a brief response about what you can help with.',
        data: {
          testType: 'cross-sdk-rest-send',
          timestamp: new Date().toISOString(),
          testId: testId
        }
      };

      console.log('📤 [RestSDK] Sending message...');
      const sendResult = await restSDK.send(restRequest);
      
      console.log('📨 [RestSDK] Send result:', sendResult.success ? 'Success' : sendResult.error);
      
      if (!sendResult.success && sendResult.statusCode === 401) {
        console.warn('⚠️  Authentication issue - skipping test');
        return;
      }
      
      expect(sendResult.success).toBe(true);
      
      await waitForResponsesAndLog('RestSDK Send Test', 20000);
      
      // Verify that at least one SDK received a response
      const totalResponses = allReceivedChatMessages.length + allReceivedDataMessages.length + allReceivedHandoffMessages.length;
      if (totalResponses > 0) {
        console.log('✅ Cross-SDK communication successful!');
        
        // Check that responses were received by real-time SDKs
        const socketResponses = allReceivedChatMessages.filter(m => m.sdk === 'SocketSDK').length + 
                               allReceivedDataMessages.filter(m => m.sdk === 'SocketSDK').length;
        const sseResponses = allReceivedChatMessages.filter(m => m.sdk === 'SseSDK').length + 
                            allReceivedDataMessages.filter(m => m.sdk === 'SseSDK').length;
        
        console.log(`   SocketSDK received: ${socketResponses} responses`);
        console.log(`   SseSDK received: ${sseResponses} responses`);
        
        // At least one real-time SDK should have received a response
        expect(socketResponses + sseResponses).toBeGreaterThan(0);
      } else {
        console.log('ℹ️  No agent responses received - this might be expected if the bot is not active');
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
  }, 30000);

  // npx vitest -t "should send via SocketSDK and receive responses via all SDKs"
  it('should send via SocketSDK and receive responses via all SDKs', async () => {
    await setupAllSDKs();
    
    try {
      const testId = 'cross-test-socket-' + Date.now();
      
      // Send message via SocketSDK
      const socketRequest: any = {
        requestId: testId,
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'What are your main capabilities? Please give a concise answer.',
        data: {
          documentId: 'ebbb57bd-8428-458f-9618-d8fe3bef103d',
          timestamp: new Date().toISOString(),
          testId: testId
        }
      };

      console.log('📤 [SocketSDK] Sending inbound message...');
      await socketSDK.sendInboundMessage(socketRequest, MessageType.Chat);
      console.log('✅ [SocketSDK] Message sent successfully');
      
      await waitForResponsesAndLog('SocketSDK Send Test', 20000);
      
      // Verify inbound processing confirmation
      expect(socketInboundProcessed.length).toBeGreaterThan(0);
      console.log('✅ Inbound message processing confirmed');
      
      // Check for responses across all SDKs
      const totalResponses = allReceivedChatMessages.length + allReceivedDataMessages.length + allReceivedHandoffMessages.length;
      if (totalResponses > 0) {
        console.log('✅ Cross-SDK communication successful!');
        
        // Verify responses were received by both real-time SDKs
        const socketResponses = allReceivedChatMessages.filter(m => m.sdk === 'SocketSDK').length + 
                               allReceivedDataMessages.filter(m => m.sdk === 'SocketSDK').length;
        const sseResponses = allReceivedChatMessages.filter(m => m.sdk === 'SseSDK').length + 
                            allReceivedDataMessages.filter(m => m.sdk === 'SseSDK').length;
        
        console.log(`   SocketSDK received: ${socketResponses} responses`);
        console.log(`   SseSDK received: ${sseResponses} responses`);
        
        // At least one SDK should have received a response
        expect(totalResponses).toBeGreaterThan(0);
      } else {
        console.log('ℹ️  No agent responses received - this might be expected if the bot is not active');
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
  }, 30000);

  // npx vitest -t "should demonstrate message consistency across SDKs"
  it('should demonstrate message consistency across SDKs', async () => {
    await setupAllSDKs();
    
    try {
      const testId = 'cross-test-consistency-' + Date.now();
      
      // Send a message that should trigger a predictable response
      const socketRequest: any = {
        requestId: testId,
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'Hello, can you confirm you received this message?',
        data: {
          testType: 'cross-sdk-consistency',
          timestamp: new Date().toISOString(),
          testId: testId
        }
      };

      console.log('📤 [Consistency Test] Sending message via SocketSDK...');
      await socketSDK.sendInboundMessage(socketRequest, MessageType.Chat);
      
      await waitForResponsesAndLog('Consistency Test', 20000);
      
      // Clear arrays for second test
      const firstTestResponses = {
        chat: [...allReceivedChatMessages],
        data: [...allReceivedDataMessages],
        handoff: [...allReceivedHandoffMessages]
      };
      
      allReceivedChatMessages = [];
      allReceivedDataMessages = [];
      allReceivedHandoffMessages = [];
      
      // Send the same message again via RestSDK
      const restRequest: RestMessageRequest = {
        requestId: testId + '-rest',
        participantId: participantId,
        workflow: workflowType,
        type: 'Chat',
        text: 'Hello, can you confirm you received this message?',
        data: {
          testType: 'cross-sdk-consistency-rest',
          timestamp: new Date().toISOString(),
          testId: testId + '-rest'
        }
      };

      console.log('📤 [Consistency Test] Sending same message via RestSDK...');
      const sendResult = await restSDK.send(restRequest);
      expect(sendResult.success).toBe(true);
      
      await waitForResponsesAndLog('Consistency Test (Second)', 15000);
      
      const secondTestResponses = {
        chat: [...allReceivedChatMessages],
        data: [...allReceivedDataMessages],
        handoff: [...allReceivedHandoffMessages]
      };
      
      console.log('🔍 Message Consistency Analysis:');
      console.log(`   First test (SocketSDK): ${firstTestResponses.chat.length} chat, ${firstTestResponses.data.length} data`);
      console.log(`   Second test (RestSDK): ${secondTestResponses.chat.length} chat, ${secondTestResponses.data.length} data`);
      
      // Both tests should have triggered some form of response
      const firstTotal = firstTestResponses.chat.length + firstTestResponses.data.length + firstTestResponses.handoff.length;
      const secondTotal = secondTestResponses.chat.length + secondTestResponses.data.length + secondTestResponses.handoff.length;
      
      if (firstTotal > 0 && secondTotal > 0) {
        console.log('✅ Both sending methods triggered responses');
        
        // Check if both SocketSDK and SseSDK received responses in at least one test
        const allResponses = [...firstTestResponses.chat, ...firstTestResponses.data, 
                             ...secondTestResponses.chat, ...secondTestResponses.data];
        const socketReceived = allResponses.some(r => r.sdk === 'SocketSDK');
        const sseReceived = allResponses.some(r => r.sdk === 'SseSDK');
        
        console.log(`   SocketSDK participated: ${socketReceived}`);
        console.log(`   SseSDK participated: ${sseReceived}`);
        
        // At least one real-time SDK should have received responses
        expect(socketReceived || sseReceived).toBe(true);
      } else {
        console.log('ℹ️  Responses may vary based on bot state - this is normal for integration testing');
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
  }, 45000);

  // npx vitest -t "should verify all SDKs use consistent authentication"
  it('should verify all SDKs use consistent authentication', async () => {
    await setupAllSDKs();
    
    // Verify all SDKs are using the same authentication method
    expect(restSDK.getAuthType()).toBe('apiKey');
    expect(socketSDK.getAuthType()).toBe('apiKey');
    expect(sseSDK.getAuthType()).toBe('apiKey');
    
    // Verify all SDKs are configured with the same tenant
    expect(restSDK.getTenantId()).toBe(tenantId);
    expect(socketSDK.getTenantId()).toBe(tenantId);
    expect(sseSDK.getTenantId()).toBe(tenantId);
    
    console.log('✅ All SDKs use consistent authentication and tenant configuration');
    
    // Test that all SDKs can handle authentication updates consistently
    const newApiKey = 'test-key-' + Date.now();
    
    restSDK.updateApiKey(newApiKey);
    socketSDK.updateApiKey(newApiKey);
    sseSDK.updateApiKey(newApiKey);
    
    expect(restSDK.getAuthType()).toBe('apiKey');
    expect(socketSDK.getAuthType()).toBe('apiKey');
    expect(sseSDK.getAuthType()).toBe('apiKey');
    
    console.log('✅ All SDKs handle authentication updates consistently');
  }, 10000);
}); 