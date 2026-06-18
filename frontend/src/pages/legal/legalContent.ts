// Structured legal content for /legal, /privacy, /terms.
// Not stored in i18n JSON to keep fr.json/en.json readable and avoid bloating
// the translation bundles with ~500 lines of legal prose.

export type Locale = 'fr' | 'en';

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalPage {
  title: string;
  updatedLabel: string;
  sections: LegalSection[];
}

// Updated when the content materially changes. Shown to users.
export const LEGAL_UPDATED_AT = '2026-06-17';

// -------------------- LEGAL (mentions légales) --------------------

const legalFr: LegalPage = {
  title: 'Mentions légales',
  updatedLabel: 'Dernière mise à jour',
  sections: [
    {
      heading: 'Éditeur du site',
      body: [
        "Freenote est un projet personnel édité par un ancien étudiant de l'ISFCE (Institut Supérieur de Formation Continue Étudiante, Bruxelles).",
        "Le site est un projet indépendant, non affilié à l'ISFCE ni à aucune structure commerciale. Aucun numéro BCE n'y est rattaché : il s'agit d'une initiative étudiante sans but lucratif.",
        "L'identité complète de l'éditeur est déposée chez le registrar du nom de domaine et peut être communiquée aux autorités compétentes sur réquisition judiciaire. Pour tout contact officiel, rejoignez le serveur Discord communautaire (lien dans le pied de page).",
      ],
    },
    {
      heading: 'Hébergement',
      body: [
        "Le site est auto-hébergé par l'éditeur sur une infrastructure personnelle située en Belgique (serveur Proxmox). Aucun prestataire d'hébergement tiers n'est utilisé pour l'application, la base de données ou le stockage des fichiers.",
      ],
    },
    {
      heading: 'Propriété intellectuelle',
      body: [
        "Le code source de Freenote est distribué sous licence MIT et disponible publiquement sur GitHub.",
        "Les documents partagés par les utilisateurs restent la propriété de leurs auteurs respectifs. Leur accès est strictement réservé aux membres vérifiés de la communauté étudiante ISFCE.",
        "Les logos, marques et dénominations de l'ISFCE sont la propriété de leurs détenteurs respectifs et sont utilisés à titre informatif uniquement.",
      ],
    },
    {
      heading: 'Contact',
      body: [
        "Toute demande (question, signalement, demande RGPD, retrait droit d'auteur) peut être adressée via le serveur Discord communautaire en mentionnant explicitement le motif de la demande, ou en ouvrant une issue sur le dépôt GitHub du projet pour les sujets techniques. Les réponses sont apportées dans un délai raisonnable.",
      ],
    },
    {
      heading: 'Dons',
      body: [
        "Freenote est gratuit. Les dons volontaires effectués via Ko-fi servent exclusivement à couvrir les frais de fonctionnement (nom de domaine, consommation électrique du serveur). Aucun don ne constitue une rémunération de l'éditeur.",
      ],
    },
  ],
};

const legalEn: LegalPage = {
  title: 'Legal notice',
  updatedLabel: 'Last updated',
  sections: [
    {
      heading: 'Publisher',
      body: [
        'Freenote is a personal project published by a former ISFCE (Brussels) student.',
        'The site is an independent initiative, not affiliated with ISFCE or any commercial entity. No company registration (BCE) is attached to it: this is a non-profit student initiative.',
        "The publisher's full identity is registered with the domain registrar and may be disclosed to competent authorities upon lawful request. For any official matter, reach out via the community Discord server (link in the footer).",
      ],
    },
    {
      heading: 'Hosting',
      body: [
        'The site is self-hosted by the publisher on personal infrastructure located in Belgium (Proxmox server). No third-party hosting provider is used for the application, database or file storage.',
      ],
    },
    {
      heading: 'Intellectual property',
      body: [
        "Freenote's source code is distributed under the MIT license and publicly available on GitHub.",
        'Documents shared by users remain the property of their respective authors. Access is strictly restricted to verified members of the ISFCE student community.',
        'ISFCE logos, trademarks and names are the property of their respective owners and are used for informational purposes only.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        'Any request (question, report, GDPR request, copyright takedown) can be sent via the community Discord server with an explicit mention of the request type, or by opening an issue on the project GitHub repository for technical topics. Responses are provided within a reasonable timeframe.',
      ],
    },
    {
      heading: 'Donations',
      body: [
        'Freenote is free. Voluntary donations made via Ko-fi are used exclusively to cover operating costs (domain name, server electricity). No donation constitutes compensation for the publisher.',
      ],
    },
  ],
};

