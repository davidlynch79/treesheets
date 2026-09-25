import { createContext, useContext, useSyncExternalStore } from 'react';
import { TreeSheetStore } from './store';

const StoreContext = createContext<TreeSheetStore | null>(null);

export const StoreProvider = StoreContext.Provider;

/**
 * Subscribes the calling component to the store's version counter, so it re-renders
 * whenever any store mutation calls `notify()`. Returns the live store instance;
 * read fields directly off it (e.g. `store.rootData`, `store.activePath`).
 */
export function useStore(): TreeSheetStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within a StoreProvider');
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  return store;
}
