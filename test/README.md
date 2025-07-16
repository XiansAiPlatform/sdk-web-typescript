# RPC SDK Tests

This directory contains tests for the RPC SDK functionality using Vitest.

## Test Files

- `RpcSDK.test.ts` - Unit tests for RPC SDK functionality
  - Constructor validation tests
  - HTTP request and response handling tests
  - Logging and error handling tests
  - URL construction tests
- `RpcSDK.integration.test.ts` - Integration tests with real-world scenarios
  - Document service integration tests
  - Multiple request handling tests
  - Error handling in integration scenarios

## Configuration

### Using .env File

The integration tests support loading configuration from a `.env` file located in the `test/` directory. This is the recommended approach for managing test configuration.

1. **Create or modify `test/.env`:**
   ```bash
   # API key for integration tests
   API_KEY=your-api-key-here
   
   # Server URL for the RPC endpoint
   SERVER_URL=http://localhost:5000
   
   # Tenant ID for the requests
   TENANT_ID=default
   ```

2. **The `.env` file is automatically loaded** by the integration tests, so no additional configuration is needed.

### Environment Variables

For integration tests, you can configure settings via environment variables:

```bash
# Using .env file (recommended)
# Edit test/.env and add:
API_KEY=your-api-key-here
SERVER_URL=http://localhost:5000
TENANT_ID=default

# Or set environment variables directly
export API_KEY="your-api-key-here"
export SERVER_URL="http://localhost:5000"
export TENANT_ID="default"
npm test

# Or run tests with inline environment variables
API_KEY="your-api-key-here" SERVER_URL="http://localhost:5000" TENANT_ID="default" npx vitest test/RpcSDK.integration.test.ts
```

**Available environment variables:**
- `API_KEY` - API key for authentication (required)
- `SERVER_URL` - Server URL for RPC calls (required, e.g., `http://localhost:5000`)
- `TENANT_ID` - Tenant ID for requests (required, e.g., `default`)

All environment variables are required for integration tests. If any are missing, the tests will fail with an error message.

## Running Tests

### Standard Commands

```bash
# Run all tests in watch mode (default)
npm test

# Run tests once and exit
npm run test:run

# Run tests with UI interface
npm run test:ui

# Run tests with coverage
npx vitest run --coverage
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