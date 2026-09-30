import { CellData, ClipboardEntry, DragModifier, DropMode, GridData, SettingsExport } from './types';
import {
  calculateRangeSelection,
  getCellByPath,
  newEmptyGrid,
} from './treeUtils';
import * as gridMutations from './gridMutations';
import * as gridNavigation from './gridNavigation';

function downloadJson(filename: string, data: unknown): void {
  const a = Object.assign(document.createElement('a'), {
    href: 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2)),
    download: filename,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function readJsonFile(file: File, onLoad: (data: any) => void, invalidMsg = 'Invalid JSON format.'): void {
  const r = new FileReader();
  r.readAsText(file, 'UTF-8');
  r.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target!.result as string);
      if (parsed && typeof parsed === 'object') {
        onLoad(parsed);
      } else {
        alert(invalidMsg);
      }
    } catch {
      alert('Error parsing JSON.');
    }
  };
}

function initialData(): GridData {
  return {
    rows: [
      {
        cells: [
          {
            text: 'hello',
            subgrid: {
              rows: [{ cells: [{ text: 'how are you', subgrid: null, childrenHidden: false }] }],
            },
            childrenHidden: false,
          },
        ],
      },
    ],
  };
}

/**
 * TreeSheetStore holds all application state as plain mutable fields and
 * coordinates notifications across subscribers.
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
  enterAddCellAtEnd = true;
  enterAddSibling = true;
  navigateFutureEdgeCells = true;
  helpPanelOpen = true;

  globalPadding = 3;
  lightMode = false;
  blackMode = false;
  compactGaps = true;

  history: string[] = [];
  redoStack: string[] = [];
  activeDragModifier: DragModifier = '';

  treeScale = 100;
  fontSize = 12;
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

  updateEditingTextSilent = (text: string): void => {
    this.saveState();
    const cell = this.getCurrentCell();
    if (cell) cell.text = text;
  };

  commitAndStopEditing = (path: string, text: string): void => {
    if (this.activePath !== path || !this.isEditing) return;
    const cell = this.getCurrentCell();
    if (cell) cell.text = text;
    this.isEditing = false;
    this.notify();
  };

  commitActiveEdit = (): void => {
    this.isEditing = false;
  };

  stopEditing = (): void => {
    this.isEditing = false;
    this.notify();
  };

  getCurrentCell(): CellData | null {
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
  updateFontSize = (val: number): void => {
    this.fontSize = Math.max(8, Math.min(32, val));
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
  toggleNavigateFutureEdgeCells = (val: boolean): void => {
    this.navigateFutureEdgeCells = val;
    if (!val) this.activeGapPath = null;
    this.notify();
  };
  setTheme = (theme: 'light' | 'dark' | 'black'): void => {
    this.lightMode = theme === 'light';
    this.blackMode = theme === 'black';
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
        tc.childrenHidden = clip.cell.childrenHidden;
        tc.subgrid = clip.cell.subgrid ? structuredClone(clip.cell.subgrid) : null;
      }
    });
    this.notify();
  };

  // ---------- structure editing (delegated to gridMutations) ----------
  getGridByPrefix(prefix: string): GridData | null {
    if (prefix === 'root') return this.rootData;
    const cell = getCellByPath(this.rootData, prefix);
    return cell ? cell.subgrid : null;
  }

  menuClearCell = (): void => gridMutations.menuClearCell(this);
  menuPruneCellGrid = (): void => gridMutations.menuPruneCellGrid(this);
  menuPruneEntireTree = (): void => gridMutations.menuPruneEntireTree(this);
  menuToggleNest = (): void => gridMutations.menuToggleNest(this);
  menuTransposeGrid = (): void => gridMutations.menuTransposeGrid(this);
  menuAddParent = (): void => gridMutations.menuAddParent(this);
  menuAddParentSingle = (): void => gridMutations.menuAddParentSingle(this);
  insertSiblingAtGap = (gapPath: string): void => gridMutations.insertSiblingAtGap(this, gapPath);
  insertColumnAtGap = (gapPath: string): void => gridMutations.insertColumnAtGap(this, gapPath);
  menuAddRow = (): void => gridMutations.menuAddRow(this);
  menuAddCol = (): void => gridMutations.menuAddCol(this);
  menuDelRow = (): void => gridMutations.menuDelRow(this);
  menuDelCol = (): void => gridMutations.menuDelCol(this);

  // ---------- drag & drop (delegated to gridMutations) ----------
  handleDrop = (targetCellPath: string, draggedPaths: string[], modifier: DragModifier, dropMode: DropMode): void =>
    gridMutations.handleDrop(this, targetCellPath, draggedPaths, modifier, dropMode);

  // ---------- navigation (delegated to gridNavigation) ----------
  navigateGridByDelta = (dR: number, dC: number): boolean => gridNavigation.navigateGridByDelta(this, dR, dC);
  tryEnterChild = (shiftKey: boolean): boolean => gridNavigation.tryEnterChild(this, shiftKey);
  tryExitToParent = (shiftKey: boolean): boolean => gridNavigation.tryExitToParent(this, shiftKey);
  moveLinear = (dir: 1 | -1, shiftKey: boolean): void => gridNavigation.moveLinear(this, dir, shiftKey);
  compactVerticalMove = (dir: 1 | -1): boolean => gridNavigation.compactVerticalMove(this, dir);
  compactHorizontalMove = (dir: 1 | -1): boolean => gridNavigation.compactHorizontalMove(this, dir);
  setActiveGapPath = (gapPath: string | null): void => {
    this.activeGapPath = gapPath;
    this.notify();
  };
  handleEditorKeyDown = (e: { key: string; preventDefault: () => void }, shiftKey: boolean, ctrlKey: boolean): void =>
    gridNavigation.handleEditorKeyDown(this, e, shiftKey, ctrlKey);
  toggleChildrenHiddenOnActive = (): void => gridNavigation.toggleChildrenHiddenOnActive(this);
  handleGlobalKeyDown = (e: KeyboardEvent, isTyping: boolean): void =>
    gridNavigation.handleGlobalKeyDown(this, e, isTyping);

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
    downloadJson('treesheets_project.json', this.rootData);

    if (exportSettingsToo) {
      const settingsData: SettingsExport = {
        treeScale: this.treeScale,
        fontSize: this.fontSize,
        menuWidth: this.menuWidth,
        helpWidth: this.helpWidth,
        globalPadding: this.globalPadding,
        lightMode: this.lightMode,
        blackMode: this.blackMode,
        showGridLines: this.showGridLines,
        enterNextCell: this.enterNextCell,
        enterAddCellAtEnd: this.enterAddCellAtEnd,
        enterAddSibling: this.enterAddSibling,
        navigateFutureEdgeCells: this.navigateFutureEdgeCells,
        helpPanelOpen: this.helpPanelOpen,
        compactGaps: this.compactGaps,
      };
      downloadJson('treesheets_settings.json', settingsData);
    }
  };

  importJSON = (file: File): void => {
    readJsonFile(file, (parsed) => {
      if (parsed.rows) {
        this.saveState();
        this.rootData = parsed;
        this.activePath = 'root_r0c0';
        this.selectedPaths = new Set([this.activePath]);
        this.isEditing = false;
        this.notify();
      } else {
        alert('Invalid JSON format.');
      }
    });
  };

  importSettingsJSON = (file: File): void => {
    readJsonFile(file, (s) => {
      if (typeof s.treeScale === 'number') this.treeScale = s.treeScale;
      if (typeof s.fontSize === 'number') this.fontSize = Math.max(8, Math.min(32, s.fontSize));
      if (typeof s.menuWidth === 'number') this.menuWidth = s.menuWidth;
      if (typeof s.helpWidth === 'number') this.helpWidth = s.helpWidth;
      if (typeof s.globalPadding === 'number') this.globalPadding = s.globalPadding;
      if (typeof s.lightMode === 'boolean') this.lightMode = s.lightMode;
      if (typeof s.blackMode === 'boolean') this.blackMode = s.blackMode;
      if (typeof s.showGridLines === 'boolean') this.showGridLines = s.showGridLines;
      if (typeof s.enterNextCell === 'boolean') this.enterNextCell = s.enterNextCell;
      if (typeof s.enterAddCellAtEnd === 'boolean') this.enterAddCellAtEnd = s.enterAddCellAtEnd;
      if (typeof s.enterAddSibling === 'boolean') this.enterAddSibling = s.enterAddSibling;
      if (typeof s.navigateFutureEdgeCells === 'boolean') this.navigateFutureEdgeCells = s.navigateFutureEdgeCells;
      if (typeof s.helpPanelOpen === 'boolean') this.helpPanelOpen = s.helpPanelOpen;
      if (typeof s.compactGaps === 'boolean') this.compactGaps = s.compactGaps;
      this.notify();
    }, 'Invalid settings JSON format.');
  };
}
