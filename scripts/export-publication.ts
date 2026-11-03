import fs from 'node:fs';
import { publicationManifest } from '../src/lib/publication';
import { loadNoteAssets, noteCover } from '../src/lib/note-media';
import { assetPublicPrefix } from '../src/lib/note-assets.mjs';

// Private CI hand-off and Pages Functions input; never part of public dist.
const directory = 'artifacts/notes-publication';
const manifest = publicationManifest();
const assetPaths = manifest.notes.flatMap((note) =>
  Object.keys(loadNoteAssets(note.noteRef)).map((name) =>
    assetPublicPrefix(manifest.profileId, note.noteRef) + name));
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(`${directory}/notes.json`, JSON.stringify({
  ...manifest, defaultImagePath: noteCover().path, assetPaths,
}));
console.log('Exported private publication manifest outside the public build.');
