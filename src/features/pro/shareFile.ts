import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';

/** Writes a file to the app's cache and opens the share sheet for it. */
export async function shareFile(
  filename: string,
  content: string,
  { encoding, mime }: { encoding: 'utf8' | 'base64'; mime: string },
): Promise<void> {
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
  await ReactNativeBlobUtil.fs.writeFile(path, content, encoding);
  await Share.open({
    url: `file://${path}`,
    type: mime,
    filename,
    failOnCancel: false,
  });
}

/** A safe file name from a title: "Goa trip" → "Sharelith-Goa-trip". */
export function fileBase(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `Sharelith-${slug || 'statement'}`;
}
