import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
} from "@dnd-kit/core";
import {
  Lock,
  Unlock,
  RefreshCw,
  Sparkles,
  Users,
  Plus,
  Minus,
  Layers,
  Trash2,
} from "lucide-react";

interface GameProps {
  participants: string[];
  isStarted: boolean;
  onFinished: (rankings: string[]) => void;
  onReset: () => void;
}

interface Player {
  id: string;
  name: string;
  teamId: string | null;
  isLocked: boolean;
}

const getTeamColor = (index: number) => {
  const colors = [
    "border-blue-500/25 bg-blue-500/5 text-blue-400 ring-blue-500/15",
    "border-purple-500/25 bg-purple-500/5 text-purple-400 ring-purple-500/15",
    "border-emerald-500/25 bg-emerald-500/5 text-emerald-400 ring-emerald-500/15",
    "border-rose-500/25 bg-rose-500/5 text-rose-400 ring-rose-500/15",
    "border-amber-500/25 bg-amber-500/5 text-amber-400 ring-amber-500/15",
    "border-pink-500/25 bg-pink-500/5 text-pink-400 ring-pink-500/15",
    "border-cyan-500/25 bg-cyan-500/5 text-cyan-400 ring-cyan-500/15",
    "border-teal-500/25 bg-teal-500/5 text-teal-400 ring-teal-500/15",
  ];
  return colors[index % colors.length];
};

const DroppableArea: React.FC<{
  id: string;
  children: React.ReactNode;
  className?: string;
}> = ({ id, children, className }) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-all ${
        isOver
          ? "ring-2 ring-blue-500/50 border-blue-500/40 bg-blue-500/10"
          : ""
      }`}
    >
      {children}
    </div>
  );
};

const DraggablePlayer: React.FC<{
  player: Player;
  onToggleLock: (id: string) => void;
}> = ({ player, onToggleLock }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-between px-3 py-2 sm:py-2.5 rounded-xl border text-xs font-semibold cursor-grab active:cursor-grabbing select-none transition-all touch-none ${
        player.isLocked
          ? "border-orange-500/60 bg-orange-500/10 text-orange-400 shadow-md shadow-orange-500/5 ring-1 ring-orange-500/20"
          : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
      } ${isDragging ? "opacity-20 border-dashed border-blue-500/30 text-transparent bg-transparent" : ""}`}
    >
      <span className="truncate pr-2">{player.name}</span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock(player.id);
        }}
        className={`p-1 sm:p-1.5 rounded-lg border transition-all cursor-pointer ${
          player.isLocked
            ? "border-orange-500/40 bg-orange-500/25 text-orange-400 hover:bg-orange-500/35"
            : "border-slate-800 bg-slate-950/70 text-slate-500 hover:text-slate-300 hover:border-slate-700"
        }`}
      >
        {player.isLocked ? (
          <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        ) : (
          <Unlock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        )}
      </button>
    </div>
  );
};

