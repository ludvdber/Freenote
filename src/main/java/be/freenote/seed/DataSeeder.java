package be.freenote.seed;

import be.freenote.entity.*;
import be.freenote.enums.Category;
import be.freenote.enums.ReportStatus;
import be.freenote.repository.*;
import be.freenote.service.MinioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Component
@Profile("dev")
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final SectionRepository sectionRepository;
    private final CourseRepository courseRepository;
    private final ProfessorRepository professorRepository;
    private final DocumentRepository documentRepository;
    private final RatingRepository ratingRepository;
    private final FavoriteRepository favoriteRepository;
    private final DonationRepository donationRepository;
    private final DelegateHistoryRepository delegateHistoryRepository;
    private final ReportRepository reportRepository;
    private final MinioService minioService;

    private final Random rng = new Random(42); // deterministic for reproducible seeds

    /**
     * Generates a minimal valid PDF containing the given title and course name.
     * Raw PDF format — no external library needed.
     */
    private byte[] generateTestPdf(String title, String courseName) {
        String content =
            "%PDF-1.4\n" +
            "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
            "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
            "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
            "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
            "4 0 obj<</Length 120>>\nstream\n" +
            "BT /F1 18 Tf 50 700 Td (" + title.replace("(", "\\(").replace(")", "\\)") + ") Tj " +
            "0 -30 Td /F1 12 Tf (" + courseName.replace("(", "\\(").replace(")", "\\)") + ") Tj ET\n" +
            "endstream\nendobj\n" +
            "xref\n0 6\n" +
            "0000000000 65535 f \n" +
            "0000000009 00000 n \n" +
            "0000000058 00000 n \n" +
            "0000000115 00000 n \n" +
            "0000000296 00000 n \n" +
            "0000000251 00000 n \n" +
            "trailer<</Size 6/Root 1 0 R>>\nstartxref\n450\n%%EOF";
        return content.getBytes(StandardCharsets.US_ASCII);
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Database already seeded — skipping.");
            return;
        }

        log.info("Seeding database...");

        var userList = seedUsers();
        // Build a name-based lookup — saveAll does not guarantee index order
        Map<String, User> users = new HashMap<>();
        userList.forEach(u -> users.put(u.getUsername(), u));

        var sections = seedSections();
        assignUserSections(users.values(), sections);
        var courses = seedCourses(sections, users);
        var professors = seedProfessors();
        var documents = seedDocuments(courses, users, professors);
        int ratingsCount = seedRatings(documents, users);
        int favoritesCount = seedFavorites(documents, users);
        int donationsCount = seedDonations(users);
        int delegatesCount = seedDelegates(users, sections);
        int reportsCount = seedReports(documents, users);

        log.info("Seeded: {} users, {} sections, {} courses, {} professors, {} documents, " +
                        "{} ratings, {} favorites, {} donations, {} delegates, {} reports",
                users.size(), sections.size(), courses.size(), professors.size(), documents.size(),
                ratingsCount, favoritesCount, donationsCount, delegatesCount, reportsCount);
    }

    // ==================== USERS ====================

    private List<User> seedUsers() {
        List<User> users = new ArrayList<>();

        // 1 admin
        users.add(createUser("admin", "Admin Freenote", "DISCORD", "admin-001", true, "ADMIN", 500,
                "Administrateur de la plateforme Freenote", true, true,
                "freenote-admin", null, null, null));

        // 5 active verified users
        users.add(createUser("Sophie_M", "Sophie Martin", "DISCORD", "disc-g101", true, "USER", 280,
                "Etudiante en informatique a l'ISFCE, passionnee de dev web et Java.",
                true, true, "sophie-dev", "https://linkedin.com/in/sophie-m", null, null));
        users.add(createUser("Karim_B", "Karim Boulanger", "DISCORD", "disc-102", true, "USER", 195,
                "3eme annee comptabilite. J'aime partager mes syntheses !",
                true, true, null, "https://linkedin.com/in/karim-b", "Karim#4521", null));
        users.add(createUser("Julie_V", "Julie Vandenberghe", "DISCORD", "disc-g103", true, "USER", 150,
                "Assistante de direction ISFCE. Notes de cours et examens corriges.",
                true, false, "juliev-notes", null, null, null));
        users.add(createUser("Mehdi_A", "Mehdi Amrani", "DISCORD", "disc-104", true, "USER", 120,
                "Futur developpeur full-stack. Je partage tout ce que je peux.",
                false, false, "mehdi-dev", null, "Mehdi#7890", null));
        users.add(createUser("Clara_D", "Clara Dupont", "DISCORD", "disc-g105", true, "USER", 85,
                "Marketing digital a l'ISFCE. Mes resumes sont toujours colores.",
                false, false, null, "https://linkedin.com/in/clara-d", null, null));

        // 5 users with some contributions
        users.add(createUser("Thomas_R", "Thomas Renard", "DISCORD", "disc-201", true, "USER", 45,
                "Etudiant en fiscalite", false, false, null, null, null, null));
        users.add(createUser("Amira_S", "Amira Saidi", "DISCORD", "disc-g202", true, "USER", 35,
                null, false, false, null, null, null, null));
        users.add(createUser("Lucas_P", "Lucas Petit", "DISCORD", "disc-203", true, "USER", 28,
                "Fan de reseaux et cybersecurite", true, false, null, null, "Lucas#1234", null));
        users.add(createUser("Emma_L", "Emma Lambert", "DISCORD", "disc-g204", true, "USER", 15,
                null, false, false, null, null, null, null));
        users.add(createUser("Youssef_K", "Youssef Kaddouri", "DISCORD", "disc-205", true, "USER", 12,
                null, false, false, null, null, null, null));

        // 4 unverified users
        users.add(createUser("Lea_F", "Lea Fontaine", "DISCORD", "disc-g301", false, "USER", 0,
                null, false, false, null, null, null, null));
        users.add(createUser("Nathan_G", "Nathan Garcia", "DISCORD", "disc-302", false, "USER", 0,
                null, false, false, null, null, null, null));
        users.add(createUser("Ines_H", "Ines Hadj", "DISCORD", "disc-g303", false, "USER", 0,
                null, false, false, null, null, null, null));
        users.add(createUser("Axel_J", "Axel Janssens", "DISCORD", "disc-304", false, "USER", 0,
                null, false, false, null, null, null, null));

        return userRepository.saveAll(users);
    }

    private User createUser(String username, String fullName, String provider, String oauthId,
                            boolean verified, String role, int xp,
                            String bio, boolean profilePublic, boolean showInCarousel,
                            String github, String linkedin, String discord, String website) {
        String emailHash = verified ? sha256Hex(username.toLowerCase() + "@isfce.be") : null;

        String[] nameParts = fullName != null ? fullName.trim().split("\\s+", 2) : new String[0];
        String firstName = nameParts.length > 0 ? nameParts[0] : null;
        String lastName = nameParts.length > 1 ? nameParts[1] : null;

        User user = User.builder()
                .username(username)
                .emailHash(emailHash)
                .verified(verified)
                .role(role)
                .xp(xp)
                .build();

        UserProfile profile = UserProfile.builder()
                .user(user)
                .firstName(firstName)
                .lastName(lastName)
                .displayRealName(true)
                .bio(bio)
                .website(website)
                .github(github)
                .linkedin(linkedin)
                .discord(discord)
                .profilePublic(profilePublic)
                .showInCarousel(showInCarousel)
                .termsAcceptedAt(verified ? LocalDateTime.now() : null)
                .build();

        user.setProfile(profile);

        // Cascade through user.oauthLinks (CascadeType.ALL) persists the link with the user.
        be.freenote.entity.UserOauthLink link = be.freenote.entity.UserOauthLink.builder()
                .user(user)
                .provider(provider)
                .oauthId(oauthId)
                .build();
        user.getOauthLinks().add(link);
        return user;
    }

    // ==================== SECTIONS ====================

    /** Spread seeded users across sections (round-robin) so the section features have realistic data. */
    private void assignUserSections(Collection<User> users, List<Section> sections) {
        if (sections.isEmpty()) return;
        int i = 0;
        for (User u : users) {
            if (u.getProfile() != null) {
                u.getProfile().setSection(sections.get(i % sections.size()));
            }
            i++;
        }
        userRepository.saveAll(users);
        log.info("Assigned sections to {} users across {} sections", users.size(), sections.size());
    }

    private List<Section> seedSections() {
        List<Section> sections = List.of(
                Section.builder().name("Informatique").icon("\uD83D\uDCBB").approved(true).build(),
                Section.builder().name("Comptabilite").icon("\uD83D\uDCCA").approved(true).build(),
                Section.builder().name("Marketing").icon("\uD83D\uDCC8").approved(true).build(),
                Section.builder().name("Assistant de direction").icon("\uD83D\uDCCB").approved(true).build(),
                Section.builder().name("Fiscalite").icon("\uD83D\uDCB0").approved(true).build(),
                Section.builder().name("Langues").icon("\uD83C\uDF0D").approved(true).build(),
                Section.builder().name("Techniques de programmation").icon("\u2699\uFE0F").approved(true).build()
        );
        return sectionRepository.saveAll(sections);
    }

    // ==================== COURSES ====================

    private List<Course> seedCourses(List<Section> sections, Map<String, User> users) {
        // Map section names for easy lookup
        Map<String, Section> byName = new HashMap<>();
        sections.forEach(s -> byName.put(s.getName(), s));

        List<Course> courses = new ArrayList<>();

        // Informatique
        courses.add(course("Programmation Java", byName.get("Informatique"), users.get("Sophie_M")));
        courses.add(course("Base de donnees", byName.get("Informatique"), users.get("Mehdi_A")));
        courses.add(course("Reseaux", byName.get("Informatique"), users.get("Mehdi_A")));
        courses.add(course("Systemes d'exploitation", byName.get("Informatique"), users.get("Sophie_M")));

        // Comptabilite
        courses.add(course("Comptabilite generale", byName.get("Comptabilite"), users.get("Karim_B")));
        courses.add(course("Droit fiscal", byName.get("Comptabilite"), users.get("Karim_B")));
        courses.add(course("Mathematiques financieres", byName.get("Comptabilite"), users.get("Karim_B")));

        // Marketing
        courses.add(course("Marketing digital", byName.get("Marketing"), users.get("Clara_D")));
        courses.add(course("Etude de marche", byName.get("Marketing"), users.get("Clara_D")));
        courses.add(course("Communication commerciale", byName.get("Marketing"), users.get("Clara_D")));

        // Assistant de direction
        courses.add(course("Bureautique avancee", byName.get("Assistant de direction"), users.get("Julie_V")));
        courses.add(course("Organisation administrative", byName.get("Assistant de direction"), users.get("Julie_V")));
        courses.add(course("Correspondance professionnelle", byName.get("Assistant de direction"), users.get("Julie_V")));

        // Fiscalite
        courses.add(course("Impot des personnes physiques", byName.get("Fiscalite"), users.get("Karim_B")));
        courses.add(course("TVA et douanes", byName.get("Fiscalite"), users.get("Karim_B")));
        courses.add(course("Impot des societes", byName.get("Fiscalite"), users.get("Karim_B")));

        // Langues
        courses.add(course("Anglais des affaires", byName.get("Langues"), users.get("Julie_V")));
        courses.add(course("Neerlandais professionnel", byName.get("Langues"), users.get("Julie_V")));
        courses.add(course("Francais : techniques redactionnelles", byName.get("Langues"), users.get("Sophie_M")));

        // Techniques de programmation
        courses.add(course("Algorithmique", byName.get("Techniques de programmation"), users.get("Sophie_M")));
        courses.add(course("Developpement web", byName.get("Techniques de programmation"), users.get("Mehdi_A")));
        courses.add(course("Programmation orientee objet", byName.get("Techniques de programmation"), users.get("Sophie_M")));
        courses.add(course("Gestion de projets IT", byName.get("Techniques de programmation"), users.get("Mehdi_A")));

        return courseRepository.saveAll(courses);
    }

    private Course course(String name, Section section, User creator) {
        return Course.builder()
                .name(name)
                .section(section)
                .createdBy(creator)
                .approved(true)
                .build();
    }

    // ==================== PROFESSORS ====================

    private List<Professor> seedProfessors() {
        List<Professor> profs = List.of(
                Professor.builder().name("M. Dupont").approved(true).build(),
                Professor.builder().name("Mme Lefevre").approved(true).build(),
                Professor.builder().name("M. Janssens").approved(true).build(),
                Professor.builder().name("Mme Claessens").approved(true).build(),
                Professor.builder().name("M. Bosmans").approved(true).build(),
                Professor.builder().name("Mme Peeters").approved(true).build(),
                Professor.builder().name("M. Laurent").approved(true).build(),
                Professor.builder().name("Mme Van den Berg").approved(true).build(),
                Professor.builder().name("M. Renard").approved(true).build(),
                Professor.builder().name("Mme Dubois").approved(true).build()
        );
        return professorRepository.saveAll(profs);
    }

    // ==================== DOCUMENTS ====================

    private List<Document> seedDocuments(List<Course> courses, Map<String, User> users, List<Professor> professors) {
        // Verified users who contribute documents
        List<User> contributors = List.of(
                users.get("Sophie_M"), users.get("Karim_B"), users.get("Julie_V"),
                users.get("Mehdi_A"), users.get("Clara_D"), users.get("Thomas_R"),
                users.get("Amira_S"), users.get("Lucas_P"), users.get("Emma_L"), users.get("Youssef_K"));

        record DocDef(String title, String courseName, Category cat, String lang, String year,
                      boolean aiGen, boolean anon) {}

        List<DocDef> defs = List.of(
                // Informatique — Programmation Java
                new DocDef("Synthese Programmation Java - Chapitre 3 : Heritage", "Programmation Java", Category.SYNTHESE, "FR", "2025-2026", false, false),
                new DocDef("Examen Programmation Java - Janvier 2025", "Programmation Java", Category.EXAMEN, "FR", "2024-2025", false, false),
                new DocDef("Exercices Java - Collections et Streams", "Programmation Java", Category.EXERCICES, "FR", "2025-2026", false, false),
                new DocDef("Notes de cours Java - Threads et concurrence", "Programmation Java", Category.NOTES, "FR", "2025-2026", true, false),
                // Informatique — Base de donnees
                new DocDef("Exercices SQL - Jointures et sous-requetes", "Base de donnees", Category.EXERCICES, "FR", "2025-2026", false, false),
                new DocDef("Synthese Base de donnees - Normalisation", "Base de donnees", Category.SYNTHESE, "FR", "2024-2025", false, false),
                new DocDef("Examen BDD - Juin 2025", "Base de donnees", Category.EXAMEN, "FR", "2024-2025", false, true),
                // Informatique — Reseaux
                new DocDef("Notes de cours Reseaux - TCP/IP", "Reseaux", Category.NOTES, "FR", "2025-2026", false, false),
                new DocDef("Synthese Reseaux - Modele OSI", "Reseaux", Category.SYNTHESE, "FR", "2025-2026", true, false),
                new DocDef("Lab Reseaux - Configuration routeur Cisco", "Reseaux", Category.EXERCICES, "EN", "2025-2026", false, false),
                // Informatique — Systemes
                new DocDef("Synthese Linux - Commandes essentielles", "Systemes d'exploitation", Category.SYNTHESE, "FR", "2024-2025", false, false),
                new DocDef("Examen Systemes - Aout 2025", "Systemes d'exploitation", Category.EXAMEN, "FR", "2024-2025", false, false),
                // Comptabilite
                new DocDef("Examen Comptabilite Generale - Juin 2025", "Comptabilite generale", Category.EXAMEN, "FR", "2024-2025", false, false),
                new DocDef("Synthese Comptabilite - Plan comptable PCMN", "Comptabilite generale", Category.SYNTHESE, "FR", "2025-2026", false, false),
                new DocDef("Exercices Ecritures comptables", "Comptabilite generale", Category.EXERCICES, "FR", "2025-2026", false, false),
                new DocDef("Notes Droit fiscal - IPP 2025", "Droit fiscal", Category.NOTES, "FR", "2025-2026", false, false),
                new DocDef("Synthese Droit fiscal - TVA", "Droit fiscal", Category.SYNTHESE, "FR", "2024-2025", true, false),
                new DocDef("Exercices Mathematiques financieres - Interets composes", "Mathematiques financieres", Category.EXERCICES, "FR", "2025-2026", false, false),
                // Marketing
                new DocDef("Synthese Marketing digital - SEO et SEM", "Marketing digital", Category.SYNTHESE, "FR", "2025-2026", false, false),
                new DocDef("Etude de cas - Lancement produit B2C", "Etude de marche", Category.DIVERS, "FR", "2025-2026", false, false),
                new DocDef("Examen Marketing digital - Janvier 2025", "Marketing digital", Category.EXAMEN, "FR", "2024-2025", false, false),
                new DocDef("Notes Communication commerciale - Storytelling", "Communication commerciale", Category.NOTES, "FR", "2025-2026", true, false),
                // Assistant de direction
                new DocDef("Synthese Bureautique - Fonctions Excel avancees", "Bureautique avancee", Category.SYNTHESE, "FR", "2025-2026", false, false),
                new DocDef("Exercices Correspondance professionnelle", "Correspondance professionnelle", Category.EXERCICES, "FR", "2025-2026", false, false),
                new DocDef("Notes Organisation administrative - Archivage", "Organisation administrative", Category.NOTES, "FR", "2024-2025", false, true),
                // Fiscalite
                new DocDef("Examen IPP - Juin 2025", "Impot des personnes physiques", Category.EXAMEN, "FR", "2024-2025", false, false),
                new DocDef("Synthese TVA et douanes - Regime forfaitaire", "TVA et douanes", Category.SYNTHESE, "FR", "2025-2026", false, false),
                new DocDef("Notes Impot des societes - Base imposable", "Impot des societes", Category.NOTES, "FR", "2025-2026", true, false),
                // Langues
                new DocDef("Synthese Anglais des affaires - Business emails", "Anglais des affaires", Category.SYNTHESE, "EN", "2025-2026", false, false),
                new DocDef("Examen Neerlandais - Aout 2025", "Neerlandais professionnel", Category.EXAMEN, "FR", "2024-2025", false, false),
                new DocDef("Exercices Francais - Textes argumentatifs", "Francais : techniques redactionnelles", Category.EXERCICES, "FR", "2025-2026", false, false),
                // Techniques de programmation
                new DocDef("Synthese Algorithmique - Tri et recherche", "Algorithmique", Category.SYNTHESE, "FR", "2025-2026", false, false),
                new DocDef("Examen Algorithmique - Janvier 2025", "Algorithmique", Category.EXAMEN, "FR", "2024-2025", false, false),
                new DocDef("Projet Dev web - Site e-commerce (rapport)", "Developpement web", Category.DIVERS, "FR", "2025-2026", false, false),
                new DocDef("Synthese Dev web - React et composants", "Developpement web", Category.SYNTHESE, "FR", "2025-2026", true, false),
                new DocDef("Notes POO - Patterns de conception", "Programmation orientee objet", Category.NOTES, "FR", "2025-2026", false, false),
                new DocDef("Exercices POO - Interfaces et abstraction", "Programmation orientee objet", Category.EXERCICES, "FR", "2025-2026", false, false),
                new DocDef("Synthese Gestion de projets - Methode Agile", "Gestion de projets IT", Category.SYNTHESE, "FR", "2025-2026", true, false),
                new DocDef("Examen Gestion de projets - Juin 2025", "Gestion de projets IT", Category.EXAMEN, "FR", "2024-2025", false, true),
                // Extras
                new DocDef("Formulaire type - Demande de stage", "Organisation administrative", Category.DIVERS, "FR", "2025-2026", false, false),
                new DocDef("Synthese complete Reseaux - Tout le cours", "Reseaux", Category.SYNTHESE, "FR", "2024-2025", false, false),
                new DocDef("Examen Dev web - Aout 2025", "Developpement web", Category.EXAMEN, "FR", "2024-2025", false, false),
                new DocDef("Cheat sheet SQL - Toutes les commandes", "Base de donnees", Category.DIVERS, "EN", "2025-2026", true, false),
                new DocDef("Exercices Excel - Tableaux croises dynamiques", "Bureautique avancee", Category.EXERCICES, "FR", "2025-2026", false, false),
                new DocDef("Notes Marketing - Analyse SWOT", "Etude de marche", Category.NOTES, "FR", "2025-2026", false, false),
                new DocDef("Summary Accounting Principles", "Comptabilite generale", Category.SYNTHESE, "EN", "2025-2026", true, true)
        );

        // Build course lookup
        Map<String, Course> courseByName = new HashMap<>();
        courses.forEach(c -> courseByName.put(c.getName(), c));

        List<Document> documents = new ArrayList<>();

        for (int i = 0; i < defs.size(); i++) {
            DocDef d = defs.get(i);
            Course c = courseByName.get(d.courseName());
            User author = d.anon() ? null : contributors.get(i % contributors.size());
            Professor prof = (i % 5 < 3) ? professors.get(i % professors.size()) : null; // ~60% have prof

            boolean isVerified = (i % 5 != 4); // ~80% verified
            int downloads = isVerified
                    ? (d.cat() == Category.SYNTHESE || d.cat() == Category.EXAMEN ? 30 + rng.nextInt(170) : 5 + rng.nextInt(80))
                    : rng.nextInt(10);
            // Generate and upload a real PDF to MinIO
            byte[] pdfBytes = generateTestPdf(d.title(), d.courseName());
            String fileKey = UUID.randomUUID() + "/" + d.title().replaceAll("[^a-zA-Z0-9àâéèêëïôùûüç_ -]", "") + ".pdf";
            try {
                minioService.upload(fileKey, new ByteArrayInputStream(pdfBytes), pdfBytes.length, "application/pdf");
            } catch (Exception ex) {
                log.warn("Failed to upload seed PDF for '{}': {}", d.title(), ex.getMessage());
                fileKey = "seed-missing.pdf"; // fallback — document exists in DB but file is missing
            }

            Document doc = Document.builder()
                    .title(d.title())
                    .course(c)
                    .user(author)
                    .professor(prof)
                    .category(d.cat())
                    .language(d.lang())
                    .year(d.year())
                    .aiGenerated(d.aiGen())
                    .anonymous(d.anon())
                    .verified(isVerified)
                    .fileKey(fileKey)
                    .fileSize((long) pdfBytes.length)
                    .downloadCount(downloads)
                    .averageRating(BigDecimal.ZERO)
                    .ratingCount(0)
                    .build();

            documents.add(doc);
        }

        documents = documentRepository.saveAll(documents);

        return documents;
    }

    // ==================== RATINGS ====================

    private int seedRatings(List<Document> documents, Map<String, User> users) {
        List<User> raters = new ArrayList<>(List.of(
                users.get("Sophie_M"), users.get("Karim_B"), users.get("Julie_V"),
                users.get("Mehdi_A"), users.get("Clara_D"), users.get("Thomas_R"),
                users.get("Amira_S"), users.get("Lucas_P"), users.get("Emma_L"), users.get("Youssef_K")));
        List<Document> rateableDocs = documents.stream()
                .filter(Document::isVerified)
                .toList();

        List<Rating> ratings = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (Document doc : rateableDocs) {
            int numRatings = 1 + rng.nextInt(4); // 1-4 ratings per doc
            Collections.shuffle(raters, rng);

            for (int j = 0; j < Math.min(numRatings, raters.size()); j++) {
                User rater = raters.get(j);
                // Skip self-ratings and ensure uniqueness
                if (doc.getUser() != null && doc.getUser().getId().equals(rater.getId())) continue;
                String key = doc.getId() + "-" + rater.getId();
                if (!seen.add(key)) continue;

                int score = 3 + rng.nextInt(3); // 3-5
                ratings.add(Rating.builder()
                        .document(doc)
                        .user(rater)
                        .score(score)
                        .build());
            }
        }

        ratings = ratingRepository.saveAll(ratings);

        // Update denormalized counters
        Map<Long, List<Rating>> byDoc = new HashMap<>();
        for (Rating r : ratings) {
            byDoc.computeIfAbsent(r.getDocument().getId(), k -> new ArrayList<>()).add(r);
        }
        for (var entry : byDoc.entrySet()) {
            Document doc = entry.getValue().getFirst().getDocument();
            List<Rating> docRatings = entry.getValue();
            double avg = docRatings.stream().mapToInt(Rating::getScore).average().orElse(0);
            doc.setAverageRating(BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP));
            doc.setRatingCount(docRatings.size());
            documentRepository.save(doc);
        }

        return ratings.size();
    }

    // ==================== FAVORITES ====================

    private int seedFavorites(List<Document> documents, Map<String, User> users) {
        List<User> activeUsers = List.of(
                users.get("Sophie_M"), users.get("Karim_B"), users.get("Julie_V"),
                users.get("Mehdi_A"), users.get("Clara_D"));
        List<Document> verifiedDocs = documents.stream().filter(Document::isVerified).toList();
        List<Favorite> favorites = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (User user : activeUsers) {
            int numFavs = 3 + rng.nextInt(6); // 3-8 favorites
            List<Document> shuffled = new ArrayList<>(verifiedDocs);
            Collections.shuffle(shuffled, rng);

            for (int j = 0; j < Math.min(numFavs, shuffled.size()); j++) {
                Document doc = shuffled.get(j);
                String key = user.getId() + "-" + doc.getId();
                if (!seen.add(key)) continue;

                favorites.add(Favorite.builder()
                        .user(user)
                        .document(doc)
                        .build());
            }
        }

        return favoriteRepository.saveAll(favorites).size();
    }

    // ==================== DONATIONS ====================

    private int seedDonations(Map<String, User> users) {
        User sophie = users.get("Sophie_M");
        User karim = users.get("Karim_B");

        // Set ad-free on profiles (entitlement derived from this expiry, no boolean flag)
        sophie.getProfile().setAdFreeUntil(LocalDateTime.now().plusMonths(3));
        karim.getProfile().setAdFreeUntil(LocalDateTime.now().plusMonths(3));
        userRepository.saveAll(List.of(sophie, karim));

        List<Donation> donations = List.of(
                Donation.builder()
                        .user(sophie)
                        .amount(BigDecimal.valueOf(5.00))
                        .kofiTransactionId("KOFI-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                        .adFreeUntil(sophie.getProfile().getAdFreeUntil())
                        .build(),
                Donation.builder()
                        .user(karim)
                        .amount(BigDecimal.valueOf(10.00))
                        .kofiTransactionId("KOFI-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                        .adFreeUntil(karim.getProfile().getAdFreeUntil())
                        .build()
        );

        return donationRepository.saveAll(donations).size();
    }

    // ==================== DELEGATES ====================

    private int seedDelegates(Map<String, User> users, List<Section> sections) {
        Map<String, Section> byName = new HashMap<>();
        sections.forEach(s -> byName.put(s.getName(), s));

        List<DelegateHistory> delegates = new ArrayList<>();

        // Active mandates
        delegates.add(DelegateHistory.builder()
                .user(users.get("Sophie_M"))
                .section(byName.get("Informatique"))
                .startDate(LocalDate.of(2025, 9, 15))
                .build());
        delegates.add(DelegateHistory.builder()
                .user(users.get("Mehdi_A"))
                .section(byName.get("Informatique"))
                .startDate(LocalDate.of(2025, 9, 15))
                .build());
        delegates.add(DelegateHistory.builder()
                .user(users.get("Karim_B"))
                .section(byName.get("Comptabilite"))
                .startDate(LocalDate.of(2025, 9, 15))
                .build());
        delegates.add(DelegateHistory.builder()
                .user(users.get("Clara_D"))
                .section(byName.get("Marketing"))
                .startDate(LocalDate.of(2025, 9, 15))
                .build());

        // Ended mandates
        delegates.add(DelegateHistory.builder()
                .user(users.get("Thomas_R"))
                .section(byName.get("Comptabilite"))
                .startDate(LocalDate.of(2024, 9, 15))
                .endDate(LocalDate.of(2025, 6, 30))
                .build());
        delegates.add(DelegateHistory.builder()
                .user(users.get("Lucas_P"))
                .section(byName.get("Informatique"))
                .startDate(LocalDate.of(2024, 9, 15))
                .endDate(LocalDate.of(2025, 6, 30))
                .build());

        return delegateHistoryRepository.saveAll(delegates).size();
    }

    // ==================== REPORTS ====================

    private int seedReports(List<Document> documents, Map<String, User> users) {
        List<Document> verifiedDocs = documents.stream().filter(Document::isVerified).toList();

        List<Report> reports = List.of(
                Report.builder()
                        .document(verifiedDocs.get(5))
                        .user(users.get("Thomas_R"))
                        .reason("Document incomplet, manque les 3 derniers chapitres de la matiere.")
                        .status(ReportStatus.PENDING)
                        .build(),
                Report.builder()
                        .document(verifiedDocs.get(12))
                        .user(users.get("Lucas_P"))
                        .reason("Contenu copie depuis un autre site sans attribution. Voir https://example.com pour la source originale.")
                        .status(ReportStatus.PENDING)
                        .build(),
                Report.builder()
                        .document(verifiedDocs.get(20))
                        .user(users.get("Mehdi_A"))
                        .reason("Le fichier PDF est corrompu, impossible de l'ouvrir apres la page 5.")
                        .status(ReportStatus.RESOLVED)
                        .build()
        );

        return reportRepository.saveAll(reports).size();
    }

    // ==================== UTILS ====================

    private static String sha256Hex(String input) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }
}
