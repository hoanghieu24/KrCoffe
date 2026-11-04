import { io, type Socket } from 'socket.io-client'
import type {
  AdminAnnouncement,
  CafeSeat,
  CharacterAnimation,
  ChatMessagePayload,
  Direction,
  GameInvitePayload,
  GameKind,
  GameResultSummary,
  GameRoomSession,
  MiniGameDirectInvite,
  MusicRoomState,
  PlayerLearningProfile,
  RoomPlayerState,
  StorySyncPayload,
  VoiceInvitePayload,
  VoiceSessionInfo,
  VoiceSignalPayload,
} from '../domain/types'
import type { GameDifficulty, MemoryPairCount, MiniGameId, MiniGameLobbyRoom } from '../games/types'

export type PlayerSessionProfile = {
  userId: string
  username: string
  avatarId: string
  level: string
  entered: boolean
}

export type JoinSnapshot = {
  me: RoomPlayerState
  players: RoomPlayerState[]
  seats: CafeSeat[]
  messages: ChatMessagePayload[]
  musicState?: MusicRoomState
  suggestCooldownSec?: number
  learningProfile?: PlayerLearningProfile
  openMiniGameRooms?: MiniGameLobbyRoom[]
}

export type PlayerMovedPayload = {
  userId: string
  u: number
  v: number
  direction: Direction
  animation: CharacterAnimation
  seatId: string | null
}

export type CharacterAction = 'wave' | 'heart' | 'cheer' | 'coffee' | 'study' | 'music' | 'talk'

export type PlayerActionPayload = {
  fromId: string
  fromName: string
  targetId: string | null
  targetName: string | null
  tableId: string | null
  action: CharacterAction
}

export type VoiceInviteResultPayload = {
  inviteId: string
  accepted: boolean
  expired?: boolean
  receiverName: string
  reason?: string
}

export type GameInviteResultPayload = {
  inviteId: string
  accepted: boolean
  expired?: boolean
  receiverName: string
  reason?: string
}

const SESSION_KEY = 'kchill_tab_profile_v1'

function makeUserId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `user-${crypto.randomUUID().slice(0, 8)}`
  }
  return `user-${Math.random().toString(36).slice(2, 10)}`
}

export function loadTabSession(): PlayerSessionProfile {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerSessionProfile>
      if (parsed.userId) {
        return {
          userId: parsed.userId,
          username: parsed.username || '',
          avatarId: parsed.avatarId || 'look-01',
          level: parsed.level || 'TOPIK 1',
          entered: Boolean(parsed.entered && parsed.username?.trim()),
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  const initial: PlayerSessionProfile = {
    userId: makeUserId(),
    username: '',
    avatarId: 'look-01',
    level: 'TOPIK 1',
    entered: false,
  }
  saveTabSession(initial)
  return initial
}

export function saveTabSession(profile: PlayerSessionProfile) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile))
  } catch {
    // Ignore storage errors
  }
}

