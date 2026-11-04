import type { MusicTrackDef } from '../data/koreanVocabulary'
import type { MusicRoomState } from '../domain/types'

// Extract YouTube Video ID from any standard YouTube URL (watch?v=, youtu.be/, shorts/, embed/, etc.)
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  // 11-char direct video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i
  const match = trimmed.match(regExp)
  return match ? match[1] : null
}

interface YTPlayerInstance {
  loadVideoById: (args: string | { videoId: string; startSeconds?: number }) => void
  cueVideoById: (args: string | { videoId: string; startSeconds?: number }) => void
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  setVolume: (volume: number) => void
  getVolume: () => number
  getCurrentTime?: () => number
  getDuration?: () => number
  destroy: () => void
  getPlayerState: () => number
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          height?: string | number
          width?: string | number
          videoId?: string
          playerVars?: Record<string, unknown>
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void
            onError?: (event: { data: number }) => void
          }
        },
      ) => YTPlayerInstance
      PlayerState?: {
        ENDED: number
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        CUED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

// Warm, lush jazz chord progressions (Root, 3rd, 5th, 7th, 9th) for cozy Korean café vibes
const STYLE_CHORDS: Record<MusicTrackDef['style'], number[][]> = {
  'lofi-rain': [
    [261.63, 329.63, 392.0, 493.88, 587.33], // Cmaj9
    [220.0, 261.63, 329.63, 392.0, 493.88],  // Am9
    [174.61, 220.0, 261.63, 329.63, 392.0],  // Fmaj7(9)
    [196.0, 246.94, 293.66, 349.23, 440.0],  // G9
  ],
  'piano-study': [
    [293.66, 349.23, 440.0, 523.25, 659.25], // Dm9
    [196.0, 246.94, 329.63, 392.0, 493.88],  // G13
    [261.63, 329.63, 392.0, 493.88, 587.33], // Cmaj9
    [220.0, 261.63, 329.63, 440.0, 523.25],  // Am7
  ],
  'acoustic-warm': [
    [196.0, 246.94, 293.66, 369.99, 440.0],  // Gmaj9
    [164.81, 196.0, 246.94, 293.66, 369.99], // Em9
    [261.63, 329.63, 392.0, 493.88, 587.33], // Cmaj9
    [293.66, 369.99, 440.0, 523.25, 587.33], // D7(9)
  ],
  'seoul-night': [
    [233.08, 293.66, 349.23, 440.0, 523.25], // Bbmaj9
    [196.0, 233.08, 293.66, 349.23, 440.0],  // Gm9
    [174.61, 220.0, 261.63, 329.63, 392.0],  // Fmaj7
    [196.0, 246.94, 293.66, 392.0, 493.88],  // Gsus4 -> G
  ],
  'spring-breeze': [
    [349.23, 440.0, 523.25, 659.25], // Fmaj7
    [329.63, 392.0, 493.88, 587.33], // Em7
    [293.66, 349.23, 440.0, 523.25], // Dm7
    [261.63, 329.63, 392.0, 493.88], // Cmaj7
  ],
  'latte-jazz': [
    [207.65, 261.63, 311.13, 392.0, 466.16], // Abmaj9
    [174.61, 207.65, 261.63, 311.13, 392.0],  // Fm9
    [233.08, 277.18, 349.23, 415.3, 493.88],  // Bbm9
    [155.56, 196.0, 233.08, 277.18, 349.23],  // Eb9
  ],
}

class CafeMusicEngine {
  private ctx: AudioContext | null = null
  private synthGain: GainNode | null = null
  private ambientMasterGain: GainNode | null = null

  // 1. Rain Layer (Ambience + Window Droplet Pings)
  private rainGain: GainNode | null = null
  private rainSource: AudioBufferSourceNode | null = null
  private dropletTimer: number | null = null

  // 2. Vinyl Layer (Turntable Rumble + Tape Hiss + Dynamic Crackle)
  private vinylGain: GainNode | null = null
  private vinylSource: AudioBufferSourceNode | null = null

  // 3. Café Atmosphere Layer (Room Presence + Distant Porcelain Cup Clinking)
  private cafeAmbianceGain: GainNode | null = null
  private cafeAmbianceSource: AudioBufferSourceNode | null = null
  private cupClinkTimer: number | null = null
  private videoVisible = false

  private masterSoundOn = true
  private musicVolume = 0.50
  private ambientVolume = 0.65
  private rainEnabled = true
  private vinylEnabled = true
  private cafeAmbianceEnabled = true

  private currentStyle: MusicTrackDef['style'] = 'lofi-rain'
  private currentBpm = 72
  private currentAudioUrl: string | null = null
  private extAudio: HTMLAudioElement | null = null
  private extAudioFailed = false

  // YouTube audio playback integration
  private ytPlayer: YTPlayerInstance | null = null
  private ytReady = false
  private ytVideoId: string | null = null
  private ytFailed = false
  private pendingYtVideoId: string | null = null

  private isPlayingRoom = false
  private currentTrackId: string | null = null
  private currentStartedAtMs = 0
  private currentDurationSec = 180
  private driftTimer: number | null = null
  private loopTimer: number | null = null
  private stepIndex = 0
  private unlocked = false

  public onTrackEnded?: (trackId: string) => void
  public onUpdateDuration?: (trackId: string, durationSec: number) => void

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlocked = true
        this.ensureContext()
        if (this.ctx?.state === 'suspended') {
          void this.ctx.resume()
        }
        if (this.ytPlayer && this.ytReady && this.ytVideoId && this.masterSoundOn && this.isPlayingRoom) {
          try {
            this.ytPlayer.playVideo()
          } catch {
            // Ignore unlock play error
          }
        }
        this.refreshPlaybackLoop()
        this.startRainDroplets()
        this.startCupClinks()
      }
      window.addEventListener('pointerdown', unlock, { passive: true })
      window.addEventListener('keydown', unlock, { passive: true })
      this.initYouTubeApi()
    }
  }

  private initYouTubeApi() {
    if (typeof window === 'undefined') return
    if (window.YT && window.YT.Player) {
      this.createYouTubePlayer()
      return
    }
    const prevReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.()
      this.createYouTubePlayer()
    }
    if (!document.getElementById('yt-iframe-api-script')) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api-script'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  }

  private createYouTubePlayer() {
    if (typeof window === 'undefined' || !window.YT || !window.YT.Player || this.ytPlayer) return
    try {
      let box = document.getElementById('kchill-yt-player-box')
      if (!box) {
        box = document.createElement('div')
        box.id = 'kchill-yt-player-box'
        box.setAttribute(
          'style',
          'position:fixed;bottom:4px;right:4px;width:200px;height:120px;opacity:0.01;pointer-events:none;z-index:1;overflow:hidden;',
        )

        // Floating header bar for pip mode
        const header = document.createElement('div')
        header.id = 'kchill-yt-pip-header'
        header.setAttribute(
          'style',
          'display:none;align-items:center;justify-content:space-between;padding:4px 8px;background:rgba(25,20,18,0.95);color:#eed4ba;font-size:10.5px;font-weight:750;border-bottom:1px solid rgba(255,240,225,0.12);',
        )
        header.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:4px;">🎬 Video YouTube K-CHILL</span>
          <button id="kchill-yt-pip-close" type="button" style="background:transparent;border:0;color:#dfb26f;cursor:pointer;font-size:12px;font-weight:bold;padding:0 4px;">✕</button>
        `
        box.appendChild(header)

        const inner = document.createElement('div')
        inner.id = 'kchill-yt-inner'
        inner.setAttribute('style', 'width:100%;height:100%;')
        box.appendChild(inner)
        document.body.appendChild(box)

        const closeBtn = document.getElementById('kchill-yt-pip-close')
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            this.setVideoVisible(false)
          })
        }
      }

      this.ytPlayer = new window.YT.Player('kchill-yt-inner', {
        height: '100%',
        width: '100%',
        videoId: this.pendingYtVideoId || '',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            this.ytReady = true
            try {
              event.target.setVolume(this.masterSoundOn ? Math.round(this.musicVolume * 100) : 0)
              if (this.pendingYtVideoId) {
                this.ytVideoId = this.pendingYtVideoId
                const startSec = Math.floor(this.getExactElapsedSec())
                event.target.loadVideoById({ videoId: this.pendingYtVideoId, startSeconds: startSec })
                if (this.unlocked && this.masterSoundOn && this.isPlayingRoom) {
                  event.target.playVideo()
                }
              }
            } catch (err) {
              console.warn('[CafeMusicEngine] YouTube onReady error:', err)
            }
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              // Video ended
              if (this.currentTrackId) {
                this.onTrackEnded?.(this.currentTrackId)
              }
            } else if (event.data === 1) {
              // Playing: inspect duration
              const checkDur = (tries = 0) => {
                try {
                  const dur = event.target.getDuration?.()
                  if (dur && dur > 10 && this.currentTrackId) {
                    this.currentDurationSec = Math.round(dur)
                    this.onUpdateDuration?.(this.currentTrackId, Math.round(dur))
                    return
                  }
                } catch {}
                if (tries < 8) {
                  window.setTimeout(() => checkDur(tries + 1), 600)
                }
              }
              checkDur()
            }
          },
          onError: (err) => {
            console.warn('[CafeMusicEngine] YouTube audio playback error:', err)
            this.ytFailed = true
            this.refreshPlaybackLoop()
          },
        },
      })
    } catch (err) {
      console.warn('[CafeMusicEngine] Failed to init YouTube Player:', err)
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      try {
        this.ctx = new Ctor()

        // 1. Synth output bus (for procedural Rhodes electric piano fallback)
        this.synthGain = this.ctx.createGain()
        this.synthGain.gain.value = this.masterSoundOn ? this.musicVolume : 0
        this.synthGain.connect(this.ctx.destination)

        // 2. Dedicated ambient soundscape bus (unaffected by music volume, perfectly balanced)
        this.ambientMasterGain = this.ctx.createGain()
        this.ambientMasterGain.gain.value = this.masterSoundOn ? this.ambientVolume : 0
        this.ambientMasterGain.connect(this.ctx.destination)

        this.setupRainNoise()
        this.startRainDroplets()
        this.setupVinylNoise()
        this.setupCafeAmbiance()
        this.startCupClinks()
      } catch {
        return null
      }
    }
    return this.ctx
  }

  // === 1. RAIN ENGINE: Continuous Shower + Realistic Window Droplet Pings ===
  private setupRainNoise() {
    if (!this.ctx || !this.ambientMasterGain || this.rainSource) return
    try {
      // 4-second seamless pink noise buffer
      const sampleRate = this.ctx.sampleRate
      const bufferSize = sampleRate * 4
      const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate)
      const left = buffer.getChannelData(0)
      const right = buffer.getChannelData(1)

      let b0L = 0, b1L = 0, b2L = 0
      let b0R = 0, b1R = 0, b2R = 0

      for (let i = 0; i < bufferSize; i++) {
        const whiteL = Math.random() * 2 - 1
        b0L = 0.996 * b0L + whiteL * 0.03
        b1L = 0.982 * b1L + whiteL * 0.035
        b2L = 0.945 * b2L + whiteL * 0.052
        left[i] = (b0L + b1L + b2L) * 0.18

        const whiteR = Math.random() * 2 - 1
        b0R = 0.996 * b0R + whiteR * 0.03
        b1R = 0.982 * b1R + whiteR * 0.035
        b2R = 0.945 * b2R + whiteR * 0.052
        right[i] = (b0R + b1R + b2R) * 0.18
      }

      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      // Lowpass filter to simulate rain outside the glass window
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 820
      filter.Q.value = 0.7

      const rainGain = this.ctx.createGain()
      rainGain.gain.value = this.rainEnabled && this.masterSoundOn ? 0.38 : 0

      source.connect(filter)
      filter.connect(rainGain)
      rainGain.connect(this.ambientMasterGain)
      source.start()

      this.rainSource = source
      this.rainGain = rainGain
    } catch {
      // Ignore
    }
  }

  // Procedural Window Droplets (Mưa tí tách gõ cửa kính)
  private startRainDroplets() {
    if (this.dropletTimer !== null || typeof window === 'undefined') return

    const scheduleNext = () => {
      const delay = 140 + Math.random() * 240 // 140ms - 380ms
      this.dropletTimer = window.setTimeout(() => {
        this.triggerDropletImpact()
        if (this.rainEnabled && this.masterSoundOn) {
          scheduleNext()
        } else {
          this.dropletTimer = null
        }
      }, delay)
    }

    if (this.rainEnabled && this.masterSoundOn) {
      scheduleNext()
    }
  }

  private triggerDropletImpact() {
    if (!this.ctx || !this.rainGain || !this.rainEnabled || !this.masterSoundOn) return
    try {
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      // High-pitched crystalline droplet pitch (1800Hz - 3200Hz)
      const freq = 1800 + Math.random() * 1400
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + 0.028)

      filter.type = 'bandpass'
      filter.frequency.value = freq
      filter.Q.value = 8.5

      const amp = 0.025 + Math.random() * 0.035
      const duration = 0.018 + Math.random() * 0.015

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(amp, now + 0.002)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.rainGain)

      osc.start(now)
      osc.stop(now + duration + 0.01)
    } catch {
      // Ignore audio scheduling errors
    }
  }

  // === 2. VINYL ENGINE: Turntable Motor Rumble + Tape Hiss + Micro Crackles ===
  private setupVinylNoise() {
    if (!this.ctx || !this.ambientMasterGain || this.vinylSource) return
    try {
      const sampleRate = this.ctx.sampleRate
      const bufferSize = sampleRate * 8 // 8-second organic buffer
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < bufferSize; i++) {
        // Subtle 42Hz turntable motor hum
        const motorHum = Math.sin((2 * Math.PI * 42 * i) / sampleRate) * 0.012
        // Soft vintage tape hiss
        let sample = (Math.random() * 2 - 1) * 0.006 + motorHum

        // Dynamic needle dust ticks & crackles
        if (Math.random() < 0.00075) {
          const pop = (Math.random() * 0.28 + 0.09) * (Math.random() < 0.5 ? 1 : -1)
          sample += pop
          if (i + 1 < bufferSize) data[i + 1] += pop * 0.4
          if (i + 2 < bufferSize) data[i + 2] -= pop * 0.2
        }
        data[i] = sample
      }

      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2300
      filter.Q.value = 0.95

      const vinylGain = this.ctx.createGain()
      vinylGain.gain.value = this.vinylEnabled && this.masterSoundOn ? 0.24 : 0

      source.connect(filter)
      filter.connect(vinylGain)
      vinylGain.connect(this.ambientMasterGain)
      source.start()

      this.vinylSource = source
      this.vinylGain = vinylGain
    } catch {
      // Ignore WebAudio setup errors
    }
  }

  // === 3. CAFÉ AMBIANCE: Room Warmth + Delicate Ceramic Cup & Saucer Clinks ===
  private setupCafeAmbiance() {
    if (!this.ctx || !this.ambientMasterGain || this.cafeAmbianceSource) return
    try {
      // Very gentle, low-frequency café room presence
      const sampleRate = this.ctx.sampleRate
      const bufferSize = sampleRate * 4
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate)
      const data = buffer.getChannelData(0)

      let b0 = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.998 * b0 + white * 0.015
        data[i] = b0 * 0.12
      }

      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 320

      const cafeGain = this.ctx.createGain()
      cafeGain.gain.value = this.cafeAmbianceEnabled && this.masterSoundOn ? 0.26 : 0

      source.connect(filter)
      filter.connect(cafeGain)
      cafeGain.connect(this.ambientMasterGain)
      source.start()

      this.cafeAmbianceSource = source
      this.cafeAmbianceGain = cafeGain
    } catch {
      // Ignore
    }
  }

  private startCupClinks() {
    if (this.cupClinkTimer !== null || typeof window === 'undefined') return

    const scheduleNext = () => {
      // Clink occurs every 18 - 32 seconds (gentle, relaxing, unobtrusive)
      const delay = 18000 + Math.random() * 14000
      this.cupClinkTimer = window.setTimeout(() => {
        this.triggerCupClink()
        if (this.cafeAmbianceEnabled && this.masterSoundOn) {
          scheduleNext()
        } else {
          this.cupClinkTimer = null
        }
      }, delay)
    }

    if (this.cafeAmbianceEnabled && this.masterSoundOn) {
      scheduleNext()
    }
  }

  private triggerCupClink() {
    if (!this.ctx || !this.cafeAmbianceGain || !this.cafeAmbianceEnabled || !this.masterSoundOn) return
    try {
      const now = this.ctx.currentTime

      // Two simultaneous high ceramic chime harmonics (C8: 4186Hz, F8: 5587Hz)
      const frequencies = [4186, 5587]
      frequencies.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)

        const startAt = now + idx * 0.003
        const amp = 0.018 - idx * 0.006

        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.linearRampToValueAtTime(amp, startAt + 0.002)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.075)

        osc.connect(gain)
        gain.connect(this.cafeAmbianceGain!)
        osc.start(startAt)
        osc.stop(startAt + 0.08)
      })

      // Soft body resonance of the ceramic saucer
      const resOsc = this.ctx.createOscillator()
      const resGain = this.ctx.createGain()
      resOsc.type = 'sine'
      resOsc.frequency.setValueAtTime(1420, now)
      resGain.gain.setValueAtTime(0.0001, now)
      resGain.gain.linearRampToValueAtTime(0.009, now + 0.003)
      resGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)
      resOsc.connect(resGain)
      resGain.connect(this.cafeAmbianceGain)
      resOsc.start(now)
      resOsc.stop(now + 0.12)
    } catch {
      // Ignore
    }
  }

  // === CONTROLS & MIXING ===
  setMasterSound(enabled: boolean) {
    this.masterSoundOn = enabled
    if (this.synthGain && this.ctx) {
      this.synthGain.gain.setTargetAtTime(enabled ? this.musicVolume : 0, this.ctx.currentTime, 0.08)
    }
    if (this.ambientMasterGain && this.ctx) {
      this.ambientMasterGain.gain.setTargetAtTime(enabled ? this.ambientVolume : 0, this.ctx.currentTime, 0.08)
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(enabled ? Math.round(this.musicVolume * 100) : 0)
        if (!enabled) {
          this.ytPlayer.pauseVideo()
        } else if (this.isPlayingRoom && this.ytVideoId && !this.ytFailed) {
          this.ytPlayer.playVideo()
        }
      } catch {
        // Ignore YT control error
      }
    }
    if (enabled) {
      this.startRainDroplets()
      this.startCupClinks()
    }
    this.refreshPlaybackLoop()
  }

  setVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol))
    if (this.synthGain && this.ctx && this.masterSoundOn) {
      this.synthGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.08)
    }
    if (this.extAudio) {
      this.extAudio.volume = this.masterSoundOn ? this.musicVolume : 0
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(this.masterSoundOn ? Math.round(this.musicVolume * 100) : 0)
      } catch {
        // Ignore YT volume error
      }
    }
  }

  getVolume(): number {
    return this.musicVolume
  }

  setAmbientVolume(vol: number) {
    this.ambientVolume = Math.max(0, Math.min(1, vol))
    if (this.ambientMasterGain && this.ctx && this.masterSoundOn) {
      this.ambientMasterGain.gain.setTargetAtTime(this.ambientVolume, this.ctx.currentTime, 0.08)
    }
  }

  getAmbientVolume(): number {
    return this.ambientVolume
  }

  setRainEnabled(enabled: boolean) {
    this.rainEnabled = enabled
    if (this.rainGain && this.ctx) {
      this.rainGain.gain.setTargetAtTime(this.masterSoundOn && enabled ? 0.38 : 0, this.ctx.currentTime, 0.12)
    }
    if (enabled && this.masterSoundOn) {
      this.startRainDroplets()
    }
  }

  getRainEnabled(): boolean {
    return this.rainEnabled
  }

  setVinylEnabled(enabled: boolean) {
    this.vinylEnabled = enabled
    if (this.vinylGain && this.ctx) {
      this.vinylGain.gain.setTargetAtTime(this.masterSoundOn && enabled ? 0.24 : 0, this.ctx.currentTime, 0.12)
    }
  }

  getVinylEnabled(): boolean {
    return this.vinylEnabled
  }

  setCafeAmbianceEnabled(enabled: boolean) {
    this.cafeAmbianceEnabled = enabled
    if (this.cafeAmbianceGain && this.ctx) {
      this.cafeAmbianceGain.gain.setTargetAtTime(this.masterSoundOn && enabled ? 0.26 : 0, this.ctx.currentTime, 0.12)
    }
    if (enabled && this.masterSoundOn) {
      this.startCupClinks()
    }
  }

  getCafeAmbianceEnabled(): boolean {
    return this.cafeAmbianceEnabled
  }

  setVideoVisible(visible: boolean) {
    this.videoVisible = visible
    const box = document.getElementById('kchill-yt-player-box')
    const header = document.getElementById('kchill-yt-pip-header')
    if (!box) return

    if (visible) {
      if (header) header.style.display = 'flex'
      box.setAttribute(
        'style',
        'position:fixed;bottom:20px;right:20px;width:300px;height:195px;opacity:1;pointer-events:auto;z-index:9998;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,0.7);border:2px solid rgba(223,178,111,0.55);overflow:hidden;background:#0d0a09;display:flex;flex-direction:column;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);',
      )
    } else {
      if (header) header.style.display = 'none'
      box.setAttribute(
        'style',
        'position:fixed;bottom:4px;right:4px;width:200px;height:120px;opacity:0.01;pointer-events:none;z-index:1;overflow:hidden;transition:all 0.25s ease;',
      )
    }
  }

  isVideoVisible(): boolean {
    return this.videoVisible
  }

  getExactElapsedSec(): number {
    if (!this.currentStartedAtMs) return 0
    const elapsed = Math.max(0, (Date.now() - this.currentStartedAtMs) / 1000)
    const dur = Math.max(1, this.currentDurationSec)
    return elapsed % dur
  }

  private startDriftSyncLoop() {
    if (this.driftTimer !== null || typeof window === 'undefined') return
    this.driftTimer = window.setInterval(() => {
      if (!this.unlocked || !this.masterSoundOn || !this.isPlayingRoom) return
      const targetSec = this.getExactElapsedSec()

      // 1. YouTube lockstep drift sync
      if (this.ytVideoId && this.ytPlayer && this.ytReady && !this.ytFailed) {
        try {
          const curYt = this.ytPlayer.getCurrentTime?.() ?? 0
          if (Math.abs(curYt - targetSec) > 2.5) {
            this.ytPlayer.seekTo(targetSec, true)
          }
        } catch {}
      }

      // 2. HTML5 Audio lockstep drift sync
      if (this.extAudio && !this.extAudio.paused && !this.extAudioFailed) {
        try {
          const dur = this.extAudio.duration || this.currentDurationSec
          const curAudio = this.extAudio.currentTime
          const curTarget = Math.max(0, ((Date.now() - this.currentStartedAtMs) / 1000) % dur)
          if (Math.abs(curAudio - curTarget) > 2.5) {
            this.extAudio.currentTime = curTarget
          }
        } catch {}
      }
    }, 3000)
  }

  syncRoomState(state: MusicRoomState) {
    const trackChanged = state.currentTrack.id !== this.currentTrackId
    const styleChanged = state.currentTrack.style !== this.currentStyle || state.currentTrack.bpm !== this.currentBpm
    const nextUrl = state.currentTrack.audioUrl?.trim() || null
    const urlChanged = nextUrl !== this.currentAudioUrl
    const startedAtChanged = Math.abs((state.startedAtMs || Date.now()) - this.currentStartedAtMs) > 1500
    const isDifferentSong = trackChanged || urlChanged || startedAtChanged

    this.currentTrackId = state.currentTrack.id
    this.currentStyle = state.currentTrack.style
    this.currentBpm = state.currentTrack.bpm || 72
    this.isPlayingRoom = state.isPlaying
    this.currentStartedAtMs = state.startedAtMs || Date.now()
    this.currentDurationSec = state.currentTrack.durationSec || 180
    this.startDriftSyncLoop()

    const targetSec = this.getExactElapsedSec()

    if (isDifferentSong) {
      this.currentAudioUrl = nextUrl
      this.extAudioFailed = false
      this.ytFailed = false

      const ytId = extractYouTubeId(nextUrl)

      // Stop previous HTML audio immediately
      if (this.extAudio) {
        this.extAudio.pause()
        this.extAudio.src = ''
        this.extAudio = null
      }

      if (ytId) {
        // YouTube track detected!
        this.ytVideoId = ytId
        this.pendingYtVideoId = ytId
        if (this.ytPlayer && this.ytReady) {
          try {
            this.ytPlayer.loadVideoById({ videoId: ytId, startSeconds: Math.floor(targetSec) })
            this.ytPlayer.setVolume(this.masterSoundOn ? Math.round(this.musicVolume * 100) : 0)
            if (this.unlocked && this.masterSoundOn && this.isPlayingRoom) {
              this.ytPlayer.playVideo()
            }
          } catch {
            this.ytFailed = true
          }
        } else {
          this.initYouTubeApi()
        }
      } else {
        // Not a YouTube track: stop YouTube audio if playing
        this.ytVideoId = null
        this.pendingYtVideoId = null
        if (this.ytPlayer && this.ytReady) {
          try {
            this.ytPlayer.stopVideo()
          } catch {
            // Ignore
          }
        }

        // Play standard MP3/audio URL if provided (seeked to live room timestamp!)
        if (nextUrl && typeof Audio !== 'undefined') {
          const audio = new Audio(nextUrl)
          audio.loop = false
          audio.volume = this.masterSoundOn ? this.musicVolume : 0
          audio.onended = () => {
            if (this.currentTrackId) {
              this.onTrackEnded?.(this.currentTrackId)
            }
          }
          const seekToLive = () => {
            try {
              const dur = audio.duration || this.currentDurationSec
              if (audio.duration && audio.duration > 10 && this.currentTrackId) {
                this.onUpdateDuration?.(this.currentTrackId, Math.round(audio.duration))
              }
              const curLive = Math.max(0, ((Date.now() - this.currentStartedAtMs) / 1000) % dur)
              audio.currentTime = curLive
            } catch {}
          }
          audio.addEventListener('loadedmetadata', seekToLive, { once: true })
          audio.addEventListener('canplay', seekToLive, { once: true })
          audio.onerror = () => {
            this.extAudioFailed = true
            this.refreshPlaybackLoop()
          }
          if (this.unlocked && this.masterSoundOn && this.isPlayingRoom) {
            void audio.play().catch(() => {})
          }
          this.extAudio = audio
        } else {
          this.stepIndex = 0
        }
      }
    } else {
      // Same track: verify time alignment
      if (this.ytVideoId && this.ytPlayer && this.ytReady && !this.ytFailed) {
        try {
          const curYt = this.ytPlayer.getCurrentTime?.() ?? 0
          if (Math.abs(curYt - targetSec) > 3) {
            this.ytPlayer.seekTo(targetSec, true)
          }
        } catch {}
      }
      if (this.extAudio && !this.extAudio.paused && !this.extAudioFailed) {
        try {
          const dur = this.extAudio.duration || this.currentDurationSec
          const curTarget = Math.max(0, ((Date.now() - this.currentStartedAtMs) / 1000) % dur)
          if (Math.abs(this.extAudio.currentTime - curTarget) > 3) {
            this.extAudio.currentTime = curTarget
          }
        } catch {}
      }
    }

    if ((isDifferentSong || styleChanged) && this.loopTimer !== null) {
      window.clearInterval(this.loopTimer)
      this.loopTimer = null
    }
    this.refreshPlaybackLoop()
  }

  private refreshPlaybackLoop() {
    const shouldPlay = this.unlocked && this.masterSoundOn && this.isPlayingRoom

    // Always keep background Web Audio active for cozy ambient chill layers
    if (this.unlocked && this.masterSoundOn) {
      const ctx = this.ensureContext()
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume()
      }
    }

    // 1. YouTube Audio Mode
    if (this.ytVideoId && !this.ytFailed) {
      if (this.loopTimer !== null) {
        window.clearInterval(this.loopTimer)
        this.loopTimer = null
      }
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.setVolume(this.masterSoundOn ? Math.round(this.musicVolume * 100) : 0)
          if (shouldPlay) {
            this.ytPlayer.playVideo()
          } else {
            this.ytPlayer.pauseVideo()
          }
        } catch {
          this.ytFailed = true
          this.refreshPlaybackLoop()
        }
      }
      return
    }

    // 2. HTML5 Audio File Mode
    if (this.extAudio && !this.extAudioFailed) {
      this.extAudio.volume = this.masterSoundOn ? this.musicVolume : 0
      if (shouldPlay) {
        if (this.loopTimer !== null) {
          window.clearInterval(this.loopTimer)
          this.loopTimer = null
        }
        void this.extAudio.play().catch(() => {
          this.extAudioFailed = true
          this.refreshPlaybackLoop()
        })
        return
      } else {
        this.extAudio.pause()
      }
    }

    // 3. Fallback: Procedural Lush Electric Piano (Rhodes MK II)
    if (!shouldPlay) {
      if (this.loopTimer !== null) {
        window.clearInterval(this.loopTimer)
        this.loopTimer = null
      }
      return
    }
    if (this.loopTimer !== null) return

    const beatMs = Math.round((60 / Math.max(56, this.currentBpm)) * 1000 * 2)
    this.triggerLoFiStep()
    this.loopTimer = window.setInterval(() => {
      this.triggerLoFiStep()
    }, beatMs)
  }

  private triggerLoFiStep() {
    const ctx = this.ensureContext()
    if (!ctx || !this.synthGain || ctx.state !== 'running') return

    if (this.currentStartedAtMs) {
      const beatMs = Math.round((60 / Math.max(56, this.currentBpm)) * 1000 * 2)
      this.stepIndex = Math.floor(Math.max(0, Date.now() - this.currentStartedAtMs) / beatMs)
    }

    const chords = STYLE_CHORDS[this.currentStyle] ?? STYLE_CHORDS['lofi-rain']
    const chord = chords[Math.floor(this.stepIndex / 2) % chords.length]
    const isChordDownbeat = this.stepIndex % 2 === 0
    const now = ctx.currentTime

    if (isChordDownbeat) {
      // Warm Vintage Rhodes chord with overtone tine bell
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)

        // Bell tine overtone
        const bellOsc = ctx.createOscillator()
        const bellGain = ctx.createGain()
        bellOsc.type = 'sine'
        bellOsc.frequency.setValueAtTime(freq * 2, now)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(1400, now)
        filter.frequency.exponentialRampToValueAtTime(480, now + 2.2)
        filter.Q.value = 1.1

        const startAt = now + idx * 0.038 // gentle arpeggio strum
        const chordGain = 0.038 / (idx === 0 ? 0.9 : 1.25)

        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.linearRampToValueAtTime(chordGain, startAt + 0.012)
        gain.gain.exponentialRampToValueAtTime(chordGain * 0.35, startAt + 0.28)
        gain.gain.exponentialRampToValueAtTime(0.0004, startAt + 2.8)

        bellGain.gain.setValueAtTime(0.0001, startAt)
        bellGain.gain.linearRampToValueAtTime(chordGain * 0.25, startAt + 0.006)
        bellGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18)

        osc.connect(filter)
        bellOsc.connect(filter)
        filter.connect(gain)
        gain.connect(this.synthGain!)

        osc.start(startAt)
        bellOsc.start(startAt)
        osc.stop(startAt + 2.9)
        bellOsc.stop(startAt + 0.2)
      })

      // Warm sub-bass on root note
      const rootFreq = chord[0] * 0.5
      const subOsc = ctx.createOscillator()
      const subGain = ctx.createGain()
      const subFilter = ctx.createBiquadFilter()
      subOsc.type = 'sine'
      subOsc.frequency.setValueAtTime(rootFreq, now)
      subFilter.type = 'lowpass'
      subFilter.frequency.setValueAtTime(160, now)
      subGain.gain.setValueAtTime(0.0001, now)
      subGain.gain.linearRampToValueAtTime(0.048, now + 0.03)
      subGain.gain.exponentialRampToValueAtTime(0.0005, now + 2.4)
      subOsc.connect(subFilter)
      subFilter.connect(subGain)
      subGain.connect(this.synthGain!)
      subOsc.start(now)
      subOsc.stop(now + 2.5)
    } else {
      // Gentle upper Rhodes chime note
      const noteFreq = chord[(this.stepIndex * 3) % chord.length] * 2
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(noteFreq, now)

      filter.type = 'lowpass'
      filter.frequency.value = 1800

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.024, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0004, now + 1.4)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.synthGain!)
      osc.start(now)
      osc.stop(now + 1.5)
    }

    this.stepIndex++
  }

  playChime(kind: 'correct' | 'miss' | 'win') {
    if (!this.masterSoundOn) return
    const ctx = this.ensureContext()
    if (!ctx || !this.synthGain) return
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    const notes =
      kind === 'correct'
        ? [523.25, 659.25]
        : kind === 'win'
          ? [523.25, 659.25, 783.99, 1046.5]
          : [260, 210]

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = kind === 'miss' ? 'triangle' : 'sine'
      osc.frequency.value = freq

      const t = now + i * 0.075
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.linearRampToValueAtTime(0.09, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.28)

      osc.connect(gain)
      gain.connect(this.synthGain!)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  }
}

export const cafeMusicEngine = new CafeMusicEngine()

let ttsAudioEl: HTMLAudioElement | null = null

export function speakKorean(text: string) {
  if (typeof window === 'undefined') return
  const clean = text.trim()
  if (!clean) return

  try {
    if (!ttsAudioEl) {
      ttsAudioEl = new Audio()
    }
    ttsAudioEl.pause()
    ttsAudioEl.currentTime = 0
    ttsAudioEl.src = `/api/tts/korean?text=${encodeURIComponent(clean)}`
    const p = ttsAudioEl.play()
    if (p) {
      p.catch(() => {
        fallbackSpeechSynthesis(clean)
      })
    }
  } catch {
    fallbackSpeechSynthesis(clean)
  }
}

function fallbackSpeechSynthesis(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ko-KR'
    utter.rate = 0.92
    utter.pitch = 1.02
    const voices = window.speechSynthesis.getVoices()
    const googleVoice = voices.find(
      (v) => v.lang.toLowerCase().startsWith('ko') && v.name.toLowerCase().includes('google'),
    )
    const anyKoVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ko'))
    if (googleVoice) {
      utter.voice = googleVoice
    } else if (anyKoVoice) {
      utter.voice = anyKoVoice
    }
    window.speechSynthesis.speak(utter)
  } catch {
    // Ignore unsupported browser TTS environments
  }
}
