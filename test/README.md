# SDK Tests

This directory contains tests for both the RPC SDK and Socket SDK functionality using Vitest.

## Test Files

### RpcSDK Tests
- `RpcSDK.test.ts` - Unit tests for RPC SDK functionality
  - Constructor validation tests
  - HTTP request and response handling tests
  - Logging and error handling tests
  - URL construction tests
- `RpcSDK.integration.test.ts` - Integration tests with real-world scenarios
  - Document service integration tests
  - Multiple request handling tests
  - Error handling in integration scenarios

### SocketSDK Tests
- `SocketSDK.integration.test.ts` - Integration tests for Socket SDK functionality
  - WebSocket connection tests
  - Bot message sending and receiving tests
  - Bot history retrieval tests
  - Multiple bot subscription tests
  - Bot metrics retrieval tests
  - Authentication and error handling tests

## Configuration

### Using .env File

Both RPC and Socket integration tests support loading configuration from a `.env` file located in the `test/` directory. This is the recommended approach for managing test configuration.

1. **Create or modify `test/.env`:**
   ```bash
   # API key for integration tests (used by both RPC and Socket SDKs)
   API_KEY=your-api-key-here
   
   # Server URL for both RPC and WebSocket endpoints
   SERVER_URL=http://localhost:5000
   
   # Tenant ID for the requests
   TENANT_ID=default
   
   # Optional: JWT token for testing JWT authentication (alternative to API_KEY)
   JWT_TOKEN=your-jwt-token-here
   ```

2. **The `.env` file is automatically loaded** by the integration tests, so no additional configuration is needed.

### Environment Variables

For integration tests, you can configure settings via environment variables:

```bash
# Using .env file (recommended)
# Copy test/.env.example to test/.env and edit:
API_KEY=your-api-key-here
SERVER_URL=http://localhost:5000
TENANT_ID=default

# Or set environment variables directly
export API_KEY="your-api-key-here"
export SERVER_URL="http://localhost:5000"
export TENANT_ID="your-tenant-id"
```

## SocketSDK Integration Test Features

The SocketSDK integration tests cover:

1. **Connection Management**
   - WebSocket connection establishment
   - Connection state monitoring
   - Automatic reconnection handling
   - Authentication with API keys and JWT tokens

2. **Bot Communication**
   - Sending bot requests with various parameters
   - Receiving bot responses asynchronously
   - Error handling for bot communication

3. **Subscription Management**
   - Subscribing to individual bot workflows
   - Batch subscribing to multiple workflows
   - Unsubscribing from workflows

4. **History and Metrics**
   - Retrieving bot conversation history
   - Getting bot service metrics
   - Monitoring connection performance

5. **Error Scenarios**
   - Authentication failures
   - Server unavailability
   - Network disconnections
   - Invalid parameters

## Running Tests

### Standard Commands

```bash
# Run all tests
npm test

# Run only RpcSDK tests
npx vitest run --grep RpcSDK

# Run only SocketSDK tests
npx vitest run --grep SocketSDK

# Run with coverage
npm run test:coverage

# Run in watch mode
npx vitest
```

### Running Specific Tests

```bash
# Run all tests in a specific file
npx vitest test/RpcSDK.test.ts

# Run integration tests only
npx vitest test/RpcSDK.integration.test.ts

# Run tests matching a pattern in the test name
npx vitest --reporter=verbose --run -t "should work with real-world workflow"

# Run tests matching a pattern in file names
npx vitest run --reporter=verbose RpcSDK

# Run tests in a specific describe block
npx vitest --reporter=verbose --run -t "Constructor"

# Run tests in watch mode for specific file
npx vitest test/RpcSDK.test.ts --reporter=verbose

# Run tests with detailed output
npx vitest run --reporter=verbose

# Run tests and show which tests are being skipped
npx vitest run --reporter=verbose --run
```

### Test Structure

Tests are written using Vitest, which has a Jest-compatible API:

```typescript
import { describe, it, expect, vi } from 'vitest';
import RpcSDK from '../RpcSDK';

describe('RpcSDK', () => {
  it('should do something', () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
```

### Mocking

Use `vi.fn()` to create mock functions:

```typescript
const mockLogger = vi.fn();
const rpcSDK = new RpcSDK({ 
  tenantId: 'test-tenant',
  apiKey: 'test-api-key',
  serverUrl: 'http://localhost:5000',
  logger: mockLogger 
});
```

### Debug Mode

To run tests with more detailed output:

```bash
# Run with verbose reporter
npx vitest run --reporter=verbose

# Run with debug output
DEBUG=* npx vitest run

# Run specific test with detailed output
npx vitest test/RpcSDK.integration.test.ts --reporter=verbose
```

### Common Test Patterns

```bash
# Run only unit tests (exclude integration tests)
npx vitest test/RpcSDK.test.ts

# Run only integration tests
npx vitest test/RpcSDK.integration.test.ts

# Run tests and generate coverage report
npx vitest run --coverage

# Run tests in parallel (default) or serial
npx vitest run --no-parallel
```

## File Structure

```
test/
├── .env                        # Environment configuration (create this file)
├── README.md                   # This file
├── RpcSDK.test.ts             # Unit tests
└── RpcSDK.integration.test.ts # Integration tests
```

## Example .env File

```bash
# Copy this content to test/.env
API_KEY=sk-Xnai-P82pSrmqtOnb_rkDiwl8uhGDuEsvwWVLdeyG6AlsxPBcbQT-5DEzToIWrbzoSGMa2hKlXMmRG8-CS1qHIZzWKA
SERVER_URL=http://localhost:5000
TENANT_ID=default
```

## Integration Test Notes

- Integration tests make real HTTP requests to the configured server
- Tests will gracefully handle server unavailability by skipping tests with warnings
- Timeouts are set to 10-15 seconds to accommodate real network calls
- Tests verify both successful responses and error handling scenarios 