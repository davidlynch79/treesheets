import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../StoreContext';
import { CellData, DropMode, GridData } from '../types';
import { TreeSheetStore } from '../store';

interface GridNodeProps {
  gridData: GridData;
  prefix: string;
  inheritedDisableColors: boolean;
  isRoot?: boolean;
}

function getGapHighlightShadow(store: TreeSheetStore, prefix: string, r: number, c: number): string {
  if (!store.compactGaps || !store.activeGapPath) return '';
  const shadows: string[] = [];
  const rGap = store.activeGapPath.match(/^(.*)_gap(\d+)$/);
  if (rGap && rGap[1] === prefix) {
    const g = parseInt(rGap[2], 10);
    if (g === r) shadows.push('inset 0 3px 0 0 #3b82f6');
    if (g === r + 1) shadows.push('inset 0 -3px 0 0 #3b82f6');
  }
  const cGap = store.activeGapPath.match(/^(.*)_r(\d+)_colgap(\d+)$/);
  if (cGap && cGap[1] === prefix && parseInt(cGap[2], 10) === r) {
    const g = parseInt(cGap[3], 10);
    if (g === c) shadows.push('inset 3px 0 0 0 #3b82f6');
    if (g === c + 1) shadows.push('inset -3px 0 0 0 #3b82f6');
  }
  return shadows.join(', ');
}

function GapBar({ prefix, index }: { prefix: string; index: number }) {
  const store = useStore();
  const gapPath = `${prefix}_gap${index}`;
  const isActive = store.activeGapPath === gapPath;
  return (
    <div
      tabIndex={0}
      data-gap-path={gapPath}
      className={`h-1.5 my-0.5 rounded-full cursor-pointer transition focus:outline-none ${
        isActive ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-500/50'
      }`}
      onMouseDown={(e) => {
        e.stopPropagation();
        store.setActiveGapPath(gapPath);
        (e.currentTarget as HTMLElement).focus();
      }}
      onFocus={() => {
        if (store.activeGapPath !== gapPath) store.setActiveGapPath(gapPath);
      }}
    />
  );
}

export function GridNode({ gridData, prefix, inheritedDisableColors, isRoot = false }: GridNodeProps) {
  const store = useStore();
  const cols = gridData.rows[0] ? gridData.rows[0].cells.length : 1;
  const gapV = Math.max(0, Math.round(store.globalPadding * 0.75));
  const gapH = Math.max(0, Math.round(store.globalPadding * 1.0));

  return (
    <div
      className={isRoot ? 'grid' : 'grid bg-dark-surface/90 rounded border border-dark-border/60 shadow-inner'}
      style={{
        gridTemplateColumns: `repeat(${cols}, ${store.shrinkToText ? 'max-content' : 'minmax(140px, max-content)'})`,
        gap: `${gapV}px ${gapH}px`,
        padding: isRoot ? undefined : `${Math.max(0, Math.min(6, store.globalPadding))}px`,
      }}
    >
      {!store.compactGaps && <GapBar prefix={prefix} index={0} />}
      {gridData.rows.map((row, rIdx) => (
        <React.Fragment key={rIdx}>
          {row.cells.map((cell, cIdx) => (
            <Cell
              key={cIdx}
              cell={cell}
              cellPath={`${prefix}_r${rIdx}c${cIdx}`}
              prefix={prefix}
              inheritedDisableColors={inheritedDisableColors}
            />
          ))}
          {!store.compactGaps && <GapBar prefix={prefix} index={rIdx + 1} />}
        </React.Fragment>
      ))}
    </div>
  );
}

interface CellProps {
  cell: CellData;
  cellPath: string;
  prefix: string;
  inheritedDisableColors: boolean;
}

