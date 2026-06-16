import React, { useState } from 'react';
import { Users, Sparkles, Play, Trash2 } from 'lucide-react';

interface ParticipantInputProps {
  onStart: (participants: string[]) => void;
  isGameRunning: boolean;
  onReset: () => void;
}

export const ParticipantInput: React.FC<ParticipantInputProps> = ({
  onStart,
  isGameRunning,
  onReset,
}) => {
  const [inputValue, setInputValue] = useState('');

  // Parse names from input
  const parsedList = inputValue
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const handleLoadSamples = () => {
    if (isGameRunning) return;
    const samples = [
      '데드풀 🔴',
      '울버린 🟡',
      '아이언맨 🤖',
      '스파이더맨 🕷️',
      '블랙 위도우 🕷️',
      '헐크 🟢',
      '토르 ⚡',
      '캡틴 아메리카 🛡️',
      '닥터 스트레인지 🌀',
      '블랙 팬서 🐈‍⬛',
      '호크아이 🏹',
      '스칼렛 위치 🔮',
    ];
    setInputValue(samples.join('\n'));
  };

  const handleClear = () => {
    if (isGameRunning) return;
    setInputValue('');
  };

  const handleStart = () => {
    const cleanList = inputValue
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    if (cleanList.length < 2) return;

    setInputValue(cleanList.join('\n'));
    onStart(cleanList);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 backdrop-blur-md">
      {/* Title */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white">
          <Users className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-400" />
          <h3 className="font-bold tracking-tight text-sm sm:text-base">참여자 명단</h3>
        </div>
        <span className="text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          {parsedList.length} 명
        </span>
      </div>

      {/* Description / Info */}
      <p className="text-[11px] sm:text-xs text-slate-400 mb-3 sm:mb-4 leading-relaxed">
        한 줄에 한 명씩 이름을 입력해 주세요. 최소 2명 이상이 필요합니다.
      </p>

      {/* Action shortcuts */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={handleLoadSamples}
          disabled={isGameRunning}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] sm:text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        >
          <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          샘플 불러오기
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isGameRunning || !inputValue}
          className="flex items-center justify-center p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-red-400 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
          title="비우기"
        >
          <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </button>
      </div>

      {/* Textarea */}
      <div className="relative flex-1 min-h-[150px] sm:min-h-[200px] mb-3 sm:mb-4">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isGameRunning}
          placeholder="엔터(줄바꿈)로 참여자 이름을 입력하세요..."
          className="w-full h-full min-h-[160px] sm:min-h-[220px] bg-slate-950/60 text-slate-200 border border-slate-800 rounded-xl p-3 sm:p-4 text-xs sm:text-sm font-sans focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-650 resize-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/20"
        />

        {parsedList.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-700 select-none">
            <span className="text-[11px] sm:text-xs">예시: 홍길동\n이순신\n세종대왕</span>
          </div>
        )}
      </div>

      {/* Warning Message if less than 2 */}
      {parsedList.length > 0 && parsedList.length < 2 && (
        <div className="mb-3 sm:mb-4 text-center p-2 rounded-lg bg-red-950/20 border border-red-900/30 text-[11px] sm:text-xs text-red-400">
          ⚠️ 추첨을 진행하려면 2명 이상 입력해 주세요!
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-2 mt-auto">
        {!isGameRunning ? (
          <button
            onClick={handleStart}
            disabled={parsedList.length < 2}
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 cursor-pointer disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 active:scale-98"
          >
            <Play className="w-3.5 sm:w-4 h-3.5 sm:h-4 fill-current" />
            🚀 추첨 시작
          </button>
        ) : (
          <button
            onClick={onReset}
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transition-all hover:shadow-red-500/30 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-98"
          >
            🛑 게임 중단 및 리셋
          </button>
        )}
      </div>
    </div>
  );
};
