import { buildLine, isNewerBuild, parseBuildInfo, type BuildInfo } from './buildInfo'

const local: BuildInfo = { version: '0.9.0', commit: 'a1b2c3d', builtAt: '2026-11-11T10:00:00.000Z' }

describe('isNewerBuild', () => {
  it('is newer with a higher version', () => {
    expect(isNewerBuild({ ...local, version: '0.10.0', builtAt: '2026-11-01T00:00:00Z' }, local)).toBe(true)
  })

  it('is not newer with a lower version, even if built later', () => {
    expect(isNewerBuild({ ...local, version: '0.8.9', commit: 'fffffff', builtAt: '2026-12-01T00:00:00Z' }, local)).toBe(false)
  })

  it('is the same build when version and commit match', () => {
    expect(isNewerBuild({ ...local, builtAt: '2026-12-01T00:00:00Z' }, local)).toBe(false)
  })

  it('counts a later deploy of the same version from another commit', () => {
    expect(isNewerBuild({ ...local, commit: 'e4f5a6b', builtAt: '2026-11-12T10:00:00Z' }, local)).toBe(true)
    expect(isNewerBuild({ ...local, commit: 'e4f5a6b', builtAt: '2026-11-10T10:00:00Z' }, local)).toBe(false)
  })
})

describe('parseBuildInfo', () => {
  it('reads a version.json body', () => {
    expect(parseBuildInfo({ ...local, extra: 1 })).toEqual(local)
  })

  it('ignores anything else (e.g. the app page an old deploy answers with)', () => {
    expect(parseBuildInfo(null)).toBeNull()
    expect(parseBuildInfo('<!doctype html>')).toBeNull()
    expect(parseBuildInfo({ version: '1.0.0' })).toBeNull()
  })
})

describe('buildLine', () => {
  it('reads "FromZero 0.9.0 · a1b2c3d · 11 Nov · Web"', () => {
    expect(buildLine({ ...local, builtAt: '2026-11-11T12:00:00' }, 'Web')).toBe('FromZero 0.9.0 · a1b2c3d · 11 Nov · Web')
    expect(buildLine({ ...local, builtAt: '2026-11-11T12:00:00' }, 'Android')).toBe('FromZero 0.9.0 · a1b2c3d · 11 Nov · Android')
  })

  it('leaves out a date it cannot read', () => {
    expect(buildLine({ ...local, builtAt: 'soon' }, 'Web')).toBe('FromZero 0.9.0 · a1b2c3d · Web')
  })
})
