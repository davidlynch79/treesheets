import { CellData, ClipboardEntry, DragModifier, DropMode, GridData, SettingsExport } from './types';
import {
  applyColorByPath,
  calculateRangeSelection,
  findGridAndOwner,
  findGridContainingPath,
  getAllCellPaths,
  getCellByPath,
  newEmptyCell,
  newEmptyGrid,
  pruneEmptyRowsCols,
  updateCellByPath,
} from './treeUtils';

function initialData(): GridData {
  return {
    rows: [
      {
        cells: [
          {
            text: 'hello',
            color: '',
            subgrid: {
              rows: [{ cells: [{ text: 'how are you', color: '', subgrid: null, childrenHidden: false, disableColors: false }] }],
            },
            childrenHidden: false,
            disableColors: false,
          },
        ],
      },
    ],
  };
}

/**
 * TreeSheetStore holds all application state as plain mutable fields (mirroring the
 * original vanilla-JS globals) and notifies subscribers after each action, exactly like
 * the original code mutated `rootData` etc. in place and then called `render()`.
 *
 * Components read fields directly off the store instance; subscribing via
 * `useSyncExternalStore` guarantees a re-render whenever `notify()` fires.
 */
export class TreeSheetStore {
  rootData: GridData = initialData();

  activePath = 'root_r0c0';
  selectedPaths: Set<string> = new Set(['root_r0c0']);
  activeGapPath: string | null = null;
  clipboardData: ClipboardEntry[] | null = null;

  isEditing = false;
  shrinkToText = true;
  showGridLines = true;
  enterNextCell = true;
  enterAddCellAtEnd = false;
  enterAddSibling = false;
  helpPanelOpen = true;

  globalPadding = 0;
  lightMode = true;
  compactGaps = true;

  history: string[] = [];
  redoStack: string[] = [];
  activeDragModifier: DragModifier = '';

