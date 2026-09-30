import { CellData, GridData } from './types';

export interface CellCoord {
  prefix: string;
  r: number;
  c: number;
}

export function parseCellPath(path: string): CellCoord | null {
  const m = path.match(/^(.*)_r(\d+)c(\d+)$/);
  return m ? { prefix: m[1], r: parseInt(m[2], 10), c: parseInt(m[3], 10) } : null;
}

export function makeCellPath(prefix: string, r: number, c: number): string {
  return `${prefix}_r${r}c${c}`;
}

export interface GapCoord {
  prefix: string;
  type: 'row' | 'col';
  index: number;
  row?: number;
}

export function parseGapPath(gapPath: string): GapCoord | null {
  const colMatch = gapPath.match(/^(.*)_r(\d+)_colgap(\d+)$/);
  if (colMatch) {
    return { prefix: colMatch[1], type: 'col', row: parseInt(colMatch[2], 10), index: parseInt(colMatch[3], 10) };
  }
  const rowMatch = gapPath.match(/^(.*)_gap(\d+)$/);
  if (rowMatch) {
    return { prefix: rowMatch[1], type: 'row', index: parseInt(rowMatch[2], 10) };
  }
  return null;
}

export function newEmptyCell(): CellData {
  return { text: '', subgrid: null, childrenHidden: false };
}

export function newEmptyGrid(): GridData {
  return { rows: [{ cells: [newEmptyCell()] }] };
}

export function getCellByPath(grid: GridData, targetPath: string, prefix = 'root'): CellData | null {
  let found: CellData | null = null;
  grid.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      const path = makeCellPath(prefix, r, c);
      if (targetPath === path) found = cell;
      else if (cell.subgrid && targetPath.startsWith(path)) {
        const res = getCellByPath(cell.subgrid, targetPath, path);
        if (res) found = res;
      }
    })
  );
  return found;
}

export function findGridContainingPath(
  grid: GridData,
  targetPath: string,
  prefix: string
): { grid: GridData } | null {
  let found: { grid: GridData } | null = null;
  grid.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      const path = makeCellPath(prefix, r, c);
      if (targetPath === path) found = { grid };
      else if (cell.subgrid && targetPath.startsWith(path)) {
        const res = findGridContainingPath(cell.subgrid, targetPath, path);
        if (res) found = res;
      }
    })
  );
  return found;
}

export interface GridAndOwner {
  grid: GridData;
  ownerCell: CellData | null;
  ownerCellPath: string | null;
}

export function findGridAndOwner(
  grid: GridData,
  targetPath: string,
  prefix: string,
  owner: CellData | null = null,
  ownerPath: string | null = null
): GridAndOwner | null {
  let found: GridAndOwner | null = null;
  grid.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      const path = makeCellPath(prefix, r, c);
      if (targetPath === path) found = { grid, ownerCell: owner, ownerCellPath: ownerPath };
      else if (cell.subgrid && targetPath.startsWith(path)) {
        const res = findGridAndOwner(cell.subgrid, targetPath, path, cell, path);
        if (res) found = res;
      }
    })
  );
  return found;
}

export function getAllCellPaths(grid: GridData, prefix = 'root'): string[] {
  let paths: string[] = [];
  grid.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      const cp = makeCellPath(prefix, r, c);
      paths.push(cp);
      if (cell.subgrid && !cell.childrenHidden) paths = paths.concat(getAllCellPaths(cell.subgrid, cp));
    })
  );
  return paths;
}

export function pruneEmptyRowsCols(grid: GridData): void {
  grid.rows = grid.rows.filter((row) => !row.cells.every((cell) => !cell.text && !cell.subgrid));
  if (grid.rows.length === 0) {
    grid.rows.push({ cells: [newEmptyCell()] });
  }
  const colCount = grid.rows[0].cells.length;
  const colsToKeep = new Set<number>();
  grid.rows.forEach((row) => {
    row.cells.forEach((cell, c) => {
      if (cell.text || cell.subgrid) colsToKeep.add(c);
    });
  });
  const keep = colsToKeep.size === 0 ? new Set([0]) : colsToKeep;
  if (keep.size < colCount) {
    grid.rows.forEach((row) => {
      row.cells = row.cells.filter((_, c) => keep.has(c));
    });
  }
  grid.rows.forEach((row) => {
    row.cells.forEach((cell) => {
      if (cell.subgrid) pruneEmptyRowsCols(cell.subgrid);
    });
  });
}

/** Calculates a rectangular multi-select range between two cell paths in the same grid. */
export function calculateRangeSelection(start: string, end: string): Set<string> {
  const c1 = parseCellPath(start);
  const c2 = parseCellPath(end);
  if (!c1 || !c2 || c1.prefix !== c2.prefix) return new Set([start, end]);
  const newSet = new Set<string>();
  for (let r = Math.min(c1.r, c2.r); r <= Math.max(c1.r, c2.r); r++) {
    for (let c = Math.min(c1.c, c2.c); c <= Math.max(c1.c, c2.c); c++) {
      newSet.add(makeCellPath(c1.prefix, r, c));
    }
  }
  return newSet;
}
