import { useEffect, useState } from 'react'
import { getMission } from '../api/missions'
import type { Mission } from '../types/mission'

type MissionState = { status: 'loading'; id: string } | { status: 'success'; id: string; mission: Mission } | { status: 'error'; id: string; message: string }

export function useMission(id: string) {
  const [state, setState] = useState<MissionState>({ status: 'loading', id })
  useEffect(() => {
    const controller = new AbortController()
    const loadMission = () => getMission(id, controller.signal)
      .then(({ data }) => setState({ status: 'success', id, mission: data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'error', id, message: error instanceof Error ? error.message : 'Could not load mission.' })
      })
    void loadMission()
    const interval = window.setInterval(() => void loadMission(), 5_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [id])
  const currentState: MissionState = state.id === id ? state : { status: 'loading', id }
  return currentState
}
