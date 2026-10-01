import type { TreeSheetStore } from './store';
import type { CellData, DragModifier, DropMode, GridData } from './types';
import { calculateRangeSelection, findGridAndOwner, findGridContainingPath, getAllCellPaths, getCellByPath, newEmptyCell, newEmptyGrid, pruneEmptyRowsCols } from './treeUtils';

export function navigateGridByDelta(store: TreeSheetStore, dR: number, dC: number): boolean {
    const m = store.activePath.match(/^(.*)_r(\d+)c(\d+)$/);
    if (!m) return false;
    const info = findGridContainingPath(store.rootData, store.activePath, 'root');
    if (!info || !info.grid) return false;
    const grid = info.grid;
    const maxR = grid.rows.length - 1;
    const maxC = grid.rows[0] ? grid.rows[0].cells.length - 1 : 0;
    const newR = parseInt(m[2], 10) + dR;
    const newC = parseInt(m[3], 10) + dC;

    if ((newR < 0 || newR > maxR) && dR < 0) {
      const parentMatch = m[1].match(/^(.*)_r\d+c\d+$/);
      if (parentMatch) {
        store.activePath = m[1];
        store.selectedPaths = new Set([store.activePath]);
        store.notify();
        return true;
      }
    }

    store.activePath = `${m[1]}_r${Math.max(0, Math.min(maxR, newR))}c${Math.max(0, Math.min(maxC, newC))}`;
    store.selectedPaths = new Set([store.activePath]);
    store.notify();
    return true;
  
}

export function tryEnterChild(store: TreeSheetStore, shiftKey: boolean): boolean {
    const cell = getCellByPath(store.rootData, store.activePath);
    if (cell && cell.subgrid && !cell.childrenHidden) {
      const childPath = `${store.activePath}_r0c0`;
      const child = getCellByPath(store.rootData, childPath);
      if (child) {
        store.activePath = childPath;
        if (shiftKey) store.selectedPaths.add(store.activePath);
        else store.selectedPaths = new Set([store.activePath]);
        store.notify();
        return true;
      }
    }
    return false;
  
}

export function tryExitToParent(store: TreeSheetStore, shiftKey: boolean): boolean {
    const m = store.activePath.match(/^(.*)_r(\d+)c(\d+)$/);
    if (m && parseInt(m[2], 10) === 0) {
      const parentMatch = m[1].match(/^(.*)_r\d+c\d+$/);
      if (parentMatch) {
        store.activePath = m[1];
        if (shiftKey) store.selectedPaths.add(store.activePath);
        else store.selectedPaths = new Set([store.activePath]);
        store.notify();
        return true;
      }
    }
    return false;
  
}

export function moveLinear(store: TreeSheetStore, dir: 1 | -1, shiftKey: boolean): void {
    const all = getAllCellPaths(store.rootData);
    const idx = all.indexOf(store.activePath);
    if (idx === -1) return;
    const next = dir === 1 ? Math.min(idx + 1, all.length - 1) : Math.max(idx - 1, 0);
    store.activePath = all[next];
    if (shiftKey) store.selectedPaths.add(store.activePath);
    else store.selectedPaths = new Set([store.activePath]);
    store.notify();
  
}

export function compactVerticalMove(store: TreeSheetStore, dir: 1 | -1): boolean {
    const gMatch = store.activeGapPath && store.activeGapPath.match(/^(.*)_gap(\d+)$/);
    if (gMatch) {
      const grid = store.getGridByPrefix(gMatch[1]);
      if (!grid) return false;
      const target = dir === 1 ? parseInt(gMatch[2], 10) : parseInt(gMatch[2], 10) - 1;
      if (target < 0 || target >= grid.rows.length) return true;
      store.activeGapPath = null;
      store.activePath = `${gMatch[1]}_r${target}c0`;
      store.selectedPaths = new Set([store.activePath]);
      store.notify();
      return true;
    }
    const m = store.activePath.match(/^(.*)_r(\d+)c(\d+)$/);
    if (!m) return false;
    const grid = store.getGridByPrefix(m[1]);
    if (!grid) return false;
    const gapIdx = dir === 1 ? parseInt(m[2], 10) + 1 : parseInt(m[2], 10);
    if (gapIdx < 0 || gapIdx > grid.rows.length) return false;
    store.activeGapPath = `${m[1]}_gap${gapIdx}`;
    store.notify();
    return true;
  
}

