import crypto from 'node:crypto'
import { getTableIdForSeat } from '../src/domain/seatUtils.ts'
import { getVocabForLevel, KOREAN_VOCABULARY, type TopikLevel, type VocabItem } from '../src/data/koreanVocabulary.ts'
import type {
  GameInvitePayload,
  GameKind,
  GamePlayerProgress,
  GameResultSummary,
  GameRoomSession,
  PlayerLearningProfile,
  RainWordSeed,
  WordBattleQuestion,
} from '../src/domain/types.ts'
import type { CafeRoomState } from './roomState.ts'
import { mutateLearningProfile, normalizeTopikLevel, saveGameResultRecord } from './store.ts'

const INVITE_TTL_MS = 30_000

type ActiveRoomInternal = {
  session: GameRoomSession
  timeoutTimer: ReturnType<typeof setTimeout>
  npcInterval?: ReturnType<typeof setInterval>
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildRainDeck(level: TopikLevel): RainWordSeed[] {
  const pool = getVocabForLevel(level)
  const seeds: RainWordSeed[] = []
  let spawnAtMs = 650
  let prevLane = 0.5

  for (let i = 0; i < 44; i++) {
    const word = pool[Math.floor(Math.random() * pool.length)] ?? KOREAN_VOCABULARY[i % KOREAN_VOCABULARY.length]
    const progress = i / 43
    // Avoid spawning right on top of the previous word horizontally
    let lane = 0.14 + Math.random() * 0.72
    if (Math.abs(lane - prevLane) < 0.18) {
      lane = lane > 0.5 ? Math.max(0.14, lane - 0.28) : Math.min(0.86, lane + 0.28)
    }
    prevLane = lane

    const fallDurationMs = Math.round(7800 - progress * 2900)
    seeds.push({
      vocabId: word.id,
      hangul: word.hangul,
      romanization: word.romanization,
      meaningVi: word.meaningVi,
      lane: Number(lane.toFixed(3)),
      spawnAtMs: Math.round(spawnAtMs),
      fallDurationMs,
    })

    const gap = Math.round(1620 - progress * 670)
    spawnAtMs += gap
  }

  return seeds
}

function buildBattleDeck(level: TopikLevel): WordBattleQuestion[] {
  const pool = shuffle(getVocabForLevel(level))
  const selected: VocabItem[] = []
  for (let i = 0; i < 10; i++) {
    selected.push(pool[i % pool.length])
  }

  return selected.map((correct, index) => {
    const distractors = shuffle(
      KOREAN_VOCABULARY.filter((w) => w.hangul !== correct.hangul),
    ).slice(0, 3)

    const options = shuffle([correct, ...distractors]).map((item) => ({
      hangul: item.hangul,
      romanization: item.romanization,
    }))

    return {
      index,
      vocabId: correct.id,
      meaningVi: correct.meaningVi,
      exampleVi: correct.exampleVi,
      options,
      correctHangul: correct.hangul,
    }
  })
}

export type GameLifecycleCallbacks = {
  onInviteExpired: (invite: GameInvitePayload) => void
  onSessionStarted: (session: GameRoomSession) => void
  onSessionUpdated: (session: GameRoomSession) => void
  onSessionEnded: (
    session: GameRoomSession,
    summary: GameResultSummary,
    learningUpdates: Array<{ userId: string; profile: PlayerLearningProfile; unlockedCodes: string[] }>,
  ) => void
}

export class GameSessionManager {
  private readonly room: CafeRoomState
  private readonly callbacks: GameLifecycleCallbacks
  private readonly invites = new Map<string, { invite: GameInvitePayload; timer: ReturnType<typeof setTimeout> }>()
  private readonly rooms = new Map<string, ActiveRoomInternal>()
  private readonly userToRoom = new Map<string, string>()

  constructor(room: CafeRoomState, callbacks: GameLifecycleCallbacks) {
    this.room = room
    this.callbacks = callbacks
  }

  getActiveGameCount(): number {
    return this.rooms.size
  }

  startSoloSession(
    userId: string,
    gameKind: GameKind,
    rawLevel?: string,
  ): { ok: true; session: GameRoomSession } | { ok: false; reason: string } {
    const player = this.room.getPlayer(userId)
    if (!player) return { ok: false, reason: 'Không tìm thấy phiên người chơi.' }
    if (this.userToRoom.has(userId)) {
      this.leaveSession(userId)
    }

    const topikLevel = normalizeTopikLevel(rawLevel || player.level)
    const session = this.createRoomInternal({
      gameKind,
      mode: 'solo',
      topikLevel,
      tableId: getTableIdForSeat(player.seatId),
      participants: [{ userId: player.userId, username: player.username, avatarId: player.avatarId }],
    })

    this.callbacks.onSessionStarted(session)
    return { ok: true, session }
  }

  createInviteOrNpcMatch(
    senderId: string,
    targetId: string,
    gameKind: GameKind,
    rawLevel?: string,
  ):
    | { ok: true; mode: 'npc-started'; session: GameRoomSession }
    | { ok: true; mode: 'invited'; invite: GameInvitePayload }
    | { ok: false; reason: string } {
    const sender = this.room.getPlayer(senderId)
    const receiver = this.room.getPlayer(targetId)
    if (!sender || !receiver) {
      return { ok: false, reason: 'Người chơi này đã rời khỏi quán.' }
    }
    if (senderId === targetId) {
      return { ok: false, reason: 'Hãy chọn chế độ Luyện đơn nếu bạn muốn chơi 1 mình nhé!' }
    }

    const check = this.room.canInteractSameTable(senderId, targetId)
    if (!check.ok || !check.tableId) {
      return { ok: false, reason: `Bạn cần ngồi cùng bàn với ${receiver.username} mới có thể mời đấu game nhé!` }
    }

    if (this.userToRoom.has(senderId)) {
      return { ok: false, reason: 'Bạn đang trong một ván game khác.' }
    }
    if (this.userToRoom.has(targetId)) {
      return { ok: false, reason: `${receiver.username} hiện đang bận trong một ván game khác.` }
    }

    const topikLevel = normalizeTopikLevel(rawLevel || sender.level)

    // Instant table match if inviting a cozy AI study buddy NPC!
    if (receiver.isNpc) {
      const session = this.createRoomInternal({
        gameKind,
        mode: 'versus-npc',
        topikLevel,
        tableId: check.tableId,
        participants: [
          { userId: sender.userId, username: sender.username, avatarId: sender.avatarId },
          { userId: receiver.userId, username: receiver.username, avatarId: receiver.avatarId },
        ],
        npcUserId: receiver.userId,
      })
      this.callbacks.onSessionStarted(session)
      return { ok: true, mode: 'npc-started', session }
    }

    // Cancel any older pending invite from this sender
    for (const [id, entry] of this.invites.entries()) {
      if (entry.invite.senderId === senderId) {
        clearTimeout(entry.timer)
        this.invites.delete(id)
      }
    }

    const invite: GameInvitePayload = {
      inviteId: `ginv-${crypto.randomUUID().slice(0, 8)}`,
      gameKind,
      topikLevel,
      senderId,
      senderName: sender.username,
      senderAvatarId: sender.avatarId,
      receiverId: targetId,
      receiverName: receiver.username,
      tableId: check.tableId,
      expiresAt: Date.now() + INVITE_TTL_MS,
    }

    const timer = setTimeout(() => {
      const found = this.invites.get(invite.inviteId)
      if (!found) return
      this.invites.delete(invite.inviteId)
      this.callbacks.onInviteExpired(found.invite)
    }, INVITE_TTL_MS)

    this.invites.set(invite.inviteId, { invite, timer })
    return { ok: true, mode: 'invited', invite }
  }

  cancelInvite(senderId: string, inviteId: string): GameInvitePayload | null {
    const found = this.invites.get(inviteId)
    if (!found || found.invite.senderId !== senderId) return null
    clearTimeout(found.timer)
    this.invites.delete(inviteId)
    return found.invite
  }

  respondToInvite(
    receiverId: string,
    inviteId: string,
    accept: boolean,
  ):
    | { ok: true; accepted: false; invite: GameInvitePayload }
    | { ok: true; accepted: true; invite: GameInvitePayload; session: GameRoomSession }
    | { ok: false; reason: string } {
    const found = this.invites.get(inviteId)
    if (!found) {
      return { ok: false, reason: 'Lời mời chơi game đã hết hạn hoặc bị hủy.' }
    }
    if (found.invite.receiverId !== receiverId) {
      return { ok: false, reason: 'Không đúng người nhận lời mời.' }
    }

    clearTimeout(found.timer)
    this.invites.delete(inviteId)
    const { invite } = found

    if (!accept) {
      return { ok: true, accepted: false, invite }
    }

    const sender = this.room.getPlayer(invite.senderId)
    const receiver = this.room.getPlayer(invite.receiverId)
    if (!sender || !receiver) {
      return { ok: false, reason: 'Đối phương đã rời khỏi quán.' }
    }

    const check = this.room.canInteractSameTable(invite.senderId, invite.receiverId)
    if (!check.ok || !check.tableId) {
      return { ok: false, reason: 'Hai bạn không còn ngồi cùng bàn nữa.' }
    }

    const session = this.createRoomInternal({
      gameKind: invite.gameKind,
      mode: 'versus-player',
      topikLevel: invite.topikLevel,
      tableId: check.tableId,
      participants: [
        { userId: sender.userId, username: sender.username, avatarId: sender.avatarId },
        { userId: receiver.userId, username: receiver.username, avatarId: receiver.avatarId },
      ],
    })

    this.callbacks.onSessionStarted(session)
    return { ok: true, accepted: true, invite, session }
  }

  private createRoomInternal(params: {
    gameKind: GameKind
    mode: GameRoomSession['mode']
    topikLevel: TopikLevel
    tableId: string | null
    participants: Array<{ userId: string; username: string; avatarId: string }>
    npcUserId?: string
  }): GameRoomSession {
    const roomId = `game-${crypto.randomUUID().slice(0, 8)}`
    const durationSec = params.gameKind === 'korean-rain' ? 60 : 82
    const players: GamePlayerProgress[] = params.participants.map((p) => ({
      userId: p.userId,
      username: p.username,
      avatarId: p.avatarId,
      score: 0,
      combo: 0,
      maxCombo: 0,
      correctCount: 0,
      finished: false,
    }))

    const session: GameRoomSession = {
      roomId,
      gameKind: params.gameKind,
      mode: params.mode,
      topikLevel: params.topikLevel,
      tableId: params.tableId,
      startedAt: Date.now(),
      durationSec,
      players,
      rainDeck: params.gameKind === 'korean-rain' ? buildRainDeck(params.topikLevel) : undefined,
      battleDeck: params.gameKind === 'word-battle' ? buildBattleDeck(params.topikLevel) : undefined,
    }

    for (const p of players) {
      this.userToRoom.set(p.userId, roomId)
      this.room.setGameState(p.userId, true)
    }

    const timeoutTimer = setTimeout(() => {
      this.finalizeRoom(roomId)
    }, (durationSec + 4) * 1000)

    const internal: ActiveRoomInternal = { session, timeoutTimer }

    if (params.npcUserId) {
      let step = 0
      const maxSteps = params.gameKind === 'word-battle' ? 10 : 18
      const intervalMs = params.gameKind === 'word-battle' ? 3400 : 3000

      internal.npcInterval = setInterval(() => {
        const active = this.rooms.get(roomId)
        if (!active) return
        const npcProg = active.session.players.find((pl) => pl.userId === params.npcUserId)
        if (!npcProg || npcProg.finished) return

        step++
        const hit = Math.random() < 0.74
        if (hit) {
          npcProg.combo += 1
          npcProg.maxCombo = Math.max(npcProg.maxCombo, npcProg.combo)
          npcProg.correctCount += 1
          const basePts = params.gameKind === 'word-battle' ? 115 : 85
          npcProg.score += basePts + Math.min(4, npcProg.combo) * 15
        } else {
          npcProg.combo = 0
        }

        if (step >= maxSteps) {
          npcProg.finished = true
        }
        this.callbacks.onSessionUpdated(active.session)

        if (active.session.players.every((pl) => pl.finished)) {
          this.finalizeRoom(roomId)
        }
      }, intervalMs)
    }

    this.rooms.set(roomId, internal)
    return session
  }

  updateProgress(
    userId: string,
    roomId: string,
    patch: {
      score: number
      combo: number
      maxCombo: number
      correctCount: number
      finished?: boolean
    },
  ) {
    const active = this.rooms.get(roomId)
    if (!active) return
    const player = active.session.players.find((p) => p.userId === userId)
    if (!player) return

    player.score = Math.max(0, Math.round(patch.score))
    player.combo = Math.max(0, Math.round(patch.combo))
    player.maxCombo = Math.max(player.maxCombo, Math.round(patch.maxCombo))
    player.correctCount = Math.max(0, Math.round(patch.correctCount))
    if (patch.finished) {
      player.finished = true
    }

    // If vs-NPC and human finished early, finish the NPC gracefully right away so player doesn't wait!
    if (player.finished && active.session.mode === 'versus-npc') {
      for (const pl of active.session.players) {
        pl.finished = true
      }
    }

    this.callbacks.onSessionUpdated(active.session)

    if (active.session.players.every((pl) => pl.finished)) {
      this.finalizeRoom(roomId)
    }
  }

  leaveSession(userId: string): { cancelledInvites: GameInvitePayload[] } {
    const cancelledInvites: GameInvitePayload[] = []
    for (const [id, entry] of this.invites.entries()) {
      if (entry.invite.senderId === userId || entry.invite.receiverId === userId) {
        clearTimeout(entry.timer)
        this.invites.delete(id)
        cancelledInvites.push(entry.invite)
      }
    }

    const roomId = this.userToRoom.get(userId)
    if (roomId) {
      const active = this.rooms.get(roomId)
      if (active) {
        const leaver = active.session.players.find((p) => p.userId === userId)
        if (leaver) leaver.finished = true
        for (const p of active.session.players) {
          p.finished = true
        }
        this.finalizeRoom(roomId)
      }
    }

    return { cancelledInvites }
  }

  private finalizeRoom(roomId: string) {
    const active = this.rooms.get(roomId)
    if (!active) return

    clearTimeout(active.timeoutTimer)
    if (active.npcInterval) clearInterval(active.npcInterval)
    this.rooms.delete(roomId)

    const { session } = active
    for (const p of session.players) {
      p.finished = true
      if (this.userToRoom.get(p.userId) === roomId) {
        this.userToRoom.delete(p.userId)
      }
      this.room.setGameState(p.userId, false)
    }

    let winnerUserId: string | null = null
    let winnerName: string | null = null
    let isTie = false

    if (session.players.length === 1) {
      winnerUserId = session.players[0].userId
      winnerName = session.players[0].username
    } else if (session.players.length >= 2) {
      const sorted = [...session.players].sort((a, b) => b.score - a.score)
      if (sorted[0].score === sorted[1].score) {
        isTie = true
      } else {
        winnerUserId = sorted[0].userId
        winnerName = sorted[0].username
      }
    }

    const xpEarnedByUser: Record<string, number> = {}
    const learningUpdates: Array<{ userId: string; profile: PlayerLearningProfile; unlockedCodes: string[] }> = []

    for (const p of session.players) {
      const roomPlayer = this.room.getPlayer(p.userId)
      if (roomPlayer?.isNpc) {
        xpEarnedByUser[p.userId] = 0
        continue
      }

      let baseXp = 22
      let won2P = false
      if (session.mode === 'solo') {
        baseXp = Math.min(45, 18 + Math.floor(p.score / 45))
      } else if (isTie) {
        baseXp = 30
      } else if (winnerUserId === p.userId) {
        baseXp = 45
        won2P = true
      } else {
        baseXp = 22
      }

      const { profile, unlockedCodes } = mutateLearningProfile(p.userId, {
        deltaXp: baseXp,
        incrementGamesPlayed: true,
        incrementGamesWon: won2P,
      })

      xpEarnedByUser[p.userId] = baseXp
      this.room.setXpMeta(p.userId, profile.xp, profile.levelNum, profile.topikLevel)
      learningUpdates.push({ userId: p.userId, profile, unlockedCodes })
    }

    saveGameResultRecord({
      id: session.roomId,
      gameKind: session.gameKind,
      topikLevel: session.topikLevel,
      mode: session.mode,
      winnerUserId,
      players: session.players,
    })

    const summary: GameResultSummary = {
      roomId: session.roomId,
      gameKind: session.gameKind,
      topikLevel: session.topikLevel,
      winnerUserId,
      winnerName,
      isTie,
      players: session.players.map((pl) => ({ ...pl })),
      xpEarnedByUser,
    }

    this.callbacks.onSessionEnded(session, summary, learningUpdates)
  }
}
