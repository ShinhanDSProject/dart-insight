#!/usr/bin/env node
// 저장소 루트에서 세 서비스를 준비·실행·검사합니다. 루트 package.json의 스크립트가 이 파일을 부릅니다.
// 사용법: node scripts/run.mjs <setup|dev|test|lint|build|check> [backend|ai-server|frontend ...]
// 서비스를 적지 않으면 세 서비스 모두에 실행합니다. 의존성 없이 Node.js 22 내장 모듈만 씁니다.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IS_WINDOWS = process.platform === 'win32';
const GRADLEW = IS_WINDOWS ? 'gradlew.bat' : './gradlew';
const VENV_PYTHON = IS_WINDOWS ? join('.venv', 'Scripts', 'python.exe') : join('.venv', 'bin', 'python');
// 가상환경을 만들 Python. 기본 python3(Windows는 python)이 3.12가 아니면 PYTHON에 경로를 줍니다.
const SYSTEM_PYTHON = process.env.PYTHON ?? (IS_WINDOWS ? 'python' : 'python3');
// pytest는 테스트가 하나도 없으면 5로 끝납니다. CI와 같이 통과로 봅니다.
const PYTEST_NO_TESTS = 5;

// 서비스별 명령. AGENTS.md '서비스별 명령'과 같은 명령을 부릅니다.
// 각 작업은 [명령, 인자] 목록이고, 없는 작업은 그 서비스에서 건너뜁니다.
const SERVICES = {
  backend: {
    color: 34,
    setup: [],
    dev: [[GRADLEW, ['bootRun']]],
    test: [[GRADLEW, ['test']]],
    lint: [[GRADLEW, ['checkstyleMain', 'checkstyleTest']]],
    build: [[GRADLEW, ['build']]],
    // build가 Checkstyle과 테스트를 함께 돌립니다(CI와 같음).
    check: [[GRADLEW, ['build']]],
  },
  'ai-server': {
    color: 35,
    needsVenv: true,
    setup: [
      [SYSTEM_PYTHON, ['-m', 'venv', '.venv'], { skipIf: VENV_PYTHON }],
      [VENV_PYTHON, ['-m', 'pip', 'install', '-r', 'requirements.txt', '-r', 'requirements-dev.txt']],
    ],
    dev: [[VENV_PYTHON, ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000', '--env-file', '.env']]],
    test: [[VENV_PYTHON, ['-m', 'pytest'], { okCodes: [PYTEST_NO_TESTS] }]],
    lint: [[VENV_PYTHON, ['-m', 'ruff', 'check', '.']]],
    check: [
      [VENV_PYTHON, ['-m', 'ruff', 'check', '.']],
      [VENV_PYTHON, ['-m', 'pytest'], { okCodes: [PYTEST_NO_TESTS] }],
    ],
  },
  frontend: {
    color: 36,
    setup: [['npm', ['ci']]],
    dev: [['npm', ['run', 'dev']]],
    test: [['npm', ['test']]],
    lint: [['npm', ['run', 'lint']]],
    build: [['npm', ['run', 'build']]],
    check: [
      ['npm', ['run', 'lint']],
      ['npm', ['test']],
      ['npm', ['run', 'build']],
    ],
  },
};
const ALIASES = { ai: 'ai-server' };
const TASKS = ['setup', 'dev', 'test', 'lint', 'build', 'check'];

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (color, text) => (useColor ? `\x1b[${color}m${text}\x1b[0m` : text);
const label = (name) => paint(SERVICES[name].color, `[${name}]`);

function fail(message) {
  console.error(paint(31, message));
  process.exit(1);
}

function parseArgs(argv) {
  const [task, ...rest] = argv;
  if (!TASKS.includes(task)) {
    fail(`작업 이름이 필요합니다: ${TASKS.join(', ')}`);
  }
  const names = rest.map((name) => ALIASES[name] ?? name);
  const unknown = names.filter((name) => !SERVICES[name]);
  if (unknown.length > 0) {
    fail(`모르는 서비스: ${unknown.join(', ')} (쓸 수 있는 이름: ${Object.keys(SERVICES).join(', ')}, ai)`);
  }
  return { task, names: names.length > 0 ? names : Object.keys(SERVICES) };
}

// Windows에서 npm·gradlew.bat은 셸을 거쳐야 실행됩니다.
function spawnOptions(name, extra = {}) {
  return { cwd: join(ROOT, name), shell: IS_WINDOWS, ...extra };
}

// .env가 없으면 .env.example에서 만들고, 이미 있으면 그대로 둡니다.
function ensureEnv(name) {
  const env = join(ROOT, name, '.env');
  const example = join(ROOT, name, '.env.example');
  if (existsSync(env) || !existsSync(example)) {
    return;
  }
  copyFileSync(example, env);
  console.log(`${label(name)} .env.example을 복사해 .env를 만들었습니다. 키 값은 노션 '공용 키 모음'에서 채워 넣으세요.`);
}

function checkReady(name) {
  if (SERVICES[name].needsVenv && !existsSync(join(ROOT, name, VENV_PYTHON))) {
    fail(`${name}의 가상환경(.venv)이 없습니다. 먼저 실행하세요: npm run setup -- ${name}`);
  }
}

// 순서대로 실행하고, 실패한 서비스가 있어도 나머지를 마저 돌린 뒤 결과를 모아 보여 줍니다.
function runSequential(task, names) {
  const failed = [];
  for (const name of names) {
    const steps = SERVICES[name][task];
    if (!steps) {
      console.log(`${label(name)} ${task} 작업이 없어 건너뜁니다.`);
      continue;
    }
    if (task === 'setup') {
      ensureEnv(name);
    } else {
      checkReady(name);
    }
    for (const [command, args, { skipIf, okCodes = [] } = {}] of steps) {
      if (skipIf && existsSync(join(ROOT, name, skipIf))) {
        continue;
      }
      console.log(`${label(name)} ${command} ${args.join(' ')}`);
      const result = spawnSync(command, args, spawnOptions(name, { stdio: 'inherit' }));
      const code = result.status ?? 1;
      if (code !== 0 && !okCodes.includes(code)) {
        failed.push(name);
        break;
      }
    }
  }
  if (failed.length > 0) {
    fail(`실패: ${failed.join(', ')}`);
  }
  console.log(paint(32, `${task} 완료: ${names.join(', ')}`));
}

function prefixLines(name, stream, target) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) {
      target.write(`${label(name)} ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer) {
      target.write(`${label(name)} ${buffer}\n`);
    }
  });
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (IS_WINDOWS) {
    // 셸 아래의 java·python 프로세스까지 함께 끕니다.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    // 서비스마다 따로 둔 프로세스 그룹을 통째로 끕니다(npm 아래의 vite, gradle 아래의 java까지).
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

// 여러 서비스를 함께 띄우고 출력 줄 앞에 서비스 이름을 붙입니다.
// 하나가 꺼지거나 Ctrl+C를 누르면 나머지도 함께 끕니다.
function runParallel(names) {
  for (const name of names) {
    checkReady(name);
    if (!existsSync(join(ROOT, name, '.env'))) {
      console.log(`${label(name)} .env가 없습니다. npm run setup으로 만들 수 있습니다.`);
    }
  }
  const children = new Map();
  let stopping = false;
  let exitCode = 0;

  const stopAll = (code) => {
    if (stopping) {
      return;
    }
    stopping = true;
    exitCode = code;
    children.forEach(stopChild);
  };

  for (const name of names) {
    const [[command, args]] = SERVICES[name].dev;
    const child = spawn(command, args, spawnOptions(name, { stdio: ['ignore', 'pipe', 'pipe'], detached: !IS_WINDOWS }));
    children.set(name, child);
    prefixLines(name, child.stdout, process.stdout);
    prefixLines(name, child.stderr, process.stderr);
    child.on('error', (error) => {
      console.error(`${label(name)} 실행하지 못했습니다: ${error.message}`);
      stopAll(1);
      children.delete(name);
      if (children.size === 0) {
        process.exit(exitCode);
      }
    });
    child.on('exit', (code, signal) => {
      children.delete(name);
      if (!stopping) {
        console.error(`${label(name)} 종료됨(${signal ?? code}). 나머지 서비스도 끕니다.`);
        stopAll(code === 0 ? 0 : 1);
      }
      if (children.size === 0) {
        process.exit(exitCode);
      }
    });
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => stopAll(0));
  }
}

const { task, names } = parseArgs(process.argv.slice(2));
if (task === 'dev') {
  runParallel(names);
} else {
  runSequential(task, names);
}
