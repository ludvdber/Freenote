package be.freenote.seed;

import be.freenote.entity.Course;
import be.freenote.entity.Section;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.SectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

/**
 * Seeds the official ISFCE catalogue (sections + courses, all pre-approved) on first boot of a
 * non-dev environment (profiles {@code local} and {@code prod}). The rich {@link DataSeeder}
 * (users, documents, ratings…) is {@code @Profile("dev")} only and creates its own demo sections,
 * so the two never run together. Idempotent: skips entirely once any section exists, which means
 * an admin can freely add/rename/delete sections afterwards without this re-seeding.
 *
 * <p>Source: <a href="https://www.isfce.org/">isfce.org</a>. Trailing administrative items of each
 * cursus ("Dossier pédagogique de la section", "Profil professionnel", "Liste des compétences…")
 * are intentionally omitted — they are not courses students upload documents to.
 */
@Slf4j
@Component
@Profile("!dev")
@RequiredArgsConstructor
public class ReferenceDataSeeder implements CommandLineRunner {

    private final SectionRepository sectionRepository;
    private final CourseRepository courseRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (sectionRepository.count() > 0) {
            log.info("Sections already present — skipping ISFCE reference data seed.");
            return;
        }

        log.info("Seeding ISFCE reference data (sections + courses)…");
        int courses = 0;

        courses += seedSection("Assistant de direction", "📋",
                // 1er niveau
                "Informatique : Introduction à l'informatique",
                "Éléments de comptabilité et de fiscalité",
                "Français : communication écrite et orale",
                "Prise de notes rapide",
                "Stage orienté d'insertion socioprofessionnelle",
                "Techniques de recherche de l'information",
                "Traitement de textes : éléments de base",
                "Faits et institutions économiques",
                "Informatique : tableur",
                "Organisation des entreprises et éléments de management",
                "Éléments de statistique",
                "2e Langue en situation appliquée à l'enseign. sup. – UE 2",
                "2e Langue en situation appliquée à l'enseign. sup. – UE 3",
                // 2e niveau
                "1re et 2e Langues en situation appliq. à l'enseign. sup. – UE 4",
                "Traitement de textes : utilisation professionnelle",
                "Communication professionnelle",
                "Intégration de logiciels bureautiques",
                "Éléments de base en gestion des ressources humaines",
                "Relations humaines et communication professionnelles",
                "Notions de management commercial",
                "Techniques d'organisation professionnelle",
                // 3e niveau
                "1re Langue en situation appliquée à l'enseign. sup. – UE 5",
                "1re Langue des Affaires appliquée à l'enseign. sup. – UE 6",
                "Activités professionnelles de formation",
                "Atelier professionnel et marchés publics",
                "Notions de droit appliqué",
                "Laboratoire de logiciels bureautiques",
                "Stage d'intégration professionnelle",
                "Épreuve intégrée : Bachelier en Assistant de direction");

        courses += seedSection("Comptabilité", "📊",
                // 1re
                "Comptabilité générale : Principes et fondements",
                "Impôts des personnes physiques (I.P.P.)",
                "Mathématiques financières et statistique",
                "Stage orienté d'insertion socioprofessionnelle",
                "Techniques de communication professionnelle",
                "Taxe sur la Valeur Ajoutée",
                "Banque et finance",
                "Droit civil",
                "Informatique : Tableur",
                "Organisation des entreprises et éléments de management",
                "Langue en situation appliquée à l'enseignement sup. – UE 2",
                // 2e
                "Comptabilité et droit des sociétés",
                "Impôt des sociétés",
                "Droit social",
                "Comptabilité analytique : Principes et Fondements",
                "Comptabilité Générale Approfondie",
                "Déontologie et compliance",
                "Droit économique",
                "Faits et institutions économiques",
                "Application professionnelle de l'outil informatique",
                "Leadership et gestion du changement",
                "Langue en situation appliquée à l'enseignement sup. – UE 3",
                // 3e
                "Éléments de management stratégique",
                "Comptabilités spécifiques",
                "Comptabilité analytique approfondie",
                "Comptabilité et contrôles",
                "Analyse de bilans",
                "Gestion financière et budgétaire et business plan",
                "Langue : Terminologie des métiers du chiffre et séminaire de management",
                "Stage d'intégration professionnelle",
                "Activités professionnelles de formation",
                "Épreuve intégrée : Bachelier en Comptabilité, option Gestion");

