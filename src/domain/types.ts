import type { MusicTrackDef, TopikLevel } from '../data/koreanVocabulary'

export type AvatarLook = {
  id: string
  name: string
  hair: string
  outfit: string
  accent: string
  hairStyle: 'fluffy' | 'ponytail' | 'bob' | 'glasses' | 'sweater' | 'overalls' | 'bun' | 'auburn'
}

export type SeatStatus = 'available' | 'occupied'
export type CafeSeat = { id: string; status: SeatStatus; occupantId?: string; occupantName?: string }
export type Direction = 'up' | 'down' | 'left' | 'right'
export type CharacterAnimation =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'talk'
  | 'wave'
  | 'heart'
  | 'cheer'
  | 'coffee'
  | 'sit_wave'
  | 'sit_heart'
  | 'sit_cheer'
  | 'sit_coffee'
export type OnlineStatus = 'online' | 'away' | 'offline'
export type WorldPoint = { x: number; y: number }
export type IsoPoint = { u: number; v: number }
export type SeatPoint = WorldPoint & { id: string; direction: Direction; tableId: string }

export type PlayerCharacter = {
  userId: string
  username: string
  avatar: AvatarLook
  position: WorldPoint
  direction: Direction
  animation: CharacterAnimation
  seatId: string | null
  onlineStatus: OnlineStatus
  level?: string
  isNpc?: boolean
  inVoiceCall?: boolean
  voiceMuted?: boolean
  inGame?: boolean
}

export type RoomPlayerState = {
  userId: string
  username: string
  avatarId: string
  level: string
  u: number
  v: number
  direction: Direction
  animation: CharacterAnimation
  seatId: string | null
  onlineStatus: OnlineStatus
  mood?: 'chatting' | 'studying' | 'listening'
  isNpc?: boolean
  inVoiceCall?: boolean
  voiceMuted?: boolean
  inGame?: boolean
  xp?: number
  levelNum?: number
}

// === Phase 3: Private Voice ===
export type VoiceInvitePayload = {
  inviteId: string
  senderId: string
  senderName: string
  senderAvatarId: string
  senderLevel: string
  receiverId: string
  receiverName: string
  tableId: string
  expiresAt: number
}

export type VoiceSessionInfo = {
  sessionId: string
  tableId: string
  hostUserId: string
  hostName: string
  hostAvatarId: string
  guestUserId: string
  guestName: string
  guestAvatarId: string
  startedAt: number
}

export type VoiceSignalPayload =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit }

// === Phase 4: Korean Mini-Games ===
export type GameKind = 'korean-rain' | 'word-battle'

export type GameInvitePayload = {
  inviteId: string
  gameKind: GameKind
  topikLevel: TopikLevel
  senderId: string
  senderName: string
  senderAvatarId: string
  receiverId: string
  receiverName: string
  tableId: string
  expiresAt: number
}

export type WordBattleQuestion = {
  index: number
  vocabId: number
  meaningVi: string
  exampleVi: string
  options: Array<{ hangul: string; romanization: string }>
  correctHangul: string
}

export type RainWordSeed = {
  vocabId: number
  hangul: string
  romanization: string
  meaningVi: string
  lane: number // 0..1 normalized X
  spawnAtMs: number
  fallDurationMs: number
}

export type GamePlayerProgress = {
  userId: string
  username: string
  avatarId: string
  score: number
  combo: number
  maxCombo: number
  correctCount: number
  finished: boolean
}

export type GameRoomSession = {
  roomId: string
  gameKind: GameKind
  mode: 'solo' | 'versus-player' | 'versus-npc'
  topikLevel: TopikLevel
  tableId: string | null
  startedAt: number
  durationSec: number
  players: GamePlayerProgress[]
  rainDeck?: RainWordSeed[]
  battleDeck?: WordBattleQuestion[]
}

export type GameResultSummary = {
  roomId: string
  gameKind: GameKind
  topikLevel: TopikLevel
  winnerUserId: string | null
  winnerName: string | null
  isTie: boolean
  players: GamePlayerProgress[]
  xpEarnedByUser: Record<string, number>
}

// === Phase 5: Music Room & Learning Profile ===
export type MusicRoomState = {
  currentTrack: MusicTrackDef
  startedAtMs: number
  isPlaying: boolean
  djUserId: string | null
  djName: string | null
  queue: MusicTrackDef[]
  pendingQueue?: MusicTrackDef[]
}

export type PlayerLearningProfile = {
  userId: string
  topikLevel: TopikLevel
  xp: number
  levelNum: number
  wordsLearnedIds: number[]
  gamesPlayed: number
  gamesWon: number
  studyMinutes: number
  achievements: string[]
}

export type ChatMessagePayload = {
  id: string
  userId: string
  username: string
  avatarId: string
  text: string
  scope: 'room' | 'table'
  tableId?: string | null
  time: string
}

export type DemoPlayer = {
  id: string
  name: string
  level: string
  avatar: AvatarLook
  seatId: string
  mood: 'chatting' | 'studying' | 'listening'
  favorite?: boolean
}

export type SelectedPlayerInfo = {
  id: string
  name: string
  avatarId: string
  level: string
  seatId: string | null
  tableId: string | null
  sameTable: boolean
  partnerSeatId: string | null
  partnerSeatAvailable: boolean
  isNpc?: boolean
  inVoiceCall?: boolean
  inGame?: boolean
  x: number
  y: number
}

export type SceneSnapshot = {
  seats: CafeSeat[]
  seated: boolean
  seatedId?: string
  tableId?: string | null
  playerX: number
  playerY: number
  avatarId: string
}

export type CafeSceneEvent =
  | { type: 'snapshot'; snapshot: SceneSnapshot }
  | { type: 'select-player'; player: SelectedPlayerInfo }
  | { type: 'open-cafe-menu' }
  | { type: 'message'; text: string; kind?: 'tip' | 'success' }

// === Story Conversation & Mini-Game Center & Admin ===
export type StorySyncPayload = {
  fromId: string
  fromName: string
  storyId: string
  lineIndex: number
  action: 'open' | 'step' | 'close'
}

export type MiniGameDirectInvite = {
  roomId: string
  roomCode: string
  gameId: string
  gameTitle: string
  difficulty: string
  senderId: string
  senderName: string
  senderAvatarId: string
}

export type AdminAnnouncement = {
  id: string
  text: string
  createdAt: string
}
