import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  Sparkles,
  Play,
  Trash2,
  Image,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import Tesseract from "tesseract.js";

interface ParticipantInputProps {
  onStart: (participants: string[]) => void;
  isGameRunning: boolean;
  onReset: () => void;
  maxParticipants?: number;
}

export const ParticipantInput: React.FC<ParticipantInputProps> = ({
  onStart,
  isGameRunning,
  onReset,
  maxParticipants,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "error",
  ) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const preprocessImage = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          const scale = 3;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const gray =
              0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
          ctx.putImageData(imgData, 0, 0);

          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
          reject(new Error("Failed to load image for preprocessing"));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        reject(new FileReader().error);
      };
      reader.readAsDataURL(file);
    });
  };

  const processImage = async (file: File | Blob) => {
    setIsOcrLoading(true);
    setOcrProgress(0);
    try {
      const preprocessedSrc = await preprocessImage(file);

      const result = await Tesseract.recognize(preprocessedSrc, "kor+eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text = result.data.text;
      const ocrLines = text.split("\n");
      const newNames: string[] = [];
      const ignoreKeywords = [
        "온라인",
        "오프라인",
        "활동 중",
        "게임 중",
        "멤버",
        "봇",
        "bot",
        "오전",
        "오후",
      ];

      for (const line of ocrLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (ignoreKeywords.some((keyword) => trimmed.includes(keyword))) {
          continue;
        }

        const cleaned = trimmed
          .replace(/^[^a-zA-Z0-9가-힣\s]+/, "")
          .replace(/[^a-zA-Z0-9가-힣\s]+$/, "")
          .trim();

        if (cleaned.length >= 1 && cleaned.length <= 15) {
          newNames.push(cleaned);
        }
      }

      if (newNames.length > 0) {
        setInputValue((prevValue) => {
          const currentLines = prevValue
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l !== "");

          const mergedList = [...currentLines, ...newNames];
          const finalVal = mergedList.join("\n");

          if (maxParticipants !== undefined) {
            const finalLines = finalVal
              .split("\n")
              .filter((line) => line.trim() !== "");
            if (finalLines.length > maxParticipants) {
              const slicedLines = finalLines.slice(0, maxParticipants);
              return slicedLines.join("\n");
            }
          }
          return finalVal;
        });
      } else {
        showToast(
          "이미지에서 이름을 찾지 못했습니다. 글자가 선명한지 확인해 주세요.",
          "warning",
        );
      }
    } catch (error) {
      console.error("OCR Error:", error);
      showToast("이미지 분석 중 오류가 발생했습니다.", "error");
    } finally {
      setIsOcrLoading(false);
      setOcrProgress(null);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          processImage(blob);
          break;
        }
      }
    }
  };

  // Parse names from input
  const parsedList = inputValue
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const handleInputChange = (val: string) => {
    // Normalize line endings to \n (handles Windows/Mac carriage returns)
    const normalizedVal = val.replace(/\r/g, "");

    if (maxParticipants === undefined) {
      setInputValue(normalizedVal);
      return;
    }

    const newLines = normalizedVal
      .split("\n")
      .filter((line) => line.trim() !== "");

    if (newLines.length > maxParticipants) {
      const currentNonEmptyCount = inputValue
        .replace(/\r/g, "")
        .split("\n")
        .filter((line) => line.trim() !== "").length;

      if (currentNonEmptyCount < maxParticipants) {
        // Paste action: slice it
        const allLines = normalizedVal.split("\n");
        let count = 0;
        const slicedLines: string[] = [];
        for (const line of allLines) {
          if (line.trim() !== "") {
            count++;
          }
          if (count <= maxParticipants) {
            slicedLines.push(line);
          } else {
            break;
          }
        }
        setInputValue(slicedLines.join("\n"));
      } else {
        // Block typing: do not set state, keeping the old value intact.
      }
      return;
    }

    setInputValue(normalizedVal);
  };

  const handleLoadSamples = () => {
    if (isGameRunning) return;
    const samples = [
      "데드풀 🔴",
      "울버린 🟡",
      "아이언맨 🤖",
      "스파이더맨 🕷️",
      "블랙 위도우 🕷️",
      "헐크 🟢",
      "토르 ⚡",
      "캡틴 아메리카 🛡️",
      "닥터 스트레인지 🌀",
      "블랙 팬서 🐈‍⬛",
      "호크아이 🏹",
      "스칼렛 위치 🔮",
    ];
    handleInputChange(samples.join("\n"));
  };

  const handleClear = () => {
    if (isGameRunning) return;
    setInputValue("");
  };

  const handleStart = () => {
    const cleanList = inputValue
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    if (cleanList.length < 2) return;

    setInputValue(cleanList.join("\n"));
    onStart(cleanList);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 backdrop-blur-md">
      {/* Title */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white">
          <Users className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-400" />
          <h3 className="font-bold tracking-tight text-sm sm:text-base">
            참여자 명단
          </h3>
        </div>
        <span className="text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          {parsedList.length} 명
        </span>
      </div>

      {/* Description / Info */}
      <p className="text-[11px] sm:text-xs text-slate-400 mb-3 sm:mb-4 leading-relaxed">
        한 줄에 한 명씩 이름을 입력해 주세요.(2명 이상)
      </p>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            processImage(file);
          }
          e.target.value = "";
        }}
        accept="image/*"
        className="hidden"
      />

      {/* Action shortcuts */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={handleLoadSamples}
          disabled={isGameRunning || isOcrLoading}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] sm:text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        >
          <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          샘플 불러오기
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isGameRunning || isOcrLoading}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] sm:text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        >
          <Image className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          이미지에서 추출
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isGameRunning || !inputValue || isOcrLoading}
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
          onChange={(e) => handleInputChange(e.target.value)}
          onPaste={handlePaste}
          disabled={isGameRunning || isOcrLoading}
          placeholder={`엔터(줄바꿈)로 참여자 이름을 입력하세요...\n(이미지 복사 후 Ctrl+V 가능)`}
          className="w-full h-full min-h-[160px] sm:min-h-[220px] bg-slate-950/60 text-slate-200 border border-slate-800 rounded-xl p-3 sm:p-4 text-xs sm:text-sm font-sans focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-650 resize-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/20"
        />

        {parsedList.length === 0 && !isOcrLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-700 select-none">
            <span className="text-[11px] sm:text-xs">
              예시: 홍길동\n이순신\n세종대왕
            </span>
          </div>
        )}

        {isOcrLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm rounded-xl z-10 transition-all p-4 text-center select-none">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
            <p className="text-xs sm:text-sm font-semibold text-slate-200">
              이미지에서 이름을 추출하는 중입니다...
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1">
              (약 2~5초 소요 {ocrProgress !== null ? `- ${ocrProgress}%` : ""})
            </p>
          </div>
        )}
      </div>

      {/* Warning Message if less than 2 */}
      {parsedList.length > 0 && parsedList.length < 2 && (
        <div className="mb-3 sm:mb-4 text-center p-2 rounded-lg bg-red-950/20 border border-red-900/30 text-[11px] sm:text-xs text-red-400">
          ⚠️ 추첨을 진행하려면 2명 이상 입력해 주세요!
        </div>
      )}

      {/* Warning Message if more than maxParticipants */}
      {maxParticipants !== undefined && parsedList.length > maxParticipants && (
        <div className="mb-3 sm:mb-4 text-center p-2 rounded-lg bg-red-950/20 border border-red-900/30 text-[11px] sm:text-xs text-red-400">
          ⚠️ 이 게임은 최대 {maxParticipants}명까지 참여할 수 있습니다. (현재{" "}
          {parsedList.length}명)
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-2 mt-auto">
        {!isGameRunning ? (
          <button
            onClick={handleStart}
            disabled={
              parsedList.length < 2 ||
              (maxParticipants !== undefined &&
                parsedList.length > maxParticipants)
            }
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
      {/* Toast Notification */}
      {toast &&
        createPortal(
          <>
            <style>{`
            @keyframes toast-slide-down {
              from {
                transform: translate3d(-50%, -1.5rem, 0) scale(0.95);
                opacity: 0;
              }
              to {
                transform: translate3d(-50%, 0, 0) scale(1);
                opacity: 1;
              }
            }
          `}</style>
            <div
              style={{
                left: "50%",
                animation:
                  "toast-slide-down 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
              className={`fixed top-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 select-none max-w-[90%] w-max
              ${toast.type === "error" ? "bg-red-950/90 border-red-800/40 text-red-200 shadow-red-950/40" : ""}
              ${toast.type === "warning" ? "bg-amber-950/90 border-amber-800/40 text-amber-200 shadow-amber-950/40" : ""}
              ${toast.type === "success" ? "bg-emerald-950/90 border-emerald-800/40 text-emerald-200 shadow-emerald-950/40" : ""}
            `}
            >
              {toast.type === "error" && (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              {toast.type === "warning" && (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-semibold">
                {toast.message}
              </span>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
};
