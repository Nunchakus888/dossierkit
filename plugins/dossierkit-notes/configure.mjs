import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function configure(root, endpoint, appId) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTPS MCP URL without credentials, query or fragment.');
  if (appId && !/^(plugin_asdk_app_|connector_|dev-)[A-Za-z0-9_-]+$/.test(appId)) throw new Error('Pass the exact registered OpenAI connection ID, not a token or invented ID.');
  const write = (name,value) => fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
  write('mcp.json',{$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{'dossierkit-notes':{type:'streamable-http',url:url.href}}});
  write('.mcp.json',{'dossierkit-notes':{url:url.href}});
  const portable = JSON.parse(fs.readFileSync(path.join(root,'plugin.json'),'utf8'));
  const codex = JSON.parse(fs.readFileSync(path.join(root,'.codex-plugin/plugin.json'),'utf8'));
  if (appId) {
    write('.app.json',{apps:{'dossierkit-notes':{id:appId}}});
    portable.extensions = {...portable.extensions,'com.openai':{apps:'./.app.json'}};
    codex.apps = './.app.json';
  } else {
    // Reconfiguring to another instance must never retain its previous account binding.
    fs.rmSync(path.join(root,'.app.json'),{force:true});
    if (portable.extensions) delete portable.extensions['com.openai'];
    delete codex.apps;
  }
  write('plugin.json',portable); write('.codex-plugin/plugin.json',codex);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    if (args[0] !== '--url' || !args[1] || (args.length > 2 && (args[2] !== '--app-id' || !args[3])) || args.length > 4) throw new Error('Usage: node configure.mjs --url https://YOUR-MCP/api/mcp [--app-id REGISTERED_CONNECTION_ID]');
    configure(path.dirname(fileURLToPath(import.meta.url)),args[1],args[3]);
    console.log('Connection files configured. Authenticate separately in each client; no credentials were stored.');
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
