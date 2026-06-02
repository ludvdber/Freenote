package be.freenote.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateDocumentRequest {

    @NotBlank(message = "Title is required")
    @Size(max = 200, message = "Title must not exceed 200 characters")
    private String title;

    @NotNull(message = "Course ID is required")
    private Long courseId;

    @NotBlank(message = "Category is required")
    private String category;

    // Optional. A 4-digit year in 2000–2099, or empty/absent.
    @Pattern(regexp = "^(20\\d{2})?$", message = "L'année doit être comprise entre 2000 et 2099")
    private String year;

    private Long professorId;

    @NotBlank(message = "Language is required")
    private String language;

    private boolean aiGenerated;

    private boolean anonymous;

    private List<String> tags;
}
