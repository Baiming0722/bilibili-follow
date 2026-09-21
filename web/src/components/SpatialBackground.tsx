import React from 'react';

/**
 * 全息深邃空間星海背景 (Spatial Atmosphere Background)
 * - 3D 景深星辰微粒微光呼吸 (純 CSS GPU 合成，零 WebGL 計算開銷，滿幀 60/120 FPS)
 * - 全息網格地平線 (Perspective Cyber Horizon)
 * - 動態環境粉藍光束流動 (Ambient Volumetric Glows)
 * - 漂浮宇宙微塵多層次景深 (Cosmic Sparks)
 * - 邊緣暗角景深 (Vignette) 守衛文字與前景元件可讀性
 */
export const SpatialBackground: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#030407]">
      {/* 1. 深度動態環境光暈 (Volumetric Nebulae - 純 GPU 獨立合成圖層，適度收斂模糊半徑) */}
      <div className="ambient-orb-pink absolute -top-48 -left-48 w-[720px] h-[720px] rounded-full bg-gradient-to-br from-[#fb7299]/25 via-[#8b5cf6]/18 to-transparent blur-[64px] opacity-70 transform-gpu" />
      <div className="ambient-orb-blue absolute top-1/4 -right-52 w-[760px] h-[760px] rounded-full bg-gradient-to-bl from-[#00aeec]/22 via-[#3b82f6]/15 to-transparent blur-[72px] opacity-70 transform-gpu" />
      <div className="ambient-orb-pink absolute -bottom-52 left-1/4 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-[#fb7299]/20 via-[#ec4899]/12 to-transparent blur-[60px] opacity-65 transform-gpu" />

      {/* 2. 空間全息透視地平網格 (Perspective Spatial Grid - 移除跨圖層 mix-blend-screen，改為自然半透明疊加) */}
      <div className="spatial-horizon-grid absolute inset-0 opacity-35" />

      {/* 3. 漂浮全息微光星點 (Floating Cosmic Sparks - 雙層景深視差) */}
      <div className="cosmic-dust-layer absolute inset-0 opacity-60 transform-gpu" />
      <div className="cosmic-dust-secondary absolute inset-0 opacity-40 transform-gpu" />

      {/* 4. 極致微噪點光學濾鏡 (Film Grain Glass - 移除 mix-blend-overlay 以免被迫逐幀重新光柵化重繪) */}
      <div className="absolute inset-0 bg-noise opacity-[0.025]" />

      {/* 5. 邊緣暗角景深 (Vignette) - 確保卡片與文字高對比清晰度 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#030407_90%)] opacity-85" />
    </div>
  );
};

