import { env } from './env';

const OWN_STORAGE = `${env.supabaseUrl}/storage/v1/object/public/`;

/**
 * Other people control avatar and cover URLs, so only load remote images from
 * our own Storage: any other host would learn the viewer's IP address.
 * Local files (a photo being picked) pass through.
 */
export function safeImageUri(uri?: string | null): string | null {
  if (!uri || (/^https?:/i.test(uri) && !uri.startsWith(OWN_STORAGE))) {
    return null;
  }
  return uri;
}
