@echo off
title Freenote - Build du jar deployable
REM Les scripts sont dans scripts/ ; on se replace a la racine du projet.
cd /d "%~dp0.."

echo.
echo  ============================================================
echo   Freenote - Build du jar deployable (bootJar)
echo  ============================================================
echo   - Compile le backend + build le frontend (npm run build)
echo   - Embarque la SPA sous /static dans un fat jar unique
echo   - Sortie : build\libs\freenote-^<version^>.jar
echo  ============================================================
echo.

call .\gradlew bootJar
if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Le build a echoue. Regarde les messages ci-dessus.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo   Build termine. Jar(s) produit(s) :
echo  ============================================================
for %%f in (build\libs\freenote-*.jar) do echo   %%~ff  (%%~zf octets)
echo.
echo   Deploiement : copie ce jar en /opt/freenote/freenote.jar
echo   sur le LXC puis "systemctl restart freenote".
echo   Flyway applique les migrations en attente automatiquement.
echo  ============================================================
echo.
pause