export const TeamBuilder: React.FC<GameProps> = ({
  participants,
  isStarted,
  onReset,
}) => {
  const [players, setPlayers] = useState<Player[]>(() =>
    participants.map((name, index) => ({
      id: `player-${name}-${index}`,
      name,
      teamId: null,
      isLocked: false,
    })),
  );
  const [teamCount, setTeamCount] = useState<number>(2);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prevParticipants, setPrevParticipants] =
    useState<string[]>(participants);

  // Configure touch and mouse sensors for mobile-friendly drag and drop
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 6,
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Sync state during render when participants updates
  if (participants !== prevParticipants) {
    setPrevParticipants(participants);
    setPlayers(
      participants.map((name, index) => ({
        id: `player-${name}-${index}`,
        name,
        teamId: null,
        isLocked: false,
      })),
    );
  }

  // Handle Drag Start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle Drag End event mapping player to target container
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const playerId = active.id as string;
    const targetAreaId = over.id as string;

    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === playerId) {
          return {
            ...p,
            teamId: targetAreaId === "unassigned" ? null : targetAreaId,
          };
        }
        return p;
      }),
    );
  };

  // Toggle lock status for a player
  const handleToggleLock = (id: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isLocked: !p.isLocked } : p)),
    );
  };

  // Reset entire board assignments
  const handleReset = () => {
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, teamId: null, isLocked: false })),
    );
    onReset();
  };

  // Fisher-Yates shuffle algorithm helper
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Balance & Randomly Assign unassigned players
  const handleRandomAssign = () => {
    const unassignedUnlocked = players.filter(
      (p) => p.teamId === null && !p.isLocked,
    );
    if (unassignedUnlocked.length === 0) return;

    const shuffled = shuffleArray(unassignedUnlocked);
    const teamIds = Array.from(
      { length: teamCount },
      (_, i) => `team-${i + 1}`,
    );
    const updatedPlayers = [...players];

    shuffled.forEach((player) => {
      const teamCounts = teamIds.map((tid) => {
        const count = updatedPlayers.filter((p) => p.teamId === tid).length;
        return { teamId: tid, count };
      });

      teamCounts.sort((a, b) => a.count - b.count);
      const targetTeamId = teamCounts[0].teamId;

      const pIndex = updatedPlayers.findIndex((p) => p.id === player.id);
      if (pIndex !== -1) {
        updatedPlayers[pIndex] = {
          ...updatedPlayers[pIndex],
          teamId: targetTeamId,
        };
      }
    });

    setPlayers(updatedPlayers);
  };

  // Re-shuffle all unlocked players, keeping only locked ones in place
  const handleReShuffle = () => {
    const unlocked = players.filter((p) => !p.isLocked);
    if (unlocked.length === 0) return;

    // Reset all unlocked players to unassigned first
    const updatedPlayers = players.map((p) => {
      if (!p.isLocked) {
        return { ...p, teamId: null };
      }
      return p;
    });

    const shuffled = shuffleArray(unlocked);
    const teamIds = Array.from(
      { length: teamCount },
      (_, i) => `team-${i + 1}`,
    );

    shuffled.forEach((player) => {
      const teamCounts = teamIds.map((tid) => {
        const count = updatedPlayers.filter((p) => p.teamId === tid).length;
        return { teamId: tid, count };
      });

      teamCounts.sort((a, b) => a.count - b.count);
      const targetTeamId = teamCounts[0].teamId;

      const pIndex = updatedPlayers.findIndex((p) => p.id === player.id);
      if (pIndex !== -1) {
        updatedPlayers[pIndex] = {
          ...updatedPlayers[pIndex],
          teamId: targetTeamId,
        };
      }
    });

    setPlayers(updatedPlayers);
  };

  const teams = Array.from({ length: teamCount }, (_, i) => {
    const id = `team-${i + 1}`;
    return {
      id,
      name: `${i + 1}팀`,
      color: getTeamColor(i),
    };
  });

  const unassignedPlayers = players.filter((p) => p.teamId === null);
  const activeDraggedPlayer = players.find((p) => p.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 backdrop-blur-md overflow-hidden relative min-h-[500px]">
        {/* Header HUD */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                팀 빌더{" "}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Team Maker
                </span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400">
                참여자들을 균등하고 고르게 팀으로 나누어 배치합니다.
              </p>
            </div>
          </div>

          {isStarted && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 hover:text-red-400 text-slate-300 transition-all border border-slate-700 active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              비우기/돌아가기
            </button>
          )}
        </div>

        {/* Dashboard Actions */}
        {isStarted && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 relative z-10">
            {/* Team count adjustments */}
            <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-2.5 flex items-center justify-between gap-3 h-full">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-[9px] uppercase font-bold tracking-wider text-slate-500">
                    배정할 팀 개수
                  </p>
                  <p className="text-xs font-semibold text-slate-200">
                    {teamCount}개 팀
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTeamCount((prev) => Math.max(2, prev - 1))}
                  className="p-1 rounded-md border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 cursor-pointer disabled:opacity-40"
                  disabled={teamCount <= 2}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-5 text-center text-xs font-bold text-white">
                  {teamCount}
                </span>
                <button
                  onClick={() => setTeamCount((prev) => Math.min(8, prev + 1))}
                  className="p-1 rounded-md border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 cursor-pointer disabled:opacity-40"
                  disabled={teamCount >= 8}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Re-shuffle all unlocked players */}
            <button
              onClick={handleReShuffle}
              className="w-full py-2.5 sm:py-0 rounded-xl font-bold text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              🔄 고정 제외 다시 섞기
            </button>

            {/* Random assign unassigned players */}
            <button
              onClick={handleRandomAssign}
              disabled={unassignedPlayers.length === 0}
              className="w-full py-2.5 sm:py-0 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 border border-blue-500/20 active:scale-98 cursor-pointer transition-all disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:border-transparent disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              🎲 남은 인원 배치
            </button>
          </div>
        )}

        {/* Board Main Area */}
        <div className="flex-1 relative z-10 flex flex-col lg:flex-row gap-5 overflow-hidden h-full">
          {isStarted ? (
            <>
              {/* Unassigned List Container (Droppable) */}
              <div className="w-full lg:w-1/3 flex flex-col bg-slate-950 border border-slate-800 rounded-xl p-3 sm:p-4 overflow-hidden h-full max-h-[200px] lg:max-h-none">
                <div className="flex items-center justify-between mb-2 border-b border-slate-850 pb-1.5 flex-shrink-0">
                  <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    대기 명단{" "}
                    <span className="text-[10px] bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded-md font-mono">
                      {unassignedPlayers.length}
                    </span>
                  </h3>
                </div>

                <DroppableArea
                  id="unassigned"
                  className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 p-1 min-h-[60px]"
                >
                  {unassignedPlayers.map((player) => (
                    <DraggablePlayer
                      key={player.id}
                      player={player}
                      onToggleLock={handleToggleLock}
                    />
                  ))}
                  {unassignedPlayers.length === 0 && (
                    <div className="col-span-full flex items-center justify-center py-6 text-center text-[10px] text-slate-700 font-medium">
                      대기 중인 사람이 없습니다.
                    </div>
                  )}
                </DroppableArea>
              </div>

              {/* Assigned Teams Grid (Droppable) */}
              <div className="flex-1 bg-slate-950/20 border border-slate-850/50 rounded-xl p-3 sm:p-4 flex flex-col h-full overflow-hidden">
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-4 h-full items-stretch overflow-y-auto p-0.5">
                  {teams.map((team) => {
                    const teamMembers = players.filter(
                      (p) => p.teamId === team.id,
                    );
                    return (
                      <DroppableArea
                        key={team.id}
                        id={team.id}
                        className={`border rounded-xl p-3 flex flex-col gap-2 shadow-sm relative ring-1 h-full min-h-[140px] ${team.color}`}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1 flex-shrink-0">
                          <span className="text-xs font-bold text-white tracking-wide">
                            {team.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-current">
                            {teamMembers.length}명
                          </span>
                        </div>

                        <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto p-0.5 min-h-[80px]">
                          {teamMembers.map((player) => (
                            <DraggablePlayer
                              key={player.id}
                              player={player}
                              onToggleLock={handleToggleLock}
                            />
                          ))}
                          {teamMembers.length === 0 && (
                            <div className="flex-1 flex items-center justify-center py-6 text-center text-[10px] text-slate-700 italic">
                              이곳으로 끌어서 배치
                            </div>
                          )}
                        </div>
                      </DroppableArea>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Standby view */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 text-center z-20">
              <Layers className="w-12 h-12 text-blue-500/60 mb-3 animate-bounce" />
              <h3 className="text-lg font-bold text-white mb-1">
                팀 빌더 준비 완료
              </h3>
              <p className="text-sm text-slate-400 max-w-sm">
                왼쪽 참여자 명단에 이름을 입력한 뒤 아래{" "}
                <strong className="text-blue-400">🚀 추첨 시작</strong> 버튼을
                누르세요!
              </p>
              <div className="mt-4 text-[10px] sm:text-xs font-mono text-slate-500 border border-slate-800 bg-slate-900/40 py-1.5 px-3 rounded-md">
                드래그 앤 드롭으로 수동 배치하거나 자물쇠를 활용해 명단을 고정할
                수 있습니다.
              </div>
            </div>
          )}
        </div>

        {/* Drag Overlay for rendering active dragging chip on top of overflow boundaries */}
        {typeof document !== "undefined"
          ? createPortal(
              <DragOverlay>
                {activeId && activeDraggedPlayer ? (
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold pointer-events-none opacity-90 scale-105 shadow-2xl transition-colors duration-200 ${
                      activeDraggedPlayer.isLocked
                        ? "border-orange-500/60 bg-orange-950/90 text-orange-400 shadow-orange-500/10"
                        : "border-blue-500 bg-slate-900/90 text-blue-400 shadow-blue-500/10"
                    }`}
                  >
                    <span className="truncate pr-2">
                      {activeDraggedPlayer.name}
                    </span>
                    <div
                      className={`p-1 rounded-lg border ${
                        activeDraggedPlayer.isLocked
                          ? "border-orange-500/30 bg-orange-500/20 text-orange-400"
                          : "border-slate-800 bg-slate-950 text-slate-500"
                      }`}
                    >
                      {activeDraggedPlayer.isLocked ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )
          : null}
      </div>
    </DndContext>
  );
};
