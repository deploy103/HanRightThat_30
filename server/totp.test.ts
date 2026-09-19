import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  buildOtpauthUrl,
  generateTotp,
  generateTotpSecret,
  totpStep,
  verifyTotp,
} from './totp.js';

/** RFC 6238 Appendix B 의 SHA-1 테스트 벡터 (공유키 "12345678901234567890"). */
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('base32', () => {
  it('인코딩/디코딩이 왕복한다', () => {
    expect(base32Decode(base32Encode(Buffer.from('hello world'))).toString()).toBe('hello world');
  });

  it('base32 알파벳이 아닌 문자는 거부한다', () => {
    expect(() => base32Decode('01189998819991197253')).toThrow();
  });
});

describe('TOTP (RFC 6238 표준 벡터)', () => {
  const vectors: [number, string][] = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ];

  it.each(vectors)('유닉스 시각 %i 에서 %s 를 만든다', (seconds, expected) => {
    expect(generateTotp(RFC_SECRET, Math.floor(seconds / 30))).toBe(expected);
  });
});

describe('verifyTotp', () => {
  const secret = generateTotpSecret();

  it('현재 코드는 통과하고 틀린 코드는 거부한다', () => {
    expect(verifyTotp(secret, generateTotp(secret)).valid).toBe(true);
    expect(verifyTotp(secret, '000000').valid).toBe(false);
  });

  it('앞뒤 한 스텝(±30초)까지만 허용한다', () => {
    const now = Date.now();
    const step = totpStep(now);
    expect(verifyTotp(secret, generateTotp(secret, step - 1), now).valid).toBe(true);
    expect(verifyTotp(secret, generateTotp(secret, step + 1), now).valid).toBe(true);
    expect(verifyTotp(secret, generateTotp(secret, step - 2), now).valid).toBe(false);
    expect(verifyTotp(secret, generateTotp(secret, step + 2), now).valid).toBe(false);
  });

  it('6자리 숫자가 아니면 계산 없이 거부한다', () => {
    expect(verifyTotp(secret, 'abcdef').valid).toBe(false);
    expect(verifyTotp(secret, '12345').valid).toBe(false);
    expect(verifyTotp(secret, '1234567').valid).toBe(false);
    expect(verifyTotp(secret, '').valid).toBe(false);
  });

  it('성공하면 어떤 스텝이었는지 알려 준다 (같은 코드 재사용 차단용)', () => {
    const result = verifyTotp(secret, generateTotp(secret));
    expect(result.step).toBe(totpStep());
  });
});

describe('otpauth URI', () => {
  it('표준 파라미터를 포함하고 공백은 %20 으로 인코딩한다', () => {
    const url = buildOtpauthUrl('Hanbit Festival Admin', 'admin', 'ABCDEFGHIJKLMNOP');
    expect(url.startsWith('otpauth://totp/Hanbit%20Festival%20Admin:admin?')).toBe(true);
    expect(url).toContain('secret=ABCDEFGHIJKLMNOP');
    expect(url).toContain('issuer=Hanbit%20Festival%20Admin');
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
    expect(url).not.toContain('+');
  });
});

describe('generateTotpSecret', () => {
  it('매번 다른 160비트 base32 키를 만든다', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
  });
});
