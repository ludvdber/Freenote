# Freenote — Infra & déploiement (référence complète)

> Document destiné à un assistant (humain ou IA) qui aide à configurer l'infrastructure de
> Freenote. Il est **auto-suffisant** : il contient le contexte applicatif nécessaire pour
> prendre les bonnes décisions sans lire le code.
>
> Domaine de prod : **`freenote.be`** (acheté chez OVH, à migrer vers Cloudflare).
> Chaîne cible : **Cloudflare → nginx → 1 LXC Proxmox** (app jar+systemd + Docker pour les data).

---

## 0. Contexte applicatif (ce que l'infra doit servir)

Freenote = hub de documents étudiants (Spring Boot 4 / Java 25 backend + React/Vite frontend),
packagé en **un seul fat jar** (`./gradlew bootJar`) qui embarque le frontend et sert tout sur
le port **8080**. Dépendances externes :

| Service | Rôle | Port défaut |
|---|---|---|
| PostgreSQL 17 | base de données | 5432 |
| Redis 7 | cache, rate-limit, buffers, blacklist JWT | 6379 |
| MinIO | stockage des PDF (S3-like) | 9000 (API) / 9001 (console) |
| Meilisearch | recherche plein-texte | 7700 |
| SMTP (Brevo) | envoi des codes de vérification email | 587 |
| Discord OAuth2 | **seul** moyen de connexion | — |

Points structurants pour l'infra :
- **Auth** : login Discord → cookie JWT **HttpOnly/Secure/SameSite=Lax** nommé `jwt`. En HTTPS
  obligatoire en prod (`COOKIE_SECURE=true`).
- **Gate d'accès** : aucun contenu visible sans email `@isfce.be` **vérifié** → la délivrabilité
  email (SMTP/SPF/DKIM) est **critique**, pas optionnelle.
