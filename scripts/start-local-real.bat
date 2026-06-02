@echo off
title Freenote - Test REEL local (single-jar, profil local)
REM Les scripts sont dans scripts/ ; on se replace a la racine du projet.
cd /d "%~dp0.."

echo.
echo  ============================================================
echo   Freenote - Test REEL local (sans fake data)
echo  ============================================================
echo   - VRAI Discord + VRAI email @isfce.be (pas de DevLogin)
echo   - Pas de seed : la base demarre vide
echo   - Le jar sert le site ET l'API sur http://localhost:8080
echo  ============================================================
echo.

REM --- 1. Charger les secrets reels (Discord + SMTP) ---
REM  Le fichier doit etre un .cmd (Windows ne sait pas executer un .env via "call").
if not exist "local-real.cmd" (
    echo  [ERREUR] local-real.cmd introuvable.
    echo           Copie local-real.cmd.example en local-real.cmd et remplis-le.
    pause
    exit /b 1
)
call .\local-real.cmd

REM --- 2. Infra data (postgres/redis/minio/meili) ---
echo  [1/3] Demarrage de l'infra Docker...
docker compose up -d
if %errorlevel% neq 0 (
    echo  [ERREUR] Docker n'est pas lance.
    pause
    exit /b 1
)

REM --- 3. Build du fat jar (frontend prod embarque, donc PAS de bouton DevLogin) ---
echo.
echo  [2/3] Build du single-jar (npm build + bootJar)... cela peut prendre 1-2 min.
call .\gradlew bootJar
if %errorlevel% neq 0 (
    echo  [ERREUR] Le build a echoue.
    pause
    exit /b 1
)

REM --- 4. Lancement en profil local ---
echo.
echo  [3/3] Lancement... ouvre http://localhost:8080
echo.
for %%f in (build\libs\freenote-*.jar) do set JAR=%%f
java -Dspring.profiles.active=local -jar "%JAR%"
pause
