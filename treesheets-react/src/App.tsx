import { useEffect, useMemo } from 'react';
import { StoreProvider, useStore } from './StoreContext';
import { TreeSheetStore } from './store';
import { GridNode } from './components/GridNode';
import { HelpPanel } from './components/HelpPanel';
import { Toolbar } from './components/Toolbar';
import { Footer } from './components/Footer';

function Workspace() {
  const store = useStore();

  return (
    <main
      id="workspace"
      tabIndex={0}
      className="flex-1 overflow-auto p-6 bg-dark-bg flex justify-start items-start focus:outline-none relative"
    >
      <div className="transition-transform duration-75 origin-top-left" style={{ transform: `scale(${store.treeScale / 100})` }}>
        <div id="grid-root" className="shadow-2xl rounded-md border border-dark-border bg-dark-surface p-2 inline-block shrink-0">
          <GridNode gridData={store.rootData} prefix="root" isRoot />
        </div>
      </div>
    </main>
  );
}

function AppShell() {
  const store = useStore();

  // Apply the selected theme attribute to <html> so CSS variables update globally.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', store.blackMode ? 'black' : store.lightMode ? 'light' : 'dark');
  }, [store.blackMode, store.lightMode]);

  // Global keyboard handling, ported from the original window keydown listener.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ae = document.getElementById('active-textarea');
      const isTyping = !!ae && document.activeElement === ae;
      store.handleGlobalKeyDown(e, isTyping);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-dark-bg text-dark-text h-screen flex flex-col overflow-hidden select-none font-sans text-sm relative">
      <div className="flex-1 flex overflow-hidden relative">
        <Workspace />
        <HelpPanel />
      </div>
      <Footer />
      <Toolbar />
    </div>
  );
}

export default function App() {
  const store = useMemo(() => new TreeSheetStore(), []);
  return (
    <StoreProvider value={store}>
      <AppShell />
    </StoreProvider>
  );
}
