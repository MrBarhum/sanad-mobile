/**
 * Curated list of IANA timezones with localized city/country labels for the
 * timezone picker. Only the `id` (IANA identifier) is ever stored; the labels are
 * display-only. The list is intentionally finite and weighted toward the app's
 * primary audience (the Arab world), plus common worldwide zones for diaspora
 * families. A device whose zone isn't in this list still works — the picker
 * surfaces "this device's timezone" separately and the server validates any id.
 */
export type TimezoneOption = {
  /** IANA identifier, e.g. "Asia/Riyadh". This is the only value stored. */
  id: string;
  city: { en: string; ar: string };
  country: { en: string; ar: string };
};

export const TIMEZONES: TimezoneOption[] = [
  // Gulf
  { id: 'Asia/Riyadh', city: { en: 'Riyadh', ar: 'الرياض' }, country: { en: 'Saudi Arabia', ar: 'السعودية' } },
  { id: 'Asia/Kuwait', city: { en: 'Kuwait City', ar: 'الكويت' }, country: { en: 'Kuwait', ar: 'الكويت' } },
  { id: 'Asia/Qatar', city: { en: 'Doha', ar: 'الدوحة' }, country: { en: 'Qatar', ar: 'قطر' } },
  { id: 'Asia/Bahrain', city: { en: 'Manama', ar: 'المنامة' }, country: { en: 'Bahrain', ar: 'البحرين' } },
  { id: 'Asia/Dubai', city: { en: 'Dubai', ar: 'دبي' }, country: { en: 'United Arab Emirates', ar: 'الإمارات' } },
  { id: 'Asia/Muscat', city: { en: 'Muscat', ar: 'مسقط' }, country: { en: 'Oman', ar: 'عُمان' } },
  // Levant & Iraq
  { id: 'Asia/Baghdad', city: { en: 'Baghdad', ar: 'بغداد' }, country: { en: 'Iraq', ar: 'العراق' } },
  { id: 'Asia/Amman', city: { en: 'Amman', ar: 'عمّان' }, country: { en: 'Jordan', ar: 'الأردن' } },
  { id: 'Asia/Beirut', city: { en: 'Beirut', ar: 'بيروت' }, country: { en: 'Lebanon', ar: 'لبنان' } },
  { id: 'Asia/Damascus', city: { en: 'Damascus', ar: 'دمشق' }, country: { en: 'Syria', ar: 'سوريا' } },
  { id: 'Asia/Gaza', city: { en: 'Gaza', ar: 'غزة' }, country: { en: 'Palestine', ar: 'فلسطين' } },
  { id: 'Asia/Hebron', city: { en: 'Hebron', ar: 'الخليل' }, country: { en: 'Palestine', ar: 'فلسطين' } },
  { id: 'Asia/Jerusalem', city: { en: 'Jerusalem', ar: 'القدس' }, country: { en: 'Palestine', ar: 'فلسطين' } },
  // Arabian Peninsula & North Africa
  { id: 'Asia/Aden', city: { en: 'Sana’a', ar: 'صنعاء' }, country: { en: 'Yemen', ar: 'اليمن' } },
  { id: 'Africa/Cairo', city: { en: 'Cairo', ar: 'القاهرة' }, country: { en: 'Egypt', ar: 'مصر' } },
  { id: 'Africa/Khartoum', city: { en: 'Khartoum', ar: 'الخرطوم' }, country: { en: 'Sudan', ar: 'السودان' } },
  { id: 'Africa/Tripoli', city: { en: 'Tripoli', ar: 'طرابلس' }, country: { en: 'Libya', ar: 'ليبيا' } },
  { id: 'Africa/Tunis', city: { en: 'Tunis', ar: 'تونس' }, country: { en: 'Tunisia', ar: 'تونس' } },
  { id: 'Africa/Algiers', city: { en: 'Algiers', ar: 'الجزائر' }, country: { en: 'Algeria', ar: 'الجزائر' } },
  { id: 'Africa/Casablanca', city: { en: 'Casablanca', ar: 'الدار البيضاء' }, country: { en: 'Morocco', ar: 'المغرب' } },
  { id: 'Africa/Nouakchott', city: { en: 'Nouakchott', ar: 'نواكشوط' }, country: { en: 'Mauritania', ar: 'موريتانيا' } },
  { id: 'Africa/Mogadishu', city: { en: 'Mogadishu', ar: 'مقديشو' }, country: { en: 'Somalia', ar: 'الصومال' } },
  { id: 'Africa/Djibouti', city: { en: 'Djibouti', ar: 'جيبوتي' }, country: { en: 'Djibouti', ar: 'جيبوتي' } },
  // Wider region
  { id: 'Asia/Tehran', city: { en: 'Tehran', ar: 'طهران' }, country: { en: 'Iran', ar: 'إيران' } },
  { id: 'Europe/Istanbul', city: { en: 'Istanbul', ar: 'إسطنبول' }, country: { en: 'Türkiye', ar: 'تركيا' } },
  { id: 'Asia/Karachi', city: { en: 'Karachi', ar: 'كراتشي' }, country: { en: 'Pakistan', ar: 'باكستان' } },
  { id: 'Asia/Kolkata', city: { en: 'Mumbai', ar: 'مومباي' }, country: { en: 'India', ar: 'الهند' } },
  { id: 'Asia/Dhaka', city: { en: 'Dhaka', ar: 'دكا' }, country: { en: 'Bangladesh', ar: 'بنغلاديش' } },
  { id: 'Asia/Jakarta', city: { en: 'Jakarta', ar: 'جاكرتا' }, country: { en: 'Indonesia', ar: 'إندونيسيا' } },
  { id: 'Asia/Kuala_Lumpur', city: { en: 'Kuala Lumpur', ar: 'كوالالمبور' }, country: { en: 'Malaysia', ar: 'ماليزيا' } },
  // Europe & North America (diaspora)
  { id: 'Europe/London', city: { en: 'London', ar: 'لندن' }, country: { en: 'United Kingdom', ar: 'المملكة المتحدة' } },
  { id: 'Europe/Paris', city: { en: 'Paris', ar: 'باريس' }, country: { en: 'France', ar: 'فرنسا' } },
  { id: 'Europe/Berlin', city: { en: 'Berlin', ar: 'برلين' }, country: { en: 'Germany', ar: 'ألمانيا' } },
  { id: 'Europe/Madrid', city: { en: 'Madrid', ar: 'مدريد' }, country: { en: 'Spain', ar: 'إسبانيا' } },
  { id: 'Europe/Stockholm', city: { en: 'Stockholm', ar: 'ستوكهولم' }, country: { en: 'Sweden', ar: 'السويد' } },
  { id: 'America/New_York', city: { en: 'New York', ar: 'نيويورك' }, country: { en: 'United States', ar: 'الولايات المتحدة' } },
  { id: 'America/Chicago', city: { en: 'Chicago', ar: 'شيكاغو' }, country: { en: 'United States', ar: 'الولايات المتحدة' } },
  { id: 'America/Denver', city: { en: 'Denver', ar: 'دنفر' }, country: { en: 'United States', ar: 'الولايات المتحدة' } },
  { id: 'America/Los_Angeles', city: { en: 'Los Angeles', ar: 'لوس أنجلوس' }, country: { en: 'United States', ar: 'الولايات المتحدة' } },
  { id: 'America/Toronto', city: { en: 'Toronto', ar: 'تورونتو' }, country: { en: 'Canada', ar: 'كندا' } },
  { id: 'Australia/Sydney', city: { en: 'Sydney', ar: 'سيدني' }, country: { en: 'Australia', ar: 'أستراليا' } },
  // Universal fallback
  { id: 'UTC', city: { en: 'UTC', ar: 'التوقيت العالمي' }, country: { en: 'Coordinated Universal Time', ar: 'التوقيت العالمي المنسّق' } },
];

/** Looks up a curated option by IANA id (exact match). */
export function findTimezoneOption(id: string): TimezoneOption | undefined {
  return TIMEZONES.find((option) => option.id === id);
}
