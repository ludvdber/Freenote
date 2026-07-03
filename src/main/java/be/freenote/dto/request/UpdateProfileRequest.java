package be.freenote.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {

    @Size(max = 500, message = "Bio must not exceed 500 characters")
    private String bio;

    @Size(max = 200)
    @Pattern(regexp = "^$|^https?://[^\\s<>\"']+$", message = "Website must be a valid http(s) URL")
    private String website;

    @Size(max = 100)
    @Pattern(regexp = "^$|^[A-Za-z0-9][A-Za-z0-9-]{0,38}$", message = "GitHub must be a valid username")
    private String github;

    @Size(max = 100)
    @Pattern(regexp = "^$|^[A-Za-z0-9-_.]{3,100}$", message = "LinkedIn must be a valid handle")
    private String linkedin;

    @Size(max = 40)
    @Pattern(regexp = "^$|^[^\\s<>\"']+$", message = "Discord handle contains invalid characters")
    private String discord;

    private boolean profilePublic;

    private boolean showInCarousel;

    @Pattern(regexp = "^(AUTO|LETTER|DICEBEAR|DISCORD)$", message = "Invalid avatar source")
    private String avatarSource;

    @Size(max = 50)
    @Pattern(regexp = "^$|^[\\p{L}][\\p{L} '\\-]{0,49}$", message = "First name contains invalid characters")
    private String firstName;

    @Size(max = 50)
    @Pattern(regexp = "^$|^[\\p{L}][\\p{L} '\\-]{0,49}$", message = "Last name contains invalid characters")
    private String lastName;

    private boolean displayRealName;

    // Parcours à l'ISFCE (public si renseigné) — null = non communiqué.
    @Min(value = 2000, message = "Année invalide")
    @Max(value = 2100, message = "Année invalide")
    private Integer studyStartYear;

    @Min(value = 2000, message = "Année invalide")
    @Max(value = 2100, message = "Année invalide")
    private Integer studyEndYear;

    private boolean graduated;
}
