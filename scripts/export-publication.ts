import fs from 'node:fs';
import { publicationManifest } from '../src/lib/publication';

// Private CI hand-off only. This directory is never deployed with the public site.
const directory = 'artifacts/notes-publication';
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(`${directory}/notes.json`, JSON.stringify(publicationManifest()));
console.log('Exported private publication manifest outside the public build.');
