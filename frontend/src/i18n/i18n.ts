import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import fr from './fr.json';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: 'fr',
    // Normalise la langue détectée : un navigateur en "fr-FR"/"fr-BE" doit donner
    // i18n.language === 'fr', sinon toutes les comparaisons strictes (formatDate,
    // legalContent, surlignage FR/EN de la navbar) basculent silencieusement en anglais.
    supportedLngs: ['fr', 'en'],
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
