export type ProfileId = 'standard' | 'deaf' | 'blind' | 'lowvision'

export interface AlertPrefs {
  flash: boolean
  vibrate: boolean
  speak: boolean
  chime: boolean
}

export const PROFILES: Record<ProfileId, { label: string; short: string; blurb: string; prefs: AlertPrefs }> = {
  standard: {
    label: 'Standard',
    short: 'Standard',
    blurb: 'A chime and a notification card.',
    prefs: { flash: false, vibrate: false, speak: false, chime: true },
  },
  deaf: {
    label: 'Deaf or hard of hearing',
    short: 'Visual',
    blurb: 'Full-screen colour flashes, vibration and smart-light patterns. No sound needed.',
    prefs: { flash: true, vibrate: true, speak: false, chime: false },
  },
  blind: {
    label: 'Blind',
    short: 'Voice',
    blurb: 'Every event is read aloud. Press R to hear the last one again.',
    prefs: { flash: false, vibrate: true, speak: true, chime: false },
  },
  lowvision: {
    label: 'Low vision',
    short: 'High contrast',
    blurb: 'Larger, high-contrast text, gentle flashes and voice.',
    prefs: { flash: true, vibrate: false, speak: true, chime: false },
  },
}

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && value in PROFILES
}

export function isAlertPrefs(value: unknown): value is AlertPrefs {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return ['flash', 'vibrate', 'speak', 'chime'].every((k) => typeof v[k] === 'boolean')
}

export function readStored<T>(key: string, guard: (v: unknown) => v is T): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    return guard(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked (private mode): preferences just won't persist
  }
}
