import crypto from 'node:crypto'
import { getWordsByDifficulty, SHARED_KOREAN_VOCAB } from '../src/games/data/sharedKoreanVocab.ts'
import type {
  GameDifficulty,
  MemoryPairCount,
  MiniGameId,
  MiniGameLobbyRoom,
  QuizQuestionSeed,
} from '../src/games/types.ts'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(existingCodes: Set<string>): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    let code = ''
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    }
    if (!existingCodes.has(code)) return code
  }
  return crypto.randomUUID().slice(0, 4).toUpperCase()
}

function buildQuizQuestions(difficulty: GameDifficulty, count = 10): QuizQuestionSeed[] {
  const pool = [...getWordsByDifficulty(difficulty)]
  // Shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const picked = pool.slice(0, Math.min(count, pool.length))
  return picked.map((word, idx) => {
    const distractors = SHARED_KOREAN_VOCAB.filter((w) => w.id !== word.id && w.hangul !== word.hangul)
    for (let i = distractors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[distractors[i], distractors[j]] = [distractors[j], distractors[i]]
    }
    const opts = [word, ...distractors.slice(0, 3)].map((w) => ({
      hangul: w.hangul,
      meaningVi: w.meaningVi,
      romanization: w.romanization,
    }))
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[opts[i], opts[j]] = [opts[j], opts[i]]
    }
    return {
      index: idx,
      vocabId: word.id,
      hangul: word.hangul,
      romanization: word.romanization,
      meaningVi: word.meaningVi,
      options: opts,
      correctHangul: word.hangul,
    }
  })
}

export class GameCenterManager {
  private readonly rooms = new Map<string, MiniGameLobbyRoom>()
  private readonly userToRoom = new Map<string, string>()

  private cloneRoom(room: MiniGameLobbyRoom): MiniGameLobbyRoom {
    return {
      ...room,
      players: room.players.map((p) => ({ ...p })),
      quizQuestions: room.quizQuestions ? room.quizQuestions.map((q) => ({ ...q, options: [...q.options] })) : undefined,
    }
  }

  getPublicWaitingRooms(gameId?: MiniGameId): MiniGameLobbyRoom[] {
    const list: MiniGameLobbyRoom[] = []
    for (const r of this.rooms.values()) {
      if (r.status === 'waiting' && !r.isPrivate && r.players.length < 2) {
        if (!gameId || r.gameId === gameId) {
          list.push(this.cloneRoom(r))
        }
      }
    }
    return list.sort((a, b) => b.createdAt - a.createdAt)
  }

  getAllRoomsSummary(): MiniGameLobbyRoom[] {
    return [...this.rooms.values()].map((r) => this.cloneRoom(r))
  }

  getActiveRoomCount(): number {
    let count = 0
    for (const r of this.rooms.values()) {
      if (r.status === 'waiting' || r.status === 'playing') count++
    }
    return count
  }

  getRoomForUser(userId: string): MiniGameLobbyRoom | null {
    const rid = this.userToRoom.get(userId)
    if (!rid) return null
    const r = this.rooms.get(rid)
    return r ? this.cloneRoom(r) : null
  }

  createRoom(
    host: { userId: string; username: string; avatarId: string },
    opts: {
      gameId: MiniGameId
      difficulty: GameDifficulty
      isPrivate?: boolean
      memoryPairs?: MemoryPairCount
      memoryTimed?: boolean
    },
  ): { room: MiniGameLobbyRoom; leftPreviousRoom?: MiniGameLobbyRoom | null } {
    const leftPrev = this.leaveRoom(host.userId)
    const existingCodes = new Set([...this.rooms.values()].map((r) => r.roomCode))
    const roomCode = generateRoomCode(existingCodes)
    const roomId = `mgr-${crypto.randomUUID().slice(0, 8)}`
    const sharedSeed = Math.floor(100000 + Math.random() * 899999)

    const room: MiniGameLobbyRoom = {
      roomId,
      roomCode,
      isPrivate: Boolean(opts.isPrivate),
      gameId: opts.gameId,
      difficulty: opts.difficulty || 'easy',
      memoryPairs: opts.memoryPairs ?? 8,
      memoryTimed: opts.memoryTimed ?? true,
      status: 'waiting',
      hostUserId: host.userId,
      hostName: host.username,
      createdAt: Date.now(),
      startedAt: null,
      sharedSeed,
      quizQuestions: opts.gameId === 'quiz-battle' ? buildQuizQuestions(opts.difficulty || 'easy', 10) : undefined,
      players: [
        {
          userId: host.userId,
          username: host.username,
          avatarId: host.avatarId,
          score: 0,
          correctCount: 0,
          finished: false,
        },
      ],
    }

    this.rooms.set(roomId, room)
    this.userToRoom.set(host.userId, roomId)
    return { room: this.cloneRoom(room), leftPreviousRoom: leftPrev }
  }

  joinRoom(
    player: { userId: string; username: string; avatarId: string },
    roomId: string,
  ):
    | { ok: true; room: MiniGameLobbyRoom; leftPreviousRoom?: MiniGameLobbyRoom | null }
    | { ok: false; reason: string } {
    const target = this.rooms.get(roomId)
    if (!target) {
      return { ok: false, reason: 'Phòng chơi không tồn tại hoặc đã đóng.' }
    }
    if (target.players.some((p) => p.userId === player.userId)) {
      return { ok: true, room: this.cloneRoom(target) }
    }
    if (target.status !== 'waiting') {
      return { ok: false, reason: 'Phòng này đã bắt đầu ván đấu rồi.' }
    }
    if (target.players.length >= 2) {
      return { ok: false, reason: 'Phòng chơi đã đủ 2/2 người.' }
    }

    const leftPrev = this.leaveRoom(player.userId)
    target.players.push({
      userId: player.userId,
      username: player.username,
      avatarId: player.avatarId,
      score: 0,
      correctCount: 0,
      finished: false,
    })
    this.userToRoom.set(player.userId, target.roomId)
    return { ok: true, room: this.cloneRoom(target), leftPreviousRoom: leftPrev }
  }

