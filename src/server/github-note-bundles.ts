import { z } from 'zod';
import { noteSaveInputSchema as documentSchema, noteGetInputSchema as getSchema, noteDeleteInputSchema, parseCanonicalNote, prepareNote, renderCanonicalNote, type NoteSaveInput } from '../lib/note-ingest';
import { saveNoteToGitHub as saveDocument, getNoteFromGitHub as getDocument, deleteNoteFromGitHub as deleteDocument, type NotesEnvironment } from './github-notes';
import { ASSET_NAME, ASSET_LIMIT, SVG_LIMIT, applyAssetPatch, validateSvg, assetDirectory, assetPublicPrefix, resolveAssetImages, portableAssetImages, effectiveNoteHash } from '../lib/note-assets.mjs';
import { openNoteTransaction, decodeContent } from './note-transaction.mjs';

export const noteSaveInputSchema = z.object({
  ...documentSchema.shape,
  assets: z.record(z.string().regex(ASSET_NAME), z.string().max(SVG_LIMIT).nullable()).optional()
    .describe('Optional filename-to-SVG map, at most 8 files. cover.svg (1200×630) is the share cover. Use asset:filename.svg in an image. Omit to preserve, same name replaces, null deletes. No share field or paths.')
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.markdown) === Boolean(value.html)) ctx.addIssue({code:'custom',message:'Provide exactly one of markdown or html'});
  if (value.assets && Object.keys(value.assets).length > ASSET_LIMIT) ctx.addIssue({code:'custom',message:'At most 8 SVG assets per note.'});
});
export const noteGetInputSchema = z.object({
  ...getSchema.shape,
  includeAssets: z.boolean().optional().describe('Read SVG sources only when editing artwork. Otherwise only assetNames are returned.')
}).strict();
export { noteDeleteInputSchema };

