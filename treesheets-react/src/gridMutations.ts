import type { TreeSheetStore } from './store';
import type { CellData, DragModifier, DropMode, GridData } from './types';
import { calculateRangeSelection, findGridAndOwner, findGridContainingPath, getAllCellPaths, getCellByPath, newEmptyCell, newEmptyGrid, pruneEmptyRowsCols } from './treeUtils';

export function menuClearCell(store: TreeSheetStore): void {
    store.saveState();
    store.selectedPaths.forEach((path) => {
      const cell = getCellByPath(store.rootData, path);
      if (!cell) return;
      if (cell.text) {
        cell.text = '';
      } else {
        const info = findGridContainingPath(store.rootData, path, 'root');
        const m = path.match(/^(.*)_r(\d+)c(\d+)$/);
        if (info && info.grid && m) {
          const prefix = m[1];
          const r = parseInt(m[2], 10);
          const c = parseInt(m[3], 10);
          const grid = info.grid;
          if (grid.rows[r].cells.length > 1) {
            grid.rows[r].cells.splice(c, 1);
            const newC = Math.max(0, c - 1);
            store.activePath = `${prefix}_r${r}c${newC}`;
          } else if (grid.rows.length > 1) {
            grid.rows.splice(r, 1);
            const newR = Math.max(0, r - 1);
            store.activePath = `${prefix}_r${newR}c0`;
          } else {
            grid.rows[0].cells[0] = newEmptyCell();
            store.activePath = `${prefix}_r0c0`;
          }
        }
      }
    });
    store.selectedPaths = new Set([store.activePath]);
    store.isEditing = false;
    store.notify();
  
}

export function menuPruneCellGrid(store: TreeSheetStore): void {
    store.saveState();
    const info = findGridContainingPath(store.rootData, store.activePath, 'root');
    if (info && info.grid) {
      pruneEmptyRowsCols(info.grid);
      store.activePath = 'root_r0c0';
      store.selectedPaths = new Set([store.activePath]);
      store.isEditing = false;
      store.notify();
    }
  
}

export function menuPruneEntireTree(store: TreeSheetStore): void {
    store.saveState();
    pruneEmptyRowsCols(store.rootData);
    store.activePath = 'root_r0c0';
    store.selectedPaths = new Set([store.activePath]);
    store.isEditing = false;
    store.notify();
  
}

export function menuToggleNest(store: TreeSheetStore): void {
    store.saveState();
    const cell = getCellByPath(store.rootData, store.activePath);
    if (!cell) return;
    if (cell.subgrid) {
      if (confirm('Remove sub-grid?')) cell.subgrid = null;
    } else {
      cell.subgrid = { rows: [{ cells: [newEmptyCell()] }] };
      store.activePath += '_r0c0';
      store.selectedPaths = new Set([store.activePath]);
    }
    store.isEditing = false;
    store.notify();
  
}

export function menuTransposeGrid(store: TreeSheetStore): void {
    store.saveState();
    const cell = getCellByPath(store.rootData, store.activePath);
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
    store.notify();
  
}

export function menuAddParent(store: TreeSheetStore): void {
    store.saveState();
    const info = findGridAndOwner(store.rootData, store.activePath, 'root');
    if (info && info.ownerCell) {
      info.ownerCell.subgrid = { rows: [{ cells: [{ text: '', subgrid: info.ownerCell.subgrid, childrenHidden: false }] }] };
      store.activePath = info.ownerCellPath!;
    } else {
      store.rootData = { rows: [{ cells: [{ text: '', subgrid: store.rootData, childrenHidden: false }] }] };
      store.activePath = 'root_r0c0';
    }
    store.selectedPaths = new Set([store.activePath]);
    store.isEditing = false;
    store.notify();
  
}

export function menuAddParentSingle(store: TreeSheetStore): void {
    store.saveState();
    const info = findGridContainingPath(store.rootData, store.activePath, 'root');
    const m = store.activePath.match(/_r(\d+)c(\d+)$/);
    if (!info || !m) return;
    const r = parseInt(m[1], 10);
    const c = parseInt(m[2], 10);
    const oldCell = info.grid.rows[r].cells[c];
    info.grid.rows[r].cells[c] = { text: '', subgrid: { rows: [{ cells: [oldCell] }] }, childrenHidden: false };
    store.selectedPaths = new Set([store.activePath]);
    store.isEditing = false;
    store.notify();
  
}

