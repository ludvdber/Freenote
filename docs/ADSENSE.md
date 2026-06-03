# Activer Google AdSense sur Freenote

> Statut : **préparé, pas encore activé.** `frontend/public/ads.txt` existe avec un placeholder.
> Le reste (snippet `<head>`, CSP, unités pub) est décrit ici et s'applique **une fois que tu as
> ton ID éditeur `ca-pub-…`** et que le site est **en ligne en HTTPS**.

## Pourquoi le site doit d'abord être en ligne

AdSense ne valide un compte qu'après avoir **crawlé un site live** : contenu réel, navigation,
mentions légales / politique de confidentialité accessibles, HTTPS. La séquence est donc :

1. Déployer Freenote sur `https://freenote.be` (voir [`INFRA-SETUP.md`](INFRA-SETUP.md)).
2. Dans AdSense → **Sites → Ajouter un site** : `freenote.be`.
3. AdSense te donne un **snippet `<head>`** + ton **ID éditeur** `ca-pub-XXXXXXXXXXXXXXXX`.
4. Appliquer les 4 changements ci-dessous, **redéployer**, puis cliquer **« Demander un examen »**.
5. Examen Google : quelques jours à ~2 semaines.

## ⚠️ RGPD / Belgique — obligatoire avant de diffuser

AdSense dépose des cookies publicitaires. Pour servir des annonces **personnalisées** à des
visiteurs de l'EEE/UK, Google **impose un CMP certifié IAB TCF v2.2** (bandeau de consentement).
Le plus simple : activer **« Funding Choices » / Google CMP** directement dans AdSense
(Confidentialité et messages → Message de consentement RGPD). Sans CMP certifié, Google bloque
ou dégrade la diffusion en Europe. À mettre en place **avant** la diffusion réelle, en cohérence
avec la page `/privacy` (mentionne déjà la pub — relire avec le juriste, cf. note légale).

---

## Les 4 changements à appliquer (quand tu as l'ID éditeur)

Remplace partout `ca-pub-XXXXXXXXXXXXXXXX` par ton vrai ID, et `pub-XXXXXXXXXXXXXXXX` (sans `ca-`).

### 1. `frontend/public/ads.txt`

Déjà créé — remplace juste le placeholder :

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

### 2. `frontend/index.html` — snippet du loader dans le `<head>`

```html
<script async
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
  crossorigin="anonymous"></script>
```

### 3. CSP — `src/main/java/be/freenote/config/SecurityConfig.java`

La CSP actuelle est volontairement stricte (`script-src 'self'`) → elle **bloquerait** le script
AdSense. Élargir les directives concernées (ajouts en gras conceptuel) :

```java
.policyDirectives(
    "default-src 'self'; " +
    "script-src 'self' https://pagead2.googlesyndication.com https://*.googlesyndication.com " +
        "https://adservice.google.com https://*.googleadservices.com https://*.google.com " +
        "https://www.googletagservices.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https://api.dicebear.com https://cdn.discordapp.com " +
        "https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net; " +
    "connect-src 'self' https://pagead2.googlesyndication.com https://*.googlesyndication.com " +
        "https://*.google.com https://*.doubleclick.net; " +
    "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com " +
        "https://*.googlesyndication.com; " +
    "frame-ancestors 'self'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
)
```

Notes :
- Garder `frame-ancestors 'self'` (les PDF embarqués en iframe en dépendent).
- Certains formats AdSense (notamment **Auto Ads**) injectent des scripts inline et peuvent exiger
  `'unsafe-inline'` dans `script-src` — ce qui affaiblit la CSP. **Préférer des unités manuelles**
  (`<ins class="adsbygoogle">`, étape 4) qui passent **sans** `'unsafe-inline'`. Si une annonce
  refuse de s'afficher, ouvrir la console : la CSP y logue le domaine manquant → l'ajouter.
- Référence officielle (liste de domaines qui évolue) :
  <https://support.google.com/adsense/answer/12166601> (CSP).

### 4. Brancher une vraie unité dans `AdBanner` — `frontend/src/components/ui/AdBanner.tsx`

Aujourd'hui `AdBanner` rend un placeholder `Ad WxH`. Le garde-fou `if (user?.supporter) return null;`
**doit rester** (les donateurs n'ont pas de pub). Remplacer le placeholder par l'unité AdSense créée
dans le dashboard (Annonces → Par unité d'annonce → `data-ad-slot`) :

```tsx
import { useEffect } from 'react';
// ...
useEffect(() => {
  try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch { /* noop */ }
}, []);
// ... dans le rendu, à la place de la Box placeholder :
<ins className="adsbygoogle"
     style={{ display: 'block' }}
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="0000000000"
     data-ad-format="auto"
     data-full-width-responsive="true" />
```

Conserver le `<AdSlot>` existant : il gère déjà le masquage pour les supporters et l'effondrement
de l'espace réservé.

---

## Pour la simple demande d'examen (minimum)

Si tu veux juste **soumettre la demande** sans encore brancher d'unités : étapes **1 + 2 + 3**
suffisent (ads.txt + snippet `<head>` + CSP). Le snippet seul permet à Google de détecter le code
et de lancer l'examen. Les unités (étape 4) et le CMP peuvent suivre une fois approuvé — mais le CMP
RGPD doit être en place **avant la diffusion réelle** en Belgique.

> Dis-moi quand tu as l'`ca-pub-…` : j'applique les 4 changements (CSP comprise) et je rebuild le jar.
