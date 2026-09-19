import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * RFC 6238 TOTP (+ RFC 4226 HOTP) 최소 구현.
 * Google/Microsoft Authenticator, 1Password, Authy 등 표준 앱과 호환된다.
 *
 * 외부 라이브러리를 쓰지 않는 이유: 필요한 건 HMAC-SHA1 한 줄과 base32 인코딩뿐이고,
 * 이 프로젝트는 인증 관련 코드를 직접 읽고 검증할 수 있게 유지하는 쪽을 택했다.
 */

/** 표준값 — 이 셋은 인증 앱이 QR 없이도 가정하는 기본값이라 바꾸지 않는다. */
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SEC = 30;
export const TOTP_ALGORITHM = 'SHA1';

/**
 * 서버/휴대폰 시계 오차 허용 범위. ±1 스텝(앞뒤 30초)만 허용한다.
 * 더 넓히면 공격자가 한 번에 맞힐 수 있는 코드 수가 늘어난다.
 */
export const TOTP_WINDOW = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** 인증 앱이 읽는 base32(RFC 4648, 패딩 없음) 문자열로 만든다. */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('base32 문자열이 올바르지 않습니다.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160비트(=SHA1 블록 크기) 비밀키를 만든다. base32 로 32자가 되어 수동 입력도 무리 없다. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/** 주어진 시각(ms)이 속한 TOTP 스텝 번호. 코드 재사용(replay) 차단에 쓴다. */
export function totpStep(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / TOTP_PERIOD_SEC);
}

export function generateTotp(secretBase32: string, step: number = totpStep()): string {
  return hotp(base32Decode(secretBase32), step);
}

export interface TotpVerifyResult {
  valid: boolean;
  /** 검증에 성공한 스텝. 같은 스텝의 코드를 두 번 쓰지 못하게 막는 데 쓴다. */
  step?: number;
}

/**
 * 코드를 검증한다. 허용 창(±TOTP_WINDOW) 안의 모든 후보를 항상 끝까지 계산해
 * "몇 번째 후보에서 맞았는지"가 응답 시간으로 드러나지 않게 한다.
 */
export function verifyTotp(secretBase32: string, code: string, atMs: number = Date.now()): TotpVerifyResult {
  const normalized = code.replace(/\s+/g, '');
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(normalized)) return { valid: false };

  const current = totpStep(atMs);
  let matchedStep: number | undefined;
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const step = current + offset;
    const expected = generateTotp(secretBase32, step);
    const a = Buffer.from(expected);
    const b = Buffer.from(normalized);
    if (a.length === b.length && timingSafeEqual(a, b)) matchedStep = step;
  }
  return matchedStep === undefined ? { valid: false } : { valid: true, step: matchedStep };
}

/**
 * 인증 앱이 QR 로 읽는 표준 URI.
 * 라벨은 "Issuer:계정" 형태여야 앱 목록에서 어느 사이트인지 구분된다.
 */
export function buildOtpauthUrl(issuer: string, account: string, secretBase32: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: TOTP_ALGORITHM,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SEC),
  });
  // URLSearchParams 는 공백을 '+' 로 쓴다. otpauth URI 를 읽는 앱마다 해석이 달라질 수 있어
  // 퍼센트 인코딩(%20)으로 바꿔 둔다.
  return `otpauth://totp/${label}?${params.toString().replace(/\+/g, '%20')}`;
}
