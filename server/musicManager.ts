import crypto from 'node:crypto'
import { DEFAULT_MUSIC_TRACKS, type MusicTrackDef } from '../src/data/koreanVocabulary.ts'
import type { MusicRoomState } from '../src/domain/types.ts'
import { loadPersistedMusicQueue, saveMusicQueueState } from './store.ts'
import { extractYouTubeId, fetchYouTubeDetails } from './youtubeHelper.ts'

export const SUGGEST_COOLDOWN_MS = 10 * 60 * 1000 // 10 minutes per user

const VALID_STYLES: MusicTrackDef['style'][] = [
  'lofi-rain',
  'acoustic-warm',
  'seoul-night',
  'piano-study',
  'spring-breeze',
  'latte-jazz',
]

export class MusicRoomManager {
  private currentTrack: MusicTrackDef
  private startedAtMs: number
  private pausedElapsedMs = 0
  private isPlaying = true
  private library: MusicTrackDef[]
  private queue: MusicTrackDef[]
  private pendingQueue: MusicTrackDef[] = []
  private readonly lastSuggestedAtByUser = new Map<string, number>()
  private readonly votedByTrack = new Map<string, Set<string>>()
  private readonly onBroadcast: (state: MusicRoomState) => void
  private readonly tickTimer: ReturnType<typeof setInterval>

  constructor(onBroadcast: (state: MusicRoomState) => void) {
    this.onBroadcast = onBroadcast
    this.library = DEFAULT_MUSIC_TRACKS.map((t) => ({ ...t }))
    this.currentTrack = { ...this.library[0], suggestedBy: 'Admin K-CHILL' }
    this.startedAtMs = Date.now()
    this.queue = loadPersistedMusicQueue()

    this.tickTimer = setInterval(() => {
      if (!this.isPlaying) return
      const elapsedSec = (Date.now() - this.startedAtMs) / 1000
      // For real YouTube / external audio tracks, wait for true duration + 8s safety margin;
      // procedural synth loops advance smoothly when duration finishes.
      const maxAllowed = this.currentTrack.audioUrl
        ? Math.max(120, this.currentTrack.durationSec + 8)
        : this.currentTrack.durationSec
      if (elapsedSec >= maxAllowed) {
        this.advanceToNextTrack()
        this.onBroadcast(this.getState())
      }
    }, 2000)
  }

  dispose() {
    clearInterval(this.tickTimer)
  }

  updateTrackDuration(trackId: string, durationSec: number): void {
    if (this.currentTrack.id === trackId && durationSec >= 15) {
      const rounded = Math.round(durationSec)
      if (Math.abs(this.currentTrack.durationSec - rounded) > 1) {
        this.currentTrack.durationSec = rounded
        this.onBroadcast(this.getState())
      }
    }
    const inQueue = this.queue.find((t) => t.id === trackId)
    if (inQueue && durationSec >= 15) {
      inQueue.durationSec = Math.round(durationSec)
    }
  }

  handleTrackEnded(trackId: string): void {
    if (this.currentTrack.id === trackId) {
      this.advanceToNextTrack()
      this.onBroadcast(this.getState())
    }
  }

  getLibrary(): MusicTrackDef[] {
    return this.library.map((t) => ({ ...t }))
  }

  getState(): MusicRoomState {
    return {
      currentTrack: { ...this.currentTrack },
      startedAtMs: this.startedAtMs,
      isPlaying: this.isPlaying,
      djUserId: 'admin',
      djName: 'Admin K-CHILL',
      queue: this.queue.map((t) => ({ ...t })),
      pendingQueue: this.pendingQueue.map((t) => ({ ...t })),
    }
  }

  getRemainingCooldownSec(userId: string): number {
    const last = this.lastSuggestedAtByUser.get(userId)
    if (!last) return 0
    const diff = Date.now() - last
    if (diff >= SUGGEST_COOLDOWN_MS) return 0
    return Math.ceil((SUGGEST_COOLDOWN_MS - diff) / 1000)
  }

  private sortAndSaveQueue() {
    this.queue.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    saveMusicQueueState(this.queue)
  }

  private advanceToNextTrack(specificTrackId?: string) {
    let next: MusicTrackDef | undefined

    if (specificTrackId) {
      // 1. Check approved queue
      const qIdx = this.queue.findIndex((t) => t.id === specificTrackId)
      if (qIdx >= 0) {
        next = this.queue.splice(qIdx, 1)[0]
      } else {
        // 2. Check pending queue (when Admin approves and plays directly)
        const pIdx = this.pendingQueue.findIndex((t) => t.id === specificTrackId)
        if (pIdx >= 0) {
          next = this.pendingQueue.splice(pIdx, 1)[0]
          next.status = 'approved'
        } else {
          // 3. Check preset library
          const libFound = this.library.find((t) => t.id === specificTrackId)
          if (libFound) next = { ...libFound, suggestedBy: 'Admin K-CHILL' }
        }
      }
    }

    // Auto-advance ONLY takes from approved queue! Pending user tracks MUST be approved by Admin first!
    if (!next && this.queue.length > 0) {
      this.queue.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      next = this.queue.shift()
    }

    // Fallback to cycling built-in cafe ambient tracks
    if (!next) {
      const curIdx = this.library.findIndex((t) => t.id === this.currentTrack.id)
      const nextLib = this.library[(curIdx + 1) % this.library.length] ?? this.library[0]
      next = { ...nextLib, suggestedBy: 'Admin K-CHILL' }
    }

    this.votedByTrack.delete(next.id)
    this.currentTrack = next
    this.startedAtMs = Date.now()
    this.pausedElapsedMs = 0
    this.isPlaying = true
    this.sortAndSaveQueue()
  }

