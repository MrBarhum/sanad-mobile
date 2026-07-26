// MUST be the first import in this file. i18next 26 resolves every plural through
// `new Intl.PluralRules(lng, …)`, and Hermes — the engine this app ships on — does
// not implement PluralRules on either platform (it implements only Collator,
// DateTimeFormat and NumberFormat; facebook/hermes#1462 is still open). When the
// constructor throws, i18next does NOT warn: it silently substitutes a hardcoded
// English-shaped rule, `count === 1 ? 'one' : 'other'`, so Arabic's «zero / one /
// two / few / many / other» collapses to two buckets and «٥ دقائق» renders as
// «٥ دقيقة». There is no non-Intl fallback to fall back on either — i18next removed
// `compatibilityJSON: 'v3'` in v24.
//
// `intl-pluralrules` is the remedy i18next's own docs prescribe for React Native.
// It is pure JavaScript with zero runtime dependencies (no native module, no
// rebuild), it bundles the CLDR rules for ~200 locales including Arabic, and it
// feature-detects: on a runtime that already has a correct PluralRules (web, Node)
// it no-ops. Verified against Node's full-ICU output — identical for all six
// Arabic categories across 0,1,2,3,5,10,11,15,99,100,101,102,105,200,240.
//
// It must be imported before `i18n.init()` runs, because PluralResolver memoizes
// the rule it resolves per language on first use.
import 'intl-pluralrules';
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
