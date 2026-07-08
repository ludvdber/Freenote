import { create } from 'zustand';

/**
 * Ouverture de la palette de recherche globale (⌘K / Ctrl+K). Store minuscule découplé
 * du Router — même pattern que useAuthPromptStore — pour que la Navbar, le menu mobile
 * ou n'importe quel CTA puisse l'ouvrir sans prop drilling.
 */
interface CommandPaletteState {
  open: boolean;
  show: () => void;
  close: () => void;
  toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
