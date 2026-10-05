/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly DYNAMIC_ENV_ID: string;
}
interface ImportMetaEnv {
  readonly VITE_ALCHEMY_API_KEY: string;
  readonly VITE_ALCHEMY_POLICY_ID: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_INDEXER_URL?: string;
}
