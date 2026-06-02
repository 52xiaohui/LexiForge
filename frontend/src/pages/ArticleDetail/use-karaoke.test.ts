import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Sentence } from "./parsing"
import { useKaraoke } from "./use-karaoke"

// --- Minimal controllable Web Speech mock --------------------------------------
// jsdom ships no SpeechSynthesis, so we stub just enough surface for the hook:
// `speak` fires `onstart` immediately and records the utterance so a test can
// drive `onend` to simulate a sentence finishing.

interface MockUtterance {
  text: string
  lang: string
  rate: number
  pitch: number
  voice: unknown
  onstart?: () => void
  onend?: () => void
  onerror?: () => void
  onpause?: () => void
  onresume?: () => void
}

let spoken: MockUtterance[]
let synth: {
  speak: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  getVoices: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

class MockSpeechSynthesisUtterance {
  text: string
  lang = ""
  rate = 1
  pitch = 1
  voice: unknown = null
  onstart?: () => void
  onend?: () => void
  onerror?: () => void
  onpause?: () => void
  onresume?: () => void
  constructor(text: string) {
    this.text = text
  }
}

function installSpeech() {
  spoken = []
  synth = {
    speak: vi.fn((u: MockUtterance) => {
      spoken.push(u)
      u.onstart?.()
    }),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal("speechSynthesis", synth)
  vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance)
  // The hook reads `window.speechSynthesis`, not the bare global.
  ;(window as unknown as { speechSynthesis: unknown }).speechSynthesis = synth
}

function makeSentences(texts: string[]): Sentence[] {
  return texts.map((text, i) => ({
    globalIdx: i,
    paragraphIdx: 0,
    withinParagraphIdx: i,
    start: 0,
    end: text.length,
    text,
    segments: [],
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  // Remove the window property we set so other tests start clean.
  delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis
})

describe("useKaraoke (supported)", () => {
  beforeEach(installSpeech)

  it("reports supported and starts speaking the first sentence on play()", () => {
    const { result } = renderHook(() =>
      useKaraoke({ sentences: makeSentences(["One.", "Two."]) }),
    )
    expect(result.current.supported).toBe(true)

    act(() => result.current.play())

    expect(synth.cancel).toHaveBeenCalled()
    expect(spoken).toHaveLength(1)
    expect(spoken[0]!.text).toBe("One.")
    expect(result.current.speaking).toBe(true)
    expect(result.current.currentSentenceIdx).toBe(0)
  })

  it("auto-advances to the next sentence when one ends", () => {
    const { result } = renderHook(() =>
      useKaraoke({ sentences: makeSentences(["One.", "Two."]) }),
    )
    act(() => result.current.play())
    act(() => spoken[0]!.onend?.())

    expect(spoken).toHaveLength(2)
    expect(spoken[1]!.text).toBe("Two.")
    expect(result.current.currentSentenceIdx).toBe(1)
  })

  it("clears state after the final sentence ends", () => {
    const { result } = renderHook(() =>
      useKaraoke({ sentences: makeSentences(["Only one."]) }),
    )
    act(() => result.current.play())
    act(() => spoken[0]!.onend?.())

    expect(result.current.speaking).toBe(false)
    expect(result.current.currentSentenceIdx).toBeNull()
  })

  it("cancel() stops speech and resets state", () => {
    const { result } = renderHook(() =>
      useKaraoke({ sentences: makeSentences(["One.", "Two."]) }),
    )
    act(() => result.current.play())
    act(() => result.current.cancel())

    expect(synth.cancel).toHaveBeenCalled()
    expect(result.current.speaking).toBe(false)
    expect(result.current.currentSentenceIdx).toBeNull()
  })

  it("speakOne() speaks ad-hoc text without driving the karaoke highlight", () => {
    const { result } = renderHook(() =>
      useKaraoke({ sentences: makeSentences(["One."]) }),
    )
    act(() => result.current.speakOne("hello"))

    expect(spoken.at(-1)!.text).toBe("hello")
    expect(result.current.speaking).toBe(true)
    expect(result.current.currentSentenceIdx).toBeNull()
  })

  it("speakOne() ignores empty/whitespace text", () => {
    const { result } = renderHook(() =>
      useKaraoke({ sentences: makeSentences(["One."]) }),
    )
    act(() => result.current.speakOne("   "))
    expect(spoken).toHaveLength(0)
  })
})

describe("useKaraoke (unsupported)", () => {
  it("reports unsupported and play() is a no-op when speechSynthesis is absent", () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis
    const { result } = renderHook(() =>
      useKaraoke({ sentences: makeSentences(["One."]) }),
    )
    expect(result.current.supported).toBe(false)
    act(() => result.current.play())
    expect(result.current.currentSentenceIdx).toBeNull()
  })
})
