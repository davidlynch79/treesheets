import { useEffect, useRef, useState } from 'react';
import { GripVertical, Minus, Plus } from 'lucide-react';
import { useStore } from '../StoreContext';

const SWATCHES: { hex: string; className: string }[] = [
  { hex: '#1e1e24', className: 'bg-[#1e1e24] border border-dark-border' },
  { hex: '#7f1d1d', className: 'bg-red-900' },
  { hex: '#78350f', className: 'bg-amber-900' },
  { hex: '#14532d', className: 'bg-emerald-900' },
  { hex: '#1e3a8a', className: 'bg-blue-900' },
  { hex: '#581c87', className: 'bg-purple-900' },
];

function modeButtonClass(active: boolean, kind: 'move' | 'x' | 'c'): string {
  const base = 'px-1 py-0.5 rounded border text-[10px] text-center transition';
  if (!active) return `${base} bg-dark-surfaceHover border-dark-border text-dark-muted hover:text-dark-text`;
  if (kind === 'x') return `${base} bg-red-600 text-white border-red-500 font-bold`;
  if (kind === 'c') return `${base} bg-emerald-600 text-white border-emerald-500 font-bold`;
  return `${base} bg-blue-600 text-white border-blue-500 font-bold`;
}

export function Toolbar() {
  const store = useStore();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const importSettingsRef = useRef<HTMLInputElement>(null);
  const [exportSettingsToo, setExportSettingsToo] = useState(true);

  const dragState = useRef({ dragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    function onMouseMove(e: MouseEvent) {
      if (!dragState.current.dragging || !toolbar) return;
      toolbar.style.left = `${Math.max(0, Math.min(window.innerWidth - 100, dragState.current.initialLeft + (e.clientX - dragState.current.startX)))}px`;
      toolbar.style.top = `${Math.max(0, Math.min(window.innerHeight - 100, dragState.current.initialTop + (e.clientY - dragState.current.startY)))}px`;
    }
    function onMouseUp() {
      dragState.current.dragging = false;
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Keep the toolbar docked next to the help panel unless the user has dragged it elsewhere.
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    if (toolbar.style.left && toolbar.style.left !== 'auto') return; // user has manually positioned it
    toolbar.style.right = `${store.helpPanelOpen ? store.helpWidth : 0}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.helpWidth, store.helpPanelOpen]);

  function resetToolbarPosition() {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    toolbar.style.left = 'auto';
    toolbar.style.right = `${store.helpPanelOpen ? store.helpWidth : 0}px`;
    toolbar.style.top = '0px';
    toolbar.style.bottom = 'auto';
  }

  const nestLabel = store.hasSubgridOnActive() ? 'Unnest Sub-grid' : 'Toggle Nest';

  return (
    <div
      ref={toolbarRef}
      id="floating-toolbar"
      className="absolute top-0 bg-dark-surface/95 backdrop-blur border border-dark-border rounded-lg shadow-2xl z-40 flex flex-col overflow-hidden select-none transition-all duration-75"
      style={{ width: `${store.menuWidth}px`, right: `${store.helpPanelOpen ? store.helpWidth : 0}px`, top: 0 }}
    >
      <div
        className="bg-dark-surfaceHover px-2 py-1 border-b border-dark-border flex items-center justify-between cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).tagName === 'BUTTON') return;
          const toolbar = toolbarRef.current;
          if (!toolbar) return;
          const rect = toolbar.getBoundingClientRect();
          dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, initialLeft: rect.left, initialTop: rect.top };
          toolbar.style.left = `${rect.left}px`;
          toolbar.style.top = `${rect.top}px`;
          toolbar.style.bottom = 'auto';
          toolbar.style.right = 'auto';
          e.preventDefault();
        }}
      >
        <div className="flex items-center space-x-1.5 text-xs font-bold text-dark-text pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-dark-muted" />
          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px]">TreeSheets</span>
        </div>
        <button onClick={resetToolbarPosition} className="text-[10px] text-dark-muted hover:text-dark-text px-1 py-0.5 rounded hover:bg-dark-border">
          Reset
        </button>
      </div>

      <div className="p-1 flex flex-col space-y-1 overflow-y-auto max-h-[calc(100vh-100px)] text-xs">
        <div className="space-y-0.5">
          <div className="text-[9px] font-bold text-dark-muted uppercase px-0.5">Project</div>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => store.newBlankSheet()} className="px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-text">
              New
            </button>
            <button onClick={() => store.exportJSON(exportSettingsToo)} className="px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-text">
              Export
            </button>
          </div>
          <label className="flex items-center space-x-1.5 px-1.5 py-0.5 bg-dark-surfaceHover rounded border border-dark-border cursor-pointer text-[10px] text-dark-text mt-0.5">
            <input type="checkbox" checked={exportSettingsToo} onChange={(e) => setExportSettingsToo(e.target.checked)} className="accent-blue-500" />
            <span>Export Settings File Too</span>
          </label>
          <div className="grid grid-cols-2 gap-1 mt-0.5">
            <label className="flex items-center justify-center space-x-1 w-full px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border cursor-pointer text-dark-text">
              <span>Import JSON</span>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && store.importJSON(e.target.files[0])}
              />
            </label>
            <label className="flex items-center justify-center space-x-1 w-full px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border cursor-pointer text-dark-text">
              <span>Import Settings</span>
              <input
                ref={importSettingsRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && store.importSettingsJSON(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[9px] font-bold text-dark-muted uppercase px-0.5">History</div>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => store.undo()} className="px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-text">
              Undo
            </button>
            <button onClick={() => store.redo()} className="px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-text">
              Redo
            </button>
          </div>
        </div>

        <div className="space-y-0.5 border-t border-dark-border pt-1">
          <div className="text-[9px] font-bold text-dark-muted uppercase px-0.5">Drag Action Mode</div>
          <div className="grid grid-cols-3 gap-1">
            <button onClick={() => store.setDragMode('')} className={modeButtonClass(store.activeDragModifier === '', 'move')}>
              Move
            </button>
            <button onClick={() => store.setDragMode('x')} className={modeButtonClass(store.activeDragModifier === 'x', 'x')}>
              Cut (X)
            </button>
            <button onClick={() => store.setDragMode('c')} className={modeButtonClass(store.activeDragModifier === 'c', 'c')}>
              Copy (C)
            </button>
          </div>
        </div>

        <div className="space-y-0.5 border-t border-dark-border pt-1">
          <div className="text-[9px] font-bold text-dark-muted uppercase px-0.5">Structure</div>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => store.menuAddRow()} className="px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-muted hover:text-dark-text">
              Add Row
            </button>
            <button onClick={() => store.menuAddCol()} className="px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-muted hover:text-dark-text">
              Add Col
            </button>
            <button onClick={() => store.menuDelRow()} className="px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-red-900/40 rounded border border-dark-border text-dark-muted hover:text-red-400">
              Del Row
            </button>
            <button onClick={() => store.menuDelCol()} className="px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-red-900/40 rounded border border-dark-border text-dark-muted hover:text-red-400">
              Del Col
            </button>
          </div>
          <button onClick={() => store.menuTransposeGrid()} className="w-full px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-muted hover:text-cyan-400">
            Transpose (T)
          </button>
          <button onClick={() => store.menuAddParentSingle()} className="w-full px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-muted hover:text-emerald-400">
            Add Parent (P)
          </button>
          <button onClick={() => store.menuToggleNest()} className="w-full px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-muted hover:text-blue-400">
            {nestLabel}
          </button>
          <button onClick={() => store.menuClearCell()} className="w-full px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-amber-900/40 rounded border border-dark-border text-dark-muted hover:text-amber-400">
            Clear/Delete
          </button>
          <button onClick={() => store.menuPruneCellGrid()} className="w-full px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-muted hover:text-dark-text">
            Prune Empty (Cell)
          </button>
          <button onClick={() => store.menuPruneEntireTree()} className="w-full px-1.5 py-0.5 bg-dark-surfaceHover hover:bg-dark-border rounded border border-dark-border text-dark-muted hover:text-dark-text">
            Prune Empty (Tree)
          </button>
        </div>

        <div className="space-y-1 border-t border-dark-border pt-1">
          <div className="text-[9px] font-bold text-dark-muted uppercase px-0.5">Sizes & Zoom</div>
          <div className="flex items-center justify-between bg-dark-surfaceHover p-1 rounded border border-dark-border">
            <span className="text-[10px] text-dark-muted">Font Size</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => store.updateFontSize(store.fontSize - 1)}
                disabled={store.fontSize <= 8}
                title="Decrease font size"
                aria-label="Decrease font size"
                className="p-1 bg-dark-border hover:bg-dark-surface rounded text-dark-text disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-8 text-center text-[10px] font-bold text-dark-text">{store.fontSize}px</span>
              <button
                onClick={() => store.updateFontSize(store.fontSize + 1)}
                disabled={store.fontSize >= 32}
                title="Increase font size"
                aria-label="Increase font size"
                className="p-1 bg-dark-border hover:bg-dark-surface rounded text-dark-text disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex flex-col space-y-0.5 bg-dark-surfaceHover p-1 rounded border border-dark-border">
            <div className="flex justify-between text-[10px] text-dark-muted">
              <span>Tree Scale</span>
              <span className="font-bold text-dark-text">{store.treeScale}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={store.treeScale}
              onChange={(e) => store.updateTreeScale(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 h-1 bg-dark-border rounded cursor-pointer"
            />
          </div>
          <div className="flex flex-col space-y-0.5 bg-dark-surfaceHover p-1 rounded border border-dark-border">
            <div className="flex justify-between text-[10px] text-dark-muted">
              <span>Menu Width</span>
              <span className="font-bold text-dark-text">{store.menuWidth}px</span>
            </div>
            <input
              type="range"
              min={180}
              max={400}
              step={10}
              value={store.menuWidth}
              onChange={(e) => store.updateMenuWidth(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 h-1 bg-dark-border rounded cursor-pointer"
            />
          </div>
          <div className="flex flex-col space-y-0.5 bg-dark-surfaceHover p-1 rounded border border-dark-border">
            <div className="flex justify-between text-[10px] text-dark-muted">
              <span>Help Panel Width</span>
              <span className="font-bold text-dark-text">{store.helpWidth}px</span>
            </div>
            <input
              type="range"
              min={200}
              max={500}
              step={10}
              value={store.helpWidth}
              onChange={(e) => store.updateHelpWidth(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 h-1 bg-dark-border rounded cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-1 border-t border-dark-border pt-1">
          <div className="text-[9px] font-bold text-dark-muted uppercase px-0.5">Appearance & Workflow</div>
          <div className="flex flex-col space-y-0.5 bg-dark-surfaceHover p-1 rounded border border-dark-border">
            <div className="flex justify-between text-[10px] text-dark-muted">
              <span>Padding</span>
              <span className="font-bold text-dark-text">{store.globalPadding}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={store.globalPadding}
              onChange={(e) => store.updatePadding(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 h-1 bg-dark-border rounded cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between bg-dark-bg border border-dark-border rounded p-1">
            <span className="text-[10px] text-dark-muted">Color:</span>
            <div className="flex items-center space-x-1">
              {SWATCHES.map((s) => (
                <button key={s.hex} onClick={() => store.applyColor(s.hex)} className={`w-3 h-3 rounded-full ${s.className}`} />
              ))}
            </div>
          </div>
          <div className="space-y-0.5 bg-dark-surfaceHover p-1 rounded border border-dark-border text-[10px]">
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.enterNextCell} onChange={(e) => store.toggleEnterNext(e.target.checked)} className="accent-blue-500" />
              <span>Enter Jumps to Next Cell</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.enterAddCellAtEnd} onChange={(e) => store.toggleEnterAddCell(e.target.checked)} className="accent-blue-500" />
              <span>Enter at End Adds New Cell</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.enterAddSibling} onChange={(e) => store.toggleEnterAddSibling(e.target.checked)} className="accent-blue-500" />
              <span>Enter Adds New Sibling</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.navigateFutureEdgeCells} onChange={(e) => store.toggleNavigateFutureEdgeCells(e.target.checked)} className="accent-blue-500" />
              <span>Navigate Future Edge Cells</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.lightMode} onChange={() => store.toggleTheme()} className="accent-blue-500" />
              <span>Light Mode</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.showGridLines} onChange={() => store.toggleGridLines()} className="accent-blue-500" />
              <span>Grid Lines</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={store.activeCellColorsDisabled}
                onChange={(e) => store.setDisableColorsOnActive(e.target.checked)}
                className="accent-blue-500"
              />
              <span>No Colors</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.shrinkToText} onChange={() => store.toggleShrinkToText()} className="accent-blue-500" />
              <span>Shrink to Text</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.compactGaps} onChange={() => store.toggleCompactGaps()} className="accent-blue-500" />
              <span>Condensed Gaps</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input type="checkbox" checked={store.helpPanelOpen} onChange={() => store.toggleHelpPanel()} className="accent-blue-500" />
              <span>Help Panel</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
