import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Compass } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const { fallbackTitle = '組件渲染發生異常' } = this.props;
      return (
        <div className="w-full my-6 p-6 sm:p-10 bezel-shell animate-fade-in">
          <div className="bezel-core p-8 text-center space-y-5 border border-red-500/30 bg-[#0d070d]/90 shadow-[0_0_35px_rgba(239,68,68,0.2)]">
            <div className="w-16 h-16 squircle bg-gradient-to-tr from-red-500/20 to-pink-500/20 flex items-center justify-center mx-auto border border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.3)]">
              <AlertTriangle className="w-8 h-8 text-red-400 animate-pulse" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {fallbackTitle}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                該分頁在渲染或解析資料時遇到了未預期的狀態。系統已將此錯誤隔離，其他功能仍可正常運作。
              </p>
              {this.state.error?.message && (
                <div className="mt-3 p-3 rounded-xl bg-black/60 border border-red-500/20 text-left overflow-x-auto">
                  <p className="text-[11px] font-mono text-red-300 break-all select-all">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="btn-press btn-3d btn-3d-pink px-6 py-2.5 rounded-full text-xs font-black text-white inline-flex items-center gap-2 shadow-[0_4px_16px_rgba(251,114,153,0.45)]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重試此組件</span>
              </button>

              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  const url = new URL(window.location.href);
                  url.searchParams.set('view', 'feed');
                  window.history.replaceState({}, '', url.toString());
                  window.location.reload();
                }}
                className="btn-press px-5 py-2.5 rounded-full text-xs font-bold text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 inline-flex items-center gap-2 transition-[transform,box-shadow,background-color]"
              >
                <Compass className="w-3.5 h-3.5 text-[#00aeec]" />
                <span>返回動態首頁</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
