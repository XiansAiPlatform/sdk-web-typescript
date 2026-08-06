/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  readonly VITE_TENANT_ID?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_WORKFLOW?: string;
  readonly VITE_PARTICIPANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