export function compactHorizontalMove(store: TreeSheetStore, dir: 1 | -1): boolean {
    const cMatch = store.activeGapPath && store.activeGapPath.match(/^(.*)_r(\d+)_colgap(\d+)$/);
    if (cMatch) {
      const grid = store.getGridByPrefix(cMatch[1]);
      if (!grid) return false;
      const target = dir === 1 ? parseInt(cMatch[3], 10) : parseInt(cMatch[3], 10) - 1;
      if (target < 0 || target >= (grid.rows[0] ? grid.rows[0].cells.length : 1)) return true;
      store.activeGapPath = null;
      store.activePath = `${cMatch[1]}_r${cMatch[2]}c${target}`;
      store.selectedPaths = new Set([store.activePath]);
      store.notify();
      return true;
    }
    const m = store.activePath.match(/^(.*)_r(\d+)c(\d+)$/);
    if (!m) return false;
    const grid = store.getGridByPrefix(m[1]);
    if (!grid) return false;
    const cols = grid.rows[0] ? grid.rows[0].cells.length : 1;
    const gapIdx = dir === 1 ? parseInt(m[3], 10) + 1 : parseInt(m[3], 10);
    if (gapIdx < 0 || gapIdx > cols) return false;
    store.activeGapPath = `${m[1]}_r${m[2]}_colgap${gapIdx}`;
    store.notify();
    return true;
  
}

function enterAddSibling(store: TreeSheetStore): void {
  store.saveState();
  const info = findGridContainingPath(store.rootData, store.activePath, 'root');
  const m = store.activePath.match(/_r(\d+)c(\d+)$/);
  if (info && info.grid && m) {
    const rIdx = parseInt(m[1], 10);
    const cIdx = parseInt(m[2], 10);
    const cols = info.grid.rows[0] ? info.grid.rows[0].cells.length : 1;
    const newCells = Array.from({ length: cols }, () => newEmptyCell());
    info.grid.rows.splice(rIdx + 1, 0, { cells: newCells });
    const prefixMatch = store.activePath.match(/^(.*)_r\d+c\d+$/);
    if (prefixMatch) {
      store.activePath = `${prefixMatch[1]}_r${rIdx + 1}c${cIdx}`;
      store.selectedPaths = new Set([store.activePath]);
      store.isEditing = true;
    }
  }
  store.notify();
}

function enterMoveToNext(store: TreeSheetStore, all: string[], idx: number): void {
  if (idx !== -1 && idx < all.length - 1) {
    store.activePath = all[idx + 1];
    store.selectedPaths = new Set([store.activePath]);
    store.isEditing = true;
  } else if (store.enterAddCellAtEnd && idx === all.length - 1) {
    store.saveState();
    const info = findGridContainingPath(store.rootData, store.activePath, 'root');
    if (info && info.grid) {
      const cols = info.grid.rows[0] ? info.grid.rows[0].cells.length : 1;
      info.grid.rows.push({ cells: Array.from({ length: cols }, () => newEmptyCell()) });
      const allUpdated = getAllCellPaths(store.rootData);
      store.activePath = allUpdated[allUpdated.length - 1];
      store.selectedPaths = new Set([store.activePath]);
      store.isEditing = true;
    }
  } else {
    store.isEditing = false;
  }
  store.notify();
}

function enterPreviousOrStop(store: TreeSheetStore, all: string[], idx: number): void {
  if (idx > 0) {
    store.activePath = all[idx - 1];
    store.selectedPaths = new Set([store.activePath]);
    store.isEditing = true;
  } else {
    store.isEditing = false;
  }
  store.notify();
}

