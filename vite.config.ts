// Configuration handled by index.html importmap for stability.
export default {
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow the sandbox/preview proxy hosts (e.g. https://5173-<id>.e2b.app)
    allowedHosts: true as const,
    hmr: { clientPort: 443 },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true as const,
  },
};