function Cell({ cell, cellPath, prefix, inheritedDisableColors }: CellProps) {
  const store = useStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dropMode, setDropMode] = useState<DropMode | null>(null);
  const [dragHighlight, setDragHighlight] = useState(false);

  const isActive = store.activePath === cellPath;
  const isSelected = store.selectedPaths.has(cellPath);
  const isEditingThisCell = isActive && store.isEditing;

  const m = cellPath.match(/_r(\d+)c(\d+)$/);
  const rIdx = m ? parseInt(m[1], 10) : 0;
  const cIdx = m ? parseInt(m[2], 10) : 0;

  const vPad = Math.max(0, Math.round(store.globalPadding * 0.75));
  const hPad = Math.max(0, Math.round(store.globalPadding * 1.0));
  const shadow = getGapHighlightShadow(store, prefix, rIdx, cIdx);

  // Focus the textarea and place the cursor at the end when entering edit mode
  // (mirrors the original's setTimeout(() => ta.focus(), 10)).
  useEffect(() => {
    if (isEditingThisCell && textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = `${Math.max(38, ((cell.text || '').match(/\n/g) || []).length * 20 + 10)}px`;
      const id = setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }, 10);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingThisCell]);

  // Refocus the cell wrapper after leaving edit mode while it's still the active cell
  // (mirrors setTimeout(() => wrapper.focus(), 10) after Escape / non-"next cell" Enter).
  useEffect(() => {
    if (isActive && !store.isEditing && wrapperRef.current) {
      const id = setTimeout(() => wrapperRef.current?.focus(), 10);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, store.isEditing]);

  const wrapperClasses = [
    'relative flex flex-col bg-dark-bg transition group box-border focus:outline-none',
    store.showGridLines ? 'border border-dark-border rounded' : 'border-0',
    isActive ? 'cell-focus' : isSelected ? 'cell-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties = {
    padding: `${vPad}px ${hPad}px`,
  };
  if (!store.shrinkToText) style.minHeight = `${Math.max(28, store.globalPadding * 6 + 12)}px`;
  if (cell.color && !(inheritedDisableColors || cell.disableColors)) style.backgroundColor = cell.color;
  if (shadow) style.boxShadow = shadow;

  const highlightClass =
    dragHighlight && dropMode === 'child'
      ? store.activeDragModifier === 'x'
        ? 'bg-red-950/40 border-red-500'
        : store.activeDragModifier === 'c'
        ? 'bg-emerald-950/40 border-emerald-500'
        : 'bg-blue-950/40 border-blue-400'
      : '';

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      draggable
      className={`${wrapperClasses} ${highlightClass}`.trim()}
      style={style}
      onMouseDown={(e) => {
        e.stopPropagation();
        store.selectCell(cellPath, e.shiftKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        store.startEdit(cellPath);
      }}
      onDragStart={(e) => {
        e.stopPropagation();
        if (!store.selectedPaths.has(cellPath)) {
          store.selectedPaths = new Set([cellPath]);
          store.activePath = cellPath;
        }
        e.dataTransfer.setData(
          'text/plain',
          JSON.stringify({ paths: Array.from(store.selectedPaths), modifier: store.activeDragModifier })
        );
        e.dataTransfer.effectAllowed = store.activeDragModifier === 'c' ? 'copy' : 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = store.activeDragModifier === 'c' ? 'copy' : 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let mode: DropMode = 'child';
        if (y < 10) mode = 'row-before';
        else if (y > rect.height - 10) mode = 'row-after';
        else if (x < 10) mode = 'col-before';
        else if (x > rect.width - 10) mode = 'col-after';
        setDropMode(mode);
        setDragHighlight(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropMode(null);
        setDragHighlight(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragHighlight(false);
        const raw = e.dataTransfer.getData('text/plain');
        setDropMode(null);
        if (!raw) return;
        try {
          const payload = JSON.parse(raw);
          const draggedPaths: string[] = payload.paths || payload;
          store.handleDrop(cellPath, draggedPaths, payload.modifier || '', (dropMode as DropMode) || 'child');
        } catch (err) {
          console.error(err);
        }
      }}
    >
      {dropMode === 'row-before' && dragHighlight && <div className="drop-indicator-top" />}
      {dropMode === 'row-after' && dragHighlight && <div className="drop-indicator-bottom" />}
      {dropMode === 'col-before' && dragHighlight && <div className="drop-indicator-left" />}
      {dropMode === 'col-after' && dragHighlight && <div className="drop-indicator-right" />}

      <div className="flex flex-col w-full relative">
        {isEditingThisCell ? (
          <textarea
            ref={textareaRef}
            id="active-textarea"
            defaultValue={cell.text || ''}
            className="bg-dark-surface text-dark-text text-xs p-1.5 rounded border border-emerald-500 outline-none resize-y min-h-[36px] w-full font-sans leading-relaxed"
            onChange={(e) => store.updateEditingTextSilent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Delete' || e.key === 'Backspace') {
                e.stopPropagation();
                return;
              }
              store.handleEditorKeyDown(e, e.shiftKey, e.ctrlKey || e.metaKey);
            }}
            onBlur={(e) => {
              const value = e.target.value;
              setTimeout(() => {
                if (document.activeElement !== textareaRef.current) {
                  store.commitAndStopEditing(cellPath, value);
                }
              }, 150);
            }}
          />
        ) : (
          <div className="text-xs text-dark-text whitespace-pre-wrap break-words px-0.5 leading-relaxed cursor-default">
            {cell.text || ''}
          </div>
        )}
      </div>

      {cell.disableColors && (
        <div className="absolute top-1 right-3 w-1.5 h-1.5 bg-yellow-400 rounded-full" title="Colors disabled" />
      )}

      {cell.subgrid &&
        (cell.childrenHidden ? (
          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full" title="Children hidden ('H')" />
        ) : (
          <div className="mt-0.5 pt-0">
            <GridNode gridData={cell.subgrid} prefix={cellPath} inheritedDisableColors={inheritedDisableColors || cell.disableColors} />
          </div>
        ))}
    </div>
  );
}
