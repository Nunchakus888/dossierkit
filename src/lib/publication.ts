import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { activeProfile, locales } from './config';
import { readContentCollection, type ContentEntry } from './profile-loader';
import { integrationContext, noteIntegration } from './integrations';
import { canonicalArticleUrl } from './social-text.mjs';
import { loadNoteAssets, noteCover } from './note-media';

export function publicationHash(entry: ContentEntry) {
  const assets = loadNoteAssets(`${entry.locale}/${entry.slug}`);
  return 'sha256:' + createHash('sha256').update(JSON.stringify({
    title: entry.data.title, summary: entry.data.summary, body: entry.body.trim(),
    locale: entry.locale, kind: entry.data.kind || 'research', topics: entry.data.topics,
    ...(Object.keys(assets).length ? {assets:Object.entries(assets).sort(([a],[b]) => a.localeCompare(b))} : {})
  })).digest('hex');
}
export function publicationManifest() {
  const {config,production} = integrationContext();
  const entries = locales.flatMap((locale) => readContentCollection(locale,'notes'));
  return {
    version:1,siteId:config.siteId,profileId:activeProfile,productionOrigin:config.productionOrigin,
    repository:config.instanceRepository,sha:process.env.GITHUB_SHA || '',
    social:{...config.social,assisted:production && config.social.assisted},
    notes:config.productionOrigin ? entries.map((entry) => {
      const ref = `${entry.locale}/${entry.slug}`;
      const options = noteIntegration(config,ref);
      return {
        noteRef:ref,title:entry.data.title,summary:entry.data.summary,
        url:canonicalArticleUrl(config.productionOrigin,ref),fingerprint:publicationHash(entry),
        imageUrl:new URL(noteCover(ref).path,config.productionOrigin).href,
        ...options,comments:production && options.comments,share:production && options.share,assisted:production && options.assisted,
        sourcePath:`profiles/${activeProfile}/content/${entry.locale}/notes/${basename(entry.filePath)}`
      };
    }) : []
  };
}