export function handleEditorKeyDown(store: TreeSheetStore, e: { key: string; preventDefault: () => void }, shiftKey: boolean, ctrlKey: boolean): void {
    const all = getAllCellPaths(store.rootData);
    const idx = all.indexOf(store.activePath);
    if (e.key === 'Enter') {
      if (store.enterAddSibling && !shiftKey) {
        e.preventDefault();
        enterAddSibling(store);
        return;
      }
      if (store.enterNextCell && !shiftKey) {
        e.preventDefault();
        enterMoveToNext(store, all, idx);
        return;
      } else if (store.enterNextCell && shiftKey) {
        e.preventDefault();
        enterPreviousOrStop(store, all, idx);
        return;
      } else if (!store.enterNextCell || ctrlKey) {
        store.isEditing = false;
        e.preventDefault();
        store.notify();
      }
    } else if (e.key === 'Escape') {
      store.isEditing = false;
      e.preventDefault();
      store.notify();
    }
  
}

export function toggleChildrenHiddenOnActive(store: TreeSheetStore): void {
    const cell = getCellByPath(store.rootData, store.activePath);
    if (cell && cell.subgrid) {
      store.saveState();
      cell.childrenHidden = !cell.childrenHidden;
      store.notify();
    }
  
}

export function handleGlobalKeyDown(store: TreeSheetStore, e: KeyboardEvent, isTyping: boolean): void {
    if (store.activeGapPath && !isTyping) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (/_colgap\d+$/.test(store.activeGapPath)) store.insertColumnAtGap(store.activeGapPath);
        else store.insertSiblingAtGap(store.activeGapPath);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        store.activeGapPath = null;
        store.notify();
        return;
      }
    }
    if (!isTyping) {
      if (e.key.toLowerCase() === 'x') store.setDragMode('x');
      if (e.key.toLowerCase() === 'c') store.setDragMode('c');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      store.redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !isTyping) {
      e.preventDefault();
      store.handleCopy();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !isTyping) {
      e.preventDefault();
      store.handlePaste();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      store.menuAddParent();
      return;
    }
    if (isTyping) return;

    if ((e.ctrlKey || e.metaKey) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      store.navigateGridByDelta(
        e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0,
        e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
      );
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      store.menuClearCell();
      return;
    }
    if (store.isEditing) {
      if (e.key === 'Escape') {
        store.isEditing = false;
        store.notify();
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      store.isEditing = true;
      store.notify();
      return;
    }
    if (!(e.ctrlKey || e.metaKey)) {
    if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      store.toggleChildrenHiddenOnActive();
      return;
    }
    if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      store.menuTransposeGrid();
      return;
    }
    if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      store.menuAddParentSingle();
      return;
    }
    if (e.key.toLowerCase() === 'i') {
      e.preventDefault();
      store.menuToggleNest();
      return;
    }
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (store.navigateFutureEdgeCells && store.activeGapPath) {
        if (e.key === 'ArrowDown') store.compactVerticalMove(1);
        else if (e.key === 'ArrowUp') store.compactVerticalMove(-1);
        else if (e.key === 'ArrowRight') store.compactHorizontalMove(1);
        else if (e.key === 'ArrowLeft') store.compactHorizontalMove(-1);
        return;
      }
      if (e.key === 'ArrowDown' && store.tryEnterChild(e.shiftKey)) return;
      if (store.navigateFutureEdgeCells) {
        if (e.key === 'ArrowDown') {
          store.compactVerticalMove(1);
          return;
        }
        if (e.key === 'ArrowUp') {
          store.compactVerticalMove(-1);
          return;
        }
        if (e.key === 'ArrowRight') {
          store.compactHorizontalMove(1);
          return;
        }
        if (e.key === 'ArrowLeft') {
          store.compactHorizontalMove(-1);
          return;
        }
      } else if (store.activeGapPath) {
        store.activeGapPath = null;
      }
      if (e.key === 'ArrowUp' && store.tryExitToParent(e.shiftKey)) return;
      const dir: 1 | -1 = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      store.moveLinear(dir, e.shiftKey);
    }
  
}
