import type { APIRoute } from 'astro';
import { publicationManifest } from '../../lib/publication';
export const prerender = true;
export const GET: APIRoute = () => new Response(JSON.stringify(publicationManifest()), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' }
});