- **Rate-limiting** par IP : repose sur la vraie IP client → derrière Cloudflare+nginx, la
  résolution `X-Forwarded-For` / `CF-Connecting-IP` doit être correcte (sinon tout le monde
  partage l'IP du proxy et le rate-limit est inutile).
- **Notifications SSE** : `GET /api/notifications/stream` est un flux long → nginx doit
  désactiver le buffering sur ce chemin.
- **PDF** : servis **uniquement** par le backend (MinIO refuse l'accès anonyme). Upload ≤ 10 Mo.
- **Migrations** : Flyway, une seule `V1__init.sql`, `ddl-auto=validate`. Appliquée au boot.

---

## 1. Discord — créer l'app OAuth2

1. <https://discord.com/developers/applications> → **New Application** (nom : Freenote).
2. Onglet **OAuth2** :
   - **Client ID** + **Client Secret** (Reset Secret pour le révéler) → à mettre dans l'env.
   - **Redirects**, ajouter une entrée par environnement (exactement) :
     - local : `http://localhost:8080/login/oauth2/code/discord`
     - prod  : `https://freenote.be/login/oauth2/code/discord`
3. Les scopes (`identify`, `email`) sont demandés par le code, rien à cocher.
4. Pas besoin d'activer le bot. (Un bot Discord « rôle vérifié » est prévu plus tard, hors scope.)

Mapping env : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.

---

## 2. Brevo — SMTP transactionnel (envoi des codes)

Pourquoi Brevo et pas la boîte OVH/Zimbra : une boîte mail est faite pour un humain (volume
throttlé, délivrabilité moindre sur mails automatisés). Brevo est un relais transactionnel
(gratuit 300 mails/j, hébergé Paris/RGPD, DKIM géré). **Ne jamais auto-héberger Postfix** sur le
Proxmox (IP blacklistée).

1. Compte <https://www.brevo.com> → **SMTP & API → SMTP** : noter le **login** + générer une
   **clé SMTP**. → `SMTP_USERNAME`, `SMTP_PASSWORD` (host `smtp-relay.brevo.com`, port `587`).
2. **Authentifier le domaine** `freenote.be` : Brevo → **Senders, Domains & Dedicated IPs →
   Domains → Add a domain**. Brevo fournit les enregistrements SPF/DKIM à créer dans le DNS
   (section 4). Sans ça → spam garanti vers `@isfce.be`.
3. Créer un **expéditeur** `noreply@freenote.be`. L'app envoie avec ce From (`MAIL_FROM`).

Mapping env : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM`.

**Zimbra OVH (offert)** : à garder pour la **réception** humaine (`postmaster@`, `contact@`,
`dmarc@freenote.be` qui recevra les rapports DMARC). Pas pour l'envoi applicatif.

---

## 3. Cloudflare — rattacher le domaine

1. Compte Cloudflare → **Add a site** `freenote.be` (plan Free suffit).
2. Cloudflare donne **2 nameservers** → chez **OVH** : *Domaine → Serveurs DNS* → remplacer les
   NS OVH par ceux de Cloudflare. Propagation : quelques heures.
3. Ensuite tout le DNS se gère depuis Cloudflare.

### Réglages Cloudflare utiles
- **SSL/TLS → Overview → Full (strict)** (chiffré edge↔navigateur ET edge↔origine, certificat
  origine validé). **Jamais** "Flexible" (faille + boucle de redirection).
- **SSL/TLS → Edge Certificates** : *Always Use HTTPS* = On ; *Minimum TLS* = 1.2 ;
  *Automatic HTTPS Rewrites* = On.
- **Origine** : soit Let's Encrypt via certbot sur nginx, soit un *Cloudflare Origin
  Certificate* (15 ans) installé sur nginx — au choix, les deux marchent avec Full (strict).
- **Network → WebSockets** = On (ne gêne pas le SSE, utile si extension future).
- **Security** : niveau *Medium*, *Bot Fight Mode* On (gratuit). Optionnel : une *WAF custom
  rule* pour rate-limiter `/api/auth/*` et `/oauth2/*` au edge.
- **Speed → Brotli** = On. **Caching** : laisser auto ; ne PAS mettre en cache `/api/*`
  (Cloudflare ne cache pas les réponses non-GET ni avec cookies par défaut, donc OK, mais
  vérifier qu'aucune *Cache Rule* trop large n'attrape `/api`).
- ⚠️ Ne **pas** activer "Rocket Loader" / "Mirage" (peuvent casser le SPA React).

---

## 4. DNS (enregistrements dans Cloudflare)

`<IP_ORIGINE>` = IP publique qui atteint ton nginx.

| Type | Nom | Contenu | Proxy |
|---|---|---|---|
| A | `@` (`freenote.be`) | `<IP_ORIGINE>` | 🟠 Proxied |
| CNAME | `www` | `freenote.be` | 🟠 Proxied |
| MX | `@` | serveur mail OVH (ex. `mx1.mail.ovh.net`, prio 1 ; voir le panel OVH) | ⚪ DNS only |
| TXT (SPF) | `@` | `v=spf1 include:spf.brevo.com include:mx.ovh.com ~all` | ⚪ |
| TXT/CNAME (DKIM) | (valeurs fournies par Brevo, ex. `brevo._domainkey`) | (valeur Brevo) | ⚪ |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@freenote.be; fo=1; adkim=s; aspf=s` | ⚪ |

Règles :
- **Un seul** enregistrement SPF par domaine : fusionner les `include:` (Brevo + OVH) en une
  ligne, comme ci-dessus.
- Tout ce qui est **mail** (MX, SPF, DKIM, DMARC) reste **DNS only ⚪** (jamais proxifié).
- A/CNAME du site restent **Proxied 🟠** (active le edge → impose le bloc `real_ip` nginx).
- Après config Brevo : revenir dans Brevo et cliquer *Verify/Authenticate* (tout au vert).
- DMARC : commencer `p=quarantine`, passer à `p=reject` une fois la délivrabilité confirmée.

---

## 5. Proxmox — créer le LXC

LXC Debian 12, **non privilégié**, avec **nesting** (obligatoire pour Docker dans un LXC).

```bash
# Sur l'hôte Proxmox. Ajuste l'ID (200), le storage, le bridge.
pct create 200 local:vztmpl/debian-12-standard_*.tar.zst \
  --hostname freenote \
  --cores 2 --memory 4096 --swap 2048 \
  --rootfs local-lvm:20 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1 \
  --unprivileged 1 \
  --onboot 1
pct start 200 && pct enter 200
```

Pièges Proxmox/LXC :
- **`nesting=1` obligatoire** sinon le daemon Docker ne démarre pas. Déjà créé ? →
  `pct set 200 --features nesting=1` puis `pct reboot 200`.
- Si Docker échoue sur overlayfs : `apt install -y fuse-overlayfs` puis
  `/etc/docker/daemon.json` = `{ "storage-driver": "fuse-overlayfs" }`, `systemctl restart docker`.
- `keyctl`/`apparmor` : sur Proxmox récent c'est OK par défaut pour un LXC nesting. Si Postgres
  dans Docker râle sur `keyctl`, passer le conteneur en privilégié est un dernier recours.
- Ressources conseillées : 2 vCPU / 4 Go RAM / 20 Go disque pour démarrer (le jar tourne en ZGC,
  `MaxRAMPercentage=75`). Monter à 6-8 Go si beaucoup d'uploads/recherche.

---

## 6. LXC — paquets + Docker

```bash
apt update && apt install -y openjdk-25-jre-headless curl postgresql-client age git \
  ca-certificates gnupg nginx certbot python3-certbot-nginx

# Docker officiel
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
docker run --rm hello-world   # doit réussir → nesting OK
```

---

## 7. Les 4 services data (Docker compose dans le LXC)

Un compose **déjà durci pour la prod** est fourni : **`deploy/docker-compose.prod.yml`**
(le `docker-compose.yml` à la racine est la version *dev*, à ne pas utiliser en prod). Ses
différences : ports bornés à `127.0.0.1` uniquement, secrets via un `.env` sibling (jamais en
dur), `MEILI_ENV=production`, `restart: unless-stopped`, volumes nommés persistants.

```bash
mkdir -p /opt/freenote && cd /opt/freenote
cp <repo>/deploy/docker-compose.prod.yml docker-compose.yml
cp <repo>/deploy/data.env.example       .env     # remplir chaque secret, puis :
chmod 600 .env
docker compose up -d
docker compose ps     # les 4 doivent être (healthy)
```

⚠️ **Cohérence des secrets** : les valeurs de `.env` (Docker) et `/etc/freenote/freenote.env`
(app) doivent correspondre : `POSTGRES_USER/PASSWORD`↔`DB_USERNAME/DB_PASSWORD`,
`MINIO_ROOT_USER/PASSWORD`↔`MINIO_ACCESS_KEY/SECRET_KEY`, `MEILI_MASTER_KEY`↔`MEILISEARCH_API_KEY`.
Ne jamais publier 5432/6379/9000/7700 sur l'IP publique (le binding `127.0.0.1` du compose
prod s'en charge).

---

## 8. L'app (fat jar + systemd)

Build sur ta machine de dev, dépose sur le LXC :

```bash
# machine de dev :
./gradlew bootJar
scp build/libs/freenote-*.jar root@<LXC>:/opt/freenote/freenote.jar
scp deploy/freenote.service     root@<LXC>:/etc/systemd/system/freenote.service

# sur le LXC :
useradd --system --home /opt/freenote --shell /usr/sbin/nologin freenote 2>/dev/null || true
install -d -m 0750 -o root -g freenote /etc/freenote
chown freenote:freenote /opt/freenote/freenote.jar
vim /etc/freenote/freenote.env          # voir section 9
chmod 600 /etc/freenote/freenote.env && chown freenote:freenote /etc/freenote/freenote.env
systemctl daemon-reload && systemctl enable --now freenote
journalctl -u freenote -f               # Flyway applique V1__init, "Started FreenoteApplication"
```

`deploy/freenote.service` lance déjà avec `-Dspring.profiles.active=prod`, ZGC,
`MaxRAMPercentage=75`, `EnvironmentFile=/etc/freenote/freenote.env`, hardening systemd.

---

## 9. Variables d'environnement prod (`/etc/freenote/freenote.env`)

Base : `deploy/freenote.env.example`. Valeurs critiques :

| Variable | Valeur |
|---|---|
| `DB_URL` | `jdbc:postgresql://127.0.0.1:5432/freenote` |
| `DB_USERNAME` / `DB_PASSWORD` | `freenote` / le vrai mot de passe Postgres |
| `REDIS_HOST` / `REDIS_PORT` | `127.0.0.1` / `6379` |
| `MINIO_ENDPOINT` | `http://127.0.0.1:9000` |
| `MINIO_ACCESS_KEY` / `SECRET_KEY` | les vraies clés MinIO |
| `MEILISEARCH_HOST` / `API_KEY` | `http://127.0.0.1:7700` / la vraie master key |
| `JWT_SECRET` | `openssl rand -base64 96 \| tr -d '\n'` (≥ 64 octets, HS512) |
| `EMAIL_HASH_SALT` | `openssl rand -base64 32` |
| `DISCORD_CLIENT_ID` / `SECRET` | app Discord prod (redirect `https://freenote.be/...`) |
| `SMTP_HOST/PORT/USERNAME/PASSWORD` | Brevo |
| `MAIL_FROM` | `noreply@freenote.be` (domaine authentifié Brevo) |
| `FRONTEND_URL` | `https://freenote.be` |
| `CORS_ALLOWED_ORIGINS` | `https://freenote.be` |
| `COOKIE_SECURE` | `true` |
| `TRUSTED_PROXIES` | **l'IP du LXC nginx** (PAS Cloudflare — le backend ne voit que nginx) |
| `KOFI_VERIFICATION_TOKEN` | depuis Ko-fi (peut rester vide au lancement) |
| `SERVER_PORT` | `8080` |

---

## 10. nginx (sur le LXC ou un LXC dédié)

Utilise `deploy/nginx.conf.example` (déjà configuré pour `freenote.be`). Il contient :
- `server_name freenote.be www.freenote.be` + redirection 80→443 ;
- en-têtes sécurité (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) ;
- `client_max_body_size 12M` (aligné sur l'upload 10 Mo + marge) ;
- un **bloc dédié `location /api/notifications/stream`** avec `proxy_buffering off` (SSE) ;
- un **bloc `real_ip` Cloudflare commenté en tête** → **à décommenter** (sinon rate-limit et
  logs cassés derrière le edge).

```bash
cp deploy/nginx.conf.example /etc/nginx/sites-available/freenote.be
# DÉCOMMENTER le bloc real_ip (CIDR Cloudflare + real_ip_header CF-Connecting-IP)
# ajuster l'IP upstream (server 127.0.0.1:8080 si nginx est sur le même LXC que l'app)
ln -s /etc/nginx/sites-available/freenote.be /etc/nginx/sites-enabled/
certbot --nginx -d freenote.be -d www.freenote.be   # cert origine Let's Encrypt
nginx -t && systemctl reload nginx
```

CIDR Cloudflare à garder à jour : <https://www.cloudflare.com/ips/> (v4 + v6).
Si nginx est sur le **même** LXC que l'app, `upstream` = `127.0.0.1:8080`.

---

## 11. Premier admin

Aucun admin pré-créé en prod. Après ta 1ʳᵉ inscription vérifiée sur le site live :

```bash
docker exec -it freenote-postgres psql -U freenote -d freenote \
  -c "UPDATE users SET role='ADMIN', verified=true WHERE username='TON_PSEUDO';"
```

`AdminRoleVerificationFilter` relit le rôle en base à chaque requête `/api/admin/**` → effet
immédiat (pas besoin d'attendre l'expiration du JWT).

---

## 12. Sauvegardes

`deploy/backup.sh` + `deploy/freenote-backup.{service,timer}` : dump Postgres + miroir MinIO,
chiffrés avec **age**. Génère la paire de clés, active le timer, fais **un restore drill** une
fois. **Ne committe JAMAIS la clé privée age.** Les snapshots Proxmox complètent (rollback
rapide) mais ne remplacent pas (pas de granularité / cross-version).

---

## 13. Mise à jour applicative

```bash
./gradlew bootJar
scp build/libs/freenote-*.jar root@<LXC>:/opt/freenote/freenote.jar.new
ssh root@<LXC> 'mv /opt/freenote/freenote.jar.new /opt/freenote/freenote.jar \
  && chown freenote:freenote /opt/freenote/freenote.jar && systemctl restart freenote'
```

Flyway applique les nouvelles migrations au boot. **En prod, ne jamais éditer une migration
livrée** : toute évolution de schéma = nouveau fichier `V2`, `V3`…

---

## 14. Checklist de mise en ligne (ordre conseillé)

1. [ ] App Discord créée (redirects local + prod)
2. [ ] Brevo : clé SMTP + domaine `freenote.be` authentifié + sender `noreply@`
3. [ ] Domaine sur Cloudflare (NS changés chez OVH)
4. [ ] DNS : A/CNAME proxied, MX gris, SPF/DKIM/DMARC gris
5. [ ] Cloudflare SSL = Full (strict), Always HTTPS, Bot Fight Mode
6. [ ] LXC créé (nesting=1), paquets + Docker OK (`hello-world`)
7. [ ] `docker compose` durci (ports 127.0.0.1, secrets) → 4 services healthy
8. [ ] `freenote.env` rempli (tous les change-me, secrets générés)
9. [ ] jar déposé + service systemd actif (`journalctl` : Flyway + Started)
10. [ ] nginx : conf en place, **bloc real_ip décommenté**, certbot, reload
11. [ ] Test bout-en-bout : login Discord → onboarding → code email reçu → membre vérifié
12. [ ] Se promouvoir admin (SQL)
13. [ ] Backups : clés age générées, timer actif, restore drill
14. [ ] DMARC passé à `p=reject` une fois la délivrabilité confirmée

---

## 15. Après la mise en ligne (hors périmètre Proxmox)

Ces points ne concernent pas l'infra Proxmox/nginx/Cloudflare mais conditionnent l'ouverture
au public — à traiter par le dev / l'admin du site, pas par l'IA infra :

- **Premier admin** : section 11 (SQL `UPDATE users SET role='ADMIN'` puis **se reconnecter via
  Discord** une fois — le rôle est porté par le cookie JWT, émis à la connexion).
- **AdSense** : le site doit être live AVANT de demander l'examen. Procédure complète (ads.txt,
  snippet `<head>`, élargissement CSP, CMP RGPD obligatoire en Belgique) dans
  [`ADSENSE.md`](ADSENSE.md).
- **Revue légale** : faire relire CGU / `/privacy` / `/terms` (la pub AdSense + cookies doivent y
  figurer) et bumper la date « dernière mise à jour » avant l'ouverture grand public.
- **DMARC** : passer de `p=quarantine` à `p=reject` une fois la délivrabilité Brevo confirmée.

---

## Annexe — variables d'env, table de correspondance

`application.yml` lit ces variables (défauts entre `:` ) :
`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `REDIS_HOST`, `REDIS_PORT(6379)`, `SMTP_HOST`,
`SMTP_PORT(587)`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM(noreply@freenote.be)`,
`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SERVER_PORT(8080)`, `TRUSTED_PROXIES()`,
`JWT_SECRET`, `COOKIE_SECURE(true)`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`,
`MINIO_BUCKET(freenote-docs)`, `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`, `EMAIL_HASH_SALT`,
`KOFI_VERIFICATION_TOKEN()`, `FRONTEND_URL(http://localhost:3000)`,
`CORS_ALLOWED_ORIGINS(http://localhost:3000)`.

Profils Spring : `dev` (seed + DevLogin, SMTP localhost:1025), `local` (test réel single-jar,
infra localhost, pas de seed/DevLogin), `prod` (tout via env, défaut du systemd).
