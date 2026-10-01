import { MissionStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { AppError } from '../errors/app-error.js'
import { assertAdminStatusTransition } from './admin.js'

describe('admin mission transitions', () => {
  it('prevents manual activation and finalization', () => {
    expect(() => assertAdminStatusTransition(MissionStatus.REGISTRATION, MissionStatus.ACTIVE)).toThrowError(AppError)
    expect(() => assertAdminStatusTransition(MissionStatus.ACTIVE, MissionStatus.FINALIZED)).toThrowError(AppError)
  })

  it('allows cancellation and closing a finalized mission', () => {
    expect(() => assertAdminStatusTransition(MissionStatus.ACTIVE, MissionStatus.CANCELLED)).not.toThrow()
    expect(() => assertAdminStatusTransition(MissionStatus.FINALIZED, MissionStatus.CLOSED)).not.toThrow()
  })

  it('does not reopen terminal missions', () => {
    expect(() => assertAdminStatusTransition(MissionStatus.CANCELLED, MissionStatus.REGISTRATION)).toThrowError(AppError)
  })
})
