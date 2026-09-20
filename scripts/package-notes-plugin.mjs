// Export an explicit file allowlist, never local credentials, caches, fonts or Git history.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { configure } from '../plugins/dossierkit-notes/configure.mjs';
export const PLUGIN_FILES = [
  'plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json',
  'configure.mjs', 'README.md', 'LICENSE',
  'assets/icon.svg', 'assets/logo.svg',
  'skills/publish-note/SKILL.md',
  'skills/publish-note/agents/openai.yaml',
  'skills/publish-note/references/research-quality.md',
  'skills/publish-note/references/visual-authoring.md'
];
export function copyPluginFiles(source, destination) {
  const root = fs.realpathSync(source) + path.sep;
  for (const relative of PLUGIN_FILES) {
    const file = path.join(source, relative);
    if (!fs.lstatSync(file).isFile() || !fs.realpathSync(file).startsWith(root)) throw new Error(`Unsafe plugin source: ${relative}`);
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.copyFileSync(file, target);
  }
}
function main() {
  const source=path.resolve('plugins/dossierkit-notes');
  const output=path.resolve('artifacts/plugins');
  fs.rmSync(output,{recursive:true,force:true}); fs.mkdirSync(output,{recursive:true});
  const variants=[['dossierkit-notes',undefined],...(process.env.NOTES_PLUGIN_URL?[['dossierkit-notes-instance',process.env.NOTES_PLUGIN_URL]]:[])];
  for (const [name,url] of variants) {
    const dir=path.join(output,name); copyPluginFiles(source,dir);
    if(url) configure(dir,url,process.env.NOTES_PLUGIN_APP_ID||undefined);
    const result=spawnSync('python3',['-c',
      'import pathlib,zipfile,sys; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [(z.write(f,f.relative_to(p))) for f in sorted(p.rglob("*")) if f.is_file()]; z.close()',
      dir,path.join(output,`${name}.zip`)],{stdio:'inherit'});
    if(result.status!==0) throw new Error('Plugin archive failed. Python 3 is required.');
    fs.rmSync(dir,{recursive:true});
  }
  console.log(`Built ${variants.length} plugin archive(s). Only allowlisted source files and explicit connection configuration included.`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