// -------------------- PRIVACY (RGPD) --------------------

const privacyFr: LegalPage = {
  title: 'Politique de confidentialité',
  updatedLabel: 'Dernière mise à jour',
  sections: [
    {
      heading: 'Responsable du traitement',
      body: [
        "Le responsable du traitement des données personnelles est l'éditeur du site, identifié dans les mentions légales. Pour exercer vos droits ou pour toute question, contactez l'éditeur via le serveur Discord communautaire (lien en pied de page) en mentionnant explicitement « Demande RGPD ».",
      ],
    },
    {
      heading: 'Données collectées',
      body: [
        "Informations de compte : identifiant OAuth (Discord), nom d'utilisateur, empreinte SHA-256 de votre email ISFCE (jamais stocké en clair).",
        "Informations de profil (optionnelles) : biographie, avatar, liens GitHub/LinkedIn/Discord, affichage public opt-in.",
        "Contenus créés : documents uploadés, votes et commentaires, favoris, historique de téléchargements (compteurs agrégés uniquement).",
        "Données techniques : jeton d'authentification JWT stocké dans un cookie HttpOnly de votre navigateur (non accessible par JavaScript), adresses IP conservées dans les journaux serveur pendant 30 jours à des fins de sécurité.",
      ],
    },
    {
      heading: 'Finalités et base légale',
      body: [
        "Gestion des comptes utilisateurs et authentification : exécution d'un contrat (les conditions d'utilisation acceptées à l'inscription).",
        "Partage de documents au sein de la communauté ISFCE : exécution du contrat.",
        "Sécurité, prévention de la fraude et du spam : intérêt légitime de l'éditeur à protéger le service et ses utilisateurs.",
      ],
    },
    {
      heading: 'Sous-traitants et destinataires',
      body: [
        "Discord : fournisseur d'authentification OAuth2 (données limitées : identifiant, nom affiché, email).",
        "Brevo (ex-Sendinblue), serveurs hébergés à Paris : envoi d'emails transactionnels (vérification). Politique RGPD disponible sur brevo.com.",
        "Google AdSense (Google Ireland Limited) : régie publicitaire affichant des annonces sur les pages publiques du site. Google et ses partenaires peuvent traiter des données de navigation à des fins de diffusion et de mesure publicitaires, uniquement après recueil de votre consentement (voir « Cookies » ci-dessous). Politique de confidentialité : policies.google.com/privacy.",
        "Hormis ces prestataires, les bases de données, le stockage des fichiers et l'indexation de recherche sont hébergés sur l'infrastructure personnelle de l'éditeur en Belgique.",
      ],
    },
    {
      heading: 'Transferts hors Union européenne',
      body: [
        "Aucun transfert structurel hors UE n'est effectué pour les données de compte. Discord (OAuth) et Google (AdSense), en tant que prestataires internationaux, peuvent traiter certaines données sur des serveurs situés hors UE selon leurs politiques respectives, encadrées par les clauses contractuelles types de la Commission européenne.",
      ],
    },
    {
      heading: 'Durée de conservation',
      body: [
        "Comptes utilisateurs : conservés tant que le compte existe. Vous pouvez supprimer votre compte à tout moment depuis votre page profil, ou en faire la demande à un administrateur via le serveur Discord communautaire.",
        "Documents partagés : conservés tant que le compte de l'auteur existe. En cas de suppression du compte, les documents sont anonymisés (l'auteur devient « Anonyme ») mais restent accessibles à la communauté.",
        "Journaux serveur (adresses IP) : 30 jours maximum, rotation automatique.",
        "Signalements : conservés 1 an maximum pour traçabilité.",
      ],
    },
    {
      heading: 'Vos droits',
      body: [
        "Conformément au RGPD, vous disposez des droits suivants : accès à vos données, rectification, effacement (« droit à l'oubli »), portabilité, opposition au traitement, limitation du traitement.",
        "Pour exercer ces droits, contactez l'éditeur via le serveur Discord communautaire en mentionnant explicitement « Demande RGPD ». Une réponse vous sera apportée dans un délai maximal d'un mois.",
        "En cas de litige non résolu, vous pouvez introduire une réclamation auprès de l'Autorité de protection des données belge (APD) : autoriteprotectiondonnees.be.",
      ],
    },
    {
      heading: 'Cookies et stockage local',
      body: [
        "Cookie strictement nécessaire : un cookie HttpOnly contenant le jeton JWT d'authentification (non accessible par JavaScript), indispensable au fonctionnement du service et donc exempté de consentement préalable au sens de l'article 5(3) de la directive ePrivacy.",
        "Cookies publicitaires et de mesure : les pages publiques affichent de la publicité via Google AdSense. Google et ses partenaires peuvent déposer des cookies de publicité, de personnalisation et de mesure d'audience. Ces cookies ne sont déposés qu'après votre consentement explicite, recueilli via une bannière de gestion du consentement (CMP) certifiée par Google et conforme au cadre de transparence et de consentement (TCF) de l'IAB. Vous pouvez modifier ou retirer votre choix à tout moment depuis cette bannière.",
        "Freenote n'utilise aucun outil d'analyse d'audience tiers (Google Analytics, Plausible, etc.) au-delà de la mesure publicitaire mentionnée ci-dessus.",
      ],
    },
  ],
};

