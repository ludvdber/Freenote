import org.springframework.boot.gradle.plugin.SpringBootPlugin

plugins {
    java
    id("org.springframework.boot") version "4.1.0"
}

group = "be"
// SemVer : 1.x.0 = nouvelles fonctionnalités, 1.0.x = correctifs. Le jar est renommé freenote.jar
// au déploiement (deploy/freenote.service), donc bumper la version ne casse pas systemd ; les scripts
// locaux résolvent build/libs/freenote-*.jar par glob. Garder frontend/src/lib/constants.ts APP_VERSION synchro.
version = "1.4.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

val mapstructVersion = "1.6.3"
val jjwtVersion = "0.13.0"

dependencies {
    // Spring Boot BOM (replaces dependency-management plugin for Gradle 9+)
    implementation(platform(SpringBootPlugin.BOM_COORDINATES))
    compileOnly(platform(SpringBootPlugin.BOM_COORDINATES))
    runtimeOnly(platform(SpringBootPlugin.BOM_COORDINATES))
    annotationProcessor(platform(SpringBootPlugin.BOM_COORDINATES))
    testImplementation(platform(SpringBootPlugin.BOM_COORDINATES))
    testRuntimeOnly(platform(SpringBootPlugin.BOM_COORDINATES))

    // Spring Boot Starters
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.boot:spring-boot-starter-mail")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-aspectj")

    // Database
    runtimeOnly("org.postgresql:postgresql")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.flywaydb:flyway-database-postgresql")

    // MinIO
    implementation("io.minio:minio:9.0.3")

    // PDFBox — assemble uploaded images (JPG/PNG) into a single PDF server-side (no Ghostscript)
    implementation("org.apache.pdfbox:pdfbox:3.0.7")
    // metadata-extractor — read the EXIF Orientation tag so phone photos aren't rotated in the PDF
    implementation("com.drewnoakes:metadata-extractor:2.20.0")

    // JWT
    implementation("io.jsonwebtoken:jjwt-api:$jjwtVersion")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:$jjwtVersion")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:$jjwtVersion")

    // MapStruct
    implementation("org.mapstruct:mapstruct:$mapstructVersion")
    annotationProcessor("org.mapstruct:mapstruct-processor:$mapstructVersion")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok-mapstruct-binding:0.2.0")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:testcontainers-postgresql:2.0.5")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter:2.0.5")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile> {
    options.compilerArgs.addAll(listOf(
        "-Amapstruct.defaultComponentModel=spring"
    ))
}

tasks.named<Test>("test") {
    useJUnitPlatform {
        excludeTags("integration")
    }
    // Suppress Lombok's sun.misc.Unsafe warning on Java 25+ (JEP 471)
    jvmArgs("--add-opens=java.base/sun.misc=ALL-UNNAMED")
}

tasks.register<Test>("integrationTest") {
    description = "Runs integration tests with Testcontainers"
    group = "verification"
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform {
        includeTags("integration")
    }
    jvmArgs("--add-opens=java.base/sun.misc=ALL-UNNAMED")
}

// --- Frontend packaging ---
// Build the Vite frontend and embed dist/ into the Spring Boot fat jar under /static.
// Result: a single `build/libs/freenote-0.0.1-SNAPSHOT.jar` servable with `java -jar`
// that contains both the API and the SPA — deploy target is a Proxmox LXC.

val frontendDir = layout.projectDirectory.dir("frontend")
val frontendDist = frontendDir.dir("dist")
val isWindows = org.gradle.internal.os.OperatingSystem.current().isWindows
val npmCmd = if (isWindows) "npm.cmd" else "npm"

val npmInstall = tasks.register<Exec>("npmInstall") {
    description = "Installs frontend dependencies (uses `npm install` so Windows doesn't trip over locked cache dirs)."
    group = "frontend"
    workingDir = frontendDir.asFile
    inputs.files(
        frontendDir.file("package.json"),
        frontendDir.file("package-lock.json")
    )
    outputs.file(frontendDir.dir("node_modules").file(".package-lock.json"))
    // `npm install` is tolerant to a pre-existing node_modules (unlike `npm ci` which wipes it first
    // and fails on Windows when Vite/tsc hold open handles on node_modules/.vite).
    commandLine(npmCmd, "install", "--no-audit", "--no-fund")
}

val buildFrontend = tasks.register<Exec>("buildFrontend") {
    description = "Builds the Vite production bundle into frontend/dist/"
    group = "frontend"
    dependsOn(npmInstall)
    workingDir = frontendDir.asFile
    // Re-run when any source file in frontend/src or vite config changes.
    inputs.files(
        frontendDir.file("package.json"),
        frontendDir.file("package-lock.json"),
        frontendDir.file("vite.config.ts"),
        frontendDir.file("tsconfig.app.json"),
        frontendDir.file("tsconfig.node.json"),
        frontendDir.file("tsconfig.json"),
        frontendDir.file("index.html")
    )
    inputs.dir(frontendDir.dir("src"))
    outputs.dir(frontendDist)
    commandLine(npmCmd, "run", "build")
}

// Copy the built SPA into the final jar's /static folder so Spring Boot serves it.
// Attached to `bootJar` rather than `processResources` so unit/integration tests
// don't trigger a frontend rebuild on every run.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    dependsOn(buildFrontend)
    from(frontendDist) {
        into("BOOT-INF/classes/static")
    }
}
