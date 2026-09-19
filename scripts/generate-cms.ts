/** Extend the existing generator; keep integrations out of content schemas and OAuth. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse, stringify } from 'yaml';
import { activeProfile, profileRoot } from '../src/lib/config';
import { loadIntegrations } from '../src/lib/integrations';
const args = process.argv.slice(2);
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/generate-admin-config.ts', ...args], { stdio: 'inherit' });
const index = args.indexOf('--profile');
const profile = index >= 0 ? args[index + 1] : activeProfile;
loadIntegrations(profile); // Invalid integration settings fail before a deployment.
if (fs.existsSync(`${profileRoot(profile)}/integrations.yaml`)) {
  const file = 'public/admin/config.yml';
  const config = parse(fs.readFileSync(file, 'utf8'));
  const field = (name: string, label: string, widget = 'string', extra = {}) => ({ name, label, widget, required: false, ...extra });
  const select = (name: string, label: string, options: string[]) => field(name, label, 'select', { options });
  config.collections.find((item: { name: string }) => item.name === 'profile').files.push({
    name: 'integrations', label: '互动与分享 / Integrations', file: `profiles/${profile}/integrations.yaml`,
    fields: [
      field('version', 'Version', 'hidden', { default: 1 }),
      field('siteId', 'Stable site ID'),
      field('productionOrigin', 'Production origin (HTTPS)'),
      field('instanceRepository', 'Production repository (owner/repo)'),
      field('analytics', 'Cloudflare Web Analytics', 'object', { fields: [
        select('provider', 'Provider', ['none', 'cloudflare']), select('mode', 'Installation mode', ['pages', 'manual']),
        field('token', 'Public beacon token — manual mode only', 'string', { hint: 'Leave empty for Pages automatic injection. Never enter a Cloudflare API token.' })
      ] }),
      field('comments', 'Comments and reactions', 'object', { fields: [
        select('provider', 'Provider', ['none', 'giscus']), field('repo', 'Public discussion repository'),
        field('repoId', 'giscus repository ID'), field('category', 'Discussion category'), field('categoryId', 'giscus category ID'),
        field('reactions', 'Enable reactions', 'boolean', { default: true }),
        select('theme', 'Theme', ['light', 'dark', 'preferred_color_scheme', 'transparent_dark'])
      ] }),
      field('social', 'X assisted sharing', 'object', { fields: [
        field('readerShare', 'Reader share buttons', 'boolean', { default: false }),
        field('assisted', 'Create private draft Issues after successful CI', 'boolean', { default: false }),
        field('baselineSha', 'Existing content baseline commit (40-character SHA)'),
        field('locales', 'Languages', 'select', { multiple: true, options: ['zh', 'en'], default: ['zh'] }),
        field('maxPerRun', 'Maximum drafts per run', 'number', { value_type: 'int', min: 1, max: 10, default: 5 })
      ] }),
      field('overrides', 'Per-note overrides', 'list', { fields: [
        field('noteRef', 'noteRef', 'string', { required: true }),
        field('comments', 'Allow comments', 'boolean', { default: true }),
        field('share', 'Allow reader sharing', 'boolean', { default: true }),
        field('assisted', 'Allow assisted sharing', 'boolean', { default: true }),
        field('threadKey', 'Existing discussion key (for a migration)'),
        field('socialText', 'Override X text (the canonical URL is added separately)', 'text')
      ] })
    ]
  });
  fs.writeFileSync(file, stringify(config));
  console.log('Added optional Integrations editor; Notes remain canonical MCP/Git documents.');
}
