import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the references are initialised before vi.mock's factory runs.
const { get, post, put, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../axiosInstance', () => ({
  default: { get, post, put, patch, delete: del },
}));

import * as ep from '../endpoints';

beforeEach(() => {
  for (const fn of [get, post, put, patch, del]) {
    fn.mockReset();
    fn.mockResolvedValue({ data: { ok: true } });
  }
});

describe('endpoints — GET', () => {
  it('hits the expected URLs and unwraps response.data', async () => {
    expect(await ep.getStats()).toEqual({ ok: true });
    expect(get).toHaveBeenCalledWith('/stats');

    await ep.getDocumentById(7);
    expect(get).toHaveBeenCalledWith('/documents/7');

    await ep.searchDocuments({ q: 'algo', page: 1, size: 10 });
    expect(get).toHaveBeenCalledWith('/documents/search', { params: { q: 'algo', page: 1, size: 10 } });

    await ep.getPopularDocuments();
    expect(get).toHaveBeenCalledWith('/documents/popular', { params: undefined });
    await ep.getPopularDocuments(3);
    expect(get).toHaveBeenCalledWith('/documents/popular', { params: { sectionId: 3 } });

    await ep.getDocumentsByUser(9);
    expect(get).toHaveBeenCalledWith('/documents/user/9', { params: { page: 0, size: 6 } });

    await ep.downloadDocument(4);
    expect(get).toHaveBeenCalledWith('/documents/4/file', { responseType: 'blob' });

    await ep.getAverageRating(4);
    expect(get).toHaveBeenCalledWith('/documents/4/ratings/average');

    await ep.getFavorites();
    expect(get).toHaveBeenCalledWith('/favorites', { params: { page: 0, size: 20 } });
    await ep.getFavoriteStatus(2);
    expect(get).toHaveBeenCalledWith('/favorites/2');

    await ep.getSections();
    expect(get).toHaveBeenCalledWith('/sections');
    await ep.getCourses(5);
    expect(get).toHaveBeenCalledWith('/courses', { params: { sectionId: 5 } });

    await ep.getProfessors();
    expect(get).toHaveBeenCalledWith('/professors');
    await ep.getSuggestedProfessors(11);
    expect(get).toHaveBeenCalledWith('/professors/suggested?courseId=11');

    await ep.getCurrentUser();
    expect(get).toHaveBeenCalledWith('/users/me');
    await ep.getUserById(8);
    expect(get).toHaveBeenCalledWith('/users/8');
    await ep.getUserRank(8);
    expect(get).toHaveBeenCalledWith('/users/8/rank');
    await ep.getFeaturedProfiles();
    expect(get).toHaveBeenCalledWith('/users/featured');
    await ep.getRecentDocs();
    expect(get).toHaveBeenCalledWith('/users/me/recent-docs', { params: { limit: 6 } });

    await ep.getLeaderboard();
    expect(get).toHaveBeenCalledWith('/leaderboard', { params: {} });
    await ep.getLeaderboard(5, 2);
    expect(get).toHaveBeenCalledWith('/leaderboard', { params: { size: 5, sectionId: 2 } });

    await ep.getDelegates();
    expect(get).toHaveBeenCalledWith('/delegates');
    await ep.getDelegateHistory(3);
    expect(get).toHaveBeenCalledWith('/delegates/user/3');
    await ep.getAllMandates();
    expect(get).toHaveBeenCalledWith('/admin/delegates');

    await ep.getNotificationsUnreadCount();
    expect(get).toHaveBeenCalledWith('/notifications/unread-count');
    await ep.getNews();
    expect(get).toHaveBeenCalledWith('/news');
  });

  it('covers all admin GET endpoints', async () => {
    await ep.getPendingDocuments();
    await ep.adminListSections();
    await ep.adminListCourses();
    await ep.getPendingCourses();
    await ep.adminListProfessors();
    await ep.getPendingProfessors();
    await ep.adminSearchUsers('bob', 10, 2);
    expect(get).toHaveBeenCalledWith('/admin/users', { params: { q: 'bob', limit: 10, sectionId: 2 } });
    await ep.adminSearchUsers();
    expect(get).toHaveBeenCalledWith('/admin/users', { params: { q: '', limit: 30 } });
    await ep.getPendingReports();
    expect(get).toHaveBeenCalledWith('/admin/reports/pending', { params: { page: 0, size: 20 } });
    await ep.getAdminDonations();
    await ep.getActivityLogs(1, 25, 'LOGIN');
    expect(get).toHaveBeenCalledWith('/admin/activity-logs', { params: { page: 1, size: 25, type: 'LOGIN' } });
    await ep.getActivityLogs();
    expect(get).toHaveBeenCalledWith('/admin/activity-logs', { params: { page: 0, size: 50 } });
  });
});

