import { describe, it, expect, beforeEach, vi } from 'vitest';
import { config } from 'dotenv';
import { join } from 'path';
import RpcSDK from '../RpcSDK';
import { fail } from 'assert';

// Load environment variables from test/.env file
config({ path: join(__dirname, '.env') });

class DocumentRequest {
  documentId: string;
  participantId: string;
}

// Test interface for document service
interface AgentService {
  GetDocument(request: DocumentRequest): Promise<{
    principal: {
      userId: string;
      fullName: string;
      nationalId: string;
      address: string;
    };
    scope: string;
    representatives: any[];
    conditions: any[];
    witnesses: any[];
  }>;
}

describe('RpcSDK Integration Tests', () => {
  const mockLogger = vi.fn();
  
  // Get configuration from environment variables or fail
  const apiKey = process.env.API_KEY ?? fail('API_KEY is not set');
  const serverUrl = process.env.SERVER_URL ?? fail('SERVER_URL is not set');
  const tenantId = process.env.TENANT_ID ?? fail('TENANT_ID is not set');
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should work with real-world workflow and procedure names', async () => {
    const sdk = new RpcSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
    });
    
    const documentService = sdk.createProxy<AgentService>(
      'Power of Attorney Agent v1.3.1:Document Data Flow'
    );

    try {
      const result = await documentService.GetDocument({
        documentId: '4e85a9b8-9912-4264-adb9-d968e787f9cb',
        participantId: 'participant123'
      });
      console.log(result);
      
      // Verify the response structure
      expect(result.principal.userId).not.toBeNull();
      
    } catch (error) {
      // If server is not available, skip the test with a message
      if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('fetch'))) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 10000); // 10 second timeout for real network calls

  it('should handle multiple document requests', async () => {
    const sdk = new RpcSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
    });
    
    const documentService = sdk.createProxy<AgentService>(
      'default:Power of Attorney Agent v1.3.1:Document Data Flow',
      'DocumentService'
    );

    try {
      // Make multiple calls
      const result1 = await documentService.GetDocument({
        documentId: '4e85a9b8-9912-4264-adb9-d968e787f9cb',
        participantId: 'participant123'
      });
      const result2 = await documentService.GetDocument({
        documentId: '4e85a9b8-9912-4264-adb9-d968e787f9cc',
        participantId: 'participant456'
      });

      // Verify both calls returned data
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      
      // Verify both calls have the expected structure
      expect(result1).toHaveProperty('principal');

      
      // Verify logger was called for both requests
      expect(mockLogger).toHaveBeenCalledTimes(2);
    } catch (error) {
      // If server is not available, skip the test with a message
      if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('fetch'))) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 15000); // 15 second timeout for multiple network calls

  it('should handle errors in integration scenario', async () => {
    const sdk = new RpcSDK({
      tenantId: tenantId,
      apiKey: '212',
      serverUrl: serverUrl,
      logger: mockLogger,
    });
    
    const documentService = sdk.createProxy<AgentService>(
      'default:Power of Attorney Agent v1.3.1:Document Data Flow',
      'DocumentService'
    );

    try {
      // Try to get a document that should not exist
      await expect(documentService.GetDocument({
        documentId: 'nonexistent-doc',
        participantId: 'participant123'
      })).rejects.toThrow();
      
      // Verify error was logged
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        [expect.any(Error)]
      );
    } catch (error) {
      // If server is not available, skip the test with a message
      if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('fetch'))) {
        console.warn(`⚠️  Server not available at ${serverUrl}, skipping integration test`);
        return;
      }
      throw error;
    }
  }, 10000); // 10 second timeout for real network calls

  it('should use environment variables for configuration', () => {
    // This test verifies that the environment variables are being used
    const expectedApiKey = process.env.API_KEY ?? fail('API_KEY is not set');
    const expectedServerUrl = process.env.SERVER_URL ?? fail('SERVER_URL is not set');
    const expectedTenantId = process.env.TENANT_ID ?? fail('TENANT_ID is not set');
    
    const sdk = new RpcSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: serverUrl,
      logger: mockLogger,
    });
    
    expect(sdk.getApiKey()).toBe(expectedApiKey);
    expect(sdk.getServerUrl()).toBe(expectedServerUrl);
    expect(sdk.getTenantId()).toBe(expectedTenantId);
  });

  it('should handle server unavailability gracefully', async () => {
    const sdk = new RpcSDK({
      tenantId: tenantId,
      apiKey: apiKey,
      serverUrl: 'http://localhost:9999', // Non-existent server
      logger: mockLogger,
    });
    
    const documentService = sdk.createProxy<AgentService>(
      'default:Power of Attorney Agent v1.3.1:Document Data Flow'
    );

    // This should throw a network error
    await expect(documentService.GetDocument({
      documentId: 'doc123',
      participantId: 'participant123'
    })).rejects.toThrow();
    
    // Verify error was logged
    expect(mockLogger).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      [expect.any(Error)]
    );
  }, 10000); // 10 second timeout for real network calls
}); 