import { safeImageUri } from '../imageUri';

const own = 'http://localhost:54321/storage/v1/object/public/avatars/a.jpg';

describe('safeImageUri', () => {
  it('allows our own Storage and local files', () => {
    expect(safeImageUri(`${own}?v=1`)).toBe(`${own}?v=1`);
    expect(safeImageUri('file:///tmp/photo.jpg')).toBe('file:///tmp/photo.jpg');
  });

  it.each([
    'https://tracker.example.com/pixel.png',
    'http://localhost:54321.evil.com/storage/v1/object/public/a.jpg',
    'HTTPS://tracker.example.com/pixel.png',
  ])('blocks %s', uri => {
    expect(safeImageUri(uri)).toBeNull();
  });

  it('treats a missing value as no image', () => {
    expect(safeImageUri(null)).toBeNull();
    expect(safeImageUri('')).toBeNull();
  });
});
