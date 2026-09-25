import { useStore } from '../StoreContext';

export function Footer() {
  const store = useStore();

  const indicator =
    store.activeDragModifier === 'x'
      ? { text: 'Mode: Cut & Drop', className: 'px-2 py-0.5 bg-red-600/30 text-red-400 rounded text-[10px] font-bold uppercase border border-red-500/50' }
      : store.activeDragModifier === 'c'
      ? { text: 'Mode: Copy & Drop', className: 'px-2 py-0.5 bg-emerald-600/30 text-emerald-400 rounded text-[10px] font-bold uppercase border border-emerald-500/50' }
      : { text: 'Mode: Move', className: 'px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-[10px] font-bold uppercase border border-blue-500/30' };

  return (
    <footer className="bg-dark-surface border-t border-dark-border px-3 py-1 text-[11px] text-dark-muted flex justify-between items-center z-20 shrink-0">
      <div>Arrow keys / Shift+Select | Drag: Move | 'X'+Drag: Cut | 'C'+Drag: Copy</div>
      <div>
        <span className={indicator.className}>{indicator.text}</span>
      </div>
    </footer>
  );
}
