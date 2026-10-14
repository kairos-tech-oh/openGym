// @vitest-environment happy-dom
// The Volume card: this week against last week, the week-by-week chart and the exercises the
// volume came from — warm-ups and cardio left out.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Stats from './Stats.jsx'
import { isoOf, startOfWeek } from '../lib/format.js'

const mocks = vi.hoisted(() => ({ charts: [], S: null }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  bwSheet: () => {}, goalSheet: () => {}, calendarSheet: () => {}, workoutDetailSheet: () => {}, exerciseHistorySheet: () => {},
  WorkoutRow: () => null, bwDeltaColor: () => 'inherit',
}))
vi.mock('../components/LineChart.jsx', () => ({ default: props => { mocks.charts.push(props); return null } }))
vi.mock('../components/Heatmap.jsx', () => ({ default: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null, BodyMapLegend: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
// Days relative to the start of the current week, so "this week" and "last week" hold
// whatever day the suite runs on.
const weekStart = startOfWeek(isoOf(new Date()), 1)
const day = n => { const d = new Date(weekStart); d.setDate(d.getDate() + n); return isoOf(d) }
const session = (d, entries) => ({ id: d, d, start: Date.parse(d + 'T10:00:00'), end: Date.parse(d + 'T11:00:00'), name: 'Legs', entries })
const sets = rows => rows.map(([w, r, extra]) => ({ w, r, done: true, ...extra }))

let root, host
afterEach(() => { act(() => root.unmount()); host.remove(); mocks.charts = [] })

function mount() {
  mocks.S = { unit: 'lb', weekStart: 1, body: 'male', effort: 'none', targetW: null, bodyweight: [], routines: [], exWeights: {},
    workouts: [
      session(day(-7), [
        { id: '0599', sets: sets([[80, 10, { phase: 'warmup' }], [100, 15], [100, 15], [100, 15]]) },  // 4500
        { id: '3666', target: { mode: 'cardio' }, sets: [{ min: 10, speed: 0, done: true }] },
      ]),
      session(day(0), [{ id: '0025', sets: sets([[135, 10], [135, 10]]) }]),                          // 2700
    ] }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Stats />))
  return mocks.charts.find(c => c.color === 'var(--acc)')
}

describe('Stats — volume', () => {
  it('shows this week against last week, with the change', () => {
    mount()
    const text = host.textContent
    expect(text).toContain('Volume')
    expect(text).toContain('2,700 lb')
    expect(text).toContain('4,500 lb')
    expect(text).toContain('-40%')
    expect(text).toContain('7,200 lb')     // all time
  })

  it('charts the volume week by week in the profile unit', () => {
    const chart = mount()
    expect(chart.unit).toBe('lb')
    expect(chart.points.map(p => [p.d, p.y])).toEqual([[day(-7), 4500], [day(0), 2700]])
  })

  it('ranks the exercises the volume came from, leaving cardio out', () => {
    mount()
    const card = [...host.querySelectorAll('.card')].find(c => c.querySelector('h2')?.textContent.startsWith('Volume'))
    const rows = [...card.querySelectorAll('.mrow')].map(r => r.textContent)
    expect(rows[0]).toMatch(/lever seated leg curl.*4,500 lb/i)
    expect(rows[1]).toMatch(/barbell bench press.*2,700 lb/i)
    expect(rows.some(r => /treadmill/i.test(r))).toBe(false)
  })
})
