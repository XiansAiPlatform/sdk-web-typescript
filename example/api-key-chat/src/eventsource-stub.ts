// Stub for the Node-only `eventsource` package. The browser uses the native
// EventSource, so this module is never actually used at runtime.
export const EventSource = globalThis.EventSource;
export default { EventSource };
