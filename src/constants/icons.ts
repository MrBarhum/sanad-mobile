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
 * `doctor`, and `vital` (heart-pulse). Both fonts ship inside the single
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
} satisfies Record<string, IconEntry>;

/** The semantic icon names available to `<Icon name="…" />`. */
export type IconName = keyof typeof ICONS;
