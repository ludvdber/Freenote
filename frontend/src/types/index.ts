export type AvatarSource = 'AUTO' | 'LETTER' | 'DICEBEAR' | 'DISCORD';

export interface User {
  id: number;
  username: string;
  role: string | null;
  verified: boolean;
  /** Trusted uploader — bypasses upload rate limits (admin-granted). */
  trusted?: boolean;
  xp: number;
  bio: string | null;
  website: string | null;
  github: string | null;
  linkedin: string | null;
  discord: string | null;
  documentCount: number;
  profilePublic: boolean;
  showInCarousel: boolean;
  supporter: boolean;
  termsAccepted: boolean;
  avatarUrl: string | null;
  avatarSource: AvatarSource;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  displayRealName: boolean;
  sectionId: number | null;
  sectionName: string | null;
  usernameChosen: boolean;
  /** Raw Discord avatar URL, present only on the own-profile response — lets the avatar picker
   *  preview the "Photo Discord" option even when another source is currently active. */
  discordAvatarUrl: string | null;
  /** Parcours à l'ISFCE, affiché publiquement si renseigné (badge « Promo {endYear} »). */
  studyStartYear: number | null;
  studyEndYear: number | null;
  graduated: boolean;
  /** Palette d'accent (perk supporters) — null quand l'entitlement a expiré ou jamais choisi. */
  accentPalette: string | null;
  /** Peut choisir une palette : sans-pub actif (don OU grant admin) ou supporter à vie. */
  paletteEntitled: boolean;
  /** Flag brut « palettes à vie » (don ≥ 5 € ou grant admin) — pour le toggle admin. */
  lifetimeSupporter: boolean;
}

export interface DocumentResponse {
  id: number;
  title: string;
  courseId: number;
  courseName: string;
  sectionName: string;
  category: string;
  authorName: string;
  authorId: number | null;
  verified: boolean;
  aiGenerated: boolean;
  language: string;
  year: string | null;
  professorName: string | null;
  averageRating: number;
  /** Nombre de votes — 0 = ne pas afficher d'étoiles (des ☆☆☆☆☆ se lisent comme « note 0 »). */
  ratingCount: number;
  downloadCount: number;
  /** Avatar résolu de l'uploader (null : doc anonyme ou avatar « lettre »). */
  authorAvatarUrl: string | null;
  createdAt: string;
}

/** Compte à rebours de la home (rentrée…) — date null = désactivé. */
export interface CountdownResponse {
  date: string | null;
  label: string | null;
}

/** Voisins précédent/suivant d'un doc dans son cours (navigation de la page document). */
export interface AdjacentDocRef {
  id: number;
  title: string;
}

export interface AdjacentDocumentsResponse {
  previous: AdjacentDocRef | null;
  next: AdjacentDocRef | null;
}

export interface Section {
  id: number;
  name: string;
  icon: string | null;
  documentCount: number;
  approved: boolean;
}

export interface Course {
  id: number;
  name: string;
  sectionId: number;
  sectionName: string;
  documentCount: number;
  approved: boolean;
  /** Groupe d'équivalence V15 (même cours dans plusieurs sections) — null = non lié. */
  equivalenceGroup: number | null;
}

export interface StatsResponse {
  totalDocs: number;
  totalDownloads: number;
  totalContributors: number;
  totalCourses: number;
  weekUploads: number;
  /** Docs par section (plus actives d'abord) — nourrit la constellation du hero. */
  sections: SectionStat[];
}

export interface SectionStat {
  name: string;
  documentCount: number;
}

/** Tuiles du profil public (GET /users/:id/stats). */
export interface UserStats {
  totalViews: number;
  avgRatingReceived: number | null;
  /** Vues de la page profil (compteur anonyme, dédup 24 h par visiteur). */
  profileViews: number;
}

// --- Panel admin : tableau de bord + analytics ---

