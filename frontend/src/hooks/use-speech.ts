import { useCallback, useEffect, useMemo, useRef, useState } from "react"

interface UseSpeechOptions {
  /** Preferred language code — defaults to en-US. */
  lang?: string
  /** Speaking rate 0.1 – 10. */
  rate?: number
  /** Pitch 0 – 2. */
  pitch?: number
}

interface SpeechState {
  supported: boolean
  speaking: boolean
  paused: boolean
}

/**
 * Thin wrapper over the Web Speech API `speechSynthesis`. Exposes
 * `speak / pause / resume / cancel` plus a supports-detection flag the UI can
 * use to hide the 🔊 affordance on browsers without TTS.
 *
 * Notes on defaults:
 * - `en-US` voice preferred, since LexiForge's target content is English.
 * - Rate 0.9 lands somewhere between "native" and "pedagogic" — noticeably
 *   slower than an audiobook but not robotic.
 */
export function useSpeech(options: UseSpeechOptions = {}) {
  const { lang = "en-US", rate = 0.9, pitch = 1 } = options
  const supported =
    typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"

  const [state, setState] = useState<SpeechState>({
    supported,
    speaking: false,
    paused: false,
  })

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

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

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      if (!text.trim()) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      utter.rate = rate
      utter.pitch = pitch
      const voice = pickVoice()
      if (voice) utter.voice = voice
      utter.onstart = () =>
        setState((s) => ({ ...s, speaking: true, paused: false }))
      utter.onend = () =>
        setState((s) => ({ ...s, speaking: false, paused: false }))
      utter.onerror = () =>
        setState((s) => ({ ...s, speaking: false, paused: false }))
      utter.onpause = () => setState((s) => ({ ...s, paused: true }))
      utter.onresume = () => setState((s) => ({ ...s, paused: false }))
      utteranceRef.current = utter
      window.speechSynthesis.speak(utter)
    },
    [supported, lang, rate, pitch, pickVoice],
  )

  const pause = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.pause()
  }, [supported])

  const resume = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.resume()
  }, [supported])

  const cancel = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setState((s) => ({ ...s, speaking: false, paused: false }))
  }, [supported])

  return useMemo(
    () => ({ ...state, speak, pause, resume, cancel }),
    [state, speak, pause, resume, cancel],
  )
}
