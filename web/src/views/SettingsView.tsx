import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Settings, 
  Trash2, 
  Pin, 
  Bell, 
  Download, 
  Upload, 
  Tag, 
  Edit3, 
  Check, 
  X, 
  ShieldCheck,
  Smartphone,
  Save,
  Radio,
  Video,
  Sparkles
} from 'lucide-react';
import { api } from '../api/client.js';
import type { UpUser, AppSettings } from '../types/index.js';

interface SettingsViewProps {
  ups: UpUser[];
  onRefreshUps: () => void;
  onShowNotice: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ ups, onRefreshUps, onShowNotice }) => {


  // 新增 UP 主輸入
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);

  // 應用整體設定
  const [settings, setSettings] = useState<AppSettings>({
    pollIntervalLiveSec: 30,
    pollIntervalDynamicSec: 60,
    enableNotifications: true,
    notifyLive: true,
    notifyVideo: true,
    notifyDynamic: true,
    soundEnabled: true,
    theme: 'dark'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // 備註修改狀態
  const [editingNoteMid, setEditingNoteMid] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState('');

  // 標籤修改狀態
  const [editingTagMid, setEditingTagMid] = useState<number | null>(null);
  const [tempTagInput, setTempTagInput] = useState('');

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  // 新增 UP 主
  const handleAddUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim()) return;

    try {
      setAdding(true);
      const res = await api.addUp(addInput.trim());
      onShowNotice(`🎉 成功添加關注 UP 主「${res.name}」！`);
      setAddInput('');
      onRefreshUps();
    } catch (err: any) {
      alert(`新增失敗: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  // 刪除 UP 主
  const handleDeleteUp = async (mid: number, name: string) => {
    if (!confirm(`確定要取消特別關注 UP 主「${name}」嗎？`)) return;
    try {
      await api.removeUp(mid);
      onShowNotice(`已移除 UP 主「${name}」`);
      onRefreshUps();
    } catch (err: any) {
      alert(`移除失敗: ${err.message}`);
    }
  };

  // 置頂切換
  const handleTogglePin = async (up: UpUser) => {
    try {
      await api.updateUp(up.mid, { isPinned: !up.isPinned });
      onRefreshUps();
    } catch (err: any) {
      alert(`操作失敗: ${err.message}`);
    }
  };

  // 推播通知細項開關
  const handleToggleNotify = async (up: UpUser, field: 'notifyOnLive' | 'notifyOnVideo' | 'notifyOnDynamic') => {
    try {
      const current = up[field] !== false;
      await api.updateUp(up.mid, { [field]: !current });
      onRefreshUps();
    } catch (err: any) {
      alert(`更新失敗: ${err.message}`);
    }
  };

  // 儲存備註
  const handleSaveNote = async (mid: number) => {
    try {
      await api.updateUp(mid, { customNote: tempNote.trim() });
      setEditingNoteMid(null);
      onRefreshUps();
    } catch (err: any) {
      alert(`儲存備註失敗: ${err.message}`);
    }
  };

  // 標籤新增 / 刪除
  const handleAddTag = async (up: UpUser, tag: string) => {
    if (!tag.trim()) return;
    const currentTags = up.tags || [];
    if (currentTags.includes(tag.trim())) return;
    try {
      await api.updateUp(up.mid, { tags: [...currentTags, tag.trim()] });
      setTempTagInput('');
      onRefreshUps();
    } catch (err: any) {
      alert(`添加標籤失敗: ${err.message}`);
    }
  };

  const handleRemoveTag = async (up: UpUser, tagToRemove: string) => {
    const nextTags = (up.tags || []).filter((t) => t !== tagToRemove);
    try {
      await api.updateUp(up.mid, { tags: nextTags });
      onRefreshUps();
    } catch (err: any) {
      alert(`移除標籤失敗: ${err.message}`);
    }
  };

  // 儲存系統設定
  const handleSaveSettings = async () => {
    try {
      setSettingsLoading(true);
      await api.updateSettings(settings);
      onShowNotice('✅ 應用設定已成功更新！');
    } catch (err: any) {
      alert(`設定更新失敗: ${err.message}`);
    } finally {
      setSettingsLoading(false);
    }
  };

  // 瀏覽器推播權限請求與測試
  const handleRequestNotification = async () => {
    if (!('Notification' in window)) {
      alert('您的瀏覽器不支援 Notification 系統推播 API');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('Bili特注 - 推播測試', {
        body: '特別關注即時推播功能運作正常！',
        icon: '/favicon.svg'
      });
      onShowNotice('🔔 瀏覽器系統推播權限已就緒！');
    } else {
      alert('未取得通知授權，請至瀏覽器設定中開啟通知權限。');
    }
  };

  // 資料備份匯出
  const handleExportBackup = async () => {
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bilibili-follow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowNotice('📦 備份檔案已成功下載！');
    } catch (err: any) {
      alert(`備份匯出失敗: ${err.message}`);
    }
  };

  // 資料匯入恢復
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const res = await api.importBackup(json);
        onShowNotice(`🎉 成功恢復 ${res.upsCount} 位特別關注 UP 主！`);
        onRefreshUps();
      } catch (err: any) {
        alert(`匯入失敗，請確認檔案格式正確: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-stagger-1">
      {/* 快速新增 UP 主面板 (Double-Bezel 雙層工藝結構) */}
      <section className="bezel-shell">
        <div className="bezel-core p-5 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 squircle bg-[#fb7299]/15 text-[#fb7299] flex items-center justify-center border border-[#fb7299]/30 shadow-[0_0_15px_rgba(251,114,153,0.25)]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">添加特別關注 UP 主</h3>
              <p className="text-xs text-slate-400">支援 B 站空間 UID、個人網址、b23.tv 短鏈或影片 BV 號解析</p>
            </div>
          </div>

          <form onSubmit={handleAddUp} className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              placeholder="貼上 UP 主個人主頁、UID (例如 546195)、短鏈或任意 BV 號..."
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              className="focus-ring flex-1 px-4 py-3 bg-white/[0.04] rounded-full text-sm text-white placeholder:text-slate-500 focus:outline-none border border-white/10 transition-[border-color,box-shadow,background-color] shadow-inner"
            />
            <button
              type="submit"
              disabled={adding || !addInput.trim()}
              className="btn-press btn-3d btn-3d-pink px-6 py-3 rounded-full text-white text-sm font-black flex items-center justify-between gap-3 disabled:opacity-50 shadow-[0_6px_22px_rgba(251,114,153,0.45)] group/addbtn"
            >
              <span className="tracking-tight">{adding ? '智慧解析中...' : '確認添加'}</span>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shadow-inner group-hover/addbtn:scale-110 transition-transform">
                <UserPlus className="w-3.5 h-3.5 text-white" />
              </div>
            </button>
          </form>
        </div>
      </section>

      {/* 特別關注管理列表 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white flex items-center gap-2.5 tracking-tight">
            <span>特別關注成員細節管理</span>
            <span className="text-xs text-slate-400 bg-white/[0.06] px-2.5 py-0.5 squircle tabular-nums font-bold border border-white/5">
              {ups.length} 位
            </span>
          </h3>
        </div>

        <div className="space-y-3.5">
          {ups.map((up, idx) => (
            <div
              key={up.mid}
              className={`bezel-shell bezel-shell-interactive animate-stagger-${Math.min(idx + 1, 5)} ${
                up.isPinned ? 'border-[#00aeec]/40 shadow-[0_0_25px_rgba(0,174,236,0.15)]' : ''
              }`}
            >
              <div className="bezel-core p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* UP 主基本資料 */}
                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                  <img
                    src={up.face}
                    alt={up.name}
                    referrerPolicy="no-referrer"
                    className="w-13 h-13 squircle-avatar object-cover border border-white/10 ring-2 ring-white/15 flex-shrink-0 shadow-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-sm sm:text-base text-white truncate tracking-tight">{up.name}</h4>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/[0.06] text-slate-300 font-mono tabular-nums border border-white/5 font-bold">
                        UID: {up.mid}
                      </span>
                      {up.isPinned && (
                        <span className="jelly-badge-pink text-[10px] font-black text-[#fb7299] px-2.5 py-0.5 squircle">
                          置頂關注
                        </span>
                      )}
                    </div>

                    {/* 備註編輯 */}
                    <div className="mt-1.5 flex items-center gap-2">
                      {editingNoteMid === up.mid ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={tempNote}
                            onChange={(e) => setTempNote(e.target.value)}
                            placeholder="填寫自訂備註..."
                            className="focus-ring px-3 py-1 bg-white/10 rounded-full text-xs text-white border border-white/20"
                          />
                          <button
                            onClick={() => handleSaveNote(up.mid)}
                            className="btn-press p-1.5 rounded-full bg-[#00aeec] text-white shadow-[0_2px_8px_rgba(0,174,236,0.5)]"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingNoteMid(null)}
                            className="btn-press p-1.5 rounded-full bg-white/10 text-slate-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNoteMid(up.mid);
                            setTempNote(up.customNote || '');
                          }}
                          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                        >
                          <Edit3 className="w-3 h-3 text-slate-500" />
                          <span>{up.customNote || '添加自訂備註...'}</span>
                        </button>
                      )}
                    </div>

                    {/* 自訂標籤 Tags */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {(up.tags || []).map((t) => (
                        <span
                          key={t}
                          className="jelly-badge text-[10px] px-2.5 py-0.5 squircle text-slate-200 flex items-center gap-1.5 font-bold"
                        >
                          #{t}
                          <button
                            onClick={() => handleRemoveTag(up, t)}
                            className="hover:text-red-400 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {editingTagMid === up.mid ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={tempTagInput}
                            onChange={(e) => setTempTagInput(e.target.value)}
                            placeholder="新標籤"
                            className="focus-ring px-2.5 py-0.5 bg-white/10 rounded-full text-[10px] text-white w-18 border border-white/20"
                          />
                          <button
                            onClick={() => {
                              handleAddTag(up, tempTagInput);
                              setEditingTagMid(null);
                            }}
                            className="btn-press text-[10px] text-[#00aeec] font-black px-2 py-0.5 rounded-full bg-[#00aeec]/15 border border-[#00aeec]/35"
                          >
                            加入
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingTagMid(up.mid)}
                          className="btn-press text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]"
                        >
                          <Tag className="w-2.5 h-2.5" /> +標籤
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 操作按鈕群 (立體晶片感) */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {/* 直播通知開關 */}
                  <button
                    onClick={() => handleToggleNotify(up, 'notifyOnLive')}
                    className={`btn-press focus-ring px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-[color,background-color,box-shadow] ${
                      up.notifyOnLive !== false
                        ? 'bg-red-500/15 border-red-500/40 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                        : 'bg-white/[0.03] border-white/[0.06] text-slate-500'
                    }`}
                    title="開播推播通知"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span className="hidden md:inline text-[11px]">直播</span>
                  </button>

                  {/* 影片通知開關 */}
                  <button
                    onClick={() => handleToggleNotify(up, 'notifyOnVideo')}
                    className={`btn-press focus-ring px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-[color,background-color,box-shadow] ${
                      up.notifyOnVideo !== false
                        ? 'bg-[#00aeec]/15 border-[#00aeec]/40 text-[#00aeec] shadow-[0_0_12px_rgba(0,174,236,0.25)]'
                        : 'bg-white/[0.03] border-white/[0.06] text-slate-500'
                    }`}
                    title="新影片發布通知"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span className="hidden md:inline text-[11px]">影片</span>
                  </button>

                  {/* 動態通知開關 */}
                  <button
                    onClick={() => handleToggleNotify(up, 'notifyOnDynamic')}
                    className={`btn-press focus-ring px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-[color,background-color,box-shadow] ${
                      up.notifyOnDynamic !== false
                        ? 'bg-[#fb7299]/15 border-[#fb7299]/40 text-[#fb7299] shadow-[0_0_12px_rgba(251,114,153,0.25)]'
                        : 'bg-white/[0.03] border-white/[0.06] text-slate-500'
                    }`}
                    title="圖文動態通知"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden md:inline text-[11px]">動態</span>
                  </button>

                  {/* 置頂切換 */}
                  <button
                    onClick={() => handleTogglePin(up)}
                    className={`btn-press focus-ring p-2.5 rounded-xl border transition-[color,background-color,box-shadow] ${
                      up.isPinned
                        ? 'bg-[#00aeec]/20 border-[#00aeec]/50 text-[#00aeec] shadow-[0_0_14px_rgba(0,174,236,0.3)]'
                        : 'bg-white/[0.04] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                    }`}
                    title={up.isPinned ? '取消置頂' : '置頂此 UP 主'}
                  >
                    <Pin className="w-4 h-4" />
                  </button>

                  {/* 刪除取消關注 */}
                  <button
                    onClick={() => handleDeleteUp(up.mid, up.name)}
                    className="btn-press focus-ring p-2.5 rounded-xl bg-white/[0.04] hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/[0.06] hover:border-red-500/35 transition-[color,background-color,box-shadow]"
                    title="取消特別關注"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 輪詢與通知偏好設定 */}
      <section className="bezel-shell">
        <div className="bezel-core p-5 sm:p-7 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 squircle bg-[#00aeec]/15 text-[#00aeec] flex items-center justify-center border border-[#00aeec]/30 shadow-[0_0_15px_rgba(0,174,236,0.25)]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">輪詢與推播偏好設定</h3>
                <p className="text-xs text-slate-400">配置背景巡檢頻率與作業系統推播權限</p>
              </div>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={settingsLoading}
              className="btn-press btn-3d btn-3d-blue px-5 py-2.5 rounded-full text-xs font-black text-white flex items-center gap-2 shadow-[0_4px_16px_rgba(0,174,236,0.45)]"
            >
              <Save className="w-4 h-4" />
              <span>{settingsLoading ? '儲存中...' : '儲存變更'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* 直播輪詢間隔 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 tracking-tight">
                直播開播巡邏頻率 (秒)
              </label>
              <select
                value={settings.pollIntervalLiveSec}
                onChange={(e) =>
                  setSettings({ ...settings, pollIntervalLiveSec: Number(e.target.value) })
                }
                className="focus-ring w-full px-4 py-2.5 bg-white/[0.04] rounded-2xl text-xs text-white border border-white/[0.08] tabular-nums"
              >
                <option value={10} className="bg-[#0e111c]">10 秒 (極速偵測)</option>
                <option value={30} className="bg-[#0e111c]">30 秒 (預設標準)</option>
                <option value={60} className="bg-[#0e111c]">60 秒 (低資源消耗)</option>
                <option value={300} className="bg-[#0e111c]">5 分鐘 (節能模式)</option>
              </select>
            </div>

            {/* 動態輪詢間隔 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 tracking-tight">
                新影片與圖文動態檢測頻率 (秒)
              </label>
              <select
                value={settings.pollIntervalDynamicSec}
                onChange={(e) =>
                  setSettings({ ...settings, pollIntervalDynamicSec: Number(e.target.value) })
                }
                className="focus-ring w-full px-4 py-2.5 bg-white/[0.04] rounded-2xl text-xs text-white border border-white/[0.08] tabular-nums"
              >
                <option value={30} className="bg-[#0e111c]">30 秒 (極速刷新)</option>
                <option value={60} className="bg-[#0e111c]">60 秒 (標準推薦)</option>
                <option value={300} className="bg-[#0e111c]">5 分鐘</option>
                <option value={600} className="bg-[#0e111c]">10 分鐘</option>
              </select>
            </div>
          </div>

          {/* 系統推播測試與權限 */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 p-4.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 squircle bg-[#fb7299]/15 text-[#fb7299] flex items-center justify-center border border-[#fb7299]/30">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white tracking-tight">原生系統推播彈窗</p>
                <p className="text-[11px] text-slate-400">當開播或有新影片發布時，由作業系統直接跳出視窗通知</p>
              </div>
            </div>
            <button
              onClick={handleRequestNotification}
              className="btn-press btn-3d px-5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white flex items-center gap-2 border border-white/10 shadow-md"
            >
              <Bell className="w-3.5 h-3.5 text-[#fb7299]" />
              <span>授權並測試推播</span>
            </button>
          </div>
        </div>
      </section>

      {/* 資料備份與恢復 */}
      <section className="bezel-shell">
        <div className="bezel-core p-5 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 squircle bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">資料安全與遷移備份</h3>
              <p className="text-xs text-slate-400">一鍵匯出或匯入所有關注名單、標籤與備註，輕鬆跨裝置遷移</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-3">
            <button
              onClick={handleExportBackup}
              className="btn-press btn-3d px-6 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white flex items-center gap-2 border border-white/10 shadow-md"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>匯出完整備份 (JSON)</span>
            </button>

            <label className="btn-press btn-3d px-6 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white flex items-center gap-2 border border-white/10 cursor-pointer shadow-md">
              <Upload className="w-4 h-4 text-[#00aeec]" />
              <span>匯入備份還原</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
};
