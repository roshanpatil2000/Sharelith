import { avatarContentType } from '../api';

describe('avatarContentType', () => {
  it('maps the picker’s non-standard image/jpg to image/jpeg', () => {
    expect(avatarContentType('image/jpg')).toBe('image/jpeg');
  });

  it('keeps types the avatars bucket accepts', () => {
    expect(avatarContentType('image/png')).toBe('image/png');
    expect(avatarContentType('image/webp')).toBe('image/webp');
  });

  it('falls back to JPEG for missing or unsupported types', () => {
    expect(avatarContentType(undefined)).toBe('image/jpeg');
    expect(avatarContentType('image/heic')).toBe('image/jpeg');
  });
});
