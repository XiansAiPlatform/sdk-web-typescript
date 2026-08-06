import './styles.css';
import RestSDK from '../../../RestSDK';
import SseSDK from '../../../SseSDK';
import type { Message } from '../../../types';

/**
 * Minimal chat example for the XiansAi SDK.
 *
 *  - Outbound messages are sent with the REST SDK (`restSDK.send`).
 *  - Inbound (agent) messages arrive over the SSE stream (`sseSDK.onReceiveChat`).
 *
 * This intentionally keeps everything in one file so the flow is easy to follow.
 */

interface ChatConfig {
  tenantId: string;
  apiKey: string;
  workflow: string;
  participantId: string;
}

const CONFIG_KEY = 'xians-chat-config';

// All requests go to our own origin (the Vite dev server), which proxies
// `/api/*` to the real XiansAi server (see vite.config.ts). This keeps every
// request same-origin and avoids CORS entirely.
const API_BASE_URL = window.location.origin;

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const configForm = $<HTMLFormElement>('configForm');
const connectBtn = $<HTMLButtonElement>('connectBtn');
const disconnectBtn = $<HTMLButtonElement>('disconnectBtn');
const composer = $<HTMLFormElement>('composer');
const input = $<HTMLInputElement>('input');
const sendBtn = $<HTMLButtonElement>('sendBtn');
const messagesEl = $<HTMLDivElement>('messages');
const emptyState = $<HTMLDivElement>('emptyState');
const statusDot = $<HTMLSpanElement>('statusDot');
const statusText = $<HTMLSpanElement>('statusText');

// ---------------------------------------------------------------------------
// SDK state
// ---------------------------------------------------------------------------
let restSDK: RestSDK | null = null;
let sseSDK: SseSDK | null = null;
let config: ChatConfig | null = null;

// ---------------------------------------------------------------------------
// Config persistence (prefilled from .env via Vite, then localStorage)
// ---------------------------------------------------------------------------
function loadConfig(): Partial<ChatConfig> {
  const stored = localStorage.getItem(CONFIG_KEY);
  const fromStorage: Partial<ChatConfig> = stored ? JSON.parse(stored) : {};
  const env = import.meta.env;
  return {
    tenantId: fromStorage.tenantId ?? env.VITE_TENANT_ID ?? '',
    apiKey: fromStorage.apiKey ?? env.VITE_API_KEY ?? '',
    workflow: fromStorage.workflow ?? env.VITE_WORKFLOW ?? '',
    participantId: fromStorage.participantId ?? env.VITE_PARTICIPANT_ID ?? '',
  };
}

function prefillForm() {
  const c = loadConfig();
  ($('tenantId') as HTMLInputElement).value = c.tenantId ?? '';
  ($('apiKey') as HTMLInputElement).value = c.apiKey ?? '';
  ($('workflow') as HTMLInputElement).value = c.workflow ?? '';
  ($('participantId') as HTMLInputElement).value = c.participantId ?? '';

  // Show where the proxy forwards to (informational only).
  const proxyEl = document.getElementById('proxyTarget');
  if (proxyEl) {
    proxyEl.textContent = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:5005';
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
type Sender = 'user' | 'agent' | 'system';

function setStatus(state: 'connected' | 'connecting' | 'disconnected' | 'error', label: string) {
  statusDot.className = 'status__dot';
  if (state === 'connected') statusDot.classList.add('is-connected');
  if (state === 'connecting') statusDot.classList.add('is-connecting');
  if (state === 'error') statusDot.classList.add('is-error');
  statusText.textContent = label;
}

function addMessage(sender: Sender, text: string, timestamp?: string) {
  emptyState.style.display = 'none';

  const el = document.createElement('div');
  el.className = `msg msg--${sender}`;
  el.textContent = text;

  if (sender !== 'system') {
    const meta = document.createElement('div');
    meta.className = 'msg__meta';
    const time = timestamp ? new Date(timestamp) : new Date();
    meta.textContent = `${sender === 'user' ? 'You' : 'Agent'} · ${time.toLocaleTimeString()}`;
    el.appendChild(meta);
  }

  messagesEl.appendChild(el);
  scrollToBottom();
}

let typingEl: HTMLDivElement | null = null;
function showTyping() {
  if (typingEl) return;
  typingEl = document.createElement('div');
  typingEl.className = 'typing';
  typingEl.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(typingEl);
  scrollToBottom();
}

function hideTyping() {
  typingEl?.remove();
  typingEl = null;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setChatEnabled(enabled: boolean) {
  input.disabled = !enabled;
  sendBtn.disabled = !enabled;
  disconnectBtn.disabled = !enabled;
  connectBtn.disabled = enabled;
  Array.from(configForm.elements).forEach((el) => {
    if (el instanceof HTMLInputElement) el.disabled = enabled;
  });
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------
async function connect(cfg: ChatConfig) {
  config = cfg;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));

  // REST SDK — used to SEND messages.
  restSDK = new RestSDK({
    tenantId: cfg.tenantId,
    apiKey: cfg.apiKey,
    serverUrl: API_BASE_URL,
  });

  // SSE SDK — used to LISTEN for agent responses.
  sseSDK = new SseSDK({
    tenantId: cfg.tenantId,
    apiKey: cfg.apiKey,
    serverUrl: API_BASE_URL,
    eventHandlers: {
      onReceiveChat: (message: Message) => {
        // The stream can echo our own outgoing messages back; only render the
        // agent's replies (direction === 'Outgoing' from the server's view).
        if (message.direction === 'Incoming') return;
        hideTyping();
        if (message.text) addMessage('agent', message.text, message.createdAt);
      },
      onConnected: () => {
        setStatus('connected', 'Connected');
        addMessage('system', 'Connected to agent stream');
      },
      onDisconnected: (reason) => {
        setStatus('disconnected', 'Disconnected');
        if (reason) addMessage('system', `Disconnected: ${reason}`);
      },
      onReconnecting: () => setStatus('connecting', 'Reconnecting…'),
      onError: (error) => {
        setStatus('error', 'Error');
        addMessage('system', `Error: ${error}`);
      },
    },
  });

  setStatus('connecting', 'Connecting…');
  setChatEnabled(true);

  try {
    await sseSDK.connect({
      workflow: cfg.workflow,
      participantId: cfg.participantId,
    });
    input.focus();
  } catch (err) {
    setStatus('error', 'Connection failed');
    addMessage('system', `Failed to connect: ${(err as Error).message}`);
    disconnect();
  }
}

function disconnect() {
  sseSDK?.dispose();
  restSDK?.dispose();
  sseSDK = null;
  restSDK = null;
  setChatEnabled(false);
  setStatus('disconnected', 'Disconnected');
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
async function sendMessage(text: string) {
  if (!restSDK || !config) return;

  addMessage('user', text);
  showTyping();

  const result = await restSDK.send({
    workflow: config.workflow,
    participantId: config.participantId,
    type: 'Chat',
    text,
    requestId: crypto.randomUUID(),
  });

  if (!result.success) {
    hideTyping();
    addMessage('system', `Send failed: ${result.error ?? 'unknown error'}`);
  }
}

// ---------------------------------------------------------------------------
// Wire up events
// ---------------------------------------------------------------------------
configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(configForm);
  connect({
    tenantId: String(data.get('tenantId')).trim(),
    apiKey: String(data.get('apiKey')).trim(),
    workflow: String(data.get('workflow')).trim(),
    participantId: String(data.get('participantId')).trim(),
  });
});

disconnectBtn.addEventListener('click', () => {
  disconnect();
  addMessage('system', 'Disconnected');
});

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendMessage(text);
});

prefillForm();
