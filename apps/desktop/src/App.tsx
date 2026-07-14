/** Raíz de la aplicación: arranque, atajos globales y layout. */
import { useEffect } from 'react';

import { pagesApi } from './services/api';
import { useAppStore } from './stores/appStore';
import { EmptyState, Toasts } from './components/ui';
import { PageView } from './components/PageView';
import { SearchPalette } from './components/SearchPalette';
import { Sidebar } from './components/Sidebar';
import { WelcomeScreen } from './components/WelcomeScreen';

export function App() {
  const {
    booted,
    workspace,
    currentPageId,
    boot,
    setPaletteOpen,
    goBack,
    goForward,
    navigate,
    refreshTree,
    notifyError,
  } = useAppStore();

  useEffect(() => {
    void boot();
  }, [boot]);

  // Atajos globales (PRD R4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'k' || e.key === 'p')) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (mod && e.key === 'n') {
        e.preventDefault();
        if (useAppStore.getState().workspace) {
          void pagesApi
            .create(null, '')
            .then(async (p) => {
              await refreshTree();
              await navigate(p.id);
            })
            .catch((err) => notifyError(err, 'No se pudo crear la página'));
        }
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen, goBack, goForward, navigate, refreshTree, notifyError]);

  if (!booted) {
    return (
      <div className="nd-empty">
        <div className="nd-spinner" aria-label="Cargando Nodora" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <>
        <WelcomeScreen />
        <Toasts />
      </>
    );
  }

  return (
    <div className="nd-app">
      <Sidebar />
      {currentPageId ? (
        <PageView key={currentPageId} pageId={currentPageId} />
      ) : (
        <div className="nd-main">
          <EmptyState emoji="🗂️" title="Elige o crea una página">
            <p>
              Usa la barra lateral o pulsa <span className="nd-kbd">Ctrl K</span> para buscar.
            </p>
          </EmptyState>
        </div>
      )}
      <SearchPalette />
      <Toasts />
    </div>
  );
}
