import React from "react";
type GameType = "race" | "teambuilder";

interface LayoutProps {
  currentGame: GameType;
  setCurrentGame: (game: GameType) => void;
  isGameRunning: boolean;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentGame,
  setCurrentGame,
  isGameRunning,
  sidebar,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden bg-grid">
      {/* Decorative Neon Glow Gradients in Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none animate-pulse-slow"></div>

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div> */}
          <div>
            <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              RANDOM PICKER
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-blue-400 border border-slate-700 font-mono scale-90 sm:scale-100">
                v1.0.0
              </span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-500">
              물리 엔진 기반 추첨 시뮬레이터
            </p>
          </div>
        </div>

        {/* Compact Game Selector inside Header */}
        <div className="flex items-center gap-2">
          {!isGameRunning && (
            <div className="relative">
              <select
                value={currentGame}
                onChange={(e) => setCurrentGame(e.target.value as GameType)}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white text-[11px] sm:text-xs font-semibold rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 focus:outline-none focus:border-blue-500/50 cursor-pointer transition-colors"
              >
                <option value="race">🏎️ 데스 레이스</option>
                <option value="teambuilder">👥 팀 빌더</option>
              </select>
            </div>
          )}
          {/* <div className="flex items-center gap-1.5 text-[9px] sm:text-xs font-mono text-slate-500 bg-slate-900/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-800">
            <Terminal className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-blue-500" />
            <span className="hidden xs:inline">STATUS:</span>
            <span
              className={
                isGameRunning
                  ? "text-green-400 font-bold"
                  : "text-blue-400 font-bold"
              }
            >
              {isGameRunning ? "RUNNING" : "STANDBY"}
            </span>
          </div> */}
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-4 sm:p-6 max-w-[1600px] w-full mx-auto relative z-10">
        {/* Left Side: Participant Input Form (Hidden during gameplay for full screen canvas) */}
        <section
          className={`flex flex-col h-full ${
            isGameRunning ? "hidden" : "col-span-1 lg:col-span-4"
          }`}
        >
          {sidebar}
        </section>

        {/* Right Side: Game Canvas Render Window */}
        <section
          className={`flex flex-col h-full ${
            isGameRunning
              ? "col-span-1 lg:col-span-12 min-h-[calc(100vh-140px)] lg:min-h-[600px]"
              : "col-span-1 lg:col-span-8 min-h-[380px] lg:min-h-[500px]"
          }`}
        >
          {children}
        </section>
      </main>

      {/* Footer */}
      <footer className="py-3 px-6 border-t border-slate-900 bg-slate-950 text-center text-[10px] sm:text-xs text-slate-600 flex flex-wrap items-center justify-between gap-4 mt-auto">
        <p>© 2026 random-target-picker. All rights reserved.</p>
        <p className="font-mono text-[9px] sm:text-[10px] text-slate-700">
          Engine: MatterJS / React v19
        </p>
      </footer>
    </div>
  );
};