  treeScale = 100;
  menuWidth = 224;
  helpWidth = 320;

  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): number => this.version;

  notify(): void {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  // ---------- history ----------
  saveState(): void {
    this.history.push(JSON.stringify(this.rootData));
    if (this.history.length > 50) this.history.shift();
    this.redoStack = [];
  }

  undo = (): void => {
    if (this.history.length === 0) return;
    this.redoStack.push(JSON.stringify(this.rootData));
    this.rootData = JSON.parse(this.history.pop()!);
    this.notify();
  };

  redo = (): void => {
    if (this.redoStack.length === 0) return;
    this.history.push(JSON.stringify(this.rootData));
    this.rootData = JSON.parse(this.redoStack.pop()!);
    this.notify();
  };

  // ---------- selection / editing ----------
  selectCell = (path: string, shiftKey: boolean): void => {
    if (this.isEditing) this.commitActiveEdit();
    this.activeGapPath = null;
    this.isEditing = false;
    if (shiftKey) this.selectedPaths = calculateRangeSelection(this.activePath, path);
    else {
      this.activePath = path;
      this.selectedPaths = new Set([path]);
    }
    this.notify();
  };

  startEdit = (path: string): void => {
    this.saveState();
    this.activePath = path;
    this.selectedPaths = new Set([path]);
    this.isEditing = true;
    this.notify();
  };

  /**
   * Called on every keystroke in the editing textarea. Like the original, this keeps
   * `rootData` in sync in the background WITHOUT triggering a re-render, so the native
   * textarea handles its own typing/cursor and the tree doesn't rebuild on every key.
   */
  updateEditingTextSilent = (text: string): void => {
    this.saveState();
    updateCellByPath(this.rootData, this.activePath, text);
  };

  /** Ported from the textarea's onblur handler: commits text and exits edit mode if still stale-active. */
  commitAndStopEditing = (path: string, text: string): void => {
    if (this.activePath !== path || !this.isEditing) return;
    updateCellByPath(this.rootData, path, text);
    this.isEditing = false;
    this.notify();
  };

  commitActiveEdit = (): void => {
    // value already kept in sync via updateEditingText; just close the editor.
    this.isEditing = false;
  };

  stopEditing = (): void => {
    this.isEditing = false;
    this.notify();
  };

  private getCurrentCell(): CellData | null {
    return getCellByPath(this.rootData, this.activePath);
  }

  // ---------- appearance / settings ----------
  updatePadding = (val: number): void => {
    this.globalPadding = val;
    this.notify();
  };
  updateTreeScale = (val: number): void => {
    this.treeScale = val;
    this.notify();
  };
  updateMenuWidth = (val: number): void => {
    this.menuWidth = val;
    this.notify();
  };
  updateHelpWidth = (val: number): void => {
    this.helpWidth = val;
    this.notify();
  };
  toggleGridLines = (): void => {
    this.showGridLines = !this.showGridLines;
    this.notify();
  };
  toggleShrinkToText = (): void => {
    this.shrinkToText = !this.shrinkToText;
    this.notify();
  };
  toggleEnterNext = (val: boolean): void => {
    this.enterNextCell = val;
    this.notify();
  };
  toggleEnterAddCell = (val: boolean): void => {
    this.enterAddCellAtEnd = val;
    this.notify();
  };
  toggleEnterAddSibling = (val: boolean): void => {
    this.enterAddSibling = val;
    this.notify();
  };
  toggleTheme = (): void => {
    this.lightMode = !this.lightMode;
    document.documentElement.setAttribute('data-theme', this.lightMode ? 'light' : 'dark');
    this.notify();
  };
  toggleCompactGaps = (): void => {
    this.compactGaps = !this.compactGaps;
    this.activeGapPath = null;
    this.notify();
  };
  toggleHelpPanel = (): void => {
    this.helpPanelOpen = !this.helpPanelOpen;
    this.notify();
  };
  toggleDisableColorsOnActive = (): void => {
    this.saveState();
    const cell = this.getCurrentCell();
    if (cell) cell.disableColors = !cell.disableColors;
    this.notify();
  };
  setDragMode = (mode: DragModifier): void => {
    this.activeDragModifier = mode;
    this.notify();
  };

  hasSubgridOnActive(): boolean {
    const cell = this.getCurrentCell();
    return !!(cell && cell.subgrid);
  }

  // ---------- clipboard ----------
  handleCopy = (): void => {
    if (this.selectedPaths.size === 0) return;
    this.clipboardData = Array.from(this.selectedPaths)
      .map((p) => ({ path: p, cell: getCellByPath(this.rootData, p) }))
      .filter((i): i is ClipboardEntry => !!i.cell);
    const text = this.clipboardData.map((i) => i.cell.text || '').join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  handlePaste = (): void => {
    if (!this.clipboardData || this.clipboardData.length === 0) return;
    this.saveState();
    const targets = Array.from(this.selectedPaths);
    targets.forEach((tPath, idx) => {
      const clip = this.clipboardData![idx % this.clipboardData!.length];
      const tc = getCellByPath(this.rootData, tPath);
      if (tc && clip) {
        tc.text = clip.cell.text;
        tc.color = clip.cell.color;
        tc.childrenHidden = clip.cell.childrenHidden;
        tc.disableColors = clip.cell.disableColors;
        tc.subgrid = clip.cell.subgrid ? JSON.parse(JSON.stringify(clip.cell.subgrid)) : null;
      }
    });
    this.notify();
  };

  applyColor = (hex: string): void => {
    this.saveState();
    const color = hex === '#1e1e24' ? '' : hex;
    this.selectedPaths.forEach((p) => applyColorByPath(this.rootData, p, color));
    this.isEditing = false;
    this.notify();
  };

  // ---------- structure editing ----------
  menuClearCell = (): void => {
    this.saveState();
    this.selectedPaths.forEach((path) => {
      const cell = getCellByPath(this.rootData, path);
      if (!cell) return;
      if (cell.text) {
        cell.text = '';
      } else {
        const info = findGridContainingPath(this.rootData, path, 'root');
        const m = path.match(/^(.*)_r(\d+)c(\d+)$/);
        if (info && info.grid && m) {
          const prefix = m[1];
          const r = parseInt(m[2], 10);
          const c = parseInt(m[3], 10);
          const grid = info.grid;
          if (grid.rows[r].cells.length > 1) {
            grid.rows[r].cells.splice(c, 1);
            const newC = Math.max(0, c - 1);
            this.activePath = `${prefix}_r${r}c${newC}`;
          } else if (grid.rows.length > 1) {
            grid.rows.splice(r, 1);
            const newR = Math.max(0, r - 1);
            this.activePath = `${prefix}_r${newR}c0`;
          } else {
            grid.rows[0].cells[0] = newEmptyCell();
            this.activePath = `${prefix}_r0c0`;
          }
        }
      }
    });
    this.selectedPaths = new Set([this.activePath]);
    this.isEditing = false;
    this.notify();
  };

  menuPruneCellGrid = (): void => {
    this.saveState();
    const info = findGridContainingPath(this.rootData, this.activePath, 'root');
    if (info && info.grid) {
      pruneEmptyRowsCols(info.grid);
      this.activePath = 'root_r0c0';
      this.selectedPaths = new Set([this.activePath]);
      this.isEditing = false;
      this.notify();
    }
  };

  menuPruneEntireTree = (): void => {
    this.saveState();
    pruneEmptyRowsCols(this.rootData);
    this.activePath = 'root_r0c0';
    this.selectedPaths = new Set([this.activePath]);
    this.isEditing = false;
    this.notify();
  };

  menuToggleNest = (): void => {
    this.saveState();
    const cell = this.getCurrentCell();
    if (!cell) return;
    if (cell.subgrid) {
      if (confirm('Remove sub-grid?')) cell.subgrid = null;
    } else {
      cell.subgrid = { rows: [{ cells: [newEmptyCell()] }] };
      this.activePath += '_r0c0';
      this.selectedPaths = new Set([this.activePath]);
    }
    this.isEditing = false;
    this.notify();
  };

  menuTransposeGrid = (): void => {
    this.saveState();
    const cell = this.getCurrentCell();
    if (!cell || !cell.subgrid) {
      alert('No child grid found.');
      return;
    }
    const g = cell.subgrid;
    const oldR = g.rows.length;
    const oldC = g.rows[0].cells.length;
    const newRows = [];
    for (let c = 0; c < oldC; c++) {
      const rowCells: CellData[] = [];
      for (let r = 0; r < oldR; r++) rowCells.push(g.rows[r].cells[c] || newEmptyCell());
      newRows.push({ cells: rowCells });
    }
    g.rows = newRows;
    this.notify();
  };

  menuAddParent = (): void => {
    this.saveState();
    const info = findGridAndOwner(this.rootData, this.activePath, 'root');
    if (info && info.ownerCell) {
      info.ownerCell.subgrid = { rows: [{ cells: [{ text: '', color: '', subgrid: info.ownerCell.subgrid, childrenHidden: false, disableColors: false }] }] };
      this.activePath = info.ownerCellPath!;
    } else {
      this.rootData = { rows: [{ cells: [{ text: '', color: '', subgrid: this.rootData, childrenHidden: false, disableColors: false }] }] };
      this.activePath = 'root_r0c0';
    }
    this.selectedPaths = new Set([this.activePath]);
    this.isEditing = false;
    this.notify();
  };

  menuAddParentSingle = (): void => {
    this.saveState();
    const info = findGridContainingPath(this.rootData, this.activePath, 'root');
    const m = this.activePath.match(/_r(\d+)c(\d+)$/);
    if (!info || !m) return;
    const r = parseInt(m[1], 10);
    const c = parseInt(m[2], 10);
    const oldCell = info.grid.rows[r].cells[c];
    info.grid.rows[r].cells[c] = { text: '', color: '', subgrid: { rows: [{ cells: [oldCell] }] }, childrenHidden: false, disableColors: false };
    this.selectedPaths = new Set([this.activePath]);
    this.isEditing = false;
    this.notify();
  };

  getGridByPrefix(prefix: string): GridData | null {
    if (prefix === 'root') return this.rootData;
    const cell = getCellByPath(this.rootData, prefix);
    return cell ? cell.subgrid : null;
  }

  insertSiblingAtGap = (gapPath: string): void => {
    const m = gapPath.match(/^(.*)_gap(\d+)$/);
    if (!m) return;
    const grid = this.getGridByPrefix(m[1]);
    if (!grid) return;
    this.saveState();
    const cols = grid.rows[0] ? grid.rows[0].cells.length : 1;
    const newCells = Array.from({ length: cols }, () => newEmptyCell());
    grid.rows.splice(parseInt(m[2], 10), 0, { cells: newCells });
    this.activeGapPath = null;
    this.activePath = `${m[1]}_r${m[2]}c0`;
    this.selectedPaths = new Set([this.activePath]);
    this.isEditing = true;
    this.notify();
  };

  insertColumnAtGap = (gapPath: string): void => {
    const m = gapPath.match(/^(.*)_r(\d+)_colgap(\d+)$/);
    if (!m) return;
    const grid = this.getGridByPrefix(m[1]);
    if (!grid) return;
    this.saveState();
    const colIdx = parseInt(m[3], 10);
    grid.rows.forEach((r) => r.cells.splice(colIdx, 0, newEmptyCell()));
    this.activeGapPath = null;
    this.activePath = `${m[1]}_r${m[2]}c${colIdx}`;
    this.selectedPaths = new Set([this.activePath]);
    this.isEditing = true;
    this.notify();
  };

  menuAddRow = (): void => {
    this.saveState();
    const info = findGridContainingPath(this.rootData, this.activePath, 'root');
    if (info && info.grid) {
      const cols = info.grid.rows[0] ? info.grid.rows[0].cells.length : 1;
      info.grid.rows.push({ cells: Array.from({ length: cols }, () => newEmptyCell()) });
      this.notify();
    }
  };

  menuAddCol = (): void => {
    this.saveState();
    const info = findGridContainingPath(this.rootData, this.activePath, 'root');
    if (info && info.grid) {
      info.grid.rows.forEach((r) => r.cells.push(newEmptyCell()));
      this.notify();
    }
  };

  menuDelRow = (): void => {
    this.saveState();
    const info = findGridContainingPath(this.rootData, this.activePath, 'root');
    const m = this.activePath.match(/_r(\d+)c\d+$/);
    if (info && info.grid && info.grid.rows.length > 1 && m) {
      const rIdx = parseInt(m[1], 10);
      info.grid.rows.splice(rIdx, 1);
      const newR = Math.max(0, rIdx - 1);
      const mPrefix = this.activePath.match(/^(.*)_r\d+c\d+$/);
      this.activePath = mPrefix ? `${mPrefix[1]}_r${newR}c0` : 'root_r0c0';
      this.selectedPaths = new Set([this.activePath]);
      this.isEditing = false;
      this.notify();
    }
  };

  menuDelCol = (): void => {
    this.saveState();
    const info = findGridContainingPath(this.rootData, this.activePath, 'root');
    const m = this.activePath.match(/_r\d+c(\d+)$/);
    if (info && info.grid && info.grid.rows[0].cells.length > 1 && m) {
      const cIdx = parseInt(m[1], 10);
      info.grid.rows.forEach((r) => r.cells.splice(cIdx, 1));
      const newC = Math.max(0, cIdx - 1);
      const mPrefix = this.activePath.match(/^(.*)_r\d+c\d+$/);
      this.activePath = mPrefix ? `${mPrefix[1]}_r0c${newC}` : 'root_r0c0';
      this.selectedPaths = new Set([this.activePath]);
      this.isEditing = false;
      this.notify();
    }
  };

  // ---------- drag & drop ----------
  handleDrop = (targetCellPath: string, draggedPaths: string[], modifier: DragModifier, dropMode: DropMode): void => {
    if (draggedPaths.includes(targetCellPath)) return;
    this.saveState();
    const draggedCells = draggedPaths
      .map((p) => {
        const c = getCellByPath(this.rootData, p);
        return c ? (JSON.parse(JSON.stringify(c)) as CellData) : null;
      })
      .filter((c): c is CellData => !!c);
    if (!draggedCells.length) return;

    const cell = getCellByPath(this.rootData, targetCellPath);
    const info = findGridContainingPath(this.rootData, targetCellPath, 'root');
    const targetMatch = targetCellPath.match(/_r(\d+)c(\d+)$/);
    const isCut = this.activeDragModifier === 'x' || (modifier === 'x' && this.activeDragModifier !== 'c');

    if (dropMode === 'child' && cell) {
      if (!cell.subgrid) cell.subgrid = { rows: [] };
      cell.subgrid.rows.push({ cells: draggedCells });
      cell.childrenHidden = false;
    } else if ((dropMode === 'row-before' || dropMode === 'row-after') && info && info.grid && targetMatch) {
      info.grid.rows.splice(parseInt(targetMatch[1], 10) + (dropMode === 'row-after' ? 1 : 0), 0, { cells: draggedCells });
    } else if ((dropMode === 'col-before' || dropMode === 'col-after') && info && info.grid && targetMatch) {
      const cIdx = parseInt(targetMatch[2], 10) + (dropMode === 'col-after' ? 1 : 0);
      draggedCells.forEach((dc, i) => {
        const rTarget = parseInt(targetMatch[1], 10) + i;
        if (info.grid.rows[rTarget]) info.grid.rows[rTarget].cells.splice(cIdx, 0, dc);
        else info.grid.rows.push({ cells: [dc] });
      });
    }

    if (isCut || this.activeDragModifier === '') {
      draggedPaths.forEach((p) => {
        const c = getCellByPath(this.rootData, p);
        if (c) {
          c.text = '';
          c.color = '';
          c.subgrid = null;
          c.childrenHidden = false;
          c.disableColors = false;
        }
      });
    }

    this.activePath = targetCellPath;
    this.selectedPaths = new Set([this.activePath]);
    this.activeGapPath = null;
    this.isEditing = false;
    this.notify();
  };

  // ---------- navigation ----------
  navigateGridByDelta = (dR: number, dC: number): boolean => {
    const m = this.activePath.match(/^(.*)_r(\d+)c(\d+)$/);
    if (!m) return false;
    const info = findGridContainingPath(this.rootData, this.activePath, 'root');
    if (!info || !info.grid) return false;
    const grid = info.grid;
    const maxR = grid.rows.length - 1;
    const maxC = grid.rows[0] ? grid.rows[0].cells.length - 1 : 0;
    const newR = parseInt(m[2], 10) + dR;
    const newC = parseInt(m[3], 10) + dC;

    if ((newR < 0 || newR > maxR) && dR < 0) {
      const parentMatch = m[1].match(/^(.*)_r\d+c\d+$/);
      if (parentMatch) {
        this.activePath = m[1];
        this.selectedPaths = new Set([this.activePath]);
        this.notify();
        return true;
      }
    }

    this.activePath = `${m[1]}_r${Math.max(0, Math.min(maxR, newR))}c${Math.max(0, Math.min(maxC, newC))}`;
    this.selectedPaths = new Set([this.activePath]);
    this.notify();
    return true;
  };

  tryEnterChild = (shiftKey: boolean): boolean => {
    const cell = getCellByPath(this.rootData, this.activePath);
    if (cell && cell.subgrid && !cell.childrenHidden) {
      const childPath = `${this.activePath}_r0c0`;
      const child = getCellByPath(this.rootData, childPath);
      if (child) {
        this.activePath = childPath;
        if (shiftKey) this.selectedPaths.add(this.activePath);
        else this.selectedPaths = new Set([this.activePath]);
        this.notify();
        return true;
      }
    }
    return false;
  };

  tryExitToParent = (shiftKey: boolean): boolean => {
    const m = this.activePath.match(/^(.*)_r(\d+)c(\d+)$/);
    if (m && parseInt(m[2], 10) === 0) {
      const parentMatch = m[1].match(/^(.*)_r\d+c\d+$/);
      if (parentMatch) {
        this.activePath = m[1];
        if (shiftKey) this.selectedPaths.add(this.activePath);
        else this.selectedPaths = new Set([this.activePath]);
        this.notify();
        return true;
      }
    }
    return false;
  };

  moveLinear = (dir: 1 | -1, shiftKey: boolean): void => {
    const all = getAllCellPaths(this.rootData);
    const idx = all.indexOf(this.activePath);
    if (idx === -1) return;
    const next = dir === 1 ? Math.min(idx + 1, all.length - 1) : Math.max(idx - 1, 0);
    this.activePath = all[next];
    if (shiftKey) this.selectedPaths.add(this.activePath);
    else this.selectedPaths = new Set([this.activePath]);
    this.notify();
  };

  compactVerticalMove = (dir: 1 | -1): boolean => {
    const gMatch = this.activeGapPath && this.activeGapPath.match(/^(.*)_gap(\d+)$/);
    if (gMatch) {
      const grid = this.getGridByPrefix(gMatch[1]);
      if (!grid) return false;
      const target = dir === 1 ? parseInt(gMatch[2], 10) : parseInt(gMatch[2], 10) - 1;
      if (target < 0 || target >= grid.rows.length) return true;
      this.activeGapPath = null;
      this.activePath = `${gMatch[1]}_r${target}c0`;
      this.selectedPaths = new Set([this.activePath]);
      this.notify();
      return true;
    }
    const m = this.activePath.match(/^(.*)_r(\d+)c(\d+)$/);
    if (!m) return false;
    const grid = this.getGridByPrefix(m[1]);
    if (!grid) return false;
    const gapIdx = dir === 1 ? parseInt(m[2], 10) + 1 : parseInt(m[2], 10);
    if (gapIdx < 0 || gapIdx > grid.rows.length) return false;
    this.activeGapPath = `${m[1]}_gap${gapIdx}`;
    this.notify();
    return true;
  };

  compactHorizontalMove = (dir: 1 | -1): boolean => {
    const cMatch = this.activeGapPath && this.activeGapPath.match(/^(.*)_r(\d+)_colgap(\d+)$/);
    if (cMatch) {
      const grid = this.getGridByPrefix(cMatch[1]);
      if (!grid) return false;
      const target = dir === 1 ? parseInt(cMatch[3], 10) : parseInt(cMatch[3], 10) - 1;
      if (target < 0 || target >= (grid.rows[0] ? grid.rows[0].cells.length : 1)) return true;
      this.activeGapPath = null;
      this.activePath = `${cMatch[1]}_r${cMatch[2]}c${target}`;
      this.selectedPaths = new Set([this.activePath]);
      this.notify();
      return true;
    }
    const m = this.activePath.match(/^(.*)_r(\d+)c(\d+)$/);
    if (!m) return false;
    const grid = this.getGridByPrefix(m[1]);
    if (!grid) return false;
    const cols = grid.rows[0] ? grid.rows[0].cells.length : 1;
    if (cols <= 1) return false;
    const gapIdx = dir === 1 ? parseInt(m[3], 10) + 1 : parseInt(m[3], 10);
    if (gapIdx < 0 || gapIdx > cols) return false;
    this.activeGapPath = `${m[1]}_r${m[2]}_colgap${gapIdx}`;
    this.notify();
    return true;
  };

  setActiveGapPath = (gapPath: string | null): void => {
    this.activeGapPath = gapPath;
    this.notify();
  };

  /**
   * Ported from the original `ta.onkeydown` handler on the editing textarea.
   * Text itself is kept in sync separately via `updateEditingText` on every keystroke,
   * so this only needs to handle Enter/Escape navigation, matching the original's
   * enterNextCell / enterAddCellAtEnd / enterAddSibling settings.
   */
  handleEditorKeyDown = (e: { key: string; preventDefault: () => void }, shiftKey: boolean, ctrlKey: boolean): void => {
    const all = getAllCellPaths(this.rootData);
    const idx = all.indexOf(this.activePath);
    if (e.key === 'Enter') {
      if (this.enterAddSibling && !shiftKey) {
        e.preventDefault();
        this.saveState();
        const info = findGridContainingPath(this.rootData, this.activePath, 'root');
        const m = this.activePath.match(/_r(\d+)c(\d+)$/);
        if (info && info.grid && m) {
          const rIdx = parseInt(m[1], 10);
          const cIdx = parseInt(m[2], 10);
          const cols = info.grid.rows[0] ? info.grid.rows[0].cells.length : 1;
          const newCells = Array.from({ length: cols }, () => newEmptyCell());
          info.grid.rows.splice(rIdx + 1, 0, { cells: newCells });
          const prefixMatch = this.activePath.match(/^(.*)_r\d+c\d+$/);
          if (prefixMatch) {
            this.activePath = `${prefixMatch[1]}_r${rIdx + 1}c${cIdx}`;
            this.selectedPaths = new Set([this.activePath]);
            this.isEditing = true;
          }
        }
        this.notify();
        return;
      }
      if (this.enterNextCell && !shiftKey) {
        e.preventDefault();
        if (idx !== -1 && idx < all.length - 1) {
          this.activePath = all[idx + 1];
          this.selectedPaths = new Set([this.activePath]);
          this.isEditing = true;
        } else if (this.enterAddCellAtEnd && idx === all.length - 1) {
          this.saveState();
          const info = findGridContainingPath(this.rootData, this.activePath, 'root');
          if (info && info.grid) {
            const cols = info.grid.rows[0] ? info.grid.rows[0].cells.length : 1;
            info.grid.rows.push({ cells: Array.from({ length: cols }, () => newEmptyCell()) });
            const allUpdated = getAllCellPaths(this.rootData);
            this.activePath = allUpdated[allUpdated.length - 1];
            this.selectedPaths = new Set([this.activePath]);
            this.isEditing = true;
          }
        } else {
          this.isEditing = false;
        }
        this.notify();
        return;
      } else if (this.enterNextCell && shiftKey) {
        e.preventDefault();
        if (idx > 0) {
          this.activePath = all[idx - 1];
          this.selectedPaths = new Set([this.activePath]);
          this.isEditing = true;
        } else {
          this.isEditing = false;
        }
        this.notify();
        return;
      } else if (!this.enterNextCell || ctrlKey) {
        this.isEditing = false;
        e.preventDefault();
        this.notify();
      }
    } else if (e.key === 'Escape') {
      this.isEditing = false;
      e.preventDefault();
      this.notify();
    }
  };

  toggleChildrenHiddenOnActive = (): void => {
    const cell = this.getCurrentCell();
    if (cell && cell.subgrid) {
      this.saveState();
      cell.childrenHidden = !cell.childrenHidden;
      this.notify();
    }
  };

  /**
   * Ported 1:1 from the original `window.addEventListener('keydown', ...)` handler.
   * `isTyping` should be true when focus is currently inside the active cell's textarea
   * (that element handles its own Enter/Escape/Delete logic separately).
   */
  handleGlobalKeyDown = (e: KeyboardEvent, isTyping: boolean): void => {
    if (this.activeGapPath && !isTyping) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (/_colgap\d+$/.test(this.activeGapPath)) this.insertColumnAtGap(this.activeGapPath);
        else this.insertSiblingAtGap(this.activeGapPath);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.activeGapPath = null;
        this.notify();
        return;
      }
    }
    if (!isTyping) {
      if (e.key.toLowerCase() === 'x') this.setDragMode('x');
      if (e.key.toLowerCase() === 'c') this.setDragMode('c');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !isTyping) {
      e.preventDefault();
      this.handleCopy();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !isTyping) {
      e.preventDefault();
      this.handlePaste();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      this.menuAddParent();
      return;
    }
    if (isTyping) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.menuClearCell();
      return;
    }
    if (this.isEditing) {
      if (e.key === 'Escape') {
        this.isEditing = false;
        this.notify();
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.isEditing = true;
      this.notify();
      return;
    }
    if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      this.toggleChildrenHiddenOnActive();
      return;
    }
    if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      this.menuTransposeGrid();
      return;
    }
    if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      this.menuAddParentSingle();
      return;
    }
    if (e.key.toLowerCase() === 'i') {
      e.preventDefault();
      this.menuToggleNest();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      this.navigateGridByDelta(
        e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0,
        e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
      );
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (this.compactGaps && this.activeGapPath) {
        if (e.key === 'ArrowDown') this.compactVerticalMove(1);
        else if (e.key === 'ArrowUp') this.compactVerticalMove(-1);
        else if (e.key === 'ArrowRight') this.compactHorizontalMove(1);
        else if (e.key === 'ArrowLeft') this.compactHorizontalMove(-1);
        return;
      }
      if (e.key === 'ArrowDown' && this.tryEnterChild(e.shiftKey)) return;
      if (this.compactGaps) {
        if (e.key === 'ArrowDown') {
          this.compactVerticalMove(1);
          return;
        }
        if (e.key === 'ArrowUp') {
          this.compactVerticalMove(-1);
          return;
        }
        if (e.key === 'ArrowRight') {
          this.compactHorizontalMove(1);
          return;
        }
        if (e.key === 'ArrowLeft') {
          this.compactHorizontalMove(-1);
          return;
        }
      }
      if (e.key === 'ArrowUp' && this.tryExitToParent(e.shiftKey)) return;
      const dir: 1 | -1 = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      this.moveLinear(dir, e.shiftKey);
    }
  };

  // ---------- file / project ----------
  newBlankSheet = (): void => {
    if (confirm('Create a new blank TreeSheets project?')) {
      this.saveState();
      this.rootData = newEmptyGrid();
      this.activePath = 'root_r0c0';
      this.selectedPaths = new Set([this.activePath]);
      this.isEditing = false;
      this.notify();
    }
  };

  exportJSON = (exportSettingsToo: boolean): void => {
    const a = Object.assign(document.createElement('a'), {
      href: 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.rootData, null, 2)),
      download: 'treesheets_project.json',
    });
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (exportSettingsToo) {
      const settingsData: SettingsExport = {
        treeScale: this.treeScale,
        menuWidth: this.menuWidth,
        helpWidth: this.helpWidth,
        globalPadding: this.globalPadding,
        lightMode: this.lightMode,
        showGridLines: this.showGridLines,
        enterNextCell: this.enterNextCell,
        enterAddCellAtEnd: this.enterAddCellAtEnd,
        enterAddSibling: this.enterAddSibling,
        helpPanelOpen: this.helpPanelOpen,
        compactGaps: this.compactGaps,
      };
      const b = Object.assign(document.createElement('a'), {
        href: 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settingsData, null, 2)),
        download: 'treesheets_settings.json',
      });
      document.body.appendChild(b);
      b.click();
      b.remove();
    }
  };

  importJSON = (file: File): void => {
    const r = new FileReader();
    r.readAsText(file, 'UTF-8');
    r.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target!.result as string);
        if (parsed && parsed.rows) {
          this.saveState();
          this.rootData = parsed;
          this.activePath = 'root_r0c0';
          this.selectedPaths = new Set([this.activePath]);
          this.isEditing = false;
          this.notify();
        } else {
          alert('Invalid JSON format.');
        }
      } catch {
        alert('Error parsing JSON.');
      }
    };
  };

  importSettingsJSON = (file: File): void => {
    const r = new FileReader();
    r.readAsText(file, 'UTF-8');
    r.onload = (evt) => {
      try {
        const s = JSON.parse(evt.target!.result as string);
        if (s && typeof s === 'object') {
          if (typeof s.treeScale === 'number') this.treeScale = s.treeScale;
          if (typeof s.menuWidth === 'number') this.menuWidth = s.menuWidth;
          if (typeof s.helpWidth === 'number') this.helpWidth = s.helpWidth;
          if (typeof s.globalPadding === 'number') this.globalPadding = s.globalPadding;
          if (typeof s.lightMode === 'boolean') {
            this.lightMode = s.lightMode;
            document.documentElement.setAttribute('data-theme', this.lightMode ? 'light' : 'dark');
          }
          if (typeof s.showGridLines === 'boolean') this.showGridLines = s.showGridLines;
          if (typeof s.enterNextCell === 'boolean') this.enterNextCell = s.enterNextCell;
          if (typeof s.enterAddCellAtEnd === 'boolean') this.enterAddCellAtEnd = s.enterAddCellAtEnd;
          if (typeof s.enterAddSibling === 'boolean') this.enterAddSibling = s.enterAddSibling;
          if (typeof s.helpPanelOpen === 'boolean') this.helpPanelOpen = s.helpPanelOpen;
          if (typeof s.compactGaps === 'boolean') this.compactGaps = s.compactGaps;
          this.notify();
        } else {
          alert('Invalid settings JSON format.');
        }
      } catch {
        alert('Error parsing settings JSON.');
      }
    };
  };
}
