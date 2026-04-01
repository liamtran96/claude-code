import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const BASE_DIR = path.join(process.cwd(), '.claude-bg');

function ensureDir() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

function getSessionDir(id: string) {
  return path.join(BASE_DIR, id);
}

function listSessions() {
  ensureDir();
  return fs
    .readdirSync(BASE_DIR)
    .filter((f) => fs.statSync(path.join(BASE_DIR, f)).isDirectory());
}

export async function psHandler(args: string[] = []) {
  const sessions = listSessions();

  if (args.includes('--json')) {
    console.log(JSON.stringify(sessions, null, 2));
    return;
  }

  if (sessions.length === 0) {
    console.log('No background sessions.');
    return;
  }

  for (const id of sessions) {
    console.log(`• ${id}`);
  }
}

export async function logsHandler(id?: string) {
  if (!id) {
    console.error('Missing session id');
    process.exit(1);
  }

  const logFile = path.join(getSessionDir(id), 'output.log');

  if (!fs.existsSync(logFile)) {
    console.error('No logs found');
    process.exit(1);
  }

  const stream = fs.createReadStream(logFile, { encoding: 'utf-8' });
  stream.pipe(process.stdout);
}

export async function attachHandler(id?: string) {
  if (!id) {
    console.error('Missing session id');
    process.exit(1);
  }

  console.log(`Attaching to ${id} (simplified)`);

  // Real implementation would use IPC/pty
  await logsHandler(id);
}

export async function killHandler(id?: string) {
  if (!id) {
    console.error('Missing session id');
    process.exit(1);
  }

  const pidFile = path.join(getSessionDir(id), 'pid');

  if (!fs.existsSync(pidFile)) {
    console.error('No PID found');
    process.exit(1);
  }

  const pid = Number(fs.readFileSync(pidFile, 'utf-8'));

  try {
    process.kill(pid);
    console.log(`Killed session ${id}`);
  } catch (err) {
    console.error('Failed to kill:', err);
  }
}

export async function handleBgFlag(args: string[]) {
  ensureDir();

  const id = `sess-${Date.now()}`;
  const dir = getSessionDir(id);
  fs.mkdirSync(dir);

  const logFile = path.join(dir, 'output.log');
  const pidFile = path.join(dir, 'pid');

  const child = spawn(
    process.argv[0],
    process.argv.slice(1).filter((a) => a !== '--bg' && a !== '--background'),
    {
      detached: true,
      stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')]
    }
  );

  fs.writeFileSync(pidFile, String(child.pid));

  child.unref();

  console.log(`Started background session: ${id}`);
}
