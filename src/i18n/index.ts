import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

export const defaultNS = 'common';

export const resources = {
  ar: { common: ar },
  en: { common: en },
} as const;

const supportedLngs = ['ar', 'en'] as const;

/**
 * Arabic-first language selection: respect the device language only when it is
 * one we support, otherwise fall back to Arabic. English is the fallback for any
 * missing keys. RTL layout forcing is intentionally deferred to a later step to
 * avoid triggering a native reload here.
 */
function getInitialLanguage(): string {
  const deviceLanguage = getLocales()[0]?.languageCode;
  if (deviceLanguage && (supportedLngs as readonly string[]).includes(deviceLanguage)) {
    return deviceLanguage;
  }
  return 'ar';
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: [...supportedLngs],
    defaultNS,
    ns: [defaultNS],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  });
}

export default i18n;
