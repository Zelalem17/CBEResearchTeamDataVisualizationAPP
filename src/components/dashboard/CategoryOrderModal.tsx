import { useState } from "react";
import { X, GripVertical, ArrowUpDown, RotateCcw } from "lucide-react";

interface CategoryOrderModalProps {
  /** Every distinct category value currently on the dashboard, already
   * in the order that will apply if nothing is changed (CBE first, by
   * default). */
  categories: string[];
  onSave: (order: string[]) => void;
  onClose: () => void;
}

/** Lets the researcher drag categories into whatever order they want —
 * e.g. "Industry" before "CBE" instead of the app's own CBE-first
 * default — and applies it to every chart on the dashboard at once
 * (every chart builder reads the same saved order). Plain HTML5 drag
 * and drop, no extra dependency. */
export default function CategoryOrderModal({ categories, onSave, onClose }: CategoryOrderModalProps) {
  const [order, setOrder] = useState<string[]>(categories);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <ArrowUpDown size={18} /> Category order
          </h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Drag to set which category comes first — applies to every chart's bars, legend, and list order at once.
        </p>

        <div className="space-y-1.5 mb-4">
          {order.map((cat, i) => (
            <div
              key={cat}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) moveTo(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium cursor-move select-none transition-colors ${
                dragIndex === i
                  ? "opacity-40 border-brand-400 bg-brand-50 dark:bg-brand-900/30"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200"
              }`}
            >
              <GripVertical size={14} className="text-gray-400 shrink-0" />
              <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
              <span className="truncate">{cat}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setOrder(categories)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 dark:hover:text-brand-400"
          >
            <RotateCcw size={12} /> Reset to default
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button
              onClick={() => {
                onSave(order);
                onClose();
              }}
              className="btn-primary text-sm"
            >
              Apply to all charts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