type ListenerMap = {
  snapshot: (data: JoinSnapshot) => void
  playersChanged: (players: RoomPlayerState[]) => void
  seatsChanged: (seats: CafeSeat[]) => void
  playerMoved: (payload: PlayerMovedPayload) => void
  playerAction: (payload: PlayerActionPayload) => void
  chatMessage: (msg: ChatMessagePayload) => void
  connectionChanged: (connected: boolean) => void
  // Phase 3 Voice
  voiceIncomingInvite: (invite: VoiceInvitePayload) => void
  voiceInviteCancelled: (payload: { inviteId: string; reason: string }) => void
  voiceInviteResult: (payload: VoiceInviteResultPayload) => void
  voiceSessionStarted: (session: VoiceSessionInfo) => void
  voiceSignal: (payload: { sessionId: string; fromId: string; signal: VoiceSignalPayload }) => void
  voicePeerMute: (payload: { sessionId: string; userId: string; muted: boolean }) => void
  voiceEnded: (payload: { sessionId: string; reason: string }) => void
  // Phase 4 Legacy Table Games
  gameIncomingInvite: (invite: GameInvitePayload) => void
  gameInviteCancelled: (payload: { inviteId: string; reason: string }) => void
  gameInviteResult: (payload: GameInviteResultPayload) => void
  gameStarted: (session: GameRoomSession) => void
  gameState: (session: GameRoomSession) => void
  gameEnded: (summary: GameResultSummary) => void
  // Mini-Game Center (6 Games)
  mgOpenRooms: (rooms: MiniGameLobbyRoom[]) => void
  mgRoomUpdated: (room: MiniGameLobbyRoom) => void
  mgIncomingInvite: (invite: MiniGameDirectInvite) => void
  // Story Conversation
  storySynced: (payload: StorySyncPayload) => void
  // Music, Learning & Admin
  musicState: (state: MusicRoomState) => void
  learningUpdated: (payload: { profile: PlayerLearningProfile; unlockedCodes: string[] }) => void
  adminAnnouncement: (ann: AdminAnnouncement) => void
  adminKicked: (payload: { reason: string }) => void
  adminForceStand: (payload: { reason: string }) => void
  baristaDelivery: (payload: {
    targetUserId: string
    targetUsername?: string
    seatId?: string | null
    tableId?: string | null
    itemId: string
    itemHangul: string
    assetKey: string
  }) => void
}

class MultiplayerClient {
  private socket: Socket | null = null
  private currentProfile: PlayerSessionProfile | null = null
  private snapshot: JoinSnapshot | null = null
  private players = new Map<string, RoomPlayerState>()
  private seats: CafeSeat[] = []
  private lastMoveSentAt = 0
  private listeners: { [K in keyof ListenerMap]: Set<ListenerMap[K]> } = {
    snapshot: new Set(),
    playersChanged: new Set(),
    seatsChanged: new Set(),
    playerMoved: new Set(),
    playerAction: new Set(),
    chatMessage: new Set(),
    connectionChanged: new Set(),
    voiceIncomingInvite: new Set(),
    voiceInviteCancelled: new Set(),
    voiceInviteResult: new Set(),
    voiceSessionStarted: new Set(),
    voiceSignal: new Set(),
    voicePeerMute: new Set(),
    voiceEnded: new Set(),
    gameIncomingInvite: new Set(),
    gameInviteCancelled: new Set(),
    gameInviteResult: new Set(),
    gameStarted: new Set(),
    gameState: new Set(),
    gameEnded: new Set(),
    mgOpenRooms: new Set(),
    mgRoomUpdated: new Set(),
    mgIncomingInvite: new Set(),
    storySynced: new Set(),
    musicState: new Set(),
    learningUpdated: new Set(),
    adminAnnouncement: new Set(),
    adminKicked: new Set(),
    adminForceStand: new Set(),
    baristaDelivery: new Set(),
  }

  on<K extends keyof ListenerMap>(event: K, fn: ListenerMap[K]): () => void {
    this.listeners[event].add(fn)
    return () => {
      this.listeners[event].delete(fn)
    }
  }

  private emit<K extends keyof ListenerMap>(event: K, arg: Parameters<ListenerMap[K]>[0]) {
    for (const fn of this.listeners[event]) {
      ;(fn as (p: unknown) => void)(arg)
    }
  }

  get isConnected(): boolean {
    return Boolean(this.socket?.connected)
  }

  get userId(): string {
    return this.currentProfile?.userId ?? 'local-player'
  }

  getLatestSnapshot(): JoinSnapshot | null {
    return this.snapshot
  }

  getPlayers(): RoomPlayerState[] {
    return [...this.players.values()]
  }

  getSeats(): CafeSeat[] {
    return this.seats
  }

  joinCafe(profile: PlayerSessionProfile): Promise<{ ok: boolean; reason?: string; snapshot?: JoinSnapshot }> {
    this.currentProfile = { ...profile, entered: true }
    saveTabSession(this.currentProfile)

    if (!this.socket) {
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 600,
      })

