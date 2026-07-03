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
  downloadCount: number;
  createdAt: string;
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
}

export interface StatsResponse {
  totalDocs: number;
  totalDownloads: number;
  totalContributors: number;
  totalCourses: number;
  weekUploads: number;
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
}

export interface ProfileCardResponse {
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
  authorName: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuideResponse extends GuideSummary {
  /** Raw Markdown — rendered + sanitised on the client. */
  content: string;
}

export interface CreateGuideRequest {
  title: string;
  summary: string;
  content: string;
  category: string;
  published: boolean;
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

