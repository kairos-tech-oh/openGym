import { describe, it, expect } from 'vitest'
import { volumeSummary, volumeWeeks, volumeByExercise } from './volume.js'
import { SUNDAY } from './format.js'

// Mon 2026-10-12 is "today" throughout; its week (Monday start) began that same day.
const TODAY = '2026-10-12'
const W = (d, entries) => ({ id: 'w-' + d, d, start: new Date(d + 'T18:00:00').getTime(), entries })
const E = (id, sets) => ({ id, sets: sets.map(s => ({ done: true, ...s })) })

const S = {
  workouts: [
    W('2026-08-03', [E('0025', [{ w: 100, r: 10 }])]),                          // 1000, outside 30d
    W('2026-09-28', [E('0025', [{ w: 100, r: 5 }, { w: 100, r: 5 }])]),         // 1000
    W('2026-10-05', [
      E('0599', [{ w: 80, r: 10, phase: 'warmup' }, { w: 100, r: 15 }, { w: 100, r: 15 }]), // 3000 (warm-up left out)
      E('0739', [{ w: 50, r: 15 }, { w: 90, r: 15, done: false }]),             // 750 (unchecked left out)
      E('3666', [{ min: 10, speed: 0 }]),                                        // cardio: no volume
    ]),
    W('2026-10-07', [E('0025', [{ w: 135, r: 8 }])]),                            // 1080
    W('2026-10-12', [E('0031', [{ w: 50, r: 12 }, { w: 50, r: 10 }])]),          // 1100
  ],
}

describe('volumeSummary', () => {
  it('splits this week, last week, this month and everything — warm-ups, unchecked sets and cardio count for nothing', () => {
    expect(volumeSummary(S, TODAY)).toEqual({
      week: 1100,
      lastWeek: 3750 + 1080,
      month: 3750 + 1080 + 1100,
      all: 1000 + 1000 + 3750 + 1080 + 1100,
      workouts: 5,
    })
  })

  it('follows a Sunday week start', () => {
    // Week of Sun 2026-10-11 holds only the 12th; the one before it starts Sun 10-04.
    const s = volumeSummary(S, TODAY, SUNDAY)
    expect(s.week).toBe(1100)
    expect(s.lastWeek).toBe(3750 + 1080)
  })

  it('reads an empty log as zeros', () => {
    expect(volumeSummary({ workouts: [] }, TODAY)).toEqual({ week: 0, lastWeek: 0, month: 0, all: 0, workouts: 0 })
    expect(volumeSummary({}, TODAY).all).toBe(0)
  })

  it('ignores the stored w.vol and recounts', () => {
    const stale = { workouts: [{ ...W('2026-10-12', [E('0025', [{ w: 100, r: 10 }])]), vol: 999999 }] }
    expect(volumeSummary(stale, TODAY).all).toBe(1000)
  })
})

describe('volumeWeeks', () => {
  it('sums each week and keeps a week off as a zero instead of skipping it', () => {
    const pts = volumeWeeks(S, TODAY, 30)
    expect(pts.map(p => [p.d, p.y, p.workouts])).toEqual([
      ['2026-09-28', 1000, 1],
      ['2026-10-05', 4830, 2],
      ['2026-10-12', 1100, 1],
    ])
    expect(pts[0].t).toBe(new Date('2026-09-28T12:00:00').getTime())
  })

  it('fills the gap between distant weeks with zeros over the whole log', () => {
    const pts = volumeWeeks(S, TODAY, 0)
    expect(pts[0]).toMatchObject({ d: '2026-08-03', y: 1000 })
    expect(pts.at(-1)).toMatchObject({ d: '2026-10-12', y: 1100 })
    expect(pts.length).toBe(11)
    expect(pts.filter(p => p.y === 0).length).toBe(7)
  })

  it('returns nothing when the window holds no workouts', () => {
    expect(volumeWeeks({ workouts: [W('2025-01-06', [E('0025', [{ w: 1, r: 1 }])])] }, TODAY, 30)).toEqual([])
  })
})

describe('volumeByExercise', () => {
  it('ranks exercises by volume and counts only loaded work sets', () => {
    expect(volumeByExercise(S, TODAY, 30)).toEqual([
      { id: '0025', volume: 2080, sets: 3 },
      { id: '0599', volume: 3000, sets: 2 },
      { id: '0031', volume: 1100, sets: 2 },
      { id: '0739', volume: 750, sets: 1 },
    ].sort((a, b) => b.volume - a.volume))
  })

  it('includes older sessions for the whole log', () => {
    expect(volumeByExercise(S, TODAY, 0).find(r => r.id === '0025')).toEqual({ id: '0025', volume: 3080, sets: 4 })
  })
})