  suggestTrack(
    userId: string,
    username: string,
    payload: { title: string; artist?: string; mood?: string; style?: string; audioUrl?: string },
  ):
    | { ok: true; track: MusicTrackDef; cooldownSec: number; state: MusicRoomState }
    | { ok: false; cooldownSec?: number; reason: string } {
    const remainingSec = this.getRemainingCooldownSec(userId)
    if (remainingSec > 0) {
      const m = Math.floor(remainingSec / 60)
      const s = String(remainingSec % 60).padStart(2, '0')
      return {
        ok: false,
        cooldownSec: remainingSec,
        reason: `Mỗi 10 phút chỉ được đề xuất 1 bài hát. Bạn vui lòng đợi thêm ${m}:${s} nữa nhé!`,
      }
    }

    const cleanAudioUrl = (payload.audioUrl || '').trim()
    const cleanTitle = (payload.title || '').trim().slice(0, 80)

    if (!cleanAudioUrl && !cleanTitle) {
      return { ok: false, reason: 'Hãy nhập link YouTube và tên bài hát bạn muốn đề xuất nhé!' }
    }

    if (cleanAudioUrl && !extractYouTubeId(cleanAudioUrl)) {
      return { ok: false, reason: 'Vui lòng dán link YouTube hợp lệ (VD: https://youtu.be/... hoặc youtube.com/watch?v=...) nhé!' }
    }

    if (this.pendingQueue.length >= 24) {
      return { ok: false, reason: 'Danh sách đề xuất chờ Admin duyệt đang đầy. Hãy thử lại sau ít phút nhé!' }
    }

    const cleanArtist = (payload.artist || 'YouTube / K-CHILL').trim().slice(0, 42) || 'YouTube / K-CHILL'
    const cleanMood = (payload.mood || 'Đề xuất từ khách (YouTube)').trim().slice(0, 36) || 'Đề xuất từ khách'
    const chosenStyle: MusicTrackDef['style'] =
      payload.style && (VALID_STYLES as string[]).includes(payload.style)
        ? (payload.style as MusicTrackDef['style'])
        : 'lofi-rain'

    const bpmByStyle: Record<MusicTrackDef['style'], number> = {
      'lofi-rain': 72,
      'piano-study': 68,
      'acoustic-warm': 78,
      'seoul-night': 75,
      'spring-breeze': 82,
      'latte-jazz': 66,
    }

    const newTrack: MusicTrackDef = {
      id: `sug-${crypto.randomUUID().slice(0, 8)}`,
      title: cleanTitle || 'Đang tải bài hát...',
      artist: cleanArtist,
      mood: cleanMood,
      bpm: bpmByStyle[chosenStyle],
      style: chosenStyle,
      durationSec: 240,
      suggestedBy: username,
      votes: 1,
      audioUrl: cleanAudioUrl || undefined,
      status: 'pending',
    }

    if (newTrack.audioUrl) {
      void fetchYouTubeDetails(newTrack.audioUrl).then((info) => {
        let changed = false
        if (info?.durationSec && info.durationSec > 10) {
          newTrack.durationSec = info.durationSec
          changed = true
        }
        if (info?.title && (!cleanTitle || cleanTitle === 'Đang tải bài hát...')) {
          newTrack.title = info.title.slice(0, 80)
          changed = true
        }
        if (info?.author && newTrack.artist === 'YouTube / K-CHILL') {
          newTrack.artist = info.author.slice(0, 42)
          changed = true
        }
        if (changed) {
          this.sortAndSaveQueue()
          this.onBroadcast(this.getState())
        }
      })
    }

    this.lastSuggestedAtByUser.set(userId, Date.now())
    this.votedByTrack.set(newTrack.id, new Set([userId]))
    // Placed into pending queue waiting for Admin approval!
    this.pendingQueue.push(newTrack)

    const state = this.getState()
    this.onBroadcast(state)
    return { ok: true, track: newTrack, cooldownSec: 600, state }
  }

