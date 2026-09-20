import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillAgentConfig = (endpoint) => `interface:
  display_name: "DossierKit Note Publishing"
  short_description: "Deep-read sources and publish evidence-backed notes"
  default_prompt: "Use $publish-note to deep-read this source and prepare a focused, evidence-backed note for DossierKit publication."

dependencies:
  tools:
    - type: "mcp"
      value: "dossierkit-notes"
      description: "Read, save, and delete canonical DossierKit notes"
      transport: "streamable_http"
      url: ${JSON.stringify(endpoint)}
`;

export function configure(root, endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTPS MCP URL without credentials, query or fragment.');
  const write = (name,value) => fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
  write('mcp.json',{$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{'dossierkit-notes':{type:'streamable-http',url:url.href}}});
  write('.mcp.json',{mcpServers:{'dossierkit-notes':{url:url.href}}});
  fs.writeFileSync(path.join(root,'skills/publish-note/agents/openai.yaml'),skillAgentConfig(url.href));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    if (args[0] !== '--url' || !args[1] || args.length > 2) throw new Error('Usage: node configure.mjs --url https://YOUR-MCP/api/mcp');
    configure(path.dirname(fileURLToPath(import.meta.url)),args[1]);
    console.log('Desktop connection files configured. Authenticate separately in each client; no credentials were stored.');
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
