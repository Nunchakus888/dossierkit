import { handleViews } from '../../src/lib/view-counter/server.mjs';
import manifest from '../../src/lib/view-counter/manifest.json';

// The D1 binding exists only on sunionpeaks production, not previews or Notes MCP.
export const onRequest = (context: { request: Request; env: Record<string, unknown> }) =>
  handleViews(context.request, context.env, manifest);
