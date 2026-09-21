/**
 * 重啟不丟驗證（可重複執行，無外部依賴，離線可跑）：
 * A) 優雅 SIGTERM 落盤：啟後端 → PUT settings → SIGTERM → 重啟 → GET 讀回
 * B) 空檔霸位遷移救援：目標預置 `[]` 空檔 + legacy 好檔 → 啟動後好檔救回
 *
 * 執行：npm run build -w server && node server/scripts/verify-restart.mjs
 * 退出碼 0 = 全過；非 0 = 失敗（stderr 含定位資訊）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENTRY = path.join(ROOT, 'server', 'dist', 'index.js');
const PORT_A = 31811;
const PORT_B = 31812;

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function waitHealth(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error(`後端未就緒 (port=${port})`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

function spawnBackend(port, dataDir, extraEnv = {}) {
  const child = spawn(process.execPath, [ENTRY], {
    env: { ...process.env, PORT: String(port), BILI_DATA_DIR: dataDir, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

function waitExit(child, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('子進程退出超時')), timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function killTree(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGKILL');
  await new Promise((r) => setTimeout(r, 500));
}

async function testGracefulSigterm() {
  const dataDir = tmpDir('bili-verify-A-');
  let child = null;
  try {
    child = spawnBackend(PORT_A, dataDir);
    await waitHealth(PORT_A);

    const putRes = await fetch(`http://127.0.0.1:${PORT_A}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollIntervalLiveSec: 77 })
    });
    if (!putRes.ok) throw new Error(`PUT settings 失敗: ${putRes.status}`);

    child.kill('SIGTERM');
    await waitExit(child);
    child = null;

    const persisted = fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8');
    if (!persisted.includes('"pollIntervalLiveSec": 77')) {
      throw new Error(`SIGTERM 後磁碟檔無寫入內容: ${persisted.slice(0, 200)}`);
    }

    child = spawnBackend(PORT_A, dataDir);
    await waitHealth(PORT_A);
    const getRes = await fetch(`http://127.0.0.1:${PORT_A}/api/settings`);
    const json = await getRes.json();
    if (json.data?.pollIntervalLiveSec !== 77) {
      throw new Error(`重啟後讀回不符: ${JSON.stringify(json).slice(0, 200)}`);
    }
    console.log('[PASS] A) 優雅 SIGTERM 落盤：重啟後讀回 pollIntervalLiveSec=77');
  } finally {
    if (child) {
      await killTree(child).catch(() => {});
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function testEmptyFileMigrationRescue() {
  const dataDir = tmpDir('bili-verify-B-target-');
  const legacyDir = tmpDir('bili-verify-B-legacy-');
  const goodUps = [
    {
      mid: 999001,
      name: '遷移救援測試UP',
      face: '',
      sign: '',
      sex: '保密',
      level: 0,
      customNote: '',
      tags: [],
      isPinned: false,
      pinOrder: 0,
      notifyOnLive: true,
      notifyOnVideo: true,
      notifyOnDynamic: true,
      createdAt: 1,
      updatedAt: 1
    }
  ];
  // 模擬「空檔先建」：目標已存在 `[]` 空檔（舊 bug 下會永久霸位）
  fs.writeFileSync(path.join(dataDir, 'ups.json'), '[]', 'utf8');
  // legacy 好檔（含一筆真實資料）
  fs.writeFileSync(path.join(legacyDir, 'ups.json'), JSON.stringify(goodUps), 'utf8');

  let child = null;
  try {
    child = spawnBackend(PORT_B, dataDir, { BILI_LEGACY_DIRS: legacyDir });
    await waitHealth(PORT_B);
    const getRes = await fetch(`http://127.0.0.1:${PORT_B}/api/ups`);
    const json = await getRes.json();
    const found = Array.isArray(json.data) && json.data.some((u) => u.mid === 999001);
    if (!found) {
      throw new Error(`空檔未被救援，讀回: ${JSON.stringify(json).slice(0, 200)}`);
    }
    console.log('[PASS] B) 空檔霸位遷移救援：legacy 好檔已救回（mid=999001）');
    child.kill('SIGTERM');
    await waitExit(child);
    child = null;
  } finally {
    if (child) {
      await killTree(child).catch(() => {});
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(legacyDir, { recursive: true, force: true });
  }
}

if (!fs.existsSync(ENTRY)) {
  console.error(`[FAIL] 找不到後端編譯產物 ${ENTRY}，請先執行 npm run build -w server`);
  process.exit(1);
}

try {
  await testGracefulSigterm();
  await testEmptyFileMigrationRescue();
  console.log('[DONE] 重啟驗證全過');
} catch (err) {
  console.error('[FAIL]', err.message);
  process.exit(1);
}
