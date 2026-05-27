import type { Toast, ToastType } from "../hooks/useToast";

const colorMap: Record<ToastType, string> = {
  success: "border-green-500 bg-green-900/80 text-green-100",
  error: "border-red-500 bg-red-900/80 text-red-100",
  info: "border-slate-500 bg-slate-800/90 text-slate-100",
};

type Props = {
  toasts: Toast[];
  onRemove: (id: number) => void;
};

export function ToastContainer({ toasts, onRemove }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded border px-4 py-3 text-sm shadow-lg ${colorMap[t.type]}`}
        >
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => onRemove(t.id)}
            className="ml-auto opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
