import { recordAuditLog } from './auditLog.js';
import { resetTwoFactor } from './twoFactor.js';

/**
 * 인증 앱을 분실한 관리자의 2단계 인증을 초기화하는 CLI.
 *
 * 로그인 화면에는 이 기능을 절대 노출하지 않는다 — 서버(또는 컨테이너)에 접근할 수 있는
 * 운영자만 실행할 수 있어야 비밀번호만 아는 공격자가 2FA 를 벗겨 낼 수 없다.
 *
 *   npm run admin:reset-2fa -- --username admin
 *   docker compose exec web node dist-server/server/resetTwoFactor.js --username admin
 *
 * 실행하면 해당 계정의 TOTP secret·복구 코드·로그인 세션이 모두 지워지고,
 * 다음 로그인 때 2FA 등록 화면부터 다시 시작한다.
 */

function parseArgs(argv: string[]): { username?: string } {
  const result: { username?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--username') result.username = argv[i + 1];
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username?.trim();
  if (!username) {
    console.error('사용법: admin:reset-2fa -- --username <아이디>');
    process.exit(1);
    return;
  }

  const result = await resetTwoFactor(username);
  if (!result.found) {
    console.error(`해당 아이디의 관리자 계정을 찾을 수 없습니다: ${username}`);
    process.exit(1);
    return;
  }

  await recordAuditLog({
    admin: 'cli',
    action: 'two_factor_reset',
    targetType: 'admin',
    targetId: username,
    after: { removedRecoveryCodes: result.removedRecoveryCodes },
    ip: 'cli',
  });

  console.log(`2단계 인증을 초기화했습니다: ${username}`);
  console.log(`- 폐기한 복구 코드 ${result.removedRecoveryCodes}개`);
  console.log('- 기존 로그인 세션을 모두 종료했습니다.');
  console.log('다음 로그인 시 QR 코드로 인증 앱을 다시 등록해야 합니다.');
}

main().catch((error: unknown) => {
  console.error('[한빛제] 2단계 인증 초기화 실패', error);
  process.exit(1);
});