const privacyEn: LegalPage = {
  title: 'Privacy policy',
  updatedLabel: 'Last updated',
  sections: [
    {
      heading: 'Data controller',
      body: [
        'The controller of personal data is the site publisher, identified in the legal notice. To exercise your rights or for any question, reach out to the publisher via the community Discord server (link in the footer) explicitly mentioning "GDPR request".',
      ],
    },
    {
      heading: 'Data we collect',
      body: [
        'Account information: OAuth identifier (Discord), username, SHA-256 hash of your ISFCE email (never stored in plain text).',
        'Profile information (optional): biography, avatar, GitHub/LinkedIn/Discord links, public display is opt-in.',
        'User-generated content: uploaded documents, ratings and comments, favorites, download history (aggregate counters only).',
        'Technical data: JWT authentication token stored in an HttpOnly cookie in your browser (not accessible by JavaScript), IP addresses kept in server logs for 30 days for security purposes.',
      ],
    },
    {
      heading: 'Purposes and legal basis',
      body: [
        'Account management and authentication: contract performance (terms accepted at sign-up).',
        'Document sharing within the ISFCE community: contract performance.',
        'Security, fraud and spam prevention: legitimate interest of the publisher to protect the service and its users.',
      ],
    },
    {
      heading: 'Processors and recipients',
      body: [
        'Discord: OAuth2 authentication provider (limited data: identifier, display name, email).',
        'Brevo (formerly Sendinblue), servers hosted in Paris: transactional email delivery (verification). GDPR policy on brevo.com.',
        'Google AdSense (Google Ireland Limited): advertising network displaying ads on the public pages of the site. Google and its partners may process browsing data for ad serving and measurement, only after your consent is collected (see "Cookies" below). Privacy policy: policies.google.com/privacy.',
        "Apart from these providers, databases, file storage and search indexing run on the publisher's personal infrastructure in Belgium.",
      ],
    },
    {
      heading: 'Transfers outside the European Union',
      body: [
        'No structural transfer outside the EU is performed for account data. Discord (OAuth) and Google (AdSense), as international providers, may process some data on servers located outside the EU according to their respective policies, governed by the European Commission Standard Contractual Clauses.',
      ],
    },
    {
      heading: 'Retention period',
      body: [
        'User accounts: retained as long as the account exists. You can delete your account at any time from your profile page, or request deletion from an administrator via the community Discord server.',
        "Shared documents: retained as long as the author's account exists. If the account is deleted, documents are anonymized (author becomes \"Anonymous\") but remain accessible to the community.",
        'Server logs (IP addresses): 30 days maximum, automatic rotation.',
        'Reports: retained for up to 1 year for traceability.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'Under GDPR, you have the following rights: access to your data, rectification, erasure ("right to be forgotten"), portability, objection to processing, restriction of processing.',
        'To exercise these rights, reach out to the publisher via the community Discord server explicitly mentioning "GDPR request". A response will be provided within one month.',
        'If a dispute cannot be resolved, you may lodge a complaint with the Belgian Data Protection Authority: autoriteprotectiondonnees.be.',
      ],
    },
    {
      heading: 'Cookies and local storage',
      body: [
        'Strictly necessary cookie: an HttpOnly cookie containing the JWT authentication token (not accessible by JavaScript), essential for the service to function and therefore exempt from prior consent under article 5(3) of the ePrivacy Directive.',
        'Advertising and measurement cookies: the public pages display advertising via Google AdSense. Google and its partners may set advertising, personalization and audience-measurement cookies. These cookies are only set after your explicit consent, collected through a Google-certified consent management platform (CMP) compliant with the IAB Transparency and Consent Framework (TCF). You can change or withdraw your choice at any time from that banner.',
        'Freenote uses no third-party audience analytics tools (Google Analytics, Plausible, etc.) beyond the advertising measurement mentioned above.',
      ],
    },
  ],
};

