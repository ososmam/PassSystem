import i18n from "i18next";

import { initReactI18next } from "react-i18next";

import Backend from "i18next-http-backend";

import LanguageDetector from "i18next-browser-languagedetector";
const resources = {
  en: {
    translations: require("../src/locales/en/translations.json"),
  },
  ar: {
    translations: require("../src/locales/ar/translations.json"),
  },
};
i18n
  .use(Backend)

  .use(LanguageDetector)

  .use(initReactI18next)

  .init({
    resources,
    fallbackLng: "en",
    debug: true,
    interpolation: {
      escapeValue: false // not needed for react as it escapes by default
    },
    lng: "en"
  });

export default i18n;
