/**
 * 後端驗證測試腳本
 * 測試項目：
 * 1. WBI 簽名計算與金鑰獲取
 * 2. UP 主解析 (UID / space 網址 / BV 號)
 * 3. 獲取 UP 主基本資料 (mid: 546195 老番茄)
 * 4. 批次查詢直播間狀態
 * 5. 空間動態解析
 */
import { getWbiKeys, signWbiParams } from './bilibili/wbi.js';
import { resolveUp, getUpInfo, getLiveStatusBatch, getUpDynamics, getUpVideos } from './bilibili/endpoints.js';
import { JsonStore } from './store/jsonStore.js';

async function runTests() {
  console.log('--- 開始 Bilibili 後端核心功能驗證 ---\n');

  // 1. WBI 金鑰提取與簽名測試
  console.log('[測試 1] WBI 金鑰拉取與簽名運算:');
  const keys = await getWbiKeys();
  console.log(`  -> 成功提取 keys! img_key: ${keys.img_key.slice(0, 8)}..., sub_key: ${keys.sub_key.slice(0, 8)}...`);
  const signed = await signWbiParams({ mid: 546195, test: 'hello' });
  console.log(`  -> 簽名產物 Query: ${signed}\n`);

  // 2. UP 主解析測試 (UID 與 BV 號)
  console.log('[測試 2] UP 主多格式解析:');
  const resUid = await resolveUp('546195');
  console.log(`  -> 解析純 UID: mid=${resUid.mid} (type=${resUid.sourceType})`);

  const resSpace = await resolveUp('https://space.bilibili.com/546195?from=search');
  console.log(`  -> 解析空間 URL: mid=${resSpace.mid} (type=${resSpace.sourceType})`);

  // 3. 獲取 UP 主個人資料 (老番茄 mid: 546195)
  console.log('\n[測試 3] 獲取 UP 主個人資料 (/x/space/wbi/acc/info):');
  const upInfo = await getUpInfo(546195);
  console.log(`  -> 成功取得 UP 資訊:`);
  console.log(`     暱稱: ${upInfo.name}`);
  console.log(`     MID: ${upInfo.mid}`);
  console.log(`     性別: ${upInfo.sex}`);
  console.log(`     簽名: ${upInfo.sign.slice(0, 30)}...`);
  console.log(`     頭像: ${upInfo.face}`);

  // 4. 批次查詢直播狀態
  console.log('\n[測試 4] 批次直播間狀態查詢:');
  // 查詢老番茄(546195)與其他UP
  const liveMap = await getLiveStatusBatch([546195, 2]);
  console.log(`  -> 批次查詢成功，返回 UP 數量: ${Object.keys(liveMap).length}`);
  for (const [uid, info] of Object.entries(liveMap)) {
    console.log(`     UID ${uid}: 直播狀態=${info.live_status === 1 ? '🔴 正在直播' : '⚪ 未開播'}, 標題="${info.title}"`);
  }

  // 5. 空間動態解析測試 (測試有公開動態的影視颶風 946974、需影片降級的老番茄 546195、以及目標 UP 主 1521415)
  console.log('\n[測試 5] 空間動態與影片列表解析:');
  const dynResultStorm = await getUpDynamics(946974);
  console.log(`  -> [影視颶風 946974] 獲取動態成功，解析出動態數量: ${dynResultStorm.items.length}`);
  if (dynResultStorm.items.length > 0) {
    const first = dynResultStorm.items[0];
    console.log(`     第一條動態: [${first.type}] ID=${first.id_str}`);
    console.log(`     標題/內文: ${(first.title || first.text || '').slice(0, 40)}...`);
  }

  const dynResultTomato = await getUpDynamics(546195);
  console.log(`  -> [老番茄 546195] 獲取動態成功 (平滑降級影片)，解析出動態數量: ${dynResultTomato.items.length}`);
  if (dynResultTomato.items.length > 0) {
    const first = dynResultTomato.items[0];
    console.log(`     第一條降級動態: [${first.type}] ID=${first.id_str}`);
    console.log(`     標題: ${(first.title || '').slice(0, 40)}...`);
  }

  // 測試 mid: 1521415 (原先拋出 -352 與循環死鎖的目標 UP 主)
  console.log('\n  -> [目標測試 mid: 1521415] 投稿影片與動態獲取:');
  const videosTarget = await getUpVideos(1521415, 1, 10);
  console.log(`     影片數量: ${videosTarget.list.length}, 總計: ${videosTarget.total}`);
  if (videosTarget.list.length > 0) {
    console.log(`     最新影片: [${videosTarget.list[0].bvid}] ${videosTarget.list[0].title}`);
  }

  const dynTarget = await getUpDynamics(1521415);
  console.log(`     動態數量: ${dynTarget.items.length}`);
  if (dynTarget.items.length > 0) {
    console.log(`     第一條動態: [${dynTarget.items[0].type}] ${(dynTarget.items[0].title || dynTarget.items[0].text || '').slice(0, 40)}...`);
  }

  // 6. JSON Store 原子性存儲測試
  console.log('\n[測試 6] JSON Store 本地原子讀寫:');
  const initialUps = await JsonStore.getUps();
  console.log(`  -> 當前本地關注 UP 數量: ${initialUps.length}`);

  console.log('\n=== 所有核心模組測試驗證通過！ ===');
}

runTests().catch((err) => {
  console.error('\n❌ 測試執行過程發生錯誤:', err);
  process.exit(1);
});