// -------------------- TERMS (CGU + takedown) --------------------

const termsFr: LegalPage = {
  title: "Conditions d'utilisation",
  updatedLabel: 'Dernière mise à jour',
  sections: [
    {
      heading: 'Objet',
      body: [
        "Freenote est une plateforme communautaire et gratuite de partage de documents d'études destinée exclusivement aux membres vérifiés de la communauté ISFCE. Son objectif est d'entraider les étudiants : synthèses, notes de cours, exercices.",
        "L'utilisation du site implique l'acceptation pleine et entière des présentes conditions.",
      ],
    },
    {
      heading: 'Accès et conditions d\'inscription',
      body: [
        "L'accès au contenu est réservé aux personnes majeures (18 ans ou plus) disposant d'une adresse email @isfce.be valide et vérifiée.",
        "L'inscription se fait via Discord OAuth2, suivie d'une vérification de l'email ISFCE. Aucun accès au contenu sans vérification effective.",
        "Un compte vérifié est strictement personnel et non cessible. Le partage d'un compte avec un tiers est un motif de suspension.",
      ],
    },
    {
      heading: 'Nature privée de la plateforme',
      body: [
        "Les documents hébergés sur Freenote sont strictement privés et uniquement accessibles aux membres vérifiés de la communauté ISFCE. La plateforme fonctionne comme un cercle privé d'entraide étudiante, équivalent numérique d'un prêt de notes entre camarades de promotion.",
        "Toute redistribution, republication ou diffusion en dehors de la plateforme (réseaux sociaux publics, autres sites, impression à grande échelle) est formellement interdite.",
      ],
    },
    {
      heading: 'Responsabilités de l\'utilisateur',
      body: [
        "En publiant un document, vous garantissez soit en être l'auteur, soit disposer des droits nécessaires pour le partager, soit reconnaître que le partage reste dans le strict cadre privé du cercle étudiant vérifié.",
        "Vous vous engagez à ne pas publier de contenu illicite, diffamatoire, discriminatoire, injurieux, pornographique, ou portant atteinte à la vie privée de tiers.",
        "Vous êtes seul responsable du contenu que vous publiez. L'éditeur agit en qualité d'hébergeur passif au sens de l'article 14 de la directive 2000/31/CE.",
      ],
    },
    {
      heading: 'Propriété et licence cédée',
      body: [
        "Vous conservez l'entière propriété intellectuelle des documents que vous partagez.",
        "En publiant un document, vous accordez à Freenote une licence non-exclusive, gratuite et limitée à l'hébergement, l'affichage, l'indexation et la distribution auprès des membres vérifiés de la plateforme. Cette licence cesse lorsque vous supprimez le document ou votre compte.",
      ],
    },
    {
      heading: 'Procédure de retrait (takedown)',
      body: [
        "Tout contenu jugé illicite, contrefaisant ou portant atteinte à des droits peut être signalé via le bouton « Signaler » présent sur la page de chaque document, ou via le serveur Discord communautaire en mentionnant explicitement « Retrait droit d'auteur » ou « Signaler un contenu ».",
        "L'éditeur s'engage à examiner chaque notification et, si le retrait est justifié, à supprimer le contenu dans un délai de 48 heures ouvrables à compter de la réception.",
        "Les auteurs des documents concernés seront informés de la décision de retrait.",
      ],
    },
    {
      heading: 'Suppression de compte',
      body: [
        "Vous pouvez supprimer votre compte à tout moment depuis votre page profil. La suppression est définitive et entraîne la perte de votre nom d'utilisateur, favoris et historique personnel.",
        "Les documents que vous avez partagés ne sont pas supprimés mais anonymisés : l'auteur affiché devient « Anonyme ». Ils restent accessibles à la communauté pour préserver la valeur collective des partages passés.",
        "Si vous souhaitez également supprimer vos documents, faites-en explicitement la demande via le serveur Discord communautaire avant de supprimer votre compte.",
      ],
    },
    {
      heading: 'Résiliation et sanctions',
      body: [
        "L'éditeur se réserve le droit de suspendre ou supprimer sans préavis tout compte en cas de violation manifeste des présentes conditions, notamment en cas de harcèlement, spam, contenu illicite ou partage d'un compte.",
      ],
    },
    {
      heading: 'Modification des conditions',
      body: [
        "L'éditeur peut modifier les présentes conditions à tout moment. Les modifications prennent effet dès leur publication sur le site. Les utilisateurs sont invités à consulter cette page régulièrement.",
      ],
    },
    {
      heading: 'Droit applicable',
      body: [
        "Les présentes conditions sont régies par le droit belge. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence exclusive des tribunaux de l'arrondissement judiciaire de Bruxelles.",
      ],
    },
  ],
};

