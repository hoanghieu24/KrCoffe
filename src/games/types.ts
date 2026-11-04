export type MiniGameId =
  | 'falling-words'
  | 'word-shooter'
  | 'korean-memory'
  | 'quiz-battle'
  | 'word-builder'
  | 'listening-challenge'

export type GameDifficulty = 'easy' | 'normal' | 'hard'

export type PlayModeType = 'solo' | 'multiplayer' | 'invite-friend' | 'private-room'

export type MemoryPairCount = 4 | 8 | 12

export type MiniGameCardMeta = {
  id: MiniGameId
  title: string
  subtitleKo: string
  shortDescription: string
  imageUrl: string
  defaultDifficulty: GameDifficulty
  supportedModes: PlayModeType[]
  engineLabel: 'Phaser 3' | 'React Interactive'
}

export type MiniGameRoomPlayer = {
  userId: string
  username: string
  avatarId: string
  score: number
  correctCount: number
  finished: boolean
}

export type QuizQuestionSeed = {
  index: number
  vocabId: number
  hangul: string
  romanization: string
  meaningVi: string
  options: Array<{ hangul: string; meaningVi: string; romanization: string }>
  correctHangul: string
}

export type MiniGameLobbyRoom = {
  roomId: string
  roomCode: string
  isPrivate: boolean
  gameId: MiniGameId
  difficulty: GameDifficulty
  memoryPairs?: MemoryPairCount
  memoryTimed?: boolean
  status: 'waiting' | 'playing' | 'finished'
  hostUserId: string
  hostName: string
  createdAt: number
  startedAt: number | null
  players: MiniGameRoomPlayer[]
  sharedSeed: number
  quizQuestions?: QuizQuestionSeed[]
  winnerUserId?: string | null
  winnerName?: string | null
}

export type MiniGameHistoryEntry = {
  id: string
  gameId: MiniGameId
  gameTitle: string
  mode: 'solo' | 'multiplayer'
  difficulty: GameDifficulty
  score: number
  correctCount: number
  totalQuestions?: number
  won?: boolean
  playedAt: string
}

export type GameSpecificStats = {
  highScore: number
  plays: number
  totalCorrect: number
  lastScore: number
}

export type MiniGameStatsSummary = {
  byGame: Record<MiniGameId, GameSpecificStats>
  totalPlays: number
  totalCorrect: number
  personalAchievements: string[]
  history: MiniGameHistoryEntry[]
}
