import { Command, X } from 'lucide-react';
import { useStore } from '../StoreContext';

export function HelpPanel() {
  const store = useStore();
  if (!store.helpPanelOpen) return null;

  return (
    <aside
      id="help-panel"
      className="bg-dark-surface border-l border-dark-border flex flex-col shrink-0 shadow-lg z-30 transition-all duration-75"
      style={{ width: `${store.helpWidth}px` }}
    >
      <div className="p-2 border-b border-dark-border flex items-center justify-between bg-dark-surfaceHover">
        <div className="flex items-center space-x-2 text-xs font-bold text-dark-text">
          <Command className="w-4 h-4 text-blue-400" />
          <span>Commands Help</span>
        </div>
        <button
          onClick={() => store.toggleHelpPanel()}
          className="p-1 hover:bg-dark-border rounded text-dark-muted hover:text-dark-text transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 text-xs text-dark-muted">
        <div>
          <h3 className="font-bold text-dark-text mb-0.5">Navigation & Edit</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong className="text-dark-text">Arrow Keys:</strong> Move focus
            </li>
            <li>
              <strong className="text-dark-text">Enter / Shift+Enter:</strong> Next / Prev cell (when active)
            </li>
            <li>
              <strong className="text-dark-text">Shift + Click/Drag:</strong> Multi-select
            </li>
            <li>
              <strong className="text-dark-text">Double-Click:</strong> Edit text
            </li>
            <li>
              <strong className="text-dark-text">Esc:</strong> Leave the cell (exit edit mode)
            </li>
          </ul>
        </div>
        <div className="border-t border-dark-border pt-2">
          <h3 className="font-bold text-dark-text mb-0.5">Hierarchy & Structure</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong className="text-dark-text">'H':</strong> Toggle hide children
            </li>
            <li>
              <strong className="text-dark-text">'I':</strong> Toggle sub-grid
            </li>
            <li>
              <strong className="text-dark-text">'T':</strong> Transpose grid
            </li>
            <li>
              <strong className="text-dark-text">'P':</strong> Add parent to the active cell
            </li>
            <li>
              <strong className="text-dark-text">Ctrl+P:</strong> Add parent to the table
            </li>
          </ul>
        </div>
        <div className="border-t border-dark-border pt-2">
          <h3 className="font-bold text-dark-text mb-0.5">Clipboard & Drag</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong className="text-dark-text">Drag:</strong> Move cells
            </li>
            <li>
              <strong className="text-dark-text">'X' + Drag / Cut Mode:</strong> Cut & Drop
            </li>
            <li>
              <strong className="text-dark-text">'C' + Drag / Copy Mode:</strong> Copy & Drop
            </li>
            <li>
              <strong className="text-dark-text">Ctrl+C / Ctrl+V:</strong> Copy / Paste
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
