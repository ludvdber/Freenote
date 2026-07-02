package be.freenote.controller;

import be.freenote.dto.request.AssignDelegateRequest;
import be.freenote.dto.request.EndDelegateRequest;
import be.freenote.dto.request.UpdateDelegateRequest;
import be.freenote.dto.response.DelegateHistoryResponse;
import be.freenote.dto.response.DelegateMember;
import be.freenote.dto.response.DelegateResponse;
import be.freenote.service.DelegateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class DelegateController {

    private final DelegateService delegateService;

    // ── Public ──────────────────────────────────────────────────────────

    @GetMapping("/api/delegates")
    public ResponseEntity<List<DelegateResponse>> getActiveDelegates() {
        return ResponseEntity.ok(delegateService.getActiveDelegates());
    }

    @GetMapping("/api/delegates/former")
    public ResponseEntity<List<DelegateResponse>> getFormerDelegates() {
        return ResponseEntity.ok(delegateService.getFormerDelegates());
    }

    @GetMapping("/api/delegates/user/{userId}")
    public ResponseEntity<List<DelegateHistoryResponse>> getUserHistory(@PathVariable Long userId) {
        return ResponseEntity.ok(delegateService.getHistory(userId));
    }

    // ── Admin ───────────────────────────────────────────────────────────

    @GetMapping("/api/admin/delegates")
    public ResponseEntity<List<DelegateMember>> getAllMandates() {
        return ResponseEntity.ok(delegateService.getAllMandates());
    }

    @PostMapping("/api/admin/delegates")
    public ResponseEntity<DelegateMember> assignDelegate(@Valid @RequestBody AssignDelegateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(delegateService.assignDelegate(request));
    }

    @PatchMapping("/api/admin/delegates/{id}")
    public ResponseEntity<DelegateMember> endDelegate(
            @PathVariable Long id,
            @Valid @RequestBody EndDelegateRequest request) {
        return ResponseEntity.ok(delegateService.endDelegate(id, request));
    }

    @PatchMapping("/api/admin/delegates/{id}/edit")
    public ResponseEntity<DelegateMember> updateMandate(
            @PathVariable Long id,
            @RequestBody UpdateDelegateRequest request) {
        return ResponseEntity.ok(delegateService.updateMandate(id, request));
    }

    @DeleteMapping("/api/admin/delegates/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMandate(@PathVariable Long id) {
        delegateService.deleteMandate(id);
    }
}
