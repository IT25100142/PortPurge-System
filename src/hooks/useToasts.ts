import { useState, useCallback, useRef, useEffect } from "react";
import type { Toast } from "../types";

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (toastTimeoutRefs.current[id]) {
      clearTimeout(toastTimeoutRefs.current[id]);
      delete toastTimeoutRefs.current[id];
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: Toast["type"], options?: { permissionDenied?: boolean }) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [
        ...prev,
        { id, message, type, permissionDenied: options?.permissionDenied },
      ]);

      const timeout = setTimeout(() => {
        removeToast(id);
      }, 4000);
      toastTimeoutRefs.current[id] = timeout;
    },
    [removeToast],
  );

  useEffect(() => {
    const timeouts = toastTimeoutRefs.current;
    return () => {
      Object.values(timeouts).forEach((timeout) => clearTimeout(timeout));
      toastTimeoutRefs.current = {};
    };
  }, []);

  return { toasts, showToast, removeToast };
}
