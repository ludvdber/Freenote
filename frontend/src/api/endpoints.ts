import api from './axiosInstance';
import type {
  StatsResponse,
  DocumentResponse,
  PageResponse,
  Section,
  Course,
  CourseStats,
  LeaderboardEntry,
  DelegateResponse,
  DelegateHistoryResponse,
  DelegateMember,
  UpdateDocumentRequest,
  AssignDelegateRequest,
  EndDelegateRequest,
  UpdateDelegateRequest,
  NewsItem,
  User,
  ProfileCardResponse,
  Professor,
  CreateDocumentRequest,
  CreateCourseRequest,
  UpdateProfileRequest,
  RateRequest,
  ReportRequest,
  ReportResponse,
  DonationResponse,
  ActivityLog,
  PublishDeckRequest,
  FlashcardDeckSummary,
  FlashcardDeckResponse,
  CreateQuizRequest,
  SubmitAttemptRequest,
  QuizSummary,
  QuizPlayResponse,
  QuizFullResponse,
  AttemptResultResponse,
  QuizLeaderboardEntry,
  GuideSummary,
  GuideResponse,
  CreateGuideRequest,
  PublicDocumentSummary,
  PublicDocumentStatus,
  PublicCourse,
  NotificationItem,
  GanttSummary,
  GanttResponse,
  SaveGanttRequest,
  UserStats,
  AdjacentDocumentsResponse,
  CountdownResponse,
  FundingResponse,
  AdminOverviewResponse,
  AnalyticsResponse,
  ModerationQueue,
} from '@/types';

// --- Stats ---
export const getStats = () =>
  api.get<StatsResponse>('/stats').then((r) => r.data);

// --- Réglages (compte à rebours de la home) ---
export const getCountdown = () =>
  api.get<CountdownResponse>('/public/countdown').then((r) => r.data);

export const adminGetCountdown = () =>
  api.get<CountdownResponse>('/admin/settings/countdown').then((r) => r.data);

export const adminSetCountdown = (body: { date: string | null; label: string | null }) =>
  api.put<CountdownResponse>('/admin/settings/countdown', body).then((r) => r.data);

// --- Financement (thermomètre des dons) ---
export const getFunding = () =>
  api.get<FundingResponse>('/public/funding').then((r) => r.data);

export const adminGetFunding = () =>
  api.get<FundingResponse>('/admin/settings/funding').then((r) => r.data);

export const adminSetFunding = (monthlyCost: number | null) =>
  api.put<FundingResponse>('/admin/settings/funding', { monthlyCost }).then((r) => r.data);

/** Code personnel « FN-… » à coller dans le message d'un don Ko-fi. */
export const getMyKofiCode = () =>
  api.get<{ code: string }>('/users/me/kofi-code').then((r) => r.data);

// --- Tracking anonyme (analytics admin) ---
/** Fire-and-forget : un échec (offline, rate-limit) est avalé — jamais d'erreur visible. */
export const trackEvent = (metric: string, target: string) => {
  api.post('/public/track', { metric, target }).catch(() => {});
};

// --- Admin: tableau de bord ---
export const getAdminOverview = () =>
  api.get<AdminOverviewResponse>('/admin/overview').then((r) => r.data);

export const getAdminAnalytics = (days: number) =>
  api.get<AnalyticsResponse>('/admin/analytics', { params: { days } }).then((r) => r.data);

/** Badges des files de modération seuls — la source de la sidebar pour un MODÉRATEUR (V18),
 *  qui n'a pas accès à la vue d'ensemble complète. */
export const getModerationQueue = () =>
  api.get<ModerationQueue>('/admin/moderation/queue').then((r) => r.data);

/** Modération : retire un quiz/paquet publié de la bibliothèque (il redevient privé, auteur notifié). */
export const adminUnpublishQuiz = (id: number) =>
  api.put<void>(`/admin/quizzes/${id}/unpublish`).then((r) => r.data);

export const adminUnpublishDeck = (id: number) =>
  api.put<void>(`/admin/flashcard-decks/${id}/unpublish`).then((r) => r.data);

// --- Documents ---
export const getDocumentById = (id: number) =>
  api.get<DocumentResponse>(`/documents/${id}`).then((r) => r.data);

/** Voisins précédent/suivant du même cours (navigation de la page document). */
export const getAdjacentDocuments = (id: number) =>
  api.get<AdjacentDocumentsResponse>(`/documents/${id}/adjacent`).then((r) => r.data);