async function readAssets(tx: Awaited<ReturnType<typeof openNoteTransaction>>, ref: string) {
  const directory = assetDirectory(tx.profile, ref);
  const entries = await tx.read(directory);
  if (!entries) return Object.create(null) as Record<string,string>;
  if (!Array.isArray(entries) || entries.length > ASSET_LIMIT) throw new Error('Invalid or oversized note asset directory.');
  const assets: Record<string,string> = Object.create(null);
  for (const entry of entries) {
    if (entry.type !== 'file' || !ASSET_NAME.test(entry.name) || entry.path !== `${directory}/${entry.name}`) throw new Error('Unexpected file in note asset directory.');
    const file = await tx.read(entry.path);
    if (file?.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('Note asset is not readable UTF-8.');
    const source = decodeContent(file.content);
    // Validate the stored version without silently changing its hash or bytes.
    validateSvg(source, entry.name);
    assets[entry.name] = source;
  }
  applyAssetPatch(assets);
  return assets;
}
function mapInput(input: NoteSaveInput, prefix: string, assets?: Record<string,string>): NoteSaveInput {
  const format = input.html ? 'html' : 'markdown';
  const key = input.html ? 'html' : 'markdown';
  return {...input,[key]:resolveAssetImages(input[key]!, format, prefix, assets)};
}
function rejectInlineArtwork(input: NoteSaveInput) {
  let value = input.html || input.markdown || '';
  if (input.markdown) value = value.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '').replace(/`+[^`]*`+/g, '');
  if (/<(?:svg|foreignObject|animate|set|use|math)\b/i.test(value)) throw new Error('Put SVG source in assets and reference it with an image; inline SVG is not supported.');
}
export async function saveNoteToGitHub(raw: unknown, env: NotesEnvironment, origin: string, requestFetch: typeof fetch = fetch) {
  const {assets:patch, ...plain} = noteSaveInputSchema.parse(raw);
  rejectInlineArtwork(plain);
  applyAssetPatch({}, patch); // Reject unsafe inputs before requesting repository access.
  const tx = await openNoteTransaction(env, requestFetch);
  // Let the existing canonical parser own title, format, locale and collision handling.
  // Placeholder references only exist inside this uncommitted transaction.
  const staged = await saveDocument(mapInput(plain, '/_dossierkit_asset_/'), env, origin, tx.fetch);
  const oldAssets = await readAssets(tx, staged.noteRef);
  const assets = applyAssetPatch(oldAssets, patch);
  const prefix = assetPublicPrefix(tx.profile, staged.noteRef);
  const priorFile = await tx.read(staged.path);
  const prior = priorFile ? parseCanonicalNote(decodeContent(priorFile.content)) : undefined;
  const stagedSource = tx.changes.get(staged.path) || (priorFile && decodeContent(priorFile.content));
  if (!stagedSource) throw new Error('Missing staged canonical note.');
  const metadata = parseCanonicalNote(stagedSource).metadata;
  const note = await prepareNote(mapInput(plain, prefix, assets), new Date(), metadata);
  const hash = await effectiveNoteHash(note.contentHash, assets);
  const assetNames = Object.keys(assets).sort();
  const assetsChanged = JSON.stringify(Object.entries(oldAssets).sort()) !== JSON.stringify(Object.entries(assets).sort());
  tx.changes.clear();
  if (prior && prior.contentHash === note.contentHash && !assetsChanged) {
    return {...staged,action:'unchanged' as const,contentHash:hash,assetNames,commitUrl:undefined};
  }
  tx.stage(staged.path, renderCanonicalNote(note));
  const directory = assetDirectory(tx.profile, staged.noteRef);
  for (const name of new Set([...Object.keys(oldAssets),...assetNames])) {
    if (oldAssets[name] !== assets[name]) tx.stage(`${directory}/${name}`, assets[name] ?? null);
  }
  const commitUrl = await tx.commit(`${prior ? 'Update' : 'Publish'} note: ${note.title}`);
  return {...staged,action:prior ? 'updated' as const : 'created' as const,contentHash:hash,assetNames,commitUrl};
}
export async function getNoteFromGitHub(raw: unknown, env: NotesEnvironment, origin: string, requestFetch: typeof fetch = fetch) {
  const {includeAssets, ...input} = noteGetInputSchema.parse(raw);
  const tx = await openNoteTransaction(env, requestFetch);
  const result = await getDocument(input, env, origin, tx.fetch);
  if (result.status !== 'found' || !result.note) return result;
  const assets = await readAssets(tx, result.note.noteRef);
  const prefix = assetPublicPrefix(tx.profile, result.note.noteRef);
  return {...result,note:{...result.note,
    ...(result.note.markdown ? {markdown:portableAssetImages(result.note.markdown,'markdown',prefix)} : {}),
    ...(result.note.html ? {html:portableAssetImages(result.note.html,'html',prefix)} : {}),
    contentHash:await effectiveNoteHash(result.note.contentHash, assets),
    assetNames:Object.keys(assets).sort(), ...(includeAssets ? {assets} : {})
  }};
}
export async function deleteNoteFromGitHub(raw: unknown, env: NotesEnvironment, origin: string, requestFetch: typeof fetch = fetch) {
  const input = noteDeleteInputSchema.parse(raw);
  const tx = await openNoteTransaction(env, requestFetch);
  const found = await getDocument({query:input.noteRef}, env, origin, tx.fetch);
  if (!found.note) throw new Error('No canonical note exists for this noteRef.');
  const assets = await readAssets(tx, input.noteRef);
  const hash = await effectiveNoteHash(found.note.contentHash, assets);
  if (hash !== input.contentHash) throw new Error('The note or its assets changed after it was read. Call get_note again.');
  // Legacy document validation still checks stale frontmatter and exact-file identity.
  const result = await deleteDocument({...input,contentHash:found.note.contentHash}, env, origin, tx.fetch);
  for (const name of Object.keys(assets)) tx.stage(`${assetDirectory(tx.profile,input.noteRef)}/${name}`, null);
  const commitUrl = await tx.commit(`Delete note: ${result.title}`);
  return {...result,contentHash:hash,commitUrl};
}
