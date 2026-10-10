export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}

let audio: AudioContext | undefined

/** Two-note chime. Browsers block audio until the user has interacted with the page. */
export function chime() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const start = audio.currentTime
    ;[880, 660].forEach((freq, i) => {
      const osc = audio!.createOscillator()
      const gain = audio!.createGain()
      const t = start + i * 0.25
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      osc.connect(gain).connect(audio!.destination)
      osc.start(t)
      osc.stop(t + 0.45)
    })
  } catch {
    // audio unavailable
  }
}

export function vibrate(pattern: number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && pattern.length) navigator.vibrate(pattern)
}