describe('endpoints — POST/PUT/PATCH/DELETE', () => {
  it('sends the right method, URL and body', async () => {
    await ep.createCourse({ name: 'Algo', sectionId: 1 } as never);
    expect(post).toHaveBeenCalledWith('/courses', { name: 'Algo', sectionId: 1 });

    await ep.createProfessor('Dupont');
    expect(post).toHaveBeenCalledWith('/professors', { name: 'Dupont' });

    await ep.rateDocument(3, { score: 4 } as never);
    expect(post).toHaveBeenCalledWith('/documents/3/ratings', { score: 4 });

    await ep.toggleFavorite(3);
    expect(post).toHaveBeenCalledWith('/favorites/3');

    await ep.updateProfile({ bio: 'hi' } as never);
    expect(put).toHaveBeenCalledWith('/users/me', { bio: 'hi' });
    await ep.setUsername('neo');
    expect(put).toHaveBeenCalledWith('/users/me/username', { username: 'neo' });
    await ep.setSection(2);
    expect(put).toHaveBeenCalledWith('/users/me/section', { sectionId: 2 });

    await ep.acceptTerms();
    expect(post).toHaveBeenCalledWith('/users/me/accept-terms');
    await ep.syncDiscordRole();
    expect(post).toHaveBeenCalledWith('/users/me/sync-discord-role');
    await ep.recordDocVisit(5);
    expect(post).toHaveBeenCalledWith('/users/me/recent-docs/5');
    await ep.deleteAccount();
    expect(del).toHaveBeenCalledWith('/users/me');

    await ep.deleteDocument(6);
    expect(del).toHaveBeenCalledWith('/documents/6');
    await ep.renameDocument(6, 'New');
    expect(patch).toHaveBeenCalledWith('/documents/6', null, { params: { title: 'New' } });

    await ep.reportDocument(6, { reason: 'spam' } as never);
    expect(post).toHaveBeenCalledWith('/documents/6/reports', { reason: 'spam' });

    await ep.requestVerification('a@isfce.be');
    expect(post).toHaveBeenCalledWith('/auth/request-verification', { email: 'a@isfce.be' });
    await ep.confirmVerification('123456');
    expect(post).toHaveBeenCalledWith('/auth/confirm-verification', { code: '123456' });
    await ep.logout();
    expect(post).toHaveBeenCalledWith('/auth/logout');
    await ep.devLogin('admin');
    expect(post).toHaveBeenCalledWith('/dev/login/admin');
  });

  it('covers delegate + admin mutations', async () => {
    await ep.assignDelegate({ userId: 1, sectionId: 2 } as never);
    expect(post).toHaveBeenCalledWith('/admin/delegates', { userId: 1, sectionId: 2 });
    await ep.endDelegate(1, { endDate: '2026-01-01' } as never);
    expect(patch).toHaveBeenCalledWith('/admin/delegates/1', { endDate: '2026-01-01' });
    await ep.deleteMandate(1);
    expect(del).toHaveBeenCalledWith('/admin/delegates/1');
    await ep.updateMandate(1, { startDate: '2026-01-01' } as never);
    expect(patch).toHaveBeenCalledWith('/admin/delegates/1/edit', { startDate: '2026-01-01' });

    await ep.verifyDocument(2);
    expect(put).toHaveBeenCalledWith('/admin/documents/2/verify');
    await ep.adminUpdateDocument(2, { title: 'x' } as never);
    expect(put).toHaveBeenCalledWith('/admin/documents/2', { title: 'x' });
    await ep.adminDeleteDocument(2);
    expect(del).toHaveBeenCalledWith('/admin/documents/2');

    await ep.adminCreateSection('IT', 'icon');
    expect(post).toHaveBeenCalledWith('/admin/sections', null, { params: { name: 'IT', icon: 'icon' } });
    await ep.approveSection(1);
    await ep.adminRenameSection(1, 'IT2');
    await ep.adminDeleteSection(1);

    await ep.adminCreateCourse({ name: 'C', sectionId: 1 } as never);
    await ep.approveCourse(1);
    await ep.adminRenameCourse(1, 'C2');
    expect(patch).toHaveBeenCalledWith('/admin/courses/1', null, { params: { name: 'C2' } });
    await ep.adminDeleteCourse(1);

    await ep.adminBanUser(3, 'abuse');
    expect(post).toHaveBeenCalledWith('/admin/users/3/ban', null, { params: { reason: 'abuse' } });
    await ep.adminBanUser(3);
    expect(post).toHaveBeenCalledWith('/admin/users/3/ban', null, { params: undefined });
    await ep.adminVerifyUser(3);
    await ep.adminUnverifyUser(3);
    await ep.adminUpdateUserRole(3, 'ADMIN');
    expect(patch).toHaveBeenCalledWith('/admin/users/3/role', null, { params: { role: 'ADMIN' } });
    await ep.adminDeleteUser(3);

    await ep.adminCreateProfessor('P');
    await ep.approveProfessor(1);
    await ep.adminDeleteProfessor(1);

    await ep.resolveReport(1);
    expect(put).toHaveBeenCalledWith('/admin/reports/1/resolve');
    await ep.dismissReport(1);
    await ep.adminGrantAdFree(3, 30);
    expect(post).toHaveBeenCalledWith('/admin/users/3/grant-ad-free', null, { params: { days: 30 } });
    await ep.purgeActivityLogs(90);
    expect(del).toHaveBeenCalledWith('/admin/activity-logs', { params: { days: 90 } });
  });
});

describe('uploadDocument', () => {
  it('sends a "file" part for a PDF', async () => {
    const pdf = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
    await ep.uploadDocument({ title: 'T', courseId: 1, category: 'COURS' } as never, pdf);

    const [url, body] = post.mock.calls.at(-1)!;
    expect(url).toBe('/documents');
    const fd = body as FormData;
    expect(fd.get('file')).toBeInstanceOf(File);
    expect(fd.getAll('images')).toHaveLength(0);
  });

  it('sends "images" parts when images are provided (PDF ignored)', async () => {
    const pdf = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
    const imgs = [
      new File(['x'], '1.png', { type: 'image/png' }),
      new File(['y'], '2.jpg', { type: 'image/jpeg' }),
    ];
    await ep.uploadDocument({ title: 'T', courseId: 1, category: 'EXAMEN' } as never, pdf, imgs);

    const fd = post.mock.calls.at(-1)![1] as FormData;
    expect(fd.getAll('images')).toHaveLength(2);
    expect(fd.get('file')).toBeNull();
  });
});
