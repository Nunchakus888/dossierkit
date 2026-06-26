import { locales } from "../lib/config";
import { readContentCollection } from "../lib/profile-loader";

export function GET() {
  const data = Object.fromEntries(
    locales.map((locale) => [
      locale,
      readContentCollection(locale, "lab").map((entry) => ({
        slug: entry.slug,
        title: entry.data.title,
        summary: entry.data.summary,
        tags: entry.data.tags,
        url: `/${locale}/lab/${entry.slug}`
      }))
    ])
  );

  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
