import { useState } from 'react';
import { Layout } from './components/Layout';
import { ParticipantInput } from './components/ParticipantInput';
import { DeathRace } from './components/games/DeathRace';
import { TeamBuilder } from './components/games/TeamBuilder';
import { Trophy, Sparkles, RefreshCw } from 'lucide-react';

type GameType = 'race' | 'teambuilder';

function App() {
  const [currentGame, setCurrentGame] = useState<GameType>('race');
  const [participants, setParticipants] = useState<string[]>([]);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [rankings, setRankings] = useState<string[]>([]);

  const handleStartGame = (list: string[]) => {
    setParticipants(list);
    setIsGameRunning(true);
    setWinner(null);
    setRankings([]);
  };

  const handleFinishedGame = (result: string | string[]) => {
    if (Array.isArray(result)) {
      setRankings(result);
      setWinner(result[0]);
    } else {
      setRankings([result]);
      setWinner(result);
    }
    setIsGameRunning(false);
  };

  const handleResetGame = () => {
    setIsGameRunning(false);
    setWinner(null);
    setRankings([]);
  };

  const renderGame = () => {
    if (currentGame === 'race') {
      return (
        <DeathRace
          participants={participants}
          isStarted={isGameRunning}
          onFinished={handleFinishedGame}
          onReset={handleResetGame}
        />
      );
    }
    if (currentGame === 'teambuilder') {
      return (
        <TeamBuilder
          participants={participants}
          isStarted={isGameRunning}
          onFinished={handleFinishedGame}
          onReset={handleResetGame}
        />
      );
    }
    return null;
  };

  return (
    <>
      <Layout
        currentGame={currentGame}
        setCurrentGame={(game) => {
          if (!isGameRunning) {
            setCurrentGame(game);
            setWinner(null);
            setRankings([]);
          }
        }}
        isGameRunning={isGameRunning}
        sidebar={
          <ParticipantInput
            onStart={handleStartGame}
            isGameRunning={isGameRunning}
            onReset={handleResetGame}
            maxParticipants={currentGame === "race" ? 30 : undefined}
          />
        }
      >
        <div className="relative w-full h-full flex-1 flex flex-col">
          {renderGame()}

          {/* Winner Celebration / Full Leaderboard Modal Overlay */}
          {winner && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
              <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-center shadow-2xl shadow-yellow-500/5 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                
                {/* Decorative glow grids inside modal */}
                <div className="absolute -top-12 -left-12 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>

                {/* Animated sparks */}
                <div className="flex justify-center gap-1 mb-1 sm:mb-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 animate-pulse" />
                  <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 animate-bounce" />
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 animate-pulse" />
                </div>

                <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 mb-2 sm:mb-3 mx-auto">
                  <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white mb-1 tracking-tight">🏆 최종 레이스 결과 🏆</h3>
                <p className="text-[10px] sm:text-xs text-slate-400 mb-3 sm:mb-4">완주 순서 기준 최종 순위판입니다.</p>

                {/* Sports 3D Podium Design for Top 3 */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5 items-end px-1 mt-1">
                  
                  {/* 2nd Place (Left Side) */}
                  {rankings[1] ? (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-end min-h-[95px] sm:min-h-[120px] relative order-1">
                      <span className="text-xl sm:text-2xl mb-0.5 sm:drop-shadow-md">🥈</span>
                      <p className="text-[9px] font-black text-slate-400 tracking-wider">2ND PLACE</p>
                      <p className="text-xs sm:text-sm font-extrabold text-slate-200 truncate w-full mt-1 px-0.5">{rankings[1]}</p>
                    </div>
                  ) : (
                    <div className="bg-slate-950/20 border border-dashed border-slate-900 rounded-xl sm:rounded-2xl min-h-[95px] sm:min-h-[120px] order-1"></div>
                  )}

                  {/* 1st Place (Center / Tallest) */}
                  {rankings[0] ? (
                    <div className="bg-gradient-to-b from-yellow-500/10 to-slate-950/60 border border-yellow-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-end min-h-[115px] sm:min-h-[145px] relative order-2 shadow-lg shadow-yellow-500/5 ring-1 ring-yellow-500/10">
                      <span className="text-2xl sm:text-3xl mb-1 animate-bounce sm:drop-shadow-md">🥇</span>
                      <p className="text-[10px] sm:text-xs font-black text-yellow-500 tracking-widest">CHAMPION</p>
                      <p className="text-sm sm:text-base font-black text-yellow-400 truncate w-full mt-1 px-0.5 drop-shadow-glow">{rankings[0]}</p>
                    </div>
                  ) : (
                    <div className="bg-slate-950/20 border border-dashed border-slate-900 rounded-xl sm:rounded-2xl min-h-[115px] sm:min-h-[145px] order-2"></div>
                  )}

                  {/* 3rd Place (Right Side) */}
                  {rankings[2] ? (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-end min-h-[85px] sm:min-h-[110px] relative order-3">
                      <span className="text-xl sm:text-2xl mb-0.5 sm:drop-shadow-md">🥉</span>
                      <p className="text-[9px] font-black text-slate-500 tracking-wider">3RD PLACE</p>
                      <p className="text-xs sm:text-sm font-extrabold text-slate-300 truncate w-full mt-1 px-0.5">{rankings[2]}</p>
                    </div>
                  ) : (
                    <div className="bg-slate-950/20 border border-dashed border-slate-900 rounded-xl sm:rounded-2xl min-h-[85px] sm:min-h-[110px] order-3"></div>
                  )}

                </div>

                {/* Remainder Rankings (Scrollable List for 4th and below) */}
                {rankings.length > 3 && (
                  <div className="flex-1 overflow-y-auto max-h-[130px] sm:max-h-[180px] mb-4 sm:mb-5 bg-slate-950/50 border border-slate-850 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-left">
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">기타 순위 (4등 이하)</p>
                    <div className="flex flex-col gap-1 sm:gap-1.5">
                      {rankings.slice(3).map((name, index) => {
                        const rankNum = index + 4;
                        return (
                          <div key={name} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg sm:rounded-xl bg-slate-900/40 border border-slate-850 text-[11px] sm:text-xs transition-colors hover:border-slate-800">
                            <span className="font-mono text-slate-400 font-bold">{rankNum}등</span>
                            <span className="font-semibold text-slate-200">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Restart Button */}
                <button
                  onClick={handleResetGame}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 cursor-pointer active:scale-98"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                  다시 플레이 하기
                </button>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}

export default App;
