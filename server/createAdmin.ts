import { createInterface } from 'node:readline/promises';
import { createAdminUser } from './auth.js';

/**
 * 관리자 계정을 만드는 1회성 CLI. 회원가입 화면은 만들지 않는다.
 *
 *   npm run create-admin -- --username admin
 *   docker compose exec web node dist-server/server/createAdmin.js --username admin
 *
 * --password 를 생략하면 터미널에서 비밀번호를 프롬프트로 받는다 (쉘 히스토리에 남지 않음).
 */

function parseArgs(argv: string[]): { username?: string; password?: string } {
  const result: { username?: string; password?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--username') result.username = argv[i + 1];
    if (argv[i] === '--password') result.password = argv[i + 1];
  }
  return result;
}

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // readline 은 기본 마스킹을 지원하지 않아 출력 스트림을 잠시 가로챈다.
  const output = process.stdout as NodeJS.WriteStream & { write: (chunk: string) => boolean };
  const originalWrite = output.write.bind(output);
  let masked = false;
  output.write = (chunk: string) => (masked ? true : originalWrite(chunk));

  process.stdout.write(question);
  masked = true;
  const answer = await rl.question('');
  masked = false;
  output.write = originalWrite;
  process.stdout.write('\n');
  rl.close();
  return answer;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username?.trim();
  if (!username) {
    console.error('사용법: create-admin --username <아이디> [--password <비밀번호>]');
    process.exit(1);
    return;
  }

  const password = args.password ?? (await promptHidden('비밀번호: '));
  if (!password || password.length < 8) {
    console.error('비밀번호는 8자 이상이어야 합니다.');
    process.exit(1);
    return;
  }

  const user = await createAdminUser(username, password);
  console.log(`관리자 계정이 생성되었습니다: ${user.username}`);
}

main().catch((error: unknown) => {
  console.error('[한빛제] 관리자 계정 생성 실패', error);
  process.exit(1);
});
