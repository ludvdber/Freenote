/**
 * Logique pure de la bibliothèque de révision (quiz + paquets) : périmètre par section,
 * compteurs des chips, regroupement par cours — partagée entre les onglets Bibliothèque
 * des deux outils et le hub /reviser. Modèle calqué sur les « classes » Quizlet :
 * section = classe (périmètre par défaut de l'étudiant), cours = dossier, contenu
 * multi-cours = rattaché à la section seule.
 */

/** Champs optionnels ET nullables : satisfait à la fois les summaries API (`number | null`)
 *  et les modèles locaux des outils (`number | undefined`) — les helpers normalisent via `?? null`. */
export interface RevisionLink {
  sectionId?: number | null;
  sectionName?: string | null;
  courseId?: number | null;
  courseName?: string | null;
}

/** Périmètre de la bibliothèque : toutes sections, une section, ou « sans section ». */
export type SectionScope = 'all' | 'none' | number;

export interface SectionCount {
  /** null = « sans section ». */
  id: number | null;
  name: string | null;
  count: number;
}

export interface CourseGroup<T> {
  /** null = groupe « toute la section » (multi-cours) ou éléments sans cours. */
  courseId: number | null;
  courseName: string | null;
  items: T[];
}

export interface SectionGroup<T> {
  sectionId: number | null;
  sectionName: string | null;
  items: T[];
}

/** Compteurs par section, plus fournies d'abord ; « sans section » (id null) toujours en dernier. */
export function sectionCounts<T extends RevisionLink>(items: T[]): SectionCount[] {
  const map = new Map<number | null, SectionCount>();
  for (const it of items) {
    const key = it.sectionId ?? null;
    const entry = map.get(key);
    if (entry) {
      entry.count++;
    } else {
      map.set(key, { id: key, name: it.sectionName ?? null, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return b.count - a.count;
  });
}

export function filterByScope<T extends RevisionLink>(items: T[], scope: SectionScope): T[] {
  if (scope === 'all') return items;
  if (scope === 'none') return items.filter((it) => it.sectionId == null);
  return items.filter((it) => it.sectionId === scope);
}

/** Groupes par cours d'un périmètre section : « toute la section » (cours null) D'ABORD,
 *  puis les cours par ordre alphabétique. */
export function groupByCourse<T extends RevisionLink>(items: T[]): CourseGroup<T>[] {
  const map = new Map<number | null, CourseGroup<T>>();
  for (const it of items) {
    const key = it.courseId ?? null;
    const group = map.get(key);
    if (group) {
      group.items.push(it);
    } else {
      map.set(key, { courseId: key, courseName: it.courseName ?? null, items: [it] });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.courseId === null) return -1;
    if (b.courseId === null) return 1;
    return (a.courseName ?? '').localeCompare(b.courseName ?? '', 'fr');
  });
}

/** Vue « Tout » : groupes par section (plus fournies d'abord, « sans section » en dernier). */
export function groupBySection<T extends RevisionLink>(items: T[]): SectionGroup<T>[] {
  const map = new Map<number | null, SectionGroup<T>>();
  for (const it of items) {
    const key = it.sectionId ?? null;
    const group = map.get(key);
    if (group) {
      group.items.push(it);
    } else {
      map.set(key, { sectionId: key, sectionName: it.sectionName ?? null, items: [it] });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.sectionId === null) return 1;
    if (b.sectionId === null) return -1;
    return b.items.length - a.items.length;
  });
}

/** Les 3 statuts d'un quiz/paquet local : 📱 appareil seul, ☁️ enregistré (privé), 🌍 publié. */
export type ContentStatus = 'device' | 'saved' | 'published';

export function statusOf(serverId?: number, published?: boolean): ContentStatus {
  if (!serverId) return 'device';
  return published ? 'published' : 'saved';
}

/** Recherche plein-titre insensible à la casse/aux accents, dans le périmètre courant. */
export function matchesQuery(title: string, query: string): boolean {
  if (!query.trim()) return true;
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  return norm(title).includes(norm(query.trim()));
}
