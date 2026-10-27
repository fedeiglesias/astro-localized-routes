import type { APIRoute } from 'astro';
import { routing } from '../routing.ts';

export const GET: APIRoute = async () =>
  new Response(await routing.sitemap(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