export function insertSiblingAtGap(store: TreeSheetStore, gapPath: string): void {
    const m = gapPath.match(/^(.*)_gap(\d+)$/);
    if (!m) return;
    const grid = store.getGridByPrefix(m[1]);
    if (!grid) return;
    store.saveState();
    const cols = grid.rows[0] ? grid.rows[0].cells.length : 1;
    const newCells = Array.from({ length: cols }, () => newEmptyCell());
    grid.rows.splice(parseInt(m[2], 10), 0, { cells: newCells });
    store.activeGapPath = null;
    store.activePath = `${m[1]}_r${m[2]}c0`;
    store.selectedPaths = new Set([store.activePath]);
    store.isEditing = true;
    store.notify();
  
}

export function insertColumnAtGap(store: TreeSheetStore, gapPath: string): void {
    const m = gapPath.match(/^(.*)_r(\d+)_colgap(\d+)$/);
    if (!m) return;
    const grid = store.getGridByPrefix(m[1]);
    if (!grid) return;
    store.saveState();
    const colIdx = parseInt(m[3], 10);
    grid.rows.forEach((r) => r.cells.splice(colIdx, 0, newEmptyCell()));
    store.activeGapPath = null;
    store.activePath = `${m[1]}_r${m[2]}c${colIdx}`;
    store.selectedPaths = new Set([store.activePath]);
    store.isEditing = true;
    store.notify();
  
}

export function menuAddRow(store: TreeSheetStore): void {
    store.saveState();
    const info = findGridContainingPath(store.rootData, store.activePath, 'root');
    if (info && info.grid) {
      const cols = info.grid.rows[0] ? info.grid.rows[0].cells.length : 1;
      info.grid.rows.push({ cells: Array.from({ length: cols }, () => newEmptyCell()) });
      store.notify();
    }
  
}

export function menuAddCol(store: TreeSheetStore): void {
    store.saveState();
    const info = findGridContainingPath(store.rootData, store.activePath, 'root');
    if (info && info.grid) {
      info.grid.rows.forEach((r) => r.cells.push(newEmptyCell()));
      store.notify();
    }
  
}

export function menuDelRow(store: TreeSheetStore): void {
    store.saveState();
    const info = findGridContainingPath(store.rootData, store.activePath, 'root');
    const m = store.activePath.match(/_r(\d+)c\d+$/);
    if (info && info.grid && info.grid.rows.length > 1 && m) {
      const rIdx = parseInt(m[1], 10);
      info.grid.rows.splice(rIdx, 1);
      const newR = Math.max(0, rIdx - 1);
      const mPrefix = store.activePath.match(/^(.*)_r\d+c\d+$/);
      store.activePath = mPrefix ? `${mPrefix[1]}_r${newR}c0` : 'root_r0c0';
      store.selectedPaths = new Set([store.activePath]);
      store.isEditing = false;
      store.notify();
    }
  
}

export function menuDelCol(store: TreeSheetStore): void {
    store.saveState();
    const info = findGridContainingPath(store.rootData, store.activePath, 'root');
    const m = store.activePath.match(/_r\d+c(\d+)$/);
    if (info && info.grid && info.grid.rows[0].cells.length > 1 && m) {
      const cIdx = parseInt(m[1], 10);
      info.grid.rows.forEach((r) => r.cells.splice(cIdx, 1));
      const newC = Math.max(0, cIdx - 1);
      const mPrefix = store.activePath.match(/^(.*)_r\d+c\d+$/);
      store.activePath = mPrefix ? `${mPrefix[1]}_r0c${newC}` : 'root_r0c0';
      store.selectedPaths = new Set([store.activePath]);
      store.isEditing = false;
      store.notify();
    }
  
}

export function handleDrop(store: TreeSheetStore, targetCellPath: string, draggedPaths: string[], modifier: DragModifier, dropMode: DropMode): void {
    if (draggedPaths.includes(targetCellPath)) return;
    store.saveState();
    const draggedCells = draggedPaths
      .map((p) => {
        const c = getCellByPath(store.rootData, p);
        return c ? (JSON.parse(JSON.stringify(c)) as CellData) : null;
      })
      .filter((c): c is CellData => !!c);
    if (!draggedCells.length) return;

    const cell = getCellByPath(store.rootData, targetCellPath);
    const info = findGridContainingPath(store.rootData, targetCellPath, 'root');
    const targetMatch = targetCellPath.match(/_r(\d+)c(\d+)$/);
    const isCut = store.activeDragModifier === 'x' || (modifier === 'x' && store.activeDragModifier !== 'c');

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

    if (isCut || store.activeDragModifier === '') {
      draggedPaths.forEach((p) => {
        const c = getCellByPath(store.rootData, p);
        if (c) {
          c.text = '';
          c.subgrid = null;
          c.childrenHidden = false;
        }
      });
    }

    store.activePath = targetCellPath;
    store.selectedPaths = new Set([store.activePath]);
    store.activeGapPath = null;
    store.isEditing = false;
    store.notify();
  
}
