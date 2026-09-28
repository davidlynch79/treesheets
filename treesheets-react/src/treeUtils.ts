import { CellData, GridData } from './types';

export function newEmptyCell(): CellData {
  return { text: '', color: '', subgrid: null, childrenHidden: false, disableColors: true };
}

export function newEmptyGrid(): GridData {
  return { rows: [{ cells: [newEmptyCell()] }] };
}

export function getCellByPath(grid: GridData, targetPath: string, prefix = 'root'): CellData | null {
  let found: CellData | null = null;
  grid.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      const path = `${prefix}_r${r}c${c}`;
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
      const path = `${prefix}_r${r}c${c}`;
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
      const path = `${prefix}_r${r}c${c}`;
      if (targetPath === path) found = { grid, ownerCell: owner, ownerCellPath: ownerPath };
      else if (cell.subgrid && targetPath.startsWith(path)) {
        const res = findGridAndOwner(cell.subgrid, targetPath, path, cell, path);
        if (res) found = res;
      }
    })
  );
  return found;
}

export function updateCellByPath(grid: GridData, targetPath: string, text: string, prefix = 'root'): void {
  grid.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      const path = `${prefix}_r${r}c${c}`;
      if (targetPath === path) cell.text = text;
      else if (cell.subgrid && targetPath.startsWith(path)) updateCellByPath(cell.subgrid, targetPath, text, path);
    })
  );
}

export function applyColorByPath(grid: GridData, targetPath: string, color: string, prefix = 'root'): void {
  grid.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      const path = `${prefix}_r${r}c${c}`;
      if (targetPath === path) cell.color = color;
      else if (cell.subgrid && targetPath.startsWith(path)) applyColorByPath(cell.subgrid, targetPath, color, path);
    })
  );
}

export function getAllCellPaths(grid: GridData, prefix = 'root'): string[] {
  let paths: string[] = [];
  grid.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      const cp = `${prefix}_r${r}c${c}`;
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
  const colsToRemove: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let isColEmpty = true;
    for (let r = 0; r < grid.rows.length; r++) {
      const cell = grid.rows[r].cells[c];
      if (cell && (cell.text || cell.subgrid)) {
        isColEmpty = false;
        break;
      }
    }
    if (isColEmpty) colsToRemove.push(c);
  }
  colsToRemove.reverse().forEach((c) => {
    grid.rows.forEach((r) => {
      if (r.cells.length > 1) r.cells.splice(c, 1);
    });
  });
  grid.rows.forEach((row) => {
    row.cells.forEach((cell) => {
      if (cell.subgrid) pruneEmptyRowsCols(cell.subgrid);
    });
  });
}

/** Calculates a rectangular multi-select range between two cell paths in the same grid. */
export function calculateRangeSelection(start: string, end: string): Set<string> {
  const m1 = start.match(/^(.*)_r(\d+)c(\d+)$/);
  const m2 = end.match(/^(.*)_r(\d+)c(\d+)$/);
  if (!m1 || !m2 || m1[1] !== m2[1]) return new Set([start, end]);
  const prefix = m1[1];
  const r1 = parseInt(m1[2], 10),
    c1 = parseInt(m1[3], 10);
  const r2 = parseInt(m2[2], 10),
    c2 = parseInt(m2[3], 10);
  const newSet = new Set<string>();
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) newSet.add(`${prefix}_r${r}c${c}`);
  }
  return newSet;
}
