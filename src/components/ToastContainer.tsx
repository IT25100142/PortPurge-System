import { AlertCircle, CheckCircle2, ShieldAlert, X } from "lucide-react";
import type { Toast } from "../types";

const MAX_VISIBLE_TOASTS = 3;

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xl backdrop-blur-xl pointer-events-auto animate-slide-in transition duration-300 ${
            toast.type === "success"
              ? "bg-[#0b1c14]/90 border-green-800/50 text-green-300"
              : toast.type === "error"
              ? "bg-[#250d0d]/90 border-red-800/50 text-red-300"
              : "bg-[#1f150b]/90 border-[#855223]/50 text-amber-300"
          }`}
        >
          {toast.permissionDenied ? (
            <img
              src="/illustrations/permission-denied.webp"
              alt=""
              width={20}
              height={20}
              className="illustration-blend w-5 h-5 shrink-0 object-contain"
            />
          ) : toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />
          ) : toast.type === "error" ? (
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-500" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
          )}

          <div className="flex-1 text-xs font-semibold leading-relaxed">
            {toast.message}
          </div>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="p-0.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
