import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

import { applyRTL } from './rtl';

export const defaultNS = 'common';

export const resources = {
  ar: { common: ar },
  en: { common: en },
} as const;

const supportedLngs = ['ar', 'en'] as const;

/**
 * Arabic-first: the app always starts in Arabic regardless of the device or
 * browser language (product decision for the current phase). English resources
 * stay loaded as the `fallbackLng` for any missing keys and remain available to
 * switch to later.
 */
const initialLanguage = 'ar';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    supportedLngs: [...supportedLngs],
    defaultNS,
    ns: [defaultNS],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  });
}

// Apply the RTL layout direction to match the Arabic-first default. This is
// guarded and loop-safe: on native it sets the I18nManager flags only when they
// differ (taking effect on the next app launch, with no reload); on web it sets
// `<html dir="rtl" lang="ar">`. See ./rtl.ts and ./rtl.web.ts.
applyRTL();

export default i18n;
