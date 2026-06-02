# Tester Freenote en réel sur ton PC (sans fake data)

But : valider le site comme en prod — vrai Discord, vrai email `@isfce.be`, base vide,
**et** valider le single-jar de déploiement — le tout sur ta machine.

Pourquoi le single-jar plutôt que le mode dev ? Le frontend buildé en prod **n'affiche
pas** le bouton DevLogin, et le profil `local` **ne lance ni le seeder ni `/api/dev/login`**
(ils sont `@Profile("dev")`). Tu testes donc exactement ce qui partira en prod.

## Prérequis (comptes externes — à toi de les créer)

1. **App Discord** — <https://discord.com/developers/applications> → New Application →
   onglet **OAuth2** :
   - copie le **Client ID** et le **Client Secret**
   - dans **Redirects**, ajoute exactement : `http://localhost:8080/login/oauth2/code/discord`
   - (les scopes `identify`+`email` sont demandés par le code, rien à cocher ici)
2. **SMTP Brevo** (gratuit, 300 mails/j) — <https://app.brevo.com> → **SMTP & API** →
   **SMTP** : récupère le login + une clé SMTP. (Pour un simple test local tu n'as PAS
   besoin d'authentifier le domaine ; tu authentifieras `freenote.be` seulement pour la prod.)

## Étapes

```bat
REM 1. Renseigne tes secrets
copy local-real.cmd.example local-real.cmd
REM   puis édite local-real.cmd (Discord + SMTP)

REM 2. Lance tout (infra Docker + build jar + run profil local)
scripts\start-local-real.bat
```

Ouvre <http://localhost:8080>. Le parcours réel :
1. **Se connecter** → Discord OAuth → compte provisoire créé (`membre-xxxx`).
2. **Onboarding** : choisis ton pseudo → section (optionnel) → entre une adresse
   `@isfce.be`, reçois le code par mail (Brevo), valide → tu es membre vérifié.
3. Tu vois browse/recherche/leaderboard vides (normal, base neuve). Upload un PDF de test.

## Te donner les droits admin (1ʳᵉ fois)

En prod comme en local-réel il n'y a pas d'admin pré-créé. Après ta vérification :

```bat
docker exec -it freenote-postgres psql -U freenote -d freenote -c "UPDATE users SET role='ADMIN', verified=true WHERE username='TON_PSEUDO';"
```

Reconnecte-toi (ou attends le rafraîchissement du JWT) → l'onglet Admin apparaît.
`AdminRoleVerificationFilter` relit le rôle en base à chaque requête `/api/admin/**`,
donc la promotion est prise en compte immédiatement côté autorisation.

## Repartir d'une base vide

```bat
docker compose down -v && docker compose up -d
```

## Notes

- `local-real.cmd` est **gitignoré** — il ne sera jamais committé. (Extension `.cmd`
  obligatoire : `call` sous Windows ne charge pas les variables d'un fichier `.env`.)
- Cookies en HTTP local : le profil `local` met `app.cookie.secure=false` (sinon le
  navigateur refuse le cookie JWT sur http).
- Si l'email n'arrive pas : vérifie les spams, puis les logs Brevo. Une erreur SMTP
  renvoie désormais un **503 propre** (corrigé), pas un 500 — tu le verras en `WARN`.
- C'est le **même jar** que tu déploieras : si ce test passe, le packaging prod est validé.
