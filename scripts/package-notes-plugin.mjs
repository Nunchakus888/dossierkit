// Export only the reusable plugin, never profiles, credentials, fonts, or Git history.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { configure } from '../plugins/dossierkit-notes/configure.mjs';
const source=path.resolve('plugins/dossierkit-notes');
const output=path.resolve('artifacts/plugins');
fs.rmSync(output,{recursive:true,force:true}); fs.mkdirSync(output,{recursive:true});
const variants=[['dossierkit-notes',undefined],...(process.env.NOTES_PLUGIN_URL?[['dossierkit-notes-instance',process.env.NOTES_PLUGIN_URL]]:[])];
for (const [name,url] of variants) {
  const dir=path.join(output,name); fs.cpSync(source,dir,{recursive:true});
  if(url) configure(dir,url,process.env.NOTES_PLUGIN_APP_ID||undefined);
  const result=spawnSync('python3',['-c',
    'import pathlib,zipfile,sys; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [(z.write(f,f.relative_to(p))) for f in sorted(p.rglob("*")) if f.is_file()]; z.close()',
    dir,path.join(output,`${name}.zip`)],{stdio:'inherit'});
  if(result.status!==0) throw new Error('Plugin archive failed. Python 3 is required.');
  fs.rmSync(dir,{recursive:true});
}
console.log(`Built ${variants.length} plugin archive(s). No credentials or production content included.`);
