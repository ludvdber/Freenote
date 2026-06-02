export type AvatarSource = 'AUTO' | 'LETTER' | 'DICEBEAR' | 'DISCORD';

export interface User {
  id: number;
  username: string;
  role: string | null;
  verified: boolean;
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
  tags: string[];
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
  title: string;
  date: string | null;
  labels: string[];
  url: string | null;
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
  tags?: string[];
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
  tags?: string[];
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

