/** Web/API listen port when config and PI_WEB_PORT are unset. Production serves the UI here too. */
export const DEFAULT_WEB_PORT = 3418;

/** Vite dev-server port. It proxies /api to DEFAULT_WEB_PORT. */
export const DEFAULT_DEV_CLIENT_PORT = 3419;
