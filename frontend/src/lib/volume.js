// Volume moved — weight × reps over finished work sets — summed by period, by week and by
// exercise for the Stats volume card. Every figure is derived from workoutVolume and
// completedVolumeOf rather than read from the stored `w.vol`, so warm-ups, unchecked sets and
// per-side rows are counted the one way the rest of the app counts them, and a workout saved
// before a counting fix reads the same as one saved after it.
import { workoutVolume, workoutDay } from './history.js'
import { completedVolumeOf, isWarmupRow } from './workout-model.js'
import { isoOf, startOfWeek, MONDAY } from './format.js'

const dayShift = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return isoOf(d)
}

// The first day of the window ending on `today`, or '' for the whole log (days = 0).
const windowStart = (today, days) => (days > 0 ? dayShift(today, 1 - days) : '')

const dated = S => (S?.workouts || [])
  .map(w => ({ w, d: workoutDay(w) }))
  .filter(x => x.d)

/**
 * Headline totals: this week, last week, this calendar month and everything logged.
 * `today` is an ISO day; `ws` the profile's week start (0 Sunday, 1 Monday).
 */
export function volumeSummary(S, today, ws = MONDAY) {
  const thisWeek = isoOf(startOfWeek(today, ws))
  const lastWeek = dayShift(thisWeek, -7)
  const month = today.slice(0, 7)
  const out = { week: 0, lastWeek: 0, month: 0, all: 0, workouts: 0 }
  for (const { w, d } of dated(S)) {
    if (d > today) continue
    const v = workoutVolume(w)
    out.all += v
    out.workouts++
    if (d >= thisWeek) out.week += v
    else if (d >= lastWeek) out.lastWeek += v
    if (d.slice(0, 7) === month) out.month += v
  }
  return out
}

/**
 * Volume per week, oldest first, for the chart. Weeks between the first and last training week
 * in the window are kept at 0 — a week off is part of the trend, and leaving it out would draw
 * a line straight across it as if training had carried on. `days` = 0 means the whole log.
 * Each point: { t (ms, week start), d (ISO week start), y (volume), workouts }.
 */
export function volumeWeeks(S, today, days = 90, ws = MONDAY) {
  const from = windowStart(today, days)
  const weeks = new Map()
  for (const { w, d } of dated(S)) {
    if (d < from || d > today) continue
    const k = isoOf(startOfWeek(d, ws))
    const e = weeks.get(k) || { y: 0, workouts: 0 }
    e.y += workoutVolume(w)
    e.workouts++
    weeks.set(k, e)
  }
  if (!weeks.size) return []
  const keys = [...weeks.keys()].sort()
  const out = []
  for (let k = keys[0]; k <= keys.at(-1); k = dayShift(k, 7)) {
    const e = weeks.get(k) || { y: 0, workouts: 0 }
    out.push({ t: new Date(k + 'T12:00:00').getTime(), d: k, y: e.y, workouts: e.workouts })
  }
  return out
}

/**
 * Which exercises the volume came from in the window, largest first.
 * Each row: { id, volume, sets } — `sets` counts the finished work sets that carried load.
 */
export function volumeByExercise(S, today, days = 90) {
  const from = windowStart(today, days)
  const by = new Map()
  for (const { w, d } of dated(S)) {
    if (d < from || d > today) continue
    for (const e of Array.isArray(w.entries) ? w.entries : []) {
      for (const s of Array.isArray(e?.sets) ? e.sets : []) {
        if (isWarmupRow(s)) continue
        const v = completedVolumeOf(s)
        if (!(v > 0)) continue
        const row = by.get(e.id) || { id: e.id, volume: 0, sets: 0 }
        row.volume += v
        row.sets++
        by.set(e.id, row)
      }
    }
  }
  return [...by.values()].sort((a, b) => b.volume - a.volume || String(a.id).localeCompare(String(b.id)))
}
