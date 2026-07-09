package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.CreateCourseRequest;
import be.freenote.dto.request.CreateProfessorRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.dto.response.ActivityLogResponse;
import be.freenote.dto.response.CourseResponse;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.DonationResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.ProfessorResponse;
import be.freenote.dto.response.ReportResponse;
import be.freenote.dto.response.SectionResponse;
import be.freenote.dto.response.SmtpStatusResponse;
import be.freenote.dto.response.UserResponse;
import be.freenote.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final DocumentService documentService;
    private final CourseService courseService;
    private final ProfessorService professorService;
    private final ReportService reportService;
    private final SectionService sectionService;
    private final UserService userService;
    private final DonationService donationService;
    private final SmtpKeepAliveService smtpKeepAliveService;
    private final ActivityLogService activityLogService;

    // --- System / SMTP keep-alive (the "compteur" of days since the last sent email) ---

    @GetMapping("/smtp-status")
    public ResponseEntity<SmtpStatusResponse> getSmtpStatus() {
        return ResponseEntity.ok(smtpKeepAliveService.getStatus());
    }

    // --- Activity logs (admin audit trail) ---

    @GetMapping("/activity-logs")
    public ResponseEntity<PageResponse<ActivityLogResponse>> listActivityLogs(
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(activityLogService.list(type, PageRequest.of(page, size)));
    }

    @DeleteMapping("/activity-logs")
    public ResponseEntity<Map<String, Integer>> purgeActivityLogs(@RequestParam(defaultValue = "30") int days) {
        int deleted = activityLogService.purgeBefore(LocalDateTime.now().minusDays(days));
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    // --- Documents ---

    @GetMapping("/documents/pending")
    public ResponseEntity<PageResponse<DocumentResponse>> getPendingDocuments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        return ResponseEntity.ok(documentService.getUnverified(pageable));
    }

    /** Groupes de doublons exacts (même hash SHA-256) détectés par le backfill — vue de
     *  modération : l'admin choisit lequel garder et supprime les autres. */
    @GetMapping("/documents/duplicates")
    public ResponseEntity<List<List<DocumentResponse>>> getDuplicateGroups() {
        return ResponseEntity.ok(documentService.getDuplicateGroups());
    }

    @PutMapping("/documents/{id}/verify")
    public ResponseEntity<DocumentResponse> verifyDocument(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.verify(id));
    }

    @PutMapping("/documents/{id}")
    public ResponseEntity<DocumentResponse> updateDocument(@PathVariable Long id,
                                                            @Valid @RequestBody UpdateDocumentRequest request) {
        return ResponseEntity.ok(documentService.adminUpdate(id, request));
    }

    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id) {
        documentService.adminDelete(id);
        return ResponseEntity.noContent().build();
    }

    // --- Courses ---

    @GetMapping("/courses")
    public ResponseEntity<List<CourseResponse>> listCourses() {
        return ResponseEntity.ok(courseService.getAllForAdmin());
    }

    @GetMapping("/courses/pending")
    public ResponseEntity<List<CourseResponse>> getPendingCourses() {
        return ResponseEntity.ok(courseService.getPending());
    }

    @PostMapping("/courses")
    public ResponseEntity<CourseResponse> createCourse(@Valid @RequestBody CreateCourseRequest request) {
        return ResponseEntity.status(201).body(courseService.adminCreate(request));
    }

    @PutMapping("/courses/{id}/approve")
    public ResponseEntity<CourseResponse> approveCourse(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.approve(id));
    }

    @PatchMapping("/courses/{id}")
    public ResponseEntity<CourseResponse> renameCourse(@PathVariable Long id,
                                                       @RequestParam String name) {
        return ResponseEntity.ok(courseService.rename(id, name));
    }

    @DeleteMapping("/courses/{id}")
    public ResponseEntity<Void> deleteCourse(@PathVariable Long id) {
        courseService.adminDelete(id);
        return ResponseEntity.noContent().build();
    }

    /** Équivalences de cours (V15). Le body PUT est la liste EXACTE des ids équivalents (vide = délier). */
    @GetMapping("/courses/{id}/equivalents")
    public ResponseEntity<List<CourseResponse>> getCourseEquivalents(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getEquivalents(id));
    }

    @PutMapping("/courses/{id}/equivalents")
    public ResponseEntity<List<CourseResponse>> setCourseEquivalents(@PathVariable Long id,
                                                                     @RequestBody List<Long> courseIds) {
        return ResponseEntity.ok(courseService.setEquivalents(id, courseIds));
    }

    // --- Professors ---

    @GetMapping("/professors")
    public ResponseEntity<List<ProfessorResponse>> listProfessors() {
        return ResponseEntity.ok(professorService.getAllForAdmin());
    }

    @GetMapping("/professors/pending")
    public ResponseEntity<List<ProfessorResponse>> getPendingProfessors() {
        return ResponseEntity.ok(professorService.getPending());
    }

    @PostMapping("/professors")
    public ResponseEntity<ProfessorResponse> createProfessor(@Valid @RequestBody CreateProfessorRequest request) {
        return ResponseEntity.status(201).body(professorService.adminCreate(request.getName()));
    }

    @PutMapping("/professors/{id}/approve")
    public ResponseEntity<ProfessorResponse> approveProfessor(@PathVariable Long id) {
        return ResponseEntity.ok(professorService.approve(id));
    }

    @DeleteMapping("/professors/{id}")
    public ResponseEntity<Void> deleteProfessor(@PathVariable Long id) {
        professorService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // --- Sections ---

    @GetMapping("/sections")
    public ResponseEntity<List<SectionResponse>> listSections() {
        return ResponseEntity.ok(sectionService.getAllForAdmin());
    }

    @PostMapping("/sections")
    public ResponseEntity<SectionResponse> createSection(@RequestParam String name,
                                                          @RequestParam(required = false) String icon) {
        return ResponseEntity.status(201).body(sectionService.create(name, icon));
    }

    @PutMapping("/sections/{id}/approve")
    public ResponseEntity<SectionResponse> approveSection(@PathVariable Long id) {
        return ResponseEntity.ok(sectionService.approve(id));
    }

    @PatchMapping("/sections/{id}")
    public ResponseEntity<SectionResponse> renameSection(@PathVariable Long id,
                                                          @RequestParam String name,
                                                          @RequestParam(required = false) String icon) {
        return ResponseEntity.ok(sectionService.rename(id, name, icon));
    }

    @DeleteMapping("/sections/{id}")
    public ResponseEntity<Void> deleteSection(@PathVariable Long id) {
        sectionService.adminDelete(id);
        return ResponseEntity.noContent().build();
    }

    // --- Reports ---

    @GetMapping("/reports/pending")
    public ResponseEntity<PageResponse<ReportResponse>> getPendingReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(reportService.listPending(PageRequest.of(page, size)));
    }

    @PutMapping("/reports/{id}/resolve")
    public ResponseEntity<Void> resolveReport(@PathVariable Long id) {
        reportService.resolve(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/reports/{id}/dismiss")
    public ResponseEntity<Void> dismissReport(@PathVariable Long id) {
        reportService.dismiss(id);
        return ResponseEntity.ok().build();
    }

    // --- Users ---

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> searchUsers(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(defaultValue = "30") int limit) {
        return ResponseEntity.ok(userService.adminSearchUsers(q, sectionId, limit));
    }

    @PutMapping("/users/{id}/verify")
    public ResponseEntity<UserResponse> verifyUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.adminVerifyUser(id));
    }

    @PutMapping("/users/{id}/unverify")
    public ResponseEntity<UserResponse> unverifyUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.adminUnverifyUser(id));
    }

    @PutMapping("/users/{id}/trust")
    public ResponseEntity<UserResponse> trustUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.adminSetTrusted(id, true));
    }

    @PutMapping("/users/{id}/untrust")
    public ResponseEntity<UserResponse> untrustUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.adminSetTrusted(id, false));
    }

    /** Palettes d'accent à vie (flag lifetime_supporter — même avantage qu'un don ≥ 5 €). */
    @PutMapping("/users/{id}/lifetime-palettes")
    public ResponseEntity<UserResponse> grantLifetimePalettes(@PathVariable Long id) {
        return ResponseEntity.ok(userService.adminSetLifetimePalettes(id, true));
    }

    @DeleteMapping("/users/{id}/lifetime-palettes")
    public ResponseEntity<UserResponse> revokeLifetimePalettes(@PathVariable Long id) {
        return ResponseEntity.ok(userService.adminSetLifetimePalettes(id, false));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<UserResponse> updateUserRole(@PathVariable Long id, @RequestParam String role,
                                                       Authentication authentication) {
        // Block self-demotion: an admin changing their own role to non-ADMIN would lose access on the
        // very next request (AdminRoleVerificationFilter re-reads the role from the DB) — a lockout footgun.
        if (id.equals(SecurityUtils.currentUserId(authentication)) && !"ADMIN".equals(role)) {
            throw new be.freenote.exception.ForbiddenException("Un admin ne peut pas se retirer lui-même le rôle admin");
        }
        return ResponseEntity.ok(userService.adminUpdateRole(id, role));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id, Authentication authentication) {
        if (id.equals(SecurityUtils.currentUserId(authentication))) {
            throw new be.freenote.exception.ForbiddenException("Utilise la suppression de compte (/api/users/me) pour ton propre compte");
        }
        userService.adminDeleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{id}/ban")
    public ResponseEntity<Void> banUser(@PathVariable Long id,
                                        @RequestParam(required = false) String reason,
                                        Authentication authentication) {
        Long adminId = SecurityUtils.currentUserId(authentication);
        if (id.equals(adminId)) {
            throw new be.freenote.exception.ForbiddenException("Un admin ne peut pas se bannir lui-même");
        }
        userService.banUser(id, reason, adminId);
        return ResponseEntity.noContent().build();
    }

    // --- Donations ---

    @GetMapping("/donations")
    public ResponseEntity<PageResponse<DonationResponse>> listDonations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(donationService.listAll(PageRequest.of(page, size)));
    }

    @PostMapping("/users/{id}/grant-ad-free")
    public ResponseEntity<DonationResponse> grantAdFree(@PathVariable Long id,
                                                         @RequestParam int days,
                                                         Authentication authentication) {
        Long adminId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(donationService.grantAdFree(id, days, adminId));
    }

    /** Rattache un don Ko-fi orphelin (donateur sans code « FN-… ») à un compte et lui applique
     *  les avantages du montant. 400 si le don est déjà rattaché. */
    @PutMapping("/donations/{id}/attach")
    public ResponseEntity<DonationResponse> attachDonation(@PathVariable Long id,
                                                           @RequestParam Long userId) {
        return ResponseEntity.ok(donationService.attach(id, userId));
    }

    /** Supprime une ligne de don (purge des dons de test) — les avantages déjà appliqués restent. */
    @DeleteMapping("/donations/{id}")
    public ResponseEntity<Void> deleteDonation(@PathVariable Long id) {
        donationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
