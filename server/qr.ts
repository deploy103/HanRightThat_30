import qrcode from 'qrcode-generator';

/**
 * otpauth:// URI 를 인증 앱이 스캔할 수 있는 QR 이미지(data URL)로 만든다.
 *
 * 서버에서 만들어 내려보내는 이유: 관리자 화면이 QR 라이브러리를 따로 들이지 않아도 되고,
 * `<img src="data:…">` 하나면 되므로 admin 의 CSP(img-src 'self' data:)를 넓히지 않아도 된다.
 * QR 안에는 TOTP 비밀키가 들어 있으므로, 이 값을 만들어 내려보내는 응답은
 * 반드시 2FA 등록 단계에서 1회만, no-store 로 전달해야 한다.
 */
export function buildQrDataUrl(text: string): string {
  // 0 = 데이터 길이에 맞춰 자동으로 버전 선택, 'M' = 표준 권장 오류정정 수준.
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(6, 4);
}
