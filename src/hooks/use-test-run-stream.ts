/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useEffect, useReducer, useRef } from 'react'
import type { TestRunEvent, TestRunEventType } from '@/lib/event-bus'

// ── State ──────────────────────────────────────────────────────────────────
export interface TestRunStreamState {
  events: TestRunEvent[]
  progress: number
  isConnected: boolean
  isDone: boolean
  latestMessage: string | null
  error: string | null
}

type Action =
  | { type: 'CONNECTED' }
  | { type: 'EVENT'; payload: TestRunEvent }
  | { type: 'ERROR'; message: string }
  | { type: 'DONE' }
  | { type: 'RESET' }

const INITIAL: TestRunStreamState = {
  events: [],
  progress: 0,
  isConnected: false,
  isDone: false,
  latestMessage: null,
  error: null,
}

const TERMINAL_TYPES: TestRunEventType[] = ['completed', 'failed', 'close']

function reducer(state: TestRunStreamState, action: Action): TestRunStreamState {
  switch (action.type) {
    case 'RESET':
      return INITIAL
    case 'CONNECTED':
      return { ...state, isConnected: true, error: null }
    case 'EVENT': {
      const ev = action.payload
      const isDone = TERMINAL_TYPES.includes(ev.type)
      return {
        ...state,
        events: ev.type === 'close' ? state.events : [...state.events, ev],
        progress: ev.progress ?? state.progress,
        latestMessage: ev.message ?? state.latestMessage,
        isDone,
        isConnected: isDone ? false : state.isConnected,
      }
    }
    case 'ERROR':
      return { ...state, isConnected: false, error: action.message }
    case 'DONE':
      return { ...state, isDone: true, isConnected: false }
    default:
      return state
  }
}

/**
 * useTestRunStream
 *
 * Subscribes to the SSE stream for a test run and returns reactive state.
 *
 * @example
 *   const { events, progress, isConnected, isDone, latestMessage } =
 *     useTestRunStream(testRunId)
 */
export function useTestRunStream(testRunId: string | null) {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Tear down any existing connection
    esRef.current?.close()
    esRef.current = null
    dispatch({ type: 'RESET' })

    if (!testRunId) return

    const es = new EventSource(`/api/test-runs/${testRunId}/stream`)
    esRef.current = es

    es.onopen = () => dispatch({ type: 'CONNECTED' })

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as TestRunEvent
        dispatch({ type: 'EVENT', payload: event })
        if (event.type === 'close' || event.type === 'completed' || event.type === 'failed') {
          es.close()
        }
      } catch {
        /* ignore non-JSON frames (heartbeats) */
      }
    }

    es.onerror = () => {
      dispatch({ type: 'ERROR', message: 'Connection lost.' })
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [testRunId])

  return state
}