  voteTrack(userId: string, trackId: string): { ok: true; state: MusicRoomState } | { ok: false; reason: string } {
    const track = this.queue.find((t) => t.id === trackId) || this.pendingQueue.find((t) => t.id === trackId)
    if (!track) {
      return { ok: false, reason: 'Bài hát này không còn trong danh sách.' }
    }
    let voters = this.votedByTrack.get(trackId)
    if (!voters) {
      voters = new Set()
      this.votedByTrack.set(trackId, voters)
    }
    if (voters.has(userId)) {
      return { ok: false, reason: 'Bạn đã thả tim ủng hộ bài này rồi nhé! ❤️' }
    }
    voters.add(userId)
    track.votes = (track.votes ?? 1) + 1
    this.sortAndSaveQueue()

    const state = this.getState()
    this.onBroadcast(state)
    return { ok: true, state }
  }

  adminAction(params: {
    action:
      | 'play-track'
      | 'skip'
      | 'remove-track'
      | 'toggle-play'
      | 'add-custom'
      | 'approve-and-play'
      | 'approve-to-queue'
      | 'reject-track'
    trackId?: string
    customTrack?: {
      title: string
      artist?: string
      mood?: string
      style?: string
      audioUrl?: string
      durationSec?: number
      playNow?: boolean
    }
  }): MusicRoomState {
    const { action, trackId, customTrack } = params

    if (action === 'skip') {
      this.advanceToNextTrack()
    } else if (action === 'play-track' && trackId) {
      this.advanceToNextTrack(trackId)
    } else if (action === 'approve-and-play' && trackId) {
      const pIdx = this.pendingQueue.findIndex((t) => t.id === trackId)
      if (pIdx >= 0) {
        const approvedTrack = this.pendingQueue.splice(pIdx, 1)[0]
        approvedTrack.status = 'approved'
        this.currentTrack = approvedTrack
        this.startedAtMs = Date.now()
        this.pausedElapsedMs = 0
        this.isPlaying = true
      }
    } else if (action === 'approve-to-queue' && trackId) {
      const pIdx = this.pendingQueue.findIndex((t) => t.id === trackId)
      if (pIdx >= 0) {
        const approvedTrack = this.pendingQueue.splice(pIdx, 1)[0]
        approvedTrack.status = 'approved'
        this.queue.push(approvedTrack)
        this.sortAndSaveQueue()
      }
    } else if (action === 'reject-track' && trackId) {
      const pIdx = this.pendingQueue.findIndex((t) => t.id === trackId)
      if (pIdx >= 0) {
        this.pendingQueue.splice(pIdx, 1)
        this.votedByTrack.delete(trackId)
      }
    } else if (action === 'remove-track' && trackId) {
      const idx = this.queue.findIndex((t) => t.id === trackId)
      if (idx >= 0) {
        this.queue.splice(idx, 1)
        this.votedByTrack.delete(trackId)
        this.sortAndSaveQueue()
      }
      const pIdx = this.pendingQueue.findIndex((t) => t.id === trackId)
      if (pIdx >= 0) {
        this.pendingQueue.splice(pIdx, 1)
        this.votedByTrack.delete(trackId)
      }
    } else if (action === 'toggle-play') {
      if (this.isPlaying) {
        this.pausedElapsedMs = Math.max(0, Date.now() - this.startedAtMs)
        this.isPlaying = false
      } else {
        this.startedAtMs = Date.now() - this.pausedElapsedMs
        this.isPlaying = true
      }
    } else if (action === 'add-custom' && customTrack?.title?.trim()) {
      const chosenStyle: MusicTrackDef['style'] =
        customTrack.style && (VALID_STYLES as string[]).includes(customTrack.style)
          ? (customTrack.style as MusicTrackDef['style'])
          : 'lofi-rain'
      const initDur = customTrack.durationSec && customTrack.durationSec >= 15 ? customTrack.durationSec : 240
      const created: MusicTrackDef = {
        id: `adm-${crypto.randomUUID().slice(0, 8)}`,
        title: customTrack.title.trim().slice(0, 70),
        artist: (customTrack.artist || 'Admin Playlist').trim().slice(0, 44),
        mood: (customTrack.mood || 'Admin chọn phát').trim().slice(0, 36),
        bpm: 72,
        style: chosenStyle,
        durationSec: initDur,
        suggestedBy: 'Admin K-CHILL',
        votes: 99,
        audioUrl: customTrack.audioUrl?.trim() || undefined,
      }
      this.library.unshift(created)
      if (customTrack.playNow !== false) {
        this.currentTrack = created
        this.startedAtMs = Date.now()
        this.pausedElapsedMs = 0
        this.isPlaying = true
      } else {
        this.queue.unshift(created)
        this.sortAndSaveQueue()
      }

      if (created.audioUrl) {
        void fetchYouTubeDetails(created.audioUrl).then((info) => {
          if (info?.durationSec && info.durationSec >= 15) {
            created.durationSec = info.durationSec
            if (this.currentTrack.id === created.id) {
              this.currentTrack.durationSec = info.durationSec
            }
            if (info.title && (!customTrack.title || customTrack.title.startsWith('YouTube Track'))) {
              created.title = info.title.slice(0, 70)
              if (this.currentTrack.id === created.id) {
                this.currentTrack.title = created.title
              }
            }
            this.onBroadcast(this.getState())
          }
        })
      }
    }

    const state = this.getState()
    this.onBroadcast(state)
    return state
  }
}
