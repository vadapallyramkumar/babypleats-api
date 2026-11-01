import { isOriginAllowed, parseCorsOrigins } from './cors';

describe('parseCorsOrigins', () => {
  it('defaults to localhost:3000 when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:3000']);
  });

  it('supports a single origin', () => {
    expect(parseCorsOrigins('https://babypleats.in')).toEqual([
      'https://babypleats.in',
    ]);
  });

  it('supports comma-separated origins with trimming', () => {
    expect(
      parseCorsOrigins(
        'https://babypleats.in, https://admin.babypleats.in, https://babypleats-storefront.onrender.com',
      ),
    ).toEqual([
      'https://babypleats.in',
      'https://admin.babypleats.in',
      'https://babypleats-storefront.onrender.com',
    ]);
  });

  it('drops empty segments', () => {
    expect(
      parseCorsOrigins('https://babypleats.in,,https://admin.babypleats.in,'),
    ).toEqual(['https://babypleats.in', 'https://admin.babypleats.in']);
  });
});

describe('isOriginAllowed', () => {
  const productionAllowlist = [
    'https://babypleats.in',
    'https://admin.babypleats.in',
    'https://babypleats-storefront.onrender.com',
    'https://babypleats-admin.onrender.com',
  ];

  it('allows requests with no Origin (non-browser clients)', () => {
    expect(isOriginAllowed(undefined, productionAllowlist)).toBe(true);
  });

  it('allows storefront origin', () => {
    expect(isOriginAllowed('https://babypleats.in', productionAllowlist)).toBe(
      true,
    );
  });

  it('allows admin origin', () => {
    expect(
      isOriginAllowed('https://admin.babypleats.in', productionAllowlist),
    ).toBe(true);
  });

  it('allows temporary Render frontend origins from the allowlist', () => {
    expect(
      isOriginAllowed(
        'https://babypleats-storefront.onrender.com',
        productionAllowlist,
      ),
    ).toBe(true);
    expect(
      isOriginAllowed(
        'https://babypleats-admin.onrender.com',
        productionAllowlist,
      ),
    ).toBe(true);
  });

  it('allows localhost development origins on any port', () => {
    expect(isOriginAllowed('http://localhost:3000', [])).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', [])).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:5174', [])).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(
      isOriginAllowed('https://evil.example.com', productionAllowlist),
    ).toBe(false);
    expect(
      isOriginAllowed('https://babypleats.in.evil.com', productionAllowlist),
    ).toBe(false);
    expect(
      isOriginAllowed(
        'https://unlisted-frontend.onrender.com',
        productionAllowlist,
      ),
    ).toBe(false);
  });
});
