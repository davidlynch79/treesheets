export interface CellData {
  text: string;
  color: string;
  subgrid: GridData | null;
  childrenHidden: boolean;
  disableColors: boolean;
}

export interface RowData {
  cells: CellData[];
}

export interface GridData {
  rows: RowData[];
}

export type DragModifier = '' | 'x' | 'c';

export type DropMode = 'child' | 'row-before' | 'row-after' | 'col-before' | 'col-after';

export interface ClipboardEntry {
  path: string;
  cell: CellData;
}

export interface SettingsExport {
  treeScale: number;
  fontSize: number;
  menuWidth: number;
  helpWidth: number;
  globalPadding: number;
  lightMode: boolean;
  showGridLines: boolean;
  enterNextCell: boolean;
  enterAddCellAtEnd: boolean;
  enterAddSibling: boolean;
  navigateFutureEdgeCells: boolean;
  helpPanelOpen: boolean;
  compactGaps: boolean;
}
