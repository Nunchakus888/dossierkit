import { buildDraft, deliveryId, issueMetadata, renderIssue, sha256 } from './core.mjs';
import { plainText, composePost } from '../../src/lib/social-text.mjs';

/** The only mutation boundary. Each adapter is injectable for offline tests. */
export async function reconcile({ manifest, run, issues, baselineRefs, verify, createdCommit, create, update }) {
  const index = new Map();
  for (const issue of issues) {
    if (issue.pull_request || issue.user?.login !== 'github-actions[bot]') continue;
    const metadata = issueMetadata(issue);
    if (!metadata || metadata.repository !== manifest.repository) continue;
    if (index.has(metadata.id)) throw new Error(`Duplicate sharing records for ${metadata.noteRef}.`);
    index.set(metadata.id, { issue, metadata });
  }
  const result = { created: [], updated: [], blocked: [], pending: 0, skipped: 0 };
  for (const note of manifest.notes) {
    if (!note.assisted || baselineRefs.has(note.noteRef)) { result.skipped++; continue; }
    const existing = index.get(deliveryId(manifest, note.noteRef));
    // Closed records are terminal, including a manually closed/skipped task.
    if (existing && (existing.issue.state === 'closed' || existing.metadata.status !== 'ready')) { result.skipped++; continue; }
    const draftHash = sha256(composePost({ ...note, text: note.socialText }).fullText);
    if (existing?.metadata.fingerprint === note.fingerprint && existing.metadata.draftHash === draftHash) { result.skipped++; continue; }
    if (result.created.length + result.updated.length >= manifest.social.maxPerRun) { result.pending++; continue; }
    try {
      await verify(note);
      const commit = existing?.metadata.createdCommitSha || await createdCommit(note);
      const { draft, metadata } = buildDraft(manifest, note, run, commit, existing?.metadata);
      const body = renderIssue(metadata, draft, existing?.issue.body);
      if (existing) {
        await update(existing.issue.number, { body }); result.updated.push(existing.issue.number);
      } else {
        const issue = await create({ title: `[待分享 X] ${plainText(note.title).slice(0, 160)}`, body });
        result.created.push(issue.number);
        index.set(metadata.id, { issue, metadata });
      }
    } catch (error) {
      // A failed POST may already have created an Issue. Never retry it here: the next full scan reconciles first.
      result.blocked.push({ noteRef: note.noteRef, error: String(error.message).slice(0, 300) });
    }
  }
  return result;
}
