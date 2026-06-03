package be.freenote.service;

import be.freenote.dto.response.ProfessorResponse;

import java.util.List;

public interface ProfessorService {
    List<ProfessorResponse> getAll();
    /** Admin: every professor (approved or not), alphabetically — the admin panel list. */
    List<ProfessorResponse> getAllForAdmin();
    ProfessorResponse create(String name);
    /** Admin: create a professor approved immediately (bypasses the pending queue). */
    ProfessorResponse adminCreate(String name);
    ProfessorResponse approve(Long id);
    List<ProfessorResponse> getPending();
    /** Admin: delete a professor. Referencing documents keep their FK as NULL (ON DELETE SET NULL). */
    void delete(Long id);
}