        courses += seedSection("Informatique, orienté développement d'applications", "💻",
                // 1er niveau
                "Langue en situation appliquée à l'enseignement sup. – UE 2",
                "Initiation aux bases de données",
                "Gestion et exploitation de bases de données",
                "Structure des ordinateurs",
                "Système d'exploitation",
                "Mathématiques appliquées à l'informatique",
                "Analyse informatique",
                "Techniques de gestion de projets",
                "Principes algorithmiques et programmation",
                "Web principes de base",
                "Éléments de statistique",
                "Information et communication professionnelles",
                // 2e niveau
                "Programmation orientée objet",
                "Bases des réseaux",
                "Projet d'analyse et de conception",
                "Projet de développement SGBD",
                "Projet de développement Web",
                "Produits logiciels de gestion intégrés",
                "Notions de e-business",
                // 3e niveau
                "Organisation des entreprises et éléments de management",
                "Administration, gestion et sécurisation des réseaux",
                "Veille technologique",
                "Projet d'intégration de développement",
                "Stage d'intégration professionnelle",
                "Activités professionnelles de formation",
                "Épreuve intégrée : Bachelier en Informatique, orienté développement d'applications");

        courses += seedSection("Marketing", "📈",
                // 1er niveau
                "Techniques de créativité",
                "Techniques d'analyse en marketing stratégique",
                "Recherche documentaire et études de marchés",
                "Éléments de statistique",
                "Typologie des consommateurs",
                "Élément de législation appliquée au commerce",
                "Principes de base du marketing",
                "Informatique : Tableur",
                "Techniques de communication et dynamique de groupe",
                "Faits et institutions économiques",
                "Organisation des entreprises et éléments de management",
                "Éléments de comptabilité et de gestion financière et budgétaire",
                "Stage orienté d'insertion socioprofessionnelle",
                "Deuxième langue en situation appliquée à l'enseignement sup. – UE 2",
                // 2e niveau
                "Première et deuxième langues en situation appliquée à l'enseignement sup. – UE 3",
                "Première langue en situation appliquée à l'enseignement sup. – UE 4",
                "Marketing : séminaire",
                "Business Model",
                "Statistique inférentielle",
                "Marketing international et exportation",
                "Marketing opérationnel",
                "Gestion de la relation client",
                "Techniques de vente et négociation",
                "Distribution et merchandising",
                "Stratégies de communication marketing",
                // 3e niveau
                "Première langue en situation appliquée à l'enseignement sup. – UE 5",
                "Laboratoire : plan stratégique et opérationnel",
                "Laboratoire d'études de marché et statistique appliquée",
                "Laboratoire : outils digitaux",
                "Marketing stratégique",
                "Activités professionnelles de formation : bachelier en marketing",
                "Stage d'intégration professionnelle : bachelier en marketing",
                "Épreuve intégrée de la section : Bachelier en marketing");

        courses += seedSection("Fiscalité (complément)", "💰",
                "Enregistrement et successions",
                "Procédures fiscales",
                "Pratique de la TVA",
                "Compléments impôt des personnes physiques – impôt des sociétés – impôt des personnes morales");

        courses += seedSection("Technicien commercial", "🛒",
                "Bases en techniques commerciales",
                "Techniques commerciales",
                "Bureautique",
                "Courrier d'affaires",
                "Français et communication",
                "Bases de comptabilité",
                "Mathématique appliquée au secteur commercial",
                "Éléments de droit appliqué au commerce",
                "Communication orientée clientèle",
                "Néerlandais en situation – UE 1",
                "Néerlandais en situation – UE 2",
                "Néerlandais en situation – UE 3",
                "Néerlandais en situation – UE 4",
                "Néerlandais en situation – UE 5",
                "Néerlandais en situation – UE 6",
                "Stage",
                "Épreuve intégrée");

        courses += seedSection("Langues", "🌍",
                "Français (FLE)",
                "Néerlandais",
                "Anglais",
                "Espagnol",
                "Italien");

        log.info("Seeded {} ISFCE sections and {} courses.", sectionRepository.count(), courses);
    }

    /** Creates one approved section and its approved courses (createdBy = null = system). */
    private int seedSection(String name, String icon, String... courseNames) {
        Section section = sectionRepository.save(
                Section.builder().name(name).icon(icon).approved(true).build());
        List<Course> courses = Arrays.stream(courseNames)
                .map(cn -> Course.builder().name(cn).section(section).approved(true).build())
                .toList();
        courseRepository.saveAll(courses);
        return courseNames.length;
    }
}
