package be.freenote.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateDocumentRequest {

    @Size(max = 50, message = "Le titre ne doit pas dépasser 50 caractères")
    private String title;

    private Long courseId;

    private String category;

    private String language;

    @Size(max = 20, message = "Year must not exceed 20 characters")
    private String year;

    private Long professorId;

    private Boolean verified;
}
