/**
 * Tiny environment helper.
 * In this template we primarily rely on NG_APP_API_BASE injected by runtime environment,
 * but we also allow a safe fallback.
 */
export const environment = {
  apiBase: (globalThis as any)['NG_APP_API_BASE'] ?? '/api',
};