/** value = période courante, previous = période précédente (delta calculé côté client). */
export interface KpiPair {
  value: number;
  previous: number;
}

export interface AdminOverviewResponse {
  pendingDocs: number;
  pendingReports: number;
  duplicateGroups: number;
  visits7d: KpiPair;
  docViews7d: KpiPair;
  quizPlays7d: KpiPair;
  signups7d: KpiPair;
  activity14d: { day: string; visits: number; docViews: number; quizPlays: number }[];
}

export interface AnalyticsResponse {
  days: number;
  visits: KpiPair;
  docViews: KpiPair;
  quizPlays: KpiPair;
  guideReads: KpiPair;
  toolUses: KpiPair;
  signups: KpiPair;
  visitsByDay: { day: string; count: number }[];
  /* id : renseigné pour les tops quiz/docs (liens cliquables), null pour le tracking (slugs). */
  sources: { label: string; count: number; id: number | null }[];
  topTools: { label: string; count: number; id: number | null }[];
  topGuides: { label: string; count: number; id: number | null }[];
  topQuizzes: { label: string; count: number; id: number | null }[];
  topDocs: { label: string; count: number; id: number | null }[];
}

export interface LeaderboardEntry {
  userId: number;
  rank: number;
  username: string;
  displayName: string;
  xp: number;
  documentCount: number;
  supporter: boolean;
  avatarUrl: string | null;
  /** Parcours ISFCE + rôle communautaire, pour les badges (Promo / Délégué / Ancien délégué). */
  graduated: boolean;
  studyEndYear: number | null;
  delegate: boolean;
  formerDelegate: boolean;
}

export interface DelegateMember {
  id: number;
  userId: number | null;
  displayName: string | null;
  username: string;
  discord: string | null;
  startDate: string;
  endDate: string | null;
}

export interface DelegateResponse {
  sectionName: string;
  sectionColor: string | null;
  members: DelegateMember[];
}

export interface DelegateHistoryResponse {
  id: number;
  sectionName: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
}

export interface AssignDelegateRequest {
  userId: number;
  sectionId: number;
  startDate: string;
}

export interface EndDelegateRequest {
  endDate: string;
}

export interface UpdateDelegateRequest {
  startDate?: string;
  endDate?: string | null;
  clearEndDate?: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  date: string | null;
  labels: string[];
  url: string | null;
  content: string | null;
  thumbnail: string | null;
}

export interface ProfileCardResponse {
  /** Pour le lien « Voir le profil » du popup carrousel (/users/{id}). */
  id: number;
  username: string;
  displayName: string;
  role: string;
  discord: string | null;
  github: string | null;
  linkedin: string | null;
  supporter: boolean;
  avatarUrl: string | null;
}

