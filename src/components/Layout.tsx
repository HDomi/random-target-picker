import React from "react";

interface LayoutProps {
  isGameRunning: boolean;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  isGameRunning,
  sidebar,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden bg-grid">
      {/* Decorative Neon Glow Gradients in Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none animate-pulse-slow"></div>

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
              : "hidden lg:flex lg:col-span-8 min-h-[380px] lg:min-h-[500px]"
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
