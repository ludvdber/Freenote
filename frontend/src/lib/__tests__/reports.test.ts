import { describe, it, expect } from 'vitest';
import { REPORT_TYPES, RESOLUTIONS, reportTypeMeta, suggestedResolution } from '../reports';

describe('reportTypeMeta', () => {
  it('retourne les métadonnées du type demandé', () => {
    expect(reportTypeMeta('SUPPRESSION')).toMatchObject({ id: 'SUPPRESSION', color: 'error' });
  });

  // Un type inconnu peut arriver d'un client plus ancien ou d'une donnée héritée (avant V19,
  // tous les signalements étaient du texte libre) : la file admin ne doit pas planter dessus.
  it('retombe sur AUTRE pour une valeur inconnue, nulle ou vide', () => {
    expect(reportTypeMeta('N_IMPORTE_QUOI').id).toBe('AUTRE');
    expect(reportTypeMeta(null).id).toBe('AUTRE');
    expect(reportTypeMeta(undefined).id).toBe('AUTRE');
    expect(reportTypeMeta('').id).toBe('AUTRE');
  });

  it("n'a ni doublon ni trou d'identifiant", () => {
    const ids = REPORT_TYPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // L'ordre porte du sens : c'est l'ordre d'affichage, du plus urgent au plus anodin.
  it('place les types urgents avant les anodins', () => {
    const ids = REPORT_TYPES.map((r) => r.id);
    expect(ids.indexOf('SUPPRESSION')).toBeLessThan(ids.indexOf('DOUBLON'));
    expect(ids[ids.length - 1]).toBe('AUTRE');
  });
});

describe('suggestedResolution', () => {
  it('propose la correction pour un problème de métadonnées', () => {
    expect(suggestedResolution('METADONNEES')).toBe('EDITED');
    expect(suggestedResolution('AMELIORATION')).toBe('EDITED');
  });

  it('propose le retrait de vérification pour un contenu périmé ou faux', () => {
    expect(suggestedResolution('OBSOLETE')).toBe('UNVERIFIED');
    expect(suggestedResolution('ERREUR')).toBe('UNVERIFIED');
    expect(suggestedResolution('DOUBLON')).toBe('UNVERIFIED');
  });

  it('ne pré-coche JAMAIS la suppression — elle se décide, elle ne se subit pas', () => {
    const all = [...REPORT_TYPES.map((r) => r.id), 'INCONNU', null, undefined];
    for (const type of all) {
      expect(suggestedResolution(type)).not.toBe('DELETED');
    }
  });

  it('retombe sur « rien à changer » pour un type inconnu', () => {
    expect(suggestedResolution('INCONNU')).toBe('NO_ACTION');
  });
});

describe('RESOLUTIONS', () => {
  // `acts` distingue une décision qui touche vraiment au document d'un simple rangement de file :
  // c'est ce que l'ancienne paire Résoudre/Rejeter (deux no-op identiques) ne disait pas.
  it('marque comme agissantes exactement les résolutions qui modifient le document', () => {
    const acting = RESOLUTIONS.filter((r) => r.acts).map((r) => r.id);
    expect(acting.sort()).toEqual(['DELETED', 'UNVERIFIED']);
  });

  it('marque la suppression comme destructive, et elle seule', () => {
    const destructive = RESOLUTIONS.filter((r) => r.destructive).map((r) => r.id);
    expect(destructive).toEqual(['DELETED']);
  });

  // REJECTED est rendu à part dans le dialogue (c'est un « non » plutôt qu'une action) —
  // il ne doit pas figurer deux fois dans la liste des choix.
  it('ne contient pas REJECTED', () => {
    expect(RESOLUTIONS.map((r) => r.id)).not.toContain('REJECTED');
  });
});
