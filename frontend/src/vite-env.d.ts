/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** backend(Spring Boot) 주소. 비워 두면 같은 출처로 요청한다. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
