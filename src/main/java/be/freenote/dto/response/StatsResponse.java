package be.freenote.dto.response;

import java.util.List;

public record StatsResponse(
        long totalDocs,
        long totalDownloads,
        long totalContributors,
        long totalCourses,
        long weekUploads,
        // Docs par section (sections approuvées) — alimente la constellation du hero : chaque
        // étoile est une section, sa taille/pulsation reflète l'activité réelle. Noms publics
        // (catalogue ISFCE), endpoint permitAll, donc visible des anonymes par design.
        List<SectionStat> sections
) {
    public record SectionStat(String name, long documentCount) {}
}
