/**
 * Raspina CRM runtime configuration (served as a static file, no secrets here).
 *
 * mode:
 *   "auto"   – try the PHP API first; fall back to demo only when the API is not installed.
 *   "server" – require login and server persistence (use this in production).
 *   "demo"   – browser-only demo data, no authentication (never use in production).
 *
 * apiBase is relative to this file, so the whole app can live inside public_html.
 */
window.RASPINA_APP = {
  mode: 'auto',
  apiBase: './api',
};
