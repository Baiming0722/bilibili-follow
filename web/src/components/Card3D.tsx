import React from 'react';

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** 保留以相容呼叫端：靜態模式下已忽略，不再產生任何傾斜 */
  intensity?: number;
  /** 保留以相容呼叫端：靜態模式下已忽略，不再渲染游標追蹤邊框 */
  spotlightBorder?: boolean;
  /** 保留以相容呼叫端：靜態模式下已忽略，不再產生任何 transform */
  preserve3d?: boolean;
  /** 外層容器樣式 */
  containerClassName?: string;
  /** 保留以相容呼叫端：靜態模式下已忽略，不再渲染聚光燈光暈 */
  glowColor?: string;
}

// 靜態景深層次容器：完全靜止，不監聽滑鼠、不傾斜、不縮放、不追蹤聚光燈。
// 立體感僅由 bezel-shell / bezel-core 的靜態陰影與邊框提供。
export const Card3D: React.FC<Card3DProps> = ({
  children,
  className = '',
  onClick,
  containerClassName = ''
}) => {
  return (
    <div
      className={`relative group ${containerClassName}`}
      onClick={onClick}
    >
      <div className={`relative ${className}`}>
        {children}
      </div>
    </div>
  );
};
