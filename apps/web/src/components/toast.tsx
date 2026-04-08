"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastOptions {
  duration?: number;
  onUndo?: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  onUndo?: () => void;
  exiting?: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

/* ── Individual toast with pause-on-hover ── */
function ToastCard({
  item,
  index,
  onRemove,
}: {
  item: ToastItem;
  index: number;
  onRemove: (id: number) => void;
}) {
  const remainingRef = useRef(item.duration);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exiting, setExiting] = useState(false);

  const scheduleRemove = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(item.id), 250);
    }, remainingRef.current);
  }, [item.id, onRemove]);

  useEffect(() => {
    scheduleRemove();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleRemove]);

  function handleMouseEnter() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    remainingRef.current -= Date.now() - startRef.current;
    if (remainingRef.current < 500) remainingRef.current = 500;
  }

  function handleMouseLeave() {
    scheduleRemove();
  }

  function handleDismiss() {
    setExiting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => onRemove(item.id), 250);
  }

  const typeClasses =
    item.type === "success"
      ? "bg-success/20 text-success border border-success/30"
      : item.type === "error"
      ? "bg-danger/20 text-danger border border-danger/30"
      : "bg-accent/20 text-accent border border-accent/30";

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative pr-8 px-4 py-3 rounded-xl text-sm font-medium shadow-lg backdrop-blur-xl ${typeClasses}`}
      style={{
        animation: exiting
          ? "toast-exit 0.25s ease-in forwards"
          : `toast-enter 0.25s ease-out ${index * 0.05}s both`,
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-md opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <span>{item.message}</span>

      {item.onUndo && (
        <button
          onClick={() => {
            item.onUndo?.();
            handleDismiss();
          }}
          className="ml-3 underline underline-offset-2 font-semibold opacity-80 hover:opacity-100"
        >
          Undo
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", options?: ToastOptions) => {
      const id = nextId++;
      const duration = options?.duration ?? 4000;
      setToasts((prev) => [
        ...prev,
        { id, message, type, duration, onUndo: options?.onUndo },
      ]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t, i) => (
          <ToastCard key={t.id} item={t} index={i} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
