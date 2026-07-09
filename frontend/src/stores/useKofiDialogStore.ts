import type { MouseEvent } from 'react';
import { create } from 'zustand';
import { KOFI_URL } from '@/lib/constants';

/**
 * Dialog global « Soutenir Freenote » : TOUT bouton Ko-fi du site doit montrer le code personnel
 * « FN-… » avant d'envoyer vers Ko-fi (sinon le don part sans code et n'est pas rattaché au compte).
 * Même pattern que useAuthPromptStore : un seul <KofiSupportDialog/> monté à la racine, déclenchable
 * de n'importe où.
 */
interface KofiDialogState {
  open: boolean;
  show: () => void;
  close: () => void;
}

export const useKofiDialogStore = create<KofiDialogState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));

/**
 * Props à spreader sur n'importe quel lien/bouton Ko-fi : garde le `href` (clic molette, SEO),
 * mais intercepte TOUT clic pour ouvrir le dialog — code « FN-… » pour un compte vérifié, invite
 * « connecte-toi d'abord pour obtenir ton code » pour un anonyme (un don sans code n'est pas
 * rattaché au compte, il faut prévenir AVANT le départ vers Ko-fi).
 */
export function useKofiLinkProps() {
  const show = useKofiDialogStore((s) => s.show);
  return {
    href: KOFI_URL,
    target: '_blank' as const,
    rel: 'noopener noreferrer',
    onClick: (e: MouseEvent) => {
      e.preventDefault();
      show();
    },
  };
}