  joinByCode(
    player: { userId: string; username: string; avatarId: string },
    roomCodeRaw: string,
  ):
    | { ok: true; room: MiniGameLobbyRoom; leftPreviousRoom?: MiniGameLobbyRoom | null }
    | { ok: false; reason: string } {
    const cleanCode = (roomCodeRaw || '').trim().toUpperCase()
    if (!cleanCode) {
      return { ok: false, reason: 'Vui lòng nhập mã phòng 4 ký tự.' }
    }
    for (const r of this.rooms.values()) {
      if (r.roomCode === cleanCode && r.status === 'waiting') {
        return this.joinRoom(player, r.roomId)
      }
    }
    return { ok: false, reason: `Không tìm thấy phòng đang chờ với mã "${cleanCode}".` }
  }

  startRoom(
    userId: string,
    roomId: string,
  ): { ok: true; room: MiniGameLobbyRoom } | { ok: false; reason: string } {
    const room = this.rooms.get(roomId)
    if (!room) return { ok: false, reason: 'Phòng chơi không còn tồn tại.' }
    if (room.hostUserId !== userId) {
      return { ok: false, reason: 'Chỉ chủ phòng mới có thể bắt đầu trận đấu.' }
    }
    if (room.players.length < 2) {
      return { ok: false, reason: 'Cần đủ 2 người chơi thật trong phòng để bắt đầu đấu!' }
    }
    if (room.status !== 'waiting') {
      return { ok: true, room: this.cloneRoom(room) }
    }

    room.status = 'playing'
    room.startedAt = Date.now()
    room.winnerUserId = null
    room.winnerName = null
    for (const p of room.players) {
      p.score = 0
      p.correctCount = 0
      p.finished = false
    }
    if (room.gameId === 'quiz-battle') {
      room.quizQuestions = buildQuizQuestions(room.difficulty, 10)
    } else {
      room.sharedSeed = Math.floor(100000 + Math.random() * 899999)
    }
    return { ok: true, room: this.cloneRoom(room) }
  }

  restartRoom(
    userId: string,
    roomId: string,
  ): { ok: true; room: MiniGameLobbyRoom } | { ok: false; reason: string } {
    const room = this.rooms.get(roomId)
    if (!room) return { ok: false, reason: 'Phòng chơi đã đóng.' }
    if (!room.players.some((p) => p.userId === userId)) {
      return { ok: false, reason: 'Bạn không thuộc phòng chơi này.' }
    }
    if (room.players.length < 2) {
      room.status = 'waiting'
      room.startedAt = null
      return { ok: true, room: this.cloneRoom(room) }
    }
    room.status = 'playing'
    room.startedAt = Date.now()
    room.winnerUserId = null
    room.winnerName = null
    for (const p of room.players) {
      p.score = 0
      p.correctCount = 0
      p.finished = false
    }
    if (room.gameId === 'quiz-battle') {
      room.quizQuestions = buildQuizQuestions(room.difficulty, 10)
    } else {
      room.sharedSeed = Math.floor(100000 + Math.random() * 899999)
    }
    return { ok: true, room: this.cloneRoom(room) }
  }

  updateProgress(
    userId: string,
    roomId: string,
    payload: { score: number; correctCount: number; finished?: boolean },
  ): { room: MiniGameLobbyRoom; justFinishedMatch: boolean } | null {
    const room = this.rooms.get(roomId)
    if (!room || room.status === 'finished') return null
    const player = room.players.find((p) => p.userId === userId)
    if (!player) return null

    player.score = Math.max(0, Math.round(payload.score || 0))
    player.correctCount = Math.max(0, Math.round(payload.correctCount || 0))
    if (payload.finished) {
      player.finished = true
    }

    let justFinishedMatch = false
    if (room.players.length >= 2 && room.players.every((p) => p.finished)) {
      room.status = 'finished'
      justFinishedMatch = true
      const sorted = [...room.players].sort((a, b) => b.score - a.score)
      if (sorted[0].score > sorted[1].score) {
        room.winnerUserId = sorted[0].userId
        room.winnerName = sorted[0].username
      } else {
        room.winnerUserId = null
        room.winnerName = null
      }
    }

    return { room: this.cloneRoom(room), justFinishedMatch }
  }

  leaveRoom(userId: string): MiniGameLobbyRoom | null {
    const roomId = this.userToRoom.get(userId)
    if (!roomId) return null
    this.userToRoom.delete(userId)

    const room = this.rooms.get(roomId)
    if (!room) return null

    room.players = room.players.filter((p) => p.userId !== userId)
    if (room.players.length === 0) {
      this.rooms.delete(roomId)
      return null
    }

    if (room.hostUserId === userId) {
      room.hostUserId = room.players[0].userId
      room.hostName = room.players[0].username
    }

    if (room.status === 'playing' && room.players.length === 1) {
      room.status = 'finished'
      room.winnerUserId = room.players[0].userId
      room.winnerName = room.players[0].username
      room.players[0].finished = true
    }

    return this.cloneRoom(room)
  }
}