export interface ErrorResponse {
  status: number;
  message: string;
  timestamp: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface UpdateDocumentRequest {
  title?: string;
  courseId?: number;
  category?: string;
  language?: string;
  year?: string;
  professorId?: number;
  verified?: boolean;
}

export interface CreateDocumentRequest {
  title: string;
  courseId: number;
  category: string;
  year?: string;
  professorId?: number;
  language: string;
  aiGenerated: boolean;
  anonymous: boolean;
}

export interface ActivityLog {
  id: number;
  type: string;
  actorId: number | null;
  actorName: string | null;
  message: string | null;
  createdAt: string;
}

export interface UpdateProfileRequest {
  bio?: string;
  website?: string;
  github?: string;
  linkedin?: string;
  discord?: string;
  profilePublic: boolean;
  showInCarousel: boolean;
  avatarSource?: AvatarSource;
  firstName?: string;
  lastName?: string;
  displayRealName: boolean;
  studyStartYear?: number | null;
  studyEndYear?: number | null;
  graduated: boolean;
  /** Palette d'accent — '' = thème par défaut, id = réservé aux supporters (403 sinon). */
  accentPalette?: string;
}

export interface RateRequest {
  score: number;
}

export interface ReportRequest {
  reason: string;
}

export interface CreateCourseRequest {
  name: string;
  sectionId: number;
}

export interface Professor {
  id: number;
  name: string;
}

export interface ReportResponse {
  id: number;
  documentId: number;
  documentTitle: string;
  reporterUsername: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface DonationResponse {
  id: number;
  userId: number | null;
  username: string | null;
  amount: number;
  kofiTransactionId: string;
  adFreeUntil: string | null;
  /** Message Ko-fi (peut contenir le code « FN-… ») — aide au rattachement manuel. */
  message: string | null;
  createdAt: string;
}

/** Thermomètre de financement — monthlyCost null = jauge désactivée. */
export interface FundingResponse {
  monthlyCost: number | null;
  monthTotal: number | null;
  /** Donateurs distincts du mois (dons rattachés, montant > 0). */
  donorCount: number | null;
}

export type Category = 'SYNTHESE' | 'EXAMEN' | 'NOTES' | 'EXERCICES' | 'COURS' | 'TFE' | 'DIVERS';

// --- Shared flashcard decks (palier C) ---
export interface FlashcardCardDto {
  front: string;
  back: string;
}

export interface PublishDeckRequest {
  title: string;
  description?: string | null;
  courseId?: number | null;
  /** Section visee pour un paquet multi-cours (ignoree si courseId est fourni). */
  sectionId?: number | null;
  cards: FlashcardCardDto[];
  /** true = bibliotheque partagee ; false/absent = enregistrement prive (compte seul). */
  published: boolean;
}

export interface FlashcardDeckSummary {
  id: number;
  title: string;
  description: string | null;
  cardCount: number;
  ownerName: string;
  courseId: number | null;
  courseName: string | null;
  /** Section visee (V13) — renseignee aussi quand elle derive du cours. */
  sectionId: number | null;
  sectionName: string | null;
  createdAt: string;
  published: boolean;
  /** Calcule pour l'appelant — pilote les actions editer/supprimer. */
  owned: boolean;
}

export interface FlashcardDeckResponse extends FlashcardDeckSummary {
  cards: FlashcardCardDto[];
}

// --- Shared quizzes ---
export interface QuizQuestionDto {
  type: 'mcq' | 'open';
  question: string;
  /** MCQ choices. */
  choices: string[];
  /** MCQ: 0-based index of the correct choice (absent pour une question ouverte). */
  answer?: number | null;
  /** Open question: the expected answer. */
  openAnswer?: string;
  /** Base64 data URI (published quizzes only). */
  image?: string | null;
  code?: string | null;
  language?: string | null;
  /** Explication optionnelle, revelee uniquement sur l'ecran de review apres correction. */
  explanation?: string | null;
}

export interface CreateQuizRequest {
  title: string;
  description?: string | null;
  courseId?: number | null;
  /** Section visee pour un quiz multi-cours (ignoree si courseId est fourni). */
  sectionId?: number | null;
  questions: QuizQuestionDto[];
  /** true = bibliotheque partagee (jouable + classement) ; false = enregistrement prive. */
  published: boolean;
}

export interface SubmitAttemptRequest {
  /** Player's answer per question as a string (MCQ chosen index, or open text); null = skipped. */
  answers: (string | null)[];
  durationMs: number;
}

export interface QuizSummary {
  id: number;
  title: string;
  description: string | null;
  questionCount: number;
  attemptCount: number;
  ownerName: string;
  courseId: number | null;
  courseName: string | null;
  /** Section visee (V13) — renseignee aussi quand elle derive du cours. */
  sectionId: number | null;
  sectionName: string | null;
  createdAt: string;
  published: boolean;
  /** Calcule pour l'appelant — pilote les actions editer/supprimer. */
  owned: boolean;
}

/** Vue complete d'un quiz, REPONSES INCLUSES — edition (proprietaire) ou import (quiz publie). */
export interface QuizFullResponse {
  id: number;
  title: string;
  description: string | null;
  courseId: number | null;
  courseName: string | null;
  sectionId: number | null;
  sectionName: string | null;
  published: boolean;
  owned: boolean;
  createdAt: string;
  questions: QuizQuestionDto[];
}

/** A question served for playing — WITHOUT the graded answer (server grades on submit). */
export interface QuizPlayQuestion {
  type: 'mcq' | 'open';
  question: string;
  choices: string[];
  image?: string | null;
  code?: string | null;
  language?: string | null;
}

export interface QuizPlayResponse {
  id: number;
  title: string;
  description: string | null;
  /** Cours rattaché (nullable) — alimente le « Continue avec… » de l'écran de fin. */
  courseId: number | null;
  questions: QuizPlayQuestion[];
}

export interface AttemptResultResponse {
  score: number;
  total: number;
  durationMs: number;
  /** Per-question right/wrong — revealed only after submitting, for review. */
  correct: boolean[];
  /** Per-question display text of the correct answer. */
  correctAnswers: string[];
  /** Explication de l'auteur par question (null si aucune) — ecran de review. */
  explanations: (string | null)[];
  rank: number;
}

export interface QuizLeaderboardEntry {
  rank: number;
  userId: number;
  userName: string;
  /** Identifiant technique brut — seed stable de l'avatar (convention UserAvatar). */
  username: string;
  /** Avatar résolu (null = cercle-lettre côté client), pour la ligne décorée du classement. */
  avatarUrl: string | null;
  score: number;
  total: number;
  durationMs: number;
  achievedAt: string;
}

// --- Guides (admin-authored tutorials, public) ---
export interface GuideSummary {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  /** Slug d'un outil /outils mis en avant par le guide (optionnel — V12). */
  relatedTool: string | null;
  authorName: string;
  published: boolean;
  /** Réservé aux étudiants (V14) : contenu servi uniquement aux comptes vérifiés. */
  membersOnly: boolean;
  /** Temps de lecture estimé, calculé côté serveur (les cartes n'embarquent pas le Markdown). */
  readMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface GuideResponse extends Omit<GuideSummary, 'readMinutes'> {
  /** Raw Markdown — rendered + sanitised on the client. NULL quand le guide est membersOnly et
   *  l'appelant non vérifié : la page affiche alors le panneau « réservé aux étudiants ». */
  content: string | null;
}

export interface CreateGuideRequest {
  title: string;
  summary: string;
  content: string;
  category: string;
  relatedTool: string;
  published: boolean;
  membersOnly: boolean;
}

// --- Gantt charts (saved + shared, verified-only) ---
export interface GanttTaskDto {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  progress: number;
  dependencies: string | null;
  /** Travailleur assigné (nom libre), null si non assigné. */
  assignee: string | null;
}

export interface SaveGanttRequest {
  title: string;
  tasks: GanttTaskDto[];
  shared: boolean;
}

export interface GanttSummary {
  id: number;
  title: string;
  taskCount: number;
  shared: boolean;
  ownerName: string;
  updatedAt: string;
}

export interface GanttResponse {
  id: number;
  title: string;
  tasks: GanttTaskDto[];
  shared: boolean;
  ownerName: string;
  owned: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Public catalogue teaser (anonymous, Notes/Divers only, no author/file) ---
export interface PublicDocumentSummary {
  id: number;
  title: string;
  courseName: string | null;
  sectionName: string | null;
  category: string;
  year: string | null;
  averageRating: number;
  ratingCount: number;
  createdAt: string;
}

/** Statut public minimal d'un doc hors catégories publiques : « existe mais réservé » ou inconnu. */
export interface PublicDocumentStatus {
  exists: boolean;
  title: string | null;
}

// --- Notifications (historique persisté serveur) ---
export interface NotificationItem {
  id: number;
  type: string;
  payload: Record<string, string | number>;
  read: boolean;
  createdAt: string;
}

