import api from './axiosInstance';
import type {
  StatsResponse,
  DocumentResponse,
  PageResponse,
  Section,
  Course,
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
  AttemptResultResponse,
  QuizLeaderboardEntry,
  GuideSummary,
  GuideResponse,
  CreateGuideRequest,
  PublicDocumentSummary,
  GanttSummary,
  GanttResponse,
  SaveGanttRequest,
} from '@/types';

// --- Stats ---
export const getStats = () =>
  api.get<StatsResponse>('/stats').then((r) => r.data);

// --- Documents ---
export const getDocumentById = (id: number) =>
  api.get<DocumentResponse>(`/documents/${id}`).then((r) => r.data);

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
export const getPendingDocuments = () =>
  api.get<DocumentResponse[]>('/admin/documents/pending').then((r) => r.data);

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

// --- Shared flashcard decks (palier C) ---
export const publishDeck = (body: PublishDeckRequest) =>
  api.post<FlashcardDeckResponse>('/flashcard-decks', body).then((r) => r.data);

export const listSharedDecks = (params: { courseId?: number; page?: number; size?: number } = {}) =>
  api.get<PageResponse<FlashcardDeckSummary>>('/flashcard-decks', { params }).then((r) => r.data);

export const getSharedDeck = (id: number) =>
  api.get<FlashcardDeckResponse>(`/flashcard-decks/${id}`).then((r) => r.data);

export const deleteSharedDeck = (id: number) =>
  api.delete<void>(`/flashcard-decks/${id}`);

// --- Shared quizzes ---
export const createQuiz = (body: CreateQuizRequest) =>
  api.post<QuizSummary>('/quizzes', body).then((r) => r.data);

export const listQuizzes = (params: { courseId?: number; page?: number; size?: number } = {}) =>
  api.get<PageResponse<QuizSummary>>('/quizzes', { params }).then((r) => r.data);

export const getQuizPlay = (id: number) =>
  api.get<QuizPlayResponse>(`/quizzes/${id}/play`).then((r) => r.data);

export const submitQuizAttempt = (id: number, body: SubmitAttemptRequest) =>
  api.post<AttemptResultResponse>(`/quizzes/${id}/attempts`, body).then((r) => r.data);

export const getQuizLeaderboard = (id: number, size = 20) =>
  api.get<QuizLeaderboardEntry[]>(`/quizzes/${id}/leaderboard`, { params: { size } }).then((r) => r.data);

// --- Guides (public read) ---
export const listGuides = (params: { page?: number; size?: number } = {}) =>
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
export const listPublicDocuments = (params: { page?: number; size?: number } = {}) =>
  api.get<PageResponse<PublicDocumentSummary>>('/public/documents', { params }).then((r) => r.data);

export const getPublicDocument = (id: number) =>
  api.get<PublicDocumentSummary>(`/public/documents/${id}`).then((r) => r.data);

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
