import publication from '../../artifacts/notes-publication/notes.json' with { type: 'json' };

type Publication = {
  profileId: string;
  productionOrigin: string;
  defaultImagePath: string;
  assetPaths: string[];
  notes: Array<{ noteRef: string; imageUrl: string }>;
};
type Context = { request: Request; next: () => Promise<Response> };

const manifest = publication as Publication;
const notes = new Set(manifest.notes.map((note) => note.noteRef));
const assets = new Set(manifest.assetPaths);
const covers = new Set([
  manifest.defaultImagePath,
  ...manifest.notes.map((note) => new URL(note.imageUrl).pathname),
]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const missing = () => new Response(null, {
  status: 404,
  headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
});

// Gate only note routes against the publication bundled with this deployment.
// Missing routes must not fall through to retained Pages assets.
export function guardCurrentPublication(context: Context): Response | Promise<Response> {
  if (!manifest.productionOrigin) return context.next();

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(context.request.url).pathname)
      .replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  } catch {
    return missing();
  }

  const article = /^\/(zh|en)\/notes(?:\/(.*))?$/.exec(pathname);
  if (article) {
    let slug = article[2];
    if (!slug || slug === 'index.html') return context.next();
    slug = slug.replace(/\/index\.html$/, '').replace(/\.html$/, '');
    return slugPattern.test(slug) && notes.has(`${article[1]}/${slug}`)
      ? context.next() : missing();
  }

  const asset = /^\/profile-assets\/([^/]+)\/notes\/(zh|en)\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (asset && asset[1] === manifest.profileId) {
    return notes.has(`${asset[2]}/${asset[3]}`) && assets.has(pathname)
      ? context.next() : missing();
  }

  const cover = /^\/_generated\/og\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (cover && cover[1] === manifest.profileId) {
    return covers.has(pathname) ? context.next() : missing();
  }
  return context.next();
}
