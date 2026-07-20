// Sanad — "Dar / Green & Sand" (دار · الأخضر والرمل) design tokens
// Source of truth: design/Sanad Home Directions.dc.html (inline styles).
// Every screen uses ONLY these values. Do not invent colors.

export const palette = {
  light: {
    bg: '#EFE8D6',      // screen background (warm sand)
    card: '#FAF6EA',    // card / surface background
    ink: '#14312A',     // primary text (deep green-black)
    mut: '#47594F',     // secondary text
    line: '#14312A',    // ALL borders (same as ink in light theme)
    acc: '#0E4A40',     // accent text/icons/links (deep green)
    btn: '#0E4A40',     // primary button fill + active tab fill
    btnInk: '#F4EEDC',  // text/icons on btn
    band: '#0E4A40',    // header band fill
    bandInk: '#F4EEDC', // text/icons on band
    goldFill: '#E3C36A',// gold banner fill (claim / one-time warnings)
    goldInk: '#2A2408', // text on goldFill
    ok: '#2E6A4E',      // success stroke/text (with icon + label)
    warn: '#7F5A08',    // caution stroke/text
    err: '#9C4034',     // danger stroke/text
    tok: '#DAE8DC',     // success tint fill
    twarn: '#EEE2C1',   // caution tint fill
    terr: '#F1DED6',    // danger tint fill
    tacc: '#D9E4DE',    // accent/info tint fill
    sunken: '#E4DBC4',  // input wells, pressed, skeleton base
  },
  dark: {
    bg: '#0A1B17',
    card: '#122B24',
    ink: '#EEE7D4',
    mut: '#A9BCAD',
    line: '#6B8074',    // borders lighten in dark theme (NOT ink)
    acc: '#8FCBB8',
    btn: '#7FC7B4',
    btnInk: '#06231C',
    band: '#123B32',
    bandInk: '#EEE7D4',
    goldFill: '#C8A33B',
    goldInk: '#1A1408',
    ok: '#93C9A6',
    warn: '#DDB65E',
    err: '#E2907F',
    tok: '#1E3D2C',
    twarn: '#41351A',
    terr: '#46271F',
    tacc: '#1D3B33',
    sunken: '#0E211C',
  },
} as const;

// Fixed text-on-fill pairings (never remix):
// btn+btnInk · band+bandInk · goldFill+goldInk · err fill -> bg-colored text
// tint fills (tok/twarn/terr/tacc) -> matching stroke color (ok/warn/err/acc) or ink text.

export const radius = { card: 8, control: 6, tiny: 4, pill: 999, sheetTop: 16 } as const;
export const borderW = { standard: 2, thin: 1.5 } as const; // thin only on small status pills / tiny badges
export const space = { xs: 4, s: 8, m: 12, l: 14, xl: 16, xxl: 18, section: 22 } as const; // screen gutter: 14-16

export const font = {
  family: 'Cairo', // Google Fonts; bundle 400/600/700/800/900
  size: {
    display: 46,  // hero numbers (3/5)
    value: 26,    // big input / tile values
    h1: 24,       // tab-screen title in band
    h2: 20,       // sub-screen title in band
    stat: 38,     // stat tile number
    title: 18,    // sheet titles, profile name
    button: 17,   // primary buttons
    body: 16,     // body, card titles, list rows — MINIMUM for running text
    secondary: 15,// secondary buttons, chips, tab labels
    meta: 14,     // short meta/labels ONLY (never paragraphs)
  },
  weight: { regular: '400', med: '600', semi: '700', bold: '800', black: '900' },
  lineHeight: 1.5, // Arabic needs generous line-height; 1.6-1.7 in disclaimers
} as const;