const termsEn: LegalPage = {
  title: 'Terms of service',
  updatedLabel: 'Last updated',
  sections: [
    {
      heading: 'Purpose',
      body: [
        'Freenote is a free, community-driven document sharing platform reserved exclusively for verified members of the ISFCE community. Its goal is to help students help each other: summaries, course notes, exercises.',
        'Using the site implies full acceptance of these terms.',
      ],
    },
    {
      heading: 'Access and sign-up conditions',
      body: [
        'Access to content is reserved to adults (18 years or older) with a valid and verified @isfce.be email address.',
        'Sign-up is done through Discord OAuth2, followed by ISFCE email verification. No access to content without successful verification.',
        'A verified account is strictly personal and non-transferable. Sharing an account with a third party is grounds for suspension.',
      ],
    },
    {
      heading: 'Private nature of the platform',
      body: [
        'Documents hosted on Freenote are strictly private and accessible only to verified members of the ISFCE community. The platform operates as a private mutual-aid circle between students, a digital equivalent of sharing notes between classmates.',
        'Any redistribution, republication or diffusion outside the platform (public social media, other sites, large-scale printing) is strictly forbidden.',
      ],
    },
    {
      heading: 'User responsibilities',
      body: [
        'By publishing a document, you warrant that you are either the author, the rights holder, or you acknowledge that sharing remains within the strictly private scope of the verified student circle.',
        'You agree not to publish content that is illegal, defamatory, discriminatory, insulting, pornographic, or that infringes on the privacy of others.',
        'You are solely responsible for the content you publish. The publisher acts as a passive host under article 14 of directive 2000/31/EC.',
      ],
    },
    {
      heading: 'Intellectual property and license granted',
      body: [
        'You retain full intellectual property over the documents you share.',
        'By publishing a document, you grant Freenote a non-exclusive, free license limited to hosting, display, indexing and distribution to verified members of the platform. This license terminates when you delete the document or your account.',
      ],
    },
    {
      heading: 'Takedown procedure',
      body: [
        'Any content deemed illegal, infringing or violating rights can be reported via the "Report" button on each document page, or via the community Discord server with an explicit mention of "Copyright takedown" or "Report content".',
        'The publisher commits to reviewing each notification and, if the takedown is justified, to removing the content within 48 working hours of receipt.',
        'Authors of concerned documents will be informed of the takedown decision.',
      ],
    },
    {
      heading: 'Account deletion',
      body: [
        'You can delete your account at any time from your profile page. Deletion is permanent and results in the loss of your username, favorites and personal history.',
        'Documents you have shared are not deleted but anonymized: the displayed author becomes "Anonymous". They remain accessible to the community to preserve the collective value of past contributions.',
        'If you also want your documents deleted, explicitly request it via the community Discord server before deleting your account.',
      ],
    },
    {
      heading: 'Termination and sanctions',
      body: [
        'The publisher reserves the right to suspend or delete any account without notice in case of clear violation of these terms, notably for harassment, spam, illegal content, or account sharing.',
      ],
    },
    {
      heading: 'Modification of terms',
      body: [
        'The publisher may modify these terms at any time. Modifications take effect upon publication on the site. Users are invited to check this page regularly.',
      ],
    },
    {
      heading: 'Applicable law',
      body: [
        'These terms are governed by Belgian law. Any dispute relating to their interpretation or execution falls under the exclusive jurisdiction of the courts of the Brussels judicial district.',
      ],
    },
  ],
};

// -------------------- Public accessors --------------------

export function getLegal(locale: Locale): LegalPage {
  return locale === 'fr' ? legalFr : legalEn;
}

export function getPrivacy(locale: Locale): LegalPage {
  return locale === 'fr' ? privacyFr : privacyEn;
}

export function getTerms(locale: Locale): LegalPage {
  return locale === 'fr' ? termsFr : termsEn;
}
