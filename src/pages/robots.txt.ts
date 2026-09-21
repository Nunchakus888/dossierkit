import type { APIRoute } from "astro";
import { siteUrl } from "../lib/config";

export const prerender = true;

export const GET: APIRoute = () => {
  const sitemap = new URL("/sitemap-index.xml", siteUrl).href;
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /api/",
      "",
      `Sitemap: ${sitemap}`,
      ""
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
};
