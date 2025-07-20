# SDK Testing Guide

This directory contains integration tests for the Flowmaxer.ai Web SDK.

## Test Setup

1. **Environment Configuration**: Create a `.env` file in the `test/` directory with your API credentials:
   ```env
   API_KEY=your-api-key
   SERVER_URL=http://localhost:5000
   TENANT_ID=your-tenant-id
   PARTICIPANT_ID=your-participant-id
   WORKFLOW_TYPE=your-workflow-name
   ```

2. **Dependencies**: Ensure all dependencies are installed:
   ```bash
   npm install
   ```

## Available Tests

### Individual SDK Integration Tests

#### RestSDK Integration Test
Tests HTTP-based communication with UserApi endpoints.

```bash
# Run all RestSDK tests
npx vitest test/RestSDK.integration.test.ts

# Run specific test
npx vitest -t "should send message to workflow using send endpoint"
npx vitest -t "should send message and wait for response using converse endpoint"
```

**Key Features Tested:**
- Send messages without waiting for response (`send()`)
- Send messages and wait for synchronous response (`converse()`)
- Get conversation history (`getHistory()`)
- Authentication methods (API key, JWT)
- Error handling and timeout scenarios

#### SocketSDK Integration Test
Tests real-time WebSocket communication using SignalR.

```bash
# Run all SocketSDK tests
npx vitest test/SocketSDK.integration.test.ts

# Run specific test
npx vitest -t "should connect to chat hub, send message, and receive agent responses"
```

**Key Features Tested:**
- WebSocket connection establishment
- Real-time message sending (`sendInboundMessage()`)
- Agent subscription (`subscribeToAgent()`)
- Event handling (Chat, Data, Handoff responses)
- Connection state management
- Automatic reconnection

#### SseSDK Integration Test
Tests Server-Sent Events for real-time communication.

```bash
# Run all SseSDK tests
npx vitest test/SseSDK.integration.test.ts

# Run specific test
npx vitest -t "should connect to SSE stream with API key authentication"
```

**Key Features Tested:**
- SSE connection establishment
- Event streaming (Chat, Data, Handoff events)
- Heartbeat monitoring
- Authentication methods
- Connection state management
- Event handler consistency

### Cross-SDK Integration Test

**NEW:** Tests the happy path of sending messages via one SDK and receiving responses via all other SDKs.

```bash
# Run all cross-SDK tests
npx vitest test/CrossSDK.integration.test.ts

# Run specific cross-SDK tests
npx vitest -t "should send via RestSDK and receive responses via SocketSDK and SseSDK"
npx vitest -t "should send via SocketSDK and receive responses via all SDKs"
npx vitest -t "should demonstrate message consistency across SDKs"
npx vitest -t "should verify all SDKs use consistent authentication"
```

**Key Features Tested:**
- **Cross-SDK Communication**: Send via one SDK, receive via all others
- **Message Consistency**: Verify same message triggers similar responses across SDKs
- **Authentication Consistency**: Ensure all SDKs use consistent auth methods
- **Real-time Event Handling**: Test that both SocketSDK and SseSDK receive the same events
- **Happy Path Scenarios**: Focus on successful communication patterns

**Test Scenarios:**
1. **RestSDK → SocketSDK/SseSDK**: Send message via RestSDK.send(), listen for responses via real-time SDKs
2. **SocketSDK → All SDKs**: Send via SocketSDK.sendInboundMessage(), verify responses across all listening SDKs
3. **Consistency Verification**: Send similar messages via different SDKs, compare response patterns
4. **Authentication Alignment**: Verify all SDKs use consistent authentication and tenant configuration

### Authentication Consistency Test

Tests that all SDKs handle authentication methods consistently.

```bash
npx vitest test/AuthMethodsConsistency.test.ts
```

**Key Features Tested:**
- API key authentication across all SDKs
- JWT token authentication across all SDKs
- JWT callback authentication across all SDKs
- Authentication method switching
- Error handling for invalid credentials

## Test Categories

### Integration Tests
- **Purpose**: Test real communication with the server
- **Requirements**: Running server instance and valid credentials
- **Behavior**: May skip tests if server is unavailable

### Unit Tests
- **Purpose**: Test SDK logic and error handling
- **Requirements**: No server connection needed
- **Behavior**: Use mocks and stubs

## Running Tests

### Run All Tests
```bash
npm test
# or
npx vitest
```

### Run Specific Test Files
```bash
npx vitest test/RestSDK.integration.test.ts
npx vitest test/SocketSDK.integration.test.ts
npx vitest test/SseSDK.integration.test.ts
npx vitest test/CrossSDK.integration.test.ts
npx vitest test/AuthMethodsConsistency.test.ts
```

### Run Tests in Watch Mode
```bash
npx vitest --watch
```

### Run Tests with Detailed Output
```bash
npx vitest --reporter=verbose
```

## Test Environment Notes

### Server Availability
- Integration tests require a running server at the configured `SERVER_URL`
- Tests will gracefully skip if the server is not available
- Authentication errors (401/403) are logged but don't fail the test

### Timing Considerations
- Real-time tests include wait periods for message processing
- Cross-SDK tests wait longer to ensure all SDKs receive responses
- Adjust timeout values in test files if needed for slower environments

### Message Flow Testing
The cross-SDK test specifically validates this flow:
1. **Setup**: All three SDKs are initialized and connected
2. **Send**: Message sent via one SDK (RestSDK.send() or SocketSDK.sendInboundMessage())
3. **Listen**: All real-time SDKs (SocketSDK, SseSDK) listen for responses
4. **Verify**: Confirm responses are received across multiple SDKs
5. **Consistency**: Verify similar messages produce similar response patterns

This ensures that your application can mix and match SDK usage patterns while maintaining consistent behavior.

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify your API key and credentials in `.env`
2. **Connection Timeouts**: Check that the server is running and accessible
3. **No Agent Responses**: The bot may be inactive; this is normal for integration testing
4. **Cross-SDK Test Failures**: Ensure both SocketSDK and SseSDK can connect simultaneously

### Debug Tips

- Enable verbose logging by setting logger functions in the SDK options
- Check server logs for message processing status
- Verify network connectivity and firewall settings
- Use shorter timeout values during development

### Environment Variables
Make sure your `.env` file contains all required variables:
- `API_KEY`: Your Flowmaxer.ai API key
- `SERVER_URL`: The base URL of your Flowmaxer.ai server
- `TENANT_ID`: Your tenant identifier
- `PARTICIPANT_ID`: A participant ID for testing
- `WORKFLOW_TYPE`: The workflow/agent type to test with 