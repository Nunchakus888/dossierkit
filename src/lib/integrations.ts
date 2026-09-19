import fs from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { activeProfile, profileRoot, repository, siteUrl } from './config';

const noteRef = z.string().regex(/^(zh|en)\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
const origin = z.string().refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}, 'Use a bare HTTPS origin.').transform((value) => value ? new URL(value).origin : '');

export const integrationsSchema = z.object({
  version: z.literal(1).default(1),
  siteId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).default('notes'),
  productionOrigin: origin.default(''),
  instanceRepository: z.string().regex(/^$|^[\w.-]+\/[\w.-]+$/).default(''),
  analytics: z.object({
    provider: z.enum(['none', 'cloudflare']).default('none'),
    mode: z.enum(['pages', 'manual']).default('pages'),
    token: z.string().regex(/^$|^[a-f0-9]{32}$/i).default('')
  }).strict().default({ provider: 'none', mode: 'pages', token: '' }),
  comments: z.object({
    provider: z.enum(['none', 'giscus']).default('none'),
    repo: z.string().regex(/^$|^[\w.-]+\/[\w.-]+$/).default(''),
    repoId: z.string().default(''),
    category: z.string().default(''),
    categoryId: z.string().default(''),
    reactions: z.boolean().default(true),
    theme: z.enum(['light', 'dark', 'preferred_color_scheme', 'transparent_dark']).default('light')
  }).strict().default({ provider: 'none', repo: '', repoId: '', category: '', categoryId: '', reactions: true, theme: 'light' }),
  social: z.object({
    readerShare: z.boolean().default(false),
    assisted: z.boolean().default(false),
    baselineSha: z.string().regex(/^$|^[a-f0-9]{40}$/).default(''),
    locales: z.array(z.enum(['zh', 'en'])).min(1).default(['zh']),
    maxPerRun: z.number().int().min(1).max(10).default(5)
  }).strict().default({ readerShare: false, assisted: false, baselineSha: '', locales: ['zh'], maxPerRun: 5 }),
  overrides: z.array(z.object({
    noteRef,
    comments: z.boolean().optional(),
    share: z.boolean().optional(),
    assisted: z.boolean().optional(),
    threadKey: z.string().min(1).max(160).optional(),
    socialText: z.string().max(1000).optional()
  }).strict()).default([])
}).strict().superRefine((value, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: 'custom', message });
  if ((value.social.assisted || value.social.readerShare || value.comments.provider !== 'none'
    || value.analytics.provider !== 'none') && !value.productionOrigin) error('Enabled integrations require productionOrigin.');
  if (value.social.assisted && (!value.social.baselineSha || !value.instanceRepository)) error('Assisted sharing requires baselineSha and instanceRepository.');
  if (value.analytics.provider === 'cloudflare' && value.analytics.mode === 'manual' && !value.analytics.token) error('Manual analytics requires a beacon token, not an API token.');
  if (value.analytics.mode === 'pages' && value.analytics.token) error('Pages injection and a manual beacon token must not be combined.');
  if (value.comments.provider === 'giscus' && (!value.comments.repo || !value.comments.category
    || !/^[A-Za-z0-9_+=/-]{4,160}$/.test(value.comments.repoId) || !/^[A-Za-z0-9_+=/-]{4,160}$/.test(value.comments.categoryId))) error('giscus requires a public repository, repoId, category and categoryId.');
  if (new Set(value.overrides.map((item) => item.noteRef)).size !== value.overrides.length) error('Duplicate note overrides.');
});

export type Integrations = z.infer<typeof integrationsSchema>;
export function loadIntegrations(profileId = activeProfile): Integrations {
  const file = `${profileRoot(profileId)}/integrations.yaml`;
  return integrationsSchema.parse(fs.existsSync(file) ? parse(fs.readFileSync(file, 'utf8')) : {});
}

export function integrationContext(config = loadIntegrations()) {
  const matchesRepo = !config.instanceRepository || !repository || config.instanceRepository === repository;
  const production = Boolean(config.productionOrigin && siteUrl.replace(/\/+$/, '') === config.productionOrigin.replace(/\/+$/, '') && matchesRepo);
  return { config, production };
}

export function noteIntegration(config: Integrations, ref: string, profileId = activeProfile) {
  const override = config.overrides.find((item) => item.noteRef === ref);
  return {
    comments: config.comments.provider === 'giscus' && override?.comments !== false,
    share: config.social.readerShare && override?.share !== false,
    assisted: config.social.assisted && config.social.locales.includes(ref.split('/')[0] as 'zh' | 'en') && override?.assisted !== false,
    threadKey: override?.threadKey || `${config.siteId}:${profileId}:${ref}`,
    socialText: override?.socialText || ''
  };
}
