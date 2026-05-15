import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { Sentence } from "./parsing"

/**
 * Sentence-level TTS coordinator for the reading surface. Speaks one sentence
 * at a time so we get reliable cross-browser highlighting — Web Speech's word
 * `boundary` events are unreliable on Safari and Firefox, while sentence
 * boundaries we control ourselves are not.
 *
 * Why not stream the whole article at once?
 * - We lose progress if the user pauses or jumps to a target.
 * - Some browsers crash if you queue more than ~32K characters.
 * - We can't easily highlight which line is being read.
 */

interface UseKaraokeOptions {
  /** All sentences in reading order. */
  sentences: Sentence[]
  lang?: string
  rate?: number
  pitch?: number
}

export interface KaraokeState {
  supported: boolean
  /** Currently speaking. False while paused or stopped. */
  speaking: boolean
  paused: boolean
  /** globalIdx of the current sentence, or null if nothing is queued. */
  currentSentenceIdx: number | null
}

export interface KaraokeControls extends KaraokeState {
  /** Start playing from the given sentence (defaults to start). */
  play: (fromIdx?: number) => void
  pause: () => void
  resume: () => void
  cancel: () => void
  next: () => void
  prev: () => void
  /** Play exactly one sentence ad-hoc — used by the popover speaker icon. */
  speakOne: (text: string) => void
}

export function useKaraoke({
  sentences,
  lang = "en-US",
  rate = 0.95,
  pitch = 1,
}: UseKaraokeOptions): KaraokeControls {
  const supported =
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined"

  const [state, setState] = useState<KaraokeState>({
    supported,
    speaking: false,
    paused: false,
    currentSentenceIdx: null,
  })

  // Latest sentences kept in a ref so the recursive `onend` callback can
  // always see the freshest list without the callback identity changing
  // every time the parent re-renders. We sync via an effect so we don't
  // mutate the ref during render.
  const sentencesRef = useRef(sentences)
  useEffect(() => {
    sentencesRef.current = sentences
  }, [sentences])

  const cancelTokenRef = useRef(0)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  // The recursive sentence-stepper. Stored in a ref so the closure inside
  // `onend` can call the latest version even though `useCallback` hands out
  // a new identity on every dep change. This sidesteps the "access before
  // declared" warning the linter raises for self-referential callbacks.
  type Stepper = (idx: number, token: number) => void
  const stepperRef = useRef<Stepper | null>(null)

  useEffect(() => {
    if (!supported) return undefined
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices)
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current
    if (voices.length === 0) return null
    const exact = voices.find((v) => v.lang === lang)
    if (exact) return exact
    const prefix = lang.split("-")[0]
    const partial = voices.find((v) => v.lang.startsWith(prefix ?? "en"))
    return partial ?? voices[0] ?? null
  }, [lang])

  const speakSentence = useCallback<Stepper>(
    (idx, token) => {
      if (!supported) return
      const list = sentencesRef.current
      if (idx < 0 || idx >= list.length) {
        setState((s) => ({
          ...s,
          speaking: false,
          paused: false,
          currentSentenceIdx: null,
        }))
        return
      }
      const sentence = list[idx]!
      const utter = new SpeechSynthesisUtterance(sentence.text)
      utter.lang = lang
      utter.rate = rate
      utter.pitch = pitch
      const voice = pickVoice()
      if (voice) utter.voice = voice

      utter.onstart = () => {
        if (cancelTokenRef.current !== token) return
        setState((s) => ({
          ...s,
          speaking: true,
          paused: false,
          currentSentenceIdx: idx,
        }))
      }
      utter.onend = () => {
        if (cancelTokenRef.current !== token) return
        // Auto-advance via the ref so we always reach into the latest stepper.
        const next = idx + 1
        if (next < sentencesRef.current.length) {
          stepperRef.current?.(next, token)
        } else {
          setState((s) => ({
            ...s,
            speaking: false,
            paused: false,
            currentSentenceIdx: null,
          }))
        }
      }
      utter.onerror = () => {
        if (cancelTokenRef.current !== token) return
        setState((s) => ({
          ...s,
          speaking: false,
          paused: false,
        }))
      }
      utter.onpause = () => setState((s) => ({ ...s, paused: true }))
      utter.onresume = () => setState((s) => ({ ...s, paused: false }))

      window.speechSynthesis.speak(utter)
    },
    [supported, lang, rate, pitch, pickVoice],
  )

  // Keep the ref pointing at the latest stepper after it's defined.
  useEffect(() => {
    stepperRef.current = speakSentence
  }, [speakSentence])

  const play = useCallback(
    (fromIdx?: number) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      cancelTokenRef.current += 1
      const token = cancelTokenRef.current
      const start = Math.max(0, fromIdx ?? 0)
      speakSentence(start, token)
    },
    [supported, speakSentence],
  )

  const pause = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.pause()
    setState((s) => ({ ...s, paused: true }))
  }, [supported])

  const resume = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.resume()
    setState((s) => ({ ...s, paused: false }))
  }, [supported])

  const cancel = useCallback(() => {
    if (!supported) return
    cancelTokenRef.current += 1
    window.speechSynthesis.cancel()
    setState((s) => ({
      ...s,
      speaking: false,
      paused: false,
      currentSentenceIdx: null,
    }))
  }, [supported])

  const next = useCallback(() => {
    if (!supported) return
    const cur = state.currentSentenceIdx ?? -1
    play(cur + 1)
  }, [supported, state.currentSentenceIdx, play])

  const prev = useCallback(() => {
    if (!supported) return
    const cur = state.currentSentenceIdx ?? 1
    play(Math.max(0, cur - 1))
  }, [supported, state.currentSentenceIdx, play])

  const speakOne = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return
      window.speechSynthesis.cancel()
      cancelTokenRef.current += 1
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      utter.rate = rate
      utter.pitch = pitch
      const voice = pickVoice()
      if (voice) utter.voice = voice
      utter.onend = () =>
        setState((s) => ({
          ...s,
          speaking: false,
          paused: false,
          currentSentenceIdx: null,
        }))
      window.speechSynthesis.speak(utter)
      setState((s) => ({
        ...s,
        // ad-hoc speech doesn't drive the karaoke highlight on purpose —
        // `currentSentenceIdx` stays null so a popover word doesn't paint
        // an unrelated sentence.
        speaking: true,
        paused: false,
      }))
    },
    [supported, lang, rate, pitch, pickVoice],
  )

  // Cancel speech if the consumer unmounts (e.g. user navigates away).
  useEffect(() => {
    return () => {
      if (!supported) return
      cancelTokenRef.current += 1
      window.speechSynthesis.cancel()
    }
  }, [supported])

  return useMemo(
    () => ({
      ...state,
      play,
      pause,
      resume,
      cancel,
      next,
      prev,
      speakOne,
    }),
    [state, play, pause, resume, cancel, next, prev, speakOne],
  )
}