      this.socket.on('connect', () => {
        this.emit('connectionChanged', true)
        if (this.currentProfile?.entered) {
          void this.performJoinEmit(this.currentProfile)
        }
      })

      this.socket.on('disconnect', () => {
        this.emit('connectionChanged', false)
      })

      this.socket.on('player:joined', (player: RoomPlayerState) => {
        this.players.set(player.userId, player)
        this.emit('playersChanged', this.getPlayers())
      })

      this.socket.on('player:updated', (player: RoomPlayerState) => {
        this.players.set(player.userId, player)
        this.emit('playersChanged', this.getPlayers())
      })

      this.socket.on('player:moved', (payload: PlayerMovedPayload) => {
        const existing = this.players.get(payload.userId)
        if (existing) {
          existing.u = payload.u
          existing.v = payload.v
          existing.direction = payload.direction
          existing.animation = payload.animation
          existing.seatId = payload.seatId
        }
        this.emit('playerMoved', payload)
      })

      this.socket.on('player:left', ({ userId }: { userId: string }) => {
        this.players.delete(userId)
        this.emit('playersChanged', this.getPlayers())
      })

      this.socket.on('room:seats', (seats: CafeSeat[]) => {
        this.seats = seats
        this.emit('seatsChanged', seats)
      })

      this.socket.on('player:action', (payload: PlayerActionPayload) => {
        this.emit('playerAction', payload)
      })

      this.socket.on('chat:message', (msg: ChatMessagePayload) => {
        this.emit('chatMessage', msg)
      })

      // Phase 3 Voice
      this.socket.on('voice:incoming-invite', (invite: VoiceInvitePayload) => {
        this.emit('voiceIncomingInvite', invite)
      })
      this.socket.on('voice:invite-cancelled', (payload: { inviteId: string; reason: string }) => {
        this.emit('voiceInviteCancelled', payload)
      })
      this.socket.on('voice:invite-result', (payload: VoiceInviteResultPayload) => {
        this.emit('voiceInviteResult', payload)
      })
      this.socket.on('voice:session-started', (session: VoiceSessionInfo) => {
        this.emit('voiceSessionStarted', session)
      })
      this.socket.on('voice:signal', (payload: { sessionId: string; fromId: string; signal: VoiceSignalPayload }) => {
        this.emit('voiceSignal', payload)
      })
      this.socket.on('voice:peer-mute', (payload: { sessionId: string; userId: string; muted: boolean }) => {
        this.emit('voicePeerMute', payload)
      })
      this.socket.on('voice:ended', (payload: { sessionId: string; reason: string }) => {
        this.emit('voiceEnded', payload)
      })

      // Legacy Table Games
      this.socket.on('game:incoming-invite', (invite: GameInvitePayload) => {
        this.emit('gameIncomingInvite', invite)
      })
      this.socket.on('game:invite-cancelled', (payload: { inviteId: string; reason: string }) => {
        this.emit('gameInviteCancelled', payload)
      })
      this.socket.on('game:invite-result', (payload: GameInviteResultPayload) => {
        this.emit('gameInviteResult', payload)
      })
      this.socket.on('game:started', (session: GameRoomSession) => {
        this.emit('gameStarted', session)
      })
      this.socket.on('game:state', (session: GameRoomSession) => {
        this.emit('gameState', session)
      })
      this.socket.on('game:ended', (summary: GameResultSummary) => {
        this.emit('gameEnded', summary)
      })

      // Mini-Game Center (6 Games)
      this.socket.on('mg:open-rooms', (rooms: MiniGameLobbyRoom[]) => {
        this.emit('mgOpenRooms', rooms)
      })
      this.socket.on('mg:room-updated', (mgRoom: MiniGameLobbyRoom) => {
        this.emit('mgRoomUpdated', mgRoom)
      })
      this.socket.on('mg:incoming-invite', (invite: MiniGameDirectInvite) => {
        this.emit('mgIncomingInvite', invite)
      })