/** Compteurs par catégorie (chips de l'explorer) dans le périmètre section/cours courant. */
export const getCategoryCounts = (params: { sectionId?: number; courseId?: number } = {}) =>
  api.get<Record<string, number>>('/documents/category-counts', { params }).then((r) => r.data);

export const searchDocuments = (params: {
  q?: string;
  sectionId?: number;
  courseId?: number;
  category?: string;
  sort?: string;
  page?: number;
  size?: number;
}) =>
  api.get<PageResponse<DocumentResponse>>('/documents/search', { params }).then((r) => r.data);

export const getPopularDocuments = (sectionId?: number) =>
  api.get<DocumentResponse[]>('/documents/popular', { params: sectionId ? { sectionId } : undefined }).then((r) => r.data);

export const uploadDocument = (data: CreateDocumentRequest, file: File | null, images?: File[]) => {
  const formData = new FormData();
  formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (images && images.length > 0) {
    // Server assembles these JPG/PNG into a single PDF (strips EXIF). One part per image.
    images.forEach((img) => formData.append('images', img));
  } else if (file) {
    formData.append('file', file);
  }
  return api.post<DocumentResponse>('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const getDocumentsByUser = (userId: number, page = 0, size = 6) =>
  api.get<PageResponse<DocumentResponse>>(`/documents/user/${userId}`, { params: { page, size } }).then((r) => r.data);

export const deleteDocument = (id: number) =>
  api.delete(`/documents/${id}`);

export const renameDocument = (id: number, title: string) =>
  api.patch<DocumentResponse>(`/documents/${id}`, null, { params: { title } }).then((r) => r.data);

export const downloadDocument = (id: number) =>
  api.get<Blob>(`/documents/${id}/file`, { responseType: 'blob' }).then((r) => r.data);

// --- Ratings ---
export const rateDocument = (docId: number, data: RateRequest) =>
  api.post(`/documents/${docId}/ratings`, data);

export const getAverageRating = (docId: number) =>
  api.get<number>(`/documents/${docId}/ratings/average`).then((r) => r.data);

/** Ma note sur ce document (0 = pas encore noté) — affichée à part de la moyenne. */
export const getMyRating = (docId: number) =>
  api.get<number>(`/documents/${docId}/ratings/mine`).then((r) => r.data);

// --- Favorites ---
export const toggleFavorite = (docId: number) =>
  api.post<{ isFavorite: boolean }>(`/favorites/${docId}`).then((r) => r.data);

export const getFavorites = (page = 0, size = 20) =>
  api.get<PageResponse<DocumentResponse>>('/favorites', { params: { page, size } }).then((r) => r.data);

export const getFavoriteStatus = (docId: number) =>
  api.get<{ isFavorite: boolean }>(`/favorites/${docId}`).then((r) => r.data);

// --- Sections ---
export const getSections = () =>
  api.get<Section[]>('/sections').then((r) => r.data);

// --- Courses ---
export const getCourses = (sectionId: number) =>
  api.get<Course[]>('/courses', { params: { sectionId } }).then((r) => r.data);

export const createCourse = (data: CreateCourseRequest) =>
  api.post<Course>('/courses', data).then((r) => r.data);

/** Fiche d'un cours — le bandeau de la page cours (nom réel + section, même sans document). */
export const getCourse = (id: number) =>
  api.get<Course>(`/courses/${id}`).then((r) => r.data);

/** Stats agrégées du bandeau page cours (docs, vues, note moyenne, dernier ajout). */
export const getCourseStats = (id: number) =>
  api.get<CourseStats>(`/courses/${id}/stats`).then((r) => r.data);

/** Cours équivalents (V15) — bandeau « Inclut aussi… » de la page cours. */
export const getCourseEquivalents = (id: number) =>
  api.get<Course[]>(`/courses/${id}/equivalents`).then((r) => r.data);

/** Docs créés depuis un instant ISO local — chip « N nouveaux depuis ta dernière visite ». */
export const getNewDocsCount = (since: string) =>
  api.get<{ count: number }>('/documents/new-count', { params: { since } }).then((r) => r.data);

// --- Professors ---
export const getProfessors = () =>
  api.get<Professor[]>('/professors').then((r) => r.data);

export const getSuggestedProfessors = (courseId: number) =>
  api.get<Professor[]>(`/professors/suggested?courseId=${courseId}`).then((r) => r.data);

export const createProfessor = (name: string) =>
  api.post<Professor>('/professors', { name }).then((r) => r.data);

// --- Users ---
export const getCurrentUser = () =>
  api.get<User>('/users/me').then((r) => r.data);

export const updateProfile = (data: UpdateProfileRequest) =>
  api.put<User>('/users/me', data).then((r) => r.data);

export const setUsername = (username: string) =>
  api.put<User>('/users/me/username', { username }).then((r) => r.data);

export const setSection = (sectionId: number | null) =>
  api.put<User>('/users/me/section', { sectionId }).then((r) => r.data);

export const getUserById = (id: number) =>
  api.get<User>(`/users/${id}`).then((r) => r.data);

export const getUserRank = (id: number) =>
  api.get<number>(`/users/${id}/rank`).then((r) => r.data);

export const getUserStats = (id: number) =>
  api.get<UserStats>(`/users/${id}/stats`).then((r) => r.data);

export const getFeaturedProfiles = () =>
  api.get<ProfileCardResponse[]>('/users/featured').then((r) => r.data);

export const acceptTerms = () =>
  api.post('/users/me/accept-terms');

export const syncDiscordRole = () =>
  api.post('/users/me/sync-discord-role');

export const getRecentDocs = (limit = 6) =>
  api.get<DocumentResponse[]>('/users/me/recent-docs', { params: { limit } }).then((r) => r.data);

export const recordDocVisit = (docId: number) =>
  api.post(`/users/me/recent-docs/${docId}`);

export const deleteAccount = () =>
  api.delete('/users/me');

// --- Leaderboard ---
export const getLeaderboard = (size?: number, sectionId?: number) =>
  api.get<LeaderboardEntry[]>('/leaderboard', {
    params: { ...(size ? { size } : {}), ...(sectionId ? { sectionId } : {}) },
  }).then((r) => r.data);

// --- Delegates ---
export const getDelegates = () =>
  api.get<DelegateResponse[]>('/delegates').then((r) => r.data);

export const getFormerDelegates = () =>
  api.get<DelegateResponse[]>('/delegates/former').then((r) => r.data);

export const getDelegateHistory = (userId: number) =>
  api.get<DelegateHistoryResponse[]>(`/delegates/user/${userId}`).then((r) => r.data);

export const getAllMandates = () =>
  api.get<DelegateMember[]>('/admin/delegates').then((r) => r.data);

export const assignDelegate = (data: AssignDelegateRequest) =>
  api.post<DelegateMember>('/admin/delegates', data).then((r) => r.data);

export const endDelegate = (id: number, data: EndDelegateRequest) =>
  api.patch<DelegateMember>(`/admin/delegates/${id}`, data).then((r) => r.data);

export const deleteMandate = (id: number) =>
  api.delete(`/admin/delegates/${id}`);

export const updateMandate = (id: number, data: UpdateDelegateRequest) =>
  api.patch<DelegateMember>(`/admin/delegates/${id}/edit`, data).then((r) => r.data);

// --- Admin: Documents ---
export const getPendingDocuments = (page = 0, size = 20) =>
  api.get<PageResponse<DocumentResponse>>('/admin/documents/pending', { params: { page, size } }).then((r) => r.data);

/** Groupes de doublons exacts (même hash SHA-256) — vue de modération/fusion. */
export const getDuplicateGroups = () =>
  api.get<DocumentResponse[][]>('/admin/documents/duplicates').then((r) => r.data);

export const verifyDocument = (id: number) =>
  api.put<DocumentResponse>(`/admin/documents/${id}/verify`).then((r) => r.data);

export const adminUpdateDocument = (id: number, data: UpdateDocumentRequest) =>
  api.put<DocumentResponse>(`/admin/documents/${id}`, data).then((r) => r.data);

export const adminDeleteDocument = (id: number) =>
  api.delete(`/admin/documents/${id}`);

// --- Admin: Sections ---
export const adminListSections = () =>
  api.get<Section[]>('/admin/sections').then((r) => r.data);

export const adminCreateSection = (name: string, icon?: string) =>
  api.post<Section>('/admin/sections', null, { params: { name, icon } }).then((r) => r.data);

export const approveSection = (id: number) =>
  api.put<Section>(`/admin/sections/${id}/approve`).then((r) => r.data);

export const adminRenameSection = (id: number, name: string, icon?: string) =>
  api.patch<Section>(`/admin/sections/${id}`, null, { params: { name, icon } }).then((r) => r.data);

export const adminDeleteSection = (id: number) =>
  api.delete(`/admin/sections/${id}`);

// --- Admin: Courses ---
export const adminListCourses = () =>
  api.get<Course[]>('/admin/courses').then((r) => r.data);

export const getPendingCourses = () =>
  api.get<Course[]>('/admin/courses/pending').then((r) => r.data);

export const adminCreateCourse = (data: CreateCourseRequest) =>
  api.post<Course>('/admin/courses', data).then((r) => r.data);

export const approveCourse = (id: number) =>
  api.put<Course>(`/admin/courses/${id}/approve`).then((r) => r.data);

export const adminRenameCourse = (id: number, name: string) =>
  api.patch<Course>(`/admin/courses/${id}`, null, { params: { name } }).then((r) => r.data);

export const adminDeleteCourse = (id: number) =>
  api.delete(`/admin/courses/${id}`);

export const adminGetCourseEquivalents = (id: number) =>
  api.get<Course[]>(`/admin/courses/${id}/equivalents`).then((r) => r.data);

/** Le body est la liste EXACTE des ids équivalents (vide = délier). */
export const adminSetCourseEquivalents = (id: number, courseIds: number[]) =>
  api.put<Course[]>(`/admin/courses/${id}/equivalents`, courseIds).then((r) => r.data);

// --- Admin: Users ---
export const adminSearchUsers = (q = '', limit = 30, sectionId?: number) =>
  api.get<User[]>('/admin/users', { params: { q, limit, ...(sectionId ? { sectionId } : {}) } }).then((r) => r.data);

export const adminBanUser = (id: number, reason?: string) =>
  api.post(`/admin/users/${id}/ban`, null, { params: reason ? { reason } : undefined });

export const adminVerifyUser = (id: number) =>
  api.put<User>(`/admin/users/${id}/verify`).then((r) => r.data);

export const adminUnverifyUser = (id: number) =>
  api.put<User>(`/admin/users/${id}/unverify`).then((r) => r.data);

export const adminTrustUser = (id: number) =>
  api.put<User>(`/admin/users/${id}/trust`).then((r) => r.data);

export const adminUntrustUser = (id: number) =>
  api.put<User>(`/admin/users/${id}/untrust`).then((r) => r.data);

/** Rôles staff V18 — PUT accorde, DELETE retire (pattern lifetime-palettes). */
export const adminGrantModerator = (id: number) =>
  api.put<User>(`/admin/users/${id}/moderator`).then((r) => r.data);

export const adminRevokeModerator = (id: number) =>
  api.delete<User>(`/admin/users/${id}/moderator`).then((r) => r.data);

export const adminGrantEditor = (id: number) =>
  api.put<User>(`/admin/users/${id}/editor`).then((r) => r.data);

export const adminRevokeEditor = (id: number) =>
  api.delete<User>(`/admin/users/${id}/editor`).then((r) => r.data);

/** Palettes d'accent à vie (flag lifetime_supporter — même avantage qu'un don ≥ 5 €). */
export const adminGrantLifetimePalettes = (id: number) =>
  api.put<User>(`/admin/users/${id}/lifetime-palettes`).then((r) => r.data);

export const adminRevokeLifetimePalettes = (id: number) =>
  api.delete<User>(`/admin/users/${id}/lifetime-palettes`).then((r) => r.data);

export const adminUpdateUserRole = (id: number, role: 'USER' | 'VERIFIED' | 'ADMIN') =>
  api.patch<User>(`/admin/users/${id}/role`, null, { params: { role } }).then((r) => r.data);

export const adminDeleteUser = (id: number) =>
  api.delete(`/admin/users/${id}`);

// --- Admin: Professors ---
export const adminListProfessors = () =>
  api.get<Professor[]>('/admin/professors').then((r) => r.data);

export const getPendingProfessors = () =>
  api.get<Professor[]>('/admin/professors/pending').then((r) => r.data);

export const adminCreateProfessor = (name: string) =>
  api.post<Professor>('/admin/professors', { name }).then((r) => r.data);

export const approveProfessor = (id: number) =>
  api.put<Professor>(`/admin/professors/${id}/approve`).then((r) => r.data);

export const adminDeleteProfessor = (id: number) =>
  api.delete(`/admin/professors/${id}`);

// --- Admin: Reports ---
export const getPendingReports = (page = 0, size = 20) =>
  api.get<PageResponse<ReportResponse>>('/admin/reports/pending', { params: { page, size } }).then((r) => r.data);

export const resolveReport = (id: number) =>
  api.put(`/admin/reports/${id}/resolve`);

export const dismissReport = (id: number) =>
  api.put(`/admin/reports/${id}/dismiss`);

// --- Admin: Donations ---
export const getAdminDonations = (page = 0, size = 30) =>
  api.get<PageResponse<DonationResponse>>('/admin/donations', { params: { page, size } }).then((r) => r.data);

export const adminGrantAdFree = (userId: number, days: number) =>
  api.post<DonationResponse>(`/admin/users/${userId}/grant-ad-free`, null, { params: { days } }).then((r) => r.data);

/** Rattache un don Ko-fi orphelin à un compte (applique aussi les avantages du montant). */
export const adminAttachDonation = (donationId: number, userId: number) =>
  api.put<DonationResponse>(`/admin/donations/${donationId}/attach`, null, { params: { userId } }).then((r) => r.data);

/** Supprime une ligne de don (purge des dons de test) — les avantages déjà appliqués restent. */
export const adminDeleteDonation = (donationId: number) =>
  api.delete(`/admin/donations/${donationId}`);

// --- Admin: Activity logs ---
export const getActivityLogs = (page = 0, size = 50, type?: string) =>
  api
    .get<PageResponse<ActivityLog>>('/admin/activity-logs', { params: { page, size, ...(type ? { type } : {}) } })
    .then((r) => r.data);

export const purgeActivityLogs = (days: number) =>
  api.delete<{ deleted: number }>('/admin/activity-logs', { params: { days } }).then((r) => r.data);

// --- Notifications ---
export const getNotificationsUnreadCount = () =>
  api.get<number>('/notifications/unread-count').then((r) => r.data);

export const getNotifications = (page = 0, size = 10) =>
  api.get<PageResponse<NotificationItem>>('/notifications', { params: { page, size } }).then((r) => r.data);

export const markAllNotificationsRead = () =>
  api.post('/notifications/read-all');

// --- News ---
export const getNews = () =>
  api.get<NewsItem[]>('/news').then((r) => r.data);

// --- Reports ---
export const reportDocument = (docId: number, data: ReportRequest) =>
  api.post(`/documents/${docId}/reports`, data);

// --- Auth ---
export const requestVerification = (email: string) =>
  api.post('/auth/request-verification', { email });

export const confirmVerification = (code: string) =>
  api.post<void>('/auth/confirm-verification', { code });

export const logout = () =>
  api.post('/auth/logout');

// --- Flashcard decks (enregistrés côté serveur : privés « mine » + bibliothèque publiée) ---
export const saveDeck = (body: PublishDeckRequest) =>
  api.post<FlashcardDeckResponse>('/flashcard-decks', body).then((r) => r.data);

export const updateDeck = (id: number, body: PublishDeckRequest) =>
  api.put<FlashcardDeckResponse>(`/flashcard-decks/${id}`, body).then((r) => r.data);

export const listMyDecks = (params: { page?: number; size?: number } = {}) =>
  api.get<PageResponse<FlashcardDeckSummary>>('/flashcard-decks/mine', { params }).then((r) => r.data);

export const listSharedDecks = (params: { courseId?: number; sectionId?: number; ownerId?: number; page?: number; size?: number } = {}) =>
  api.get<PageResponse<FlashcardDeckSummary>>('/flashcard-decks', { params }).then((r) => r.data);

export const getSharedDeck = (id: number) =>
  api.get<FlashcardDeckResponse>(`/flashcard-decks/${id}`).then((r) => r.data);

export const deleteSharedDeck = (id: number) =>
  api.delete<void>(`/flashcard-decks/${id}`);

// --- Quiz (enregistrés côté serveur : privés « mine » + bibliothèque publiée) ---
export const createQuiz = (body: CreateQuizRequest) =>
  api.post<QuizSummary>('/quizzes', body).then((r) => r.data);

export const updateQuiz = (id: number, body: CreateQuizRequest) =>
  api.put<QuizSummary>(`/quizzes/${id}`, body).then((r) => r.data);

export const listMyQuizzes = (params: { page?: number; size?: number } = {}) =>
  api.get<PageResponse<QuizSummary>>('/quizzes/mine', { params }).then((r) => r.data);

export const listQuizzes = (params: { courseId?: number; sectionId?: number; ownerId?: number; page?: number; size?: number } = {}) =>
  api.get<PageResponse<QuizSummary>>('/quizzes', { params }).then((r) => r.data);

export const getQuizPlay = (id: number) =>
  api.get<QuizPlayResponse>(`/quizzes/${id}/play`).then((r) => r.data);

/** Vue complète (réponses incluses) — édition d'un quiz possédé ou import d'un quiz publié. */
export const getQuizFull = (id: number) =>
  api.get<QuizFullResponse>(`/quizzes/${id}/full`).then((r) => r.data);

export const submitQuizAttempt = (id: number, body: SubmitAttemptRequest) =>
  api.post<AttemptResultResponse>(`/quizzes/${id}/attempts`, body).then((r) => r.data);

export const getQuizLeaderboard = (id: number, size = 20) =>
  api.get<QuizLeaderboardEntry[]>(`/quizzes/${id}/leaderboard`, { params: { size } }).then((r) => r.data);

/** Signale une erreur possible dans une question (écran de fin) → notification à l'auteur. */
export const reportQuizQuestion = (id: number, questionIndex: number, message?: string) =>
  api.post(`/quizzes/${id}/report-question`, { questionIndex, message });

// --- Guides (public read) ---
export const listGuides = (params: { authorId?: number; page?: number; size?: number } = {}) =>
  api.get<PageResponse<GuideSummary>>('/guides', { params }).then((r) => r.data);

export const getGuide = (slug: string) =>
  api.get<GuideResponse>(`/guides/${slug}`).then((r) => r.data);

// --- Guides (admin authoring) ---
export const adminListGuides = (params: { page?: number; size?: number } = {}) =>
  api.get<PageResponse<GuideSummary>>('/admin/guides', { params }).then((r) => r.data);

export const adminGetGuide = (id: number) =>
  api.get<GuideResponse>(`/admin/guides/${id}`).then((r) => r.data);

export const adminCreateGuide = (body: CreateGuideRequest) =>
  api.post<GuideResponse>('/admin/guides', body).then((r) => r.data);

export const adminUpdateGuide = (id: number, body: CreateGuideRequest) =>
  api.put<GuideResponse>(`/admin/guides/${id}`, body).then((r) => r.data);

export const adminDeleteGuide = (id: number) =>
  api.delete<void>(`/admin/guides/${id}`);

// --- Public catalogue teaser (anonymous) ---
export const listPublicDocuments = (params: { page?: number; size?: number; courseId?: number } = {}) =>
  api.get<PageResponse<PublicDocumentSummary>>('/public/documents', { params }).then((r) => r.data);

/** Teaser public d'un cours (page /courses/:id anonyme — SEO). */
export const getPublicCourse = (id: number) =>
  api.get<PublicCourse>(`/public/courses/${id}`).then((r) => r.data);

export const getPublicDocument = (id: number) =>
  api.get<PublicDocumentSummary>(`/public/documents/${id}`).then((r) => r.data);

/** Statut minimal d'un doc hors catégories publiques : « existe mais réservé » (titre seul) ou inconnu. */
export const getPublicDocumentStatus = (id: number) =>
  api.get<PublicDocumentStatus>(`/public/documents/${id}/status`).then((r) => r.data);

/** Soft duplicate signal for the upload form — true if a same-titled doc already exists in the course. */
export const checkDocumentTitle = (title: string, courseId: number) =>
  api.get<boolean>('/documents/title-exists', { params: { title, courseId } }).then((r) => r.data);

// --- Gantt charts (verified-only save + share) ---
export const listMyGanttCharts = (params: { page?: number; size?: number } = {}) =>
  api.get<PageResponse<GanttSummary>>('/gantt-charts/mine', { params }).then((r) => r.data);

export const listSharedGanttCharts = (params: { page?: number; size?: number } = {}) =>
  api.get<PageResponse<GanttSummary>>('/gantt-charts/shared', { params }).then((r) => r.data);

export const getGanttChart = (id: number) =>
  api.get<GanttResponse>(`/gantt-charts/${id}`).then((r) => r.data);

export const createGanttChart = (body: SaveGanttRequest) =>
  api.post<GanttResponse>('/gantt-charts', body).then((r) => r.data);

export const updateGanttChart = (id: number, body: SaveGanttRequest) =>
  api.put<GanttResponse>(`/gantt-charts/${id}`, body).then((r) => r.data);

export const deleteGanttChart = (id: number) =>
  api.delete<void>(`/gantt-charts/${id}`);

export const deleteQuiz = (id: number) =>
  api.delete<void>(`/quizzes/${id}`);

// --- Dev-only ---
export const devLogin = (username: string) =>
  api.post<{ username: string; role: string; verified: string }>(`/dev/login/${username}`).then((r) => r.data);
