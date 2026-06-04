<div align="center">

<img src="frontend/public/banner.png" alt="Freenote — Éclaire ta promo" width="680" />

# Freenote

### Le hub de documents des étudiants de l'ISFCE — *éclaire ta promo.*

Synthèses, notes de cours et exercices, partagés entre étudiants vérifiés.

[![Java](https://img.shields.io/badge/Java-25-orange)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

</div>

---

## Le projet

**Freenote** est une plateforme d'entraide **privée et gratuite**, réservée aux membres
vérifiés de la communauté ISFCE (Bruxelles). Chaque étudiant se connecte via Discord, vérifie
son adresse `@isfce.be`, puis accède à une bibliothèque de documents partagés par ses pairs —
recherche instantanée, notes, favoris, classement XP, et une interface soignée.

> Monorepo : backend **Spring Boot 4 / Java 25** à la racine, frontend **React 19 / Vite** dans
> [`frontend/`](frontend/). Le tout se construit en **un seul fat jar** auto-suffisant (API +
> SPA) déployable d'un `java -jar`.

## Fonctionnalités

| | |
|---|---|
| **Accès vérifié** | Connexion Discord + vérification email `@isfce.be` (code à 6 chiffres). Aucun contenu visible sans email validé. |
| **Documents** | Upload PDF (≤ 10 Mo), prévisualisation in-app, favoris, notes ⭐, signalement, tags. |
| **Recherche** | Plein-texte via Meilisearch — vérifiés d'abord, filtres section / cours / catégorie. |
| **Gamification** | XP à la vérification/téléchargement/notation, classement global ou par section. |
| **Profils** | Avatar (lettre, DiceBear ou Discord), section, nom d'affichage optionnel, profil public/privé. |
| **Notifications** | Temps réel via Server-Sent Events. |
| **Admin** | Modération documents, cours, sections, profs, signalements, utilisateurs, dons, **bannissement** (email + Discord). |
| **Outils** | Calculateur IPv4, convertisseur de base, Base64, décodeur JWT (100 % client). |

## Stack technique

**Backend** — Java 25 · Spring Boot 4 · Gradle (Kotlin DSL) · PostgreSQL 17 · Redis 7 · MinIO ·
Meilisearch · Flyway · MapStruct · Lombok · OAuth2 Discord · JWT (cookie HttpOnly) · Virtual Threads

**Frontend** — React 19 · Vite · TypeScript strict · MUI (glassmorphism) · TanStack Query ·
Zustand · React Router · i18n (FR/EN) · Three.js (hero)

## Architecture

```text
Notarium/
├── src/main/java/be/freenote/   # Backend Spring Boot
│   ├── config/                  # Security, CORS, SPA forwarding…
│   ├── controller/              # Endpoints REST (DTO in/out)
│   ├── service/ + impl/         # Logique métier
│   ├── repository/              # Spring Data JPA
│   ├── entity/ · dto/ · mapper/ # JPA · records · MapStruct
│   ├── security/                # JWT, OAuth2, filtres, rate-limit
│   └── event/                   # XP & notifications (Spring Events)
├── src/main/resources/db/migration/  # Flyway — V1__init.sql
├── frontend/                    # SPA React (voir frontend/)
├── scripts/                     # Scripts de lancement Windows (.bat)
└── deploy/                      # systemd, nginx, env, backup
```

Flux d'une requête : `Controller (DTO) → Service → Repository / MinIO / Meilisearch`.
Les contrôleurs ne touchent jamais aux entités ; MapStruct fait le pont DTO ↔ entité.

## Démarrage rapide (dev)

**Prérequis :** Java 25+ et Docker.

```bash
# 1. Infrastructure (Postgres, Redis, MinIO, Meilisearch)
docker compose up -d

# 2. Backend + frontend en un clic (Windows)
scripts\start-dev.bat
#   ou manuellement :
./gradlew bootRun --args='--spring.profiles.active=dev'   # backend  :8080
cd frontend && npm install && npm run dev                 # frontend :3000
```

En profil **`dev`**, la base est peuplée automatiquement (15 utilisateurs, 7 sections, 46
documents…) et un bouton **DevLogin** permet de se connecter sans Discord. Console MinIO :
<http://localhost:9001> (`minioadmin` / `minioadmin`).

## Tests

```bash
./gradlew test                 # tests unitaires backend
./gradlew integrationTest      # tests d'intégration (Testcontainers, Docker requis)
cd frontend && npx vitest run  # tests frontend
cd frontend && npm run build   # tsc + build de prod
```

## Build de production

```bash
./gradlew bootJar   # → build/libs/freenote-0.0.1-SNAPSHOT.jar  (backend + SPA embarqués)
java -jar build/libs/freenote-*.jar --spring.profiles.active=prod
```

## Licence

Distribué sous licence **[MIT](LICENSE)**. Les documents partagés restent la propriété de leurs
auteurs et ne sont accessibles qu'aux membres vérifiés de la communauté ISFCE.

<div align="center">
<sub>Fait avec ☕ par un (ancien) étudiant de l'ISFCE.</sub>
</div>
