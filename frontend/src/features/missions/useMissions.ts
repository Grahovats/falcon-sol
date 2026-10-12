import { useCallback, useEffect, useState } from 'react'
import { getMissions } from '../../api/missions'
import type { Mission } from '../../types/mission'

type MissionsState = { status: 'loading' } | { status: 'success'; missions: Mission[] } | { status: 'error'; message: string }

export function useMissions() {
  const [state, setState] = useState<MissionsState>({ status: 'loading' })
  const [requestKey, setRequestKey] = useState(0)
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setRequestKey((key) => key + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const load = () => getMissions(controller.signal)
      .then(({ data }) => setState({ status: 'success', missions: data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load missions.' })
      })
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    return () => { window.clearInterval(timer); controller.abort() }
  }, [requestKey])

  return { state, retry }
}
