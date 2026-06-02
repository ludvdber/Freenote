package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.CreateCourseRequest;
import be.freenote.dto.request.CreateProfessorRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
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
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    // --- System / SMTP keep-alive (the "compteur" of days since the last sent email) ---

    @GetMapping("/smtp-status")
    public ResponseEntity<SmtpStatusResponse> getSmtpStatus() {
        return ResponseEntity.ok(smtpKeepAliveService.getStatus());
    }

    // --- Documents ---

    @GetMapping("/documents/pending")
    public ResponseEntity<List<DocumentResponse>> getPendingDocuments() {
        return ResponseEntity.ok(documentService.getUnverified());
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

    // --- Professors ---

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

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<UserResponse> updateUserRole(@PathVariable Long id, @RequestParam String role) {
        return ResponseEntity.ok(userService.adminUpdateRole(id, role));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.adminDeleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{id}/ban")
    public ResponseEntity<Void> banUser(@PathVariable Long id,
                                        @RequestParam(required = false) String reason,
                                        Authentication authentication) {
        Long adminId = SecurityUtils.currentUserId(authentication);
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
}
