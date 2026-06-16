/**
 * Sanad's semantic icon vocabulary — the single source of truth that maps a
 * meaning ("medication", "chevron", "success") to a concrete vector glyph.
 *
 * WHY THIS FILE EXISTS: feature components must reference icons by *meaning*
 * (`<Icon name="medication" />`), never by an icon-family glyph name. That keeps
 * one place to (a) swap families, (b) resolve look-alike collisions, and (c)
 * centralise RTL mirroring. Only `src/components/icon.tsx` is allowed to import
 * the icon families themselves — this module just holds the data.
 *
 * FAMILY POLICY: Ionicons is the default for general UI / status / navigation
 * (calm, even-weight silhouettes that read clearly for older eyes and give us a
 * proper `chevron-back`/`chevron-forward` pair for RTL). A *small, deliberate*
 * set of care-domain icons uses MaterialCommunityIcons where recognisability is
 * materially better and Ionicons has no good equivalent: `medication` (pill),
 * `doctor`, `vital` (heart-pulse), and the Phase A (Figma Make parity) additions
 * `temperature` (thermometer), `oxygen` (lungs), `appetite` (silverware-fork-knife)
 * and `owner` (crown-outline). Both fonts ship inside the single
 * `@expo/vector-icons` package, so this exception adds no further dependency.
 *
 * COLLISIONS RESOLVED: the old glyph set reused one mark for several meanings —
 * `task` shared the success check (✓) and `appointment` shared the clock (◷).
 * Here `task` is a checklist and `appointment` is a calendar, so a task no
 * longer looks "done" and an appointment no longer looks like a generic time.
 */

export type IconFamily = 'ionicons' | 'material-community';

export type IconEntry = {
  /** Which vector family the glyph comes from. */
  family: IconFamily;
  /** Glyph name within that family (LTR / default). */
  name: string;
  /** Mirrored glyph used when `I18nManager.isRTL` (directional icons only). */
  rtlName?: string;
  /**
   * Directional icons must mirror in RTL. When `rtlName` is set the component
   * swaps to it; otherwise it applies a horizontal flip transform.
   */
  directional?: boolean;
};

/**
 * Semantic name → glyph. Feature code uses these keys only. To restyle an icon
 * app-wide, change it here; to add one, add a key here (and keep it ASCII —
 * never paste a raw Unicode symbol literal as an icon anywhere in source).
 */
export const ICONS = {
  // --- Navigation & structure -------------------------------------------------
  /** Trailing "go" affordance on nav rows. The one directional icon. */
  chevron: { family: 'ionicons', name: 'chevron-forward', rtlName: 'chevron-back', directional: true },
  add: { family: 'ionicons', name: 'add' },
  close: { family: 'ionicons', name: 'close' },
  /** Small neutral marker (unread / neutral status). */
  dot: { family: 'ionicons', name: 'ellipse' },

  // --- Status (bold filled marks; always paired with a text label) ------------
  success: { family: 'ionicons', name: 'checkmark-circle' },
  warning: { family: 'ionicons', name: 'warning' },
  error: { family: 'ionicons', name: 'close-circle' },
  info: { family: 'ionicons', name: 'information-circle' },

  // --- Time -------------------------------------------------------------------
  clock: { family: 'ionicons', name: 'time-outline' },
  calendar: { family: 'ionicons', name: 'calendar-outline' },

  // --- Feature identities -----------------------------------------------------
  medication: { family: 'material-community', name: 'pill' }, // care-domain: Ionicons has no pill
  task: { family: 'ionicons', name: 'checkbox-outline' }, // checklist — NOT the success check
  appointment: { family: 'ionicons', name: 'calendar-outline' }, // calendar — NOT the clock
  visit: { family: 'ionicons', name: 'home-outline' },
  dailyLog: { family: 'ionicons', name: 'create-outline' },
  vital: { family: 'material-community', name: 'heart-pulse' }, // care-domain: clearer than Ionicons pulse
  doctor: { family: 'material-community', name: 'doctor' }, // care-domain: Ionicons has no doctor
  emergency: { family: 'ionicons', name: 'medkit' },
  member: { family: 'ionicons', name: 'people-outline' },
  profile: { family: 'ionicons', name: 'person-circle-outline' }, // care-recipient
  notification: { family: 'ionicons', name: 'notifications-outline' },
  settings: { family: 'ionicons', name: 'settings-outline' },
  system: { family: 'ionicons', name: 'cog-outline' },
  call: { family: 'ionicons', name: 'call' },

  // --- Navigation additions (Figma Make parity) -------------------------------
  /** Full back arrow on detail-screen headers — mirrors in RTL (→ arrow-forward). */
  back: { family: 'ionicons', name: 'arrow-back', rtlName: 'arrow-forward', directional: true },
  /** Downward disclosure (circle switcher, expandable rows). Not directional. */
  chevronDown: { family: 'ionicons', name: 'chevron-down' },

  // --- Feature / reading identities (Figma Make parity) -----------------------
  explore: { family: 'ionicons', name: 'compass-outline' },
  activity: { family: 'ionicons', name: 'pulse' }, // generic reading/activity — NOT a health verdict
  heart: { family: 'ionicons', name: 'heart-outline' }, // identity only — never health-color coded
  location: { family: 'ionicons', name: 'location-outline' },
  drop: { family: 'ionicons', name: 'water-outline' }, // blood type / hydration
  temperature: { family: 'material-community', name: 'thermometer' }, // care-domain reading
  oxygen: { family: 'material-community', name: 'lungs' }, // care-domain reading
  mood: { family: 'ionicons', name: 'happy-outline' }, // daily-log observation, not a clinical scale
  appetite: { family: 'material-community', name: 'silverware-fork-knife' },

  // --- Actions & roles (Figma Make parity) ------------------------------------
  more: { family: 'ionicons', name: 'ellipsis-horizontal' },
  edit: { family: 'ionicons', name: 'create-outline' }, // pencil (shares the dailyLog glyph)
  copy: { family: 'ionicons', name: 'copy-outline' },
  view: { family: 'ionicons', name: 'eye-outline' },
  invite: { family: 'ionicons', name: 'person-add-outline' },
  removeMember: { family: 'ionicons', name: 'person-remove-outline' },
  owner: { family: 'material-community', name: 'crown-outline' }, // care-circle owner marker
  role: { family: 'ionicons', name: 'ribbon-outline' },
  shield: { family: 'ionicons', name: 'shield-checkmark-outline' },
  lock: { family: 'ionicons', name: 'lock-closed-outline' },

  // --- Theme toggle (Account) -------------------------------------------------
  moon: { family: 'ionicons', name: 'moon-outline' },
  sun: { family: 'ionicons', name: 'sunny-outline' },
} satisfies Record<string, IconEntry>;

/** The semantic icon names available to `<Icon name="…" />`. */
export type IconName = keyof typeof ICONS;