      // Story Conversation
      this.socket.on('story:synced', (payload: StorySyncPayload) => {
        this.emit('storySynced', payload)
      })

      // Music, Learning & Admin
      this.socket.on('music:state', (state: MusicRoomState) => {
        this.emit('musicState', state)
      })
      this.socket.on('learning:updated', (payload: { profile: PlayerLearningProfile; unlockedCodes: string[] }) => {
        this.emit('learningUpdated', payload)
      })
      this.socket.on('admin:announcement', (ann: AdminAnnouncement) => {
        this.emit('adminAnnouncement', ann)
      })
      this.socket.on('admin:kicked', (payload: { reason: string }) => {
        this.emit('adminKicked', payload)
      })
      this.socket.on('admin:force-stand', (payload: { reason: string }) => {
        this.emit('adminForceStand', payload)
      })
      this.socket.on(
        'barista:delivery',
        (payload: {
          targetUserId: string
          targetUsername?: string
          seatId?: string | null
          tableId?: string | null
          itemId: string
          itemHangul: string
          assetKey: string
        }) => {
          this.emit('baristaDelivery', payload)
        },
      )
    }

    return this.performJoinEmit(this.currentProfile)
  }

  private performJoinEmit(profile: PlayerSessionProfile): Promise<{ ok: boolean; reason?: string; snapshot?: JoinSnapshot }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ ok: false, reason: 'Chưa khởi tạo kết nối.' })
        return
      }
      const timeout = window.setTimeout(() => {
        resolve({ ok: true })
      }, 2500)

      this.socket.emit(
        'cafe:join',
        {
          userId: profile.userId,
          username: profile.username,
          avatarId: profile.avatarId,
          level: profile.level,
        },
        (res: { ok: boolean; reason?: string } & Partial<JoinSnapshot>) => {
          window.clearTimeout(timeout)
          if (!res?.ok) {
            resolve({ ok: false, reason: res?.reason || 'Không thể vào phòng.' })
            return
          }
          if (res.me && res.players && res.seats) {
            this.players.clear()
            for (const p of res.players) this.players.set(p.userId, p)
            this.seats = res.seats
            const snap: JoinSnapshot = {
              me: res.me,
              players: res.players,
              seats: res.seats,
              messages: res.messages ?? [],
              musicState: res.musicState,
              suggestCooldownSec: res.suggestCooldownSec ?? 0,
              learningProfile: res.learningProfile,
              openMiniGameRooms: res.openMiniGameRooms ?? [],
            }
            this.snapshot = snap
            this.emit('snapshot', snap)
            this.emit('playersChanged', this.getPlayers())
            this.emit('seatsChanged', this.seats)
            if (res.musicState) this.emit('musicState', res.musicState)
            if (res.openMiniGameRooms) this.emit('mgOpenRooms', res.openMiniGameRooms)
            if (res.learningProfile) {
              this.emit('learningUpdated', { profile: res.learningProfile, unlockedCodes: [] })
            }
            resolve({ ok: true, snapshot: snap })
          } else {
            resolve({ ok: true })
          }
        },
      )
    })
  }

  requestSit(seatId: string): Promise<{ ok: boolean; seatId?: string; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: true, seatId })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: true, seatId }), 1500)
      this.socket!.emit('seat:sit', { seatId }, (res: { ok: boolean; seatId?: string; reason?: string }) => {
        window.clearTimeout(timer)
        resolve(res ?? { ok: false, reason: 'Không nhận được phản hồi ghế.' })
      })
    })
  }

  notifyStand(u: number, v: number) {
    if (!this.socket?.connected) return
    this.socket.emit('seat:stand', { u, v })
  }

  sendMove(u: number, v: number, direction: Direction, animation: CharacterAnimation, force = false) {
    if (!this.socket?.connected) return
    const now = performance.now()
    if (!force && now - this.lastMoveSentAt < 48) return
    this.lastMoveSentAt = now
    this.socket.emit('player:move', { u, v, direction, animation })
  }

  updateProfile(username: string, avatarId: string, level: string) {
    if (this.currentProfile) {
      this.currentProfile = { ...this.currentProfile, username, avatarId, level }
      saveTabSession(this.currentProfile)
    }
    if (this.socket?.connected) {
      this.socket.emit('player:profile', { username, avatarId, level })
    }
  }

  interactSameTable(targetId: string, action: CharacterAction): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: true })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: true }), 1500)
      this.socket!.emit('player:interact', { targetId, action }, (res: { ok: boolean; reason?: string }) => {
        window.clearTimeout(timer)
        resolve(res ?? { ok: false })
      })
    })
  }

  // === Story Conversation Sync ===
  sendStorySync(payload: {
    targetId: string
    storyId: string
    lineIndex: number
    action: 'open' | 'step' | 'close'
  }): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối máy chủ.' })
    }
    return new Promise((resolve) => {
      this.socket!.emit('story:sync', payload, (res: { ok: boolean; reason?: string }) => resolve(res ?? { ok: false }))
    })
  }

  // === Voice API ===
  sendVoiceInvite(targetId: string): Promise<{ ok: boolean; invite?: VoiceInvitePayload; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ Multiplayer.' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, reason: 'Máy chủ phản hồi quá thời gian.' }), 2500)
      this.socket!.emit(
        'voice:invite',
        { targetId },
        (res: { ok: boolean; invite?: VoiceInvitePayload; reason?: string }) => {
          window.clearTimeout(timer)
          resolve(res ?? { ok: false, reason: 'Không thể gửi lời mời.' })
        },
      )
    })
  }

  cancelVoiceInvite(inviteId: string) {
    if (!this.socket?.connected) return
    this.socket.emit('voice:cancel', { inviteId })
  }

  respondVoiceInvite(inviteId: string, accept: boolean): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Mất kết nối máy chủ.' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, reason: 'Không nhận được phản hồi.' }), 2500)
      this.socket!.emit('voice:respond', { inviteId, accept }, (res: { ok: boolean; reason?: string }) => {
        window.clearTimeout(timer)
        resolve(res ?? { ok: false })
      })
    })
  }

  sendVoiceSignal(
    sessionId: string,
    targetId: string,
    signal: VoiceSignalPayload,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Mất kết nối máy chủ.' })
    }
    return new Promise((resolve) => {
      this.socket!.emit('voice:signal', { sessionId, targetId, signal }, (res: { ok: boolean; reason?: string }) => {
        resolve(res ?? { ok: false })
      })
    })
  }

  sendVoiceMute(sessionId: string, muted: boolean) {
    if (!this.socket?.connected) return
    this.socket.emit('voice:mute', { sessionId, muted })
  }

  endVoiceSession() {
    if (!this.socket?.connected) return
    this.socket.emit('voice:end')
  }

  // === Mini-Game Center (6 Games, Real Multiplayer) ===
  listMiniGameRooms(gameId?: MiniGameId): Promise<MiniGameLobbyRoom[]> {
    if (!this.socket?.connected) return Promise.resolve([])
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve([]), 2000)
      this.socket!.emit('mg:list-rooms', { gameId }, (res: { ok?: boolean; rooms?: MiniGameLobbyRoom[] }) => {
        window.clearTimeout(timer)
        resolve(res?.rooms ?? [])
      })
    })
  }

  createMiniGameRoom(opts: {
    gameId: MiniGameId
    difficulty: GameDifficulty
    isPrivate?: boolean
    memoryPairs?: MemoryPairCount
    memoryTimed?: boolean
  }): Promise<{ ok: boolean; room?: MiniGameLobbyRoom; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ Multiplayer.' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, reason: 'Quá thời gian tạo phòng.' }), 2500)
      this.socket!.emit(
        'mg:create-room',
        opts,
        (res: { ok: boolean; room?: MiniGameLobbyRoom; reason?: string }) => {
          window.clearTimeout(timer)
          resolve(res ?? { ok: false, reason: 'Không thể tạo phòng chơi.' })
        },
      )
    })
  }

  joinMiniGameRoom(roomId: string): Promise<{ ok: boolean; room?: MiniGameLobbyRoom; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ.' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, reason: 'Quá thời gian vào phòng.' }), 2500)
      this.socket!.emit(
        'mg:join-room',
        { roomId },
        (res: { ok: boolean; room?: MiniGameLobbyRoom; reason?: string }) => {
          window.clearTimeout(timer)
          resolve(res ?? { ok: false, reason: 'Không thể tham gia phòng.' })
        },
      )
    })
  }

  joinMiniGameByCode(roomCode: string): Promise<{ ok: boolean; room?: MiniGameLobbyRoom; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ.' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, reason: 'Quá thời gian tìm phòng.' }), 2500)
      this.socket!.emit(
        'mg:join-code',
        { roomCode },
        (res: { ok: boolean; room?: MiniGameLobbyRoom; reason?: string }) => {
          window.clearTimeout(timer)
          resolve(res ?? { ok: false, reason: 'Mã phòng không tồn tại.' })
        },
      )
    })
  }

  inviteFriendToMiniGameRoom(payload: {
    targetId: string
    roomId: string
    roomCode: string
    gameId: string
    gameTitle: string
    difficulty: string
  }): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ.' })
    }
    return new Promise((resolve) => {
      this.socket!.emit('mg:invite-friend', payload, (res: { ok: boolean; reason?: string }) => resolve(res ?? { ok: false }))
    })
  }

  startMiniGameRoom(roomId: string): Promise<{ ok: boolean; room?: MiniGameLobbyRoom; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ.' })
    }
    return new Promise((resolve) => {
      this.socket!.emit('mg:start-room', { roomId }, (res: { ok: boolean; room?: MiniGameLobbyRoom; reason?: string }) =>
        resolve(res ?? { ok: false }),
      )
    })
  }

  restartMiniGameRoom(roomId: string): Promise<{ ok: boolean; room?: MiniGameLobbyRoom; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ.' })
    }
    return new Promise((resolve) => {
      this.socket!.emit('mg:restart-room', { roomId }, (res: { ok: boolean; room?: MiniGameLobbyRoom; reason?: string }) =>
        resolve(res ?? { ok: false }),
      )
    })
  }

  sendMiniGameProgress(payload: { roomId: string; score: number; correctCount: number; finished?: boolean }) {
    if (!this.socket?.connected) return
    this.socket.emit('mg:progress', payload)
  }

  leaveMiniGameRoom() {
    if (!this.socket?.connected) return
    this.socket.emit('mg:leave-room')
  }

  // === Legacy Phase 4 Table Games API ===
  startSoloGame(gameKind: GameKind, topikLevel: string): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ.' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, reason: 'Quá thời gian khởi tạo game.' }), 2500)
      this.socket!.emit('game:start-solo', { gameKind, topikLevel }, (res: { ok: boolean; reason?: string }) => {
        window.clearTimeout(timer)
        resolve(res ?? { ok: false })
      })
    })
  }

  sendGameInvite(
    targetId: string,
    gameKind: GameKind,
    topikLevel: string,
  ): Promise<{ ok: boolean; mode?: 'invited' | 'npc-started'; invite?: GameInvitePayload; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Chưa kết nối tới máy chủ.' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, reason: 'Quá thời gian gửi lời mời.' }), 2500)
      this.socket!.emit(
        'game:invite',
        { targetId, gameKind, topikLevel },
        (res: { ok: boolean; mode?: 'invited' | 'npc-started'; invite?: GameInvitePayload; reason?: string }) => {
          window.clearTimeout(timer)
          resolve(res ?? { ok: false, reason: 'Không thể gửi lời mời chơi game.' })
        },
      )
    })
  }

  cancelGameInvite(inviteId: string) {
    if (!this.socket?.connected) return
    this.socket.emit('game:cancel', { inviteId })
  }

  respondGameInvite(inviteId: string, accept: boolean): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'Mất kết nối máy chủ.' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, reason: 'Không nhận được phản hồi.' }), 2500)
      this.socket!.emit('game:respond', { inviteId, accept }, (res: { ok: boolean; reason?: string }) => {
        window.clearTimeout(timer)
        resolve(res ?? { ok: false })
      })
    })
  }

  sendGameProgress(payload: {
    roomId: string
    score: number
    combo: number
    maxCombo: number
    correctCount: number
    finished?: boolean
  }) {
    if (!this.socket?.connected) return
    this.socket.emit('game:progress', payload)
  }

  leaveGame() {
    if (!this.socket?.connected) return
    this.socket.emit('game:leave')
  }

  // === Admin-Controlled Music & 10-Min Song Suggestion Cooldown ===
  getMusicCooldown(): Promise<number> {
    if (!this.socket?.connected) return Promise.resolve(0)
    return new Promise((resolve) => {
      this.socket!.emit('music:cooldown', (res: { cooldownSec?: number }) => resolve(res?.cooldownSec ?? 0))
    })
  }

  suggestTrack(payload: {
    title: string
    artist?: string
    mood?: string
    style?: string
    audioUrl?: string
  }): Promise<{ ok: boolean; cooldownSec?: number; reason?: string }> {
    if (!this.socket?.connected) return Promise.resolve({ ok: false, reason: 'Chưa kết nối máy chủ.' })
    return new Promise((resolve) => {
      this.socket!.emit(
        'music:suggest',
        payload,
        (res: { ok: boolean; cooldownSec?: number; reason?: string }) => resolve(res ?? { ok: false }),
      )
    })
  }

  voteTrack(trackId: string): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) return Promise.resolve({ ok: false, reason: 'Chưa kết nối máy chủ.' })
    return new Promise((resolve) => {
      this.socket!.emit('music:vote', { trackId }, (res: { ok: boolean; reason?: string }) => resolve(res ?? { ok: false }))
    })
  }

  notifyTrackEnded(trackId: string): void {
    if (!this.socket?.connected || !trackId) return
    this.socket.emit('music:track-ended', { trackId })
  }

  notifyTrackDuration(trackId: string, durationSec: number): void {
    if (!this.socket?.connected || !trackId || !durationSec) return
    this.socket.emit('music:update-duration', { trackId, durationSec: Math.round(durationSec) })
  }

  toggleLearnedWord(vocabId: number, learned: boolean) {
    if (!this.socket?.connected) return
    this.socket.emit('learning:toggle-word', { vocabId, learned })
  }

  sendStudyTick() {
    if (!this.socket?.connected) return
    this.socket.emit('learning:study-tick')
  }

  awardBonusXp(payload: { xp: number; addStudyMinutes?: number; gameCompleted?: boolean; won?: boolean }) {
    if (!this.socket?.connected) return
    this.socket.emit('learning:award-xp', payload)
  }

  orderMenuItem(itemId: string) {
    if (!this.socket?.connected) return false
    this.socket.emit('learning:order-item', { itemId })
    return true
  }

  sendTableChat(text: string, tableId?: string | null, seatId?: string | null): Promise<{ ok: boolean; reason?: string }> {
    if (!this.socket?.connected) {
      return Promise.resolve({ ok: false, reason: 'offline' })
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: true }), 1500)
      this.socket!.emit('chat:send', { text, scope: 'table', tableId, seatId }, (res: { ok: boolean; reason?: string }) => {
        window.clearTimeout(timer)
        resolve(res ?? { ok: true })
      })
    })
  }
}

export const multiplayerClient = new MultiplayerClient()
