import 'dotenv/config'
import http from 'node:http'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import { CafeRoomState, MAX_REAL_PLAYERS } from './roomState.ts'
import {
  getOrCreateLearningProfile,
  mutateLearningProfile,
  saveChatMessage,
  savePlayerProfile,
  saveFeedback,
  loadRecentFeedback,
} from './store.ts'
import { VoiceSessionManager } from './voiceManager.ts'
import { GameSessionManager } from './gameManager.ts'
import { GameCenterManager } from './gameCenterManager.ts'
import { MusicRoomManager } from './musicManager.ts'
import { getTableIdForSeat, getPartnerSeatId } from '../src/domain/seatUtils.ts'
import { sanitizeText, validateUsername } from '../src/domain/contentFilter.ts'
import { KOREAN_CAFE_MENU } from '../src/data/koreanVocabulary.ts'
import type {
  AdminAnnouncement,
  CharacterAnimation,
  ChatMessagePayload,
  Direction,
  GameInvitePayload,
  GameKind,
  MiniGameDirectInvite,
  PlayerLearningProfile,
  StorySyncPayload,
  VoiceInvitePayload,
  VoiceSignalPayload,
} from '../src/domain/types.ts'
import type { GameDifficulty, MemoryPairCount, MiniGameId, MiniGameLobbyRoom } from '../src/games/types.ts'
import { fetchYouTubeDetails } from './youtubeHelper.ts'

const PORT = Number(process.env.PORT || 3001)
const app = express()
app.use(cors())
app.use(express.json())

const room = new CafeRoomState()
const gameCenter = new GameCenterManager()
const recentAnnouncements: AdminAnnouncement[] = []

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

const MAIN_ROOM = 'kchill-main'
const ADMIN_ROOM = 'kchill-admins'

function emitToUser(userId: string, event: string, payload: unknown) {
  const socketIds = room.getSocketIdsForUser(userId)
  for (const sid of socketIds) {
    io.to(sid).emit(event, payload)
  }
}

function emitToTable(tableId: string | null, event: string, payload: unknown) {
  if (!tableId) return
  for (const p of room.getAllPlayers()) {
    if (!p.isNpc && getTableIdForSeat(p.seatId) === tableId) {
      emitToUser(p.userId, event, payload)
    }
  }
}

function broadcastLearningUpdate(userId: string, profile: PlayerLearningProfile, unlockedCodes: string[]) {
  const updatedRoomPlayer = room.setXpMeta(userId, profile.xp, profile.levelNum, profile.topikLevel)
  if (updatedRoomPlayer) {
    io.to(MAIN_ROOM).emit('player:updated', updatedRoomPlayer)
  }
  emitToUser(userId, 'learning:updated', { profile, unlockedCodes })
}

// === Phase 5: Admin-Controlled Music Room Manager ===
const musicManager = new MusicRoomManager((state) => {
  io.to(MAIN_ROOM).emit('music:state', state)
  broadcastAdminOverview()
})

// === Phase 4: Legacy Table Games Manager ===
const gameManager = new GameSessionManager(room, {
  onInviteExpired: (expiredInvite: GameInvitePayload) => {
    emitToUser(expiredInvite.senderId, 'game:invite-result', {
      inviteId: expiredInvite.inviteId,
      accepted: false,
      expired: true,
      receiverName: expiredInvite.receiverName,
      reason: `${expiredInvite.receiverName} chưa phản hồi lời mời chơi game.`,
    })
    emitToUser(expiredInvite.receiverId, 'game:invite-cancelled', {
      inviteId: expiredInvite.inviteId,
      reason: 'Lời mời chơi game đã hết hạn.',
    })
  },
  onSessionStarted: (session) => {
    for (const p of session.players) {
      const rp = room.getPlayer(p.userId)
      if (rp) io.to(MAIN_ROOM).emit('player:updated', rp)
      if (!rp?.isNpc) {
        emitToUser(p.userId, 'game:started', session)
      }
    }
    broadcastAdminOverview()
  },
  onSessionUpdated: (session) => {
    for (const p of session.players) {
      const rp = room.getPlayer(p.userId)
      if (!rp?.isNpc) {
        emitToUser(p.userId, 'game:state', session)
      }
    }
  },
  onSessionEnded: (session, summary, learningUpdates) => {
    for (const p of session.players) {
      const rp = room.getPlayer(p.userId)
      if (rp) io.to(MAIN_ROOM).emit('player:updated', rp)
      if (!rp?.isNpc) {
        emitToUser(p.userId, 'game:ended', summary)
      }
    }
    for (const upd of learningUpdates) {
      broadcastLearningUpdate(upd.userId, upd.profile, upd.unlockedCodes)
    }
    broadcastAdminOverview()
  },
})

// === Phase 3: Private Voice Manager ===
const voiceManager = new VoiceSessionManager(room, (expiredInvite: VoiceInvitePayload) => {
  emitToUser(expiredInvite.senderId, 'voice:invite-result', {
    inviteId: expiredInvite.inviteId,
    accepted: false,
    expired: true,
    receiverName: expiredInvite.receiverName,
    reason: `${expiredInvite.receiverName} chưa phản hồi lời mời trò chuyện.`,
  })
  emitToUser(expiredInvite.receiverId, 'voice:invite-cancelled', {
    inviteId: expiredInvite.inviteId,
    reason: 'Lời mời trò chuyện đã hết hạn.',
  })
})

function buildAdminOverview() {
  const allPlayers = room.getAllPlayers()
  const seats = room.getAllSeats()
  return {
    onlineRealPlayers: room.getRealPlayerCount(),
    totalCharacters: allPlayers.length,
    maxPlayers: MAX_REAL_PLAYERS,
    occupiedSeats: seats.filter((s) => s.status === 'occupied').length,
    totalSeats: seats.length,
    activeVoiceSessions: voiceManager.getActiveSessionCount(),
    activeGames: gameManager.getActiveGameCount() + gameCenter.getActiveRoomCount(),
    musicState: musicManager.getState(),
    musicLibrary: musicManager.getLibrary(),
    players: allPlayers,
    seats,
    miniGameRooms: gameCenter.getAllRoomsSummary(),
    recentAnnouncements: recentAnnouncements.slice(-10),
    feedbackList: loadRecentFeedback(50),
  }
}

function broadcastAdminOverview() {
  io.to(ADMIN_ROOM).emit('admin:overview', buildAdminOverview())
}

function emitMiniGameRoomUpdate(mgRoom: MiniGameLobbyRoom | null | undefined) {
  if (!mgRoom) return
  for (const p of mgRoom.players) {
    emitToUser(p.userId, 'mg:room-updated', mgRoom)
    const updatedPlayer = room.setGameState(p.userId, mgRoom.status === 'playing')
    if (updatedPlayer) {
      io.to(MAIN_ROOM).emit('player:updated', updatedPlayer)
    }
  }
}

function broadcastOpenMiniGameRooms() {
  io.to(MAIN_ROOM).emit('mg:open-rooms', gameCenter.getPublicWaitingRooms())
  broadcastAdminOverview()
}

function cleanupUserMiniGameCenter(userId: string) {
  const updatedPlayer = room.setGameState(userId, false)
  if (updatedPlayer) {
    io.to(MAIN_ROOM).emit('player:updated', updatedPlayer)
  }
  const remainingRoom = gameCenter.leaveRoom(userId)
  if (remainingRoom) {
    emitMiniGameRoomUpdate(remainingRoom)
  }
  broadcastOpenMiniGameRooms()
}

function cleanupUserVoiceAndBroadcast(userId: string, reasonText: string) {
  const { endedSession, partnerId, cancelledInvites } = voiceManager.endSessionForUser(userId)

  for (const inv of cancelledInvites) {
    const otherId = inv.senderId === userId ? inv.receiverId : inv.senderId
    if (inv.senderId === userId) {
      emitToUser(otherId, 'voice:invite-cancelled', {
        inviteId: inv.inviteId,
        reason: `${inv.senderName} đã rời bàn hoặc hủy lời mời.`,
      })
    } else {
      emitToUser(otherId, 'voice:invite-result', {
        inviteId: inv.inviteId,
        accepted: false,
        receiverName: inv.receiverName,
        reason: `${inv.receiverName} đã rời bàn.`,
      })
    }
  }

  if (endedSession) {
    emitToUser(userId, 'voice:ended', {
      sessionId: endedSession.sessionId,
      reason: 'Cuộc trò chuyện riêng đã kết thúc.',
    })
    if (partnerId) {
      emitToUser(partnerId, 'voice:ended', {
        sessionId: endedSession.sessionId,
        reason: reasonText,
      })
    }
    const pHost = room.getPlayer(endedSession.hostUserId)
    const pGuest = room.getPlayer(endedSession.guestUserId)
    if (pHost) io.to(MAIN_ROOM).emit('player:updated', pHost)
    if (pGuest) io.to(MAIN_ROOM).emit('player:updated', pGuest)
  }
}

function cleanupUserGamesAndBroadcast(userId: string) {
  const { cancelledInvites } = gameManager.leaveSession(userId)
  for (const inv of cancelledInvites) {
    const otherId = inv.senderId === userId ? inv.receiverId : inv.senderId
    if (inv.senderId === userId) {
      emitToUser(otherId, 'game:invite-cancelled', {
        inviteId: inv.inviteId,
        reason: `${inv.senderName} đã hủy lời mời hoặc rời bàn.`,
      })
    } else {
      emitToUser(otherId, 'game:invite-result', {
        inviteId: inv.inviteId,
        accepted: false,
        receiverName: inv.receiverName,
        reason: `${inv.receiverName} đã rời bàn.`,
      })
    }
  }
}

// === REST API & ADMIN CONTROL ENDPOINTS ===

app.get('/api/tts/korean', async (req, res) => {
  const text = String(req.query.text || '').trim()
  if (!text) {
    res.status(400).json({ error: 'Text query parameter is required' })
    return
  }
  try {
    const encoded = encodeURIComponent(text)
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ko&q=${encoded}`
    const upstreamRes = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    })
    if (!upstreamRes.ok) {
      res.status(upstreamRes.status).send('Google TTS upstream error')
      return
    }
    const arrayBuffer = await upstreamRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(buffer)
  } catch (_err) {
    res.status(500).json({ error: 'Failed to fetch Google Korean TTS' })
  }
})

app.get(['/api/health', '/api/ping'], (_req, res) => {
  res.json({
    ok: true,
    room: MAIN_ROOM,
    maxPlayers: MAX_REAL_PLAYERS,
    realPlayers: room.getRealPlayerCount(),
    totalCharacters: room.getAllPlayers().length,
    occupiedSeats: room.getAllSeats().filter((s) => s.status === 'occupied').length,
    activeVoiceSessions: voiceManager.getActiveSessionCount(),
    activeGames: gameManager.getActiveGameCount() + gameCenter.getActiveRoomCount(),
    nowPlaying: musicManager.getState().currentTrack.title,
  })
})

app.get(['/api/admin/music-inspect', '/api/music/inspect'], async (req, res) => {
  const rawUrl = String(req.query.url || '').trim()
  if (!rawUrl) {
    res.status(400).json({ ok: false, reason: 'Thiếu liên kết cần kiểm tra.' })
    return
  }
  const info = await fetchYouTubeDetails(rawUrl)
  if (info) {
    res.json({ ok: true, info })
  } else {
    res.json({ ok: false, reason: 'Không thể nhận diện video YouTube từ liên kết này.' })
  }
})

app.get('/api/admin/overview', (_req, res) => {
  res.json({ ok: true, overview: buildAdminOverview() })
})

app.post('/api/admin/music', (req, res) => {
  const { action, trackId, customTrack } = req.body ?? {}
  if (!action) {
    res.status(400).json({ ok: false, reason: 'Thiếu thao tác điều khiển nhạc.' })
    return
  }
  const state = musicManager.adminAction({ action, trackId, customTrack })
  res.json({ ok: true, musicState: state, overview: buildAdminOverview() })
})

app.post('/api/admin/user-action', (req, res) => {
  const { userId, action } = req.body ?? {}
  if (!userId || !action) {
    res.status(400).json({ ok: false, reason: 'Thiếu userId hoặc action.' })
    return
  }
  const target = room.getPlayer(userId)
  if (!target || target.isNpc) {
    res.status(404).json({ ok: false, reason: 'Không tìm thấy người chơi thật này.' })
    return
  }

  if (action === 'force-stand') {
    cleanupUserVoiceAndBroadcast(userId, `${target.username} đã được Admin chuyển sang trạng thái đứng.`)
    cleanupUserGamesAndBroadcast(userId)
    const updated = room.standUp(userId)
    if (updated) {
      io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
      io.to(MAIN_ROOM).emit('player:updated', updated)
      emitToUser(userId, 'admin:force-stand', { reason: 'Admin đã giải phóng ghế của bạn.' })
    }
    broadcastAdminOverview()
    res.json({ ok: true, overview: buildAdminOverview() })
    return
  }

  if (action === 'kick') {
    cleanupUserVoiceAndBroadcast(userId, `${target.username} đã rời khỏi quán.`)
    cleanupUserGamesAndBroadcast(userId)
    cleanupUserMiniGameCenter(userId)
    emitToUser(userId, 'admin:kicked', { reason: 'Phiên kết nối của bạn đã được Admin ngắt khỏi quán.' })
    const sids = room.forceRemovePlayer(userId)
    for (const sid of sids) {
      io.sockets.sockets.get(sid)?.disconnect(true)
    }
    io.to(MAIN_ROOM).emit('player:left', { userId })
    io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
    broadcastAdminOverview()
    res.json({ ok: true, overview: buildAdminOverview() })
    return
  }

  res.status(400).json({ ok: false, reason: 'Action không hợp lệ.' })
})

app.post('/api/admin/announce', (req, res) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 240)
  if (!text) {
    res.status(400).json({ ok: false, reason: 'Nội dung thông báo không được để trống.' })
    return
  }
  const ann: AdminAnnouncement = {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  }
  recentAnnouncements.push(ann)
  if (recentAnnouncements.length > 20) recentAnnouncements.shift()
  io.to(MAIN_ROOM).emit('admin:announcement', ann)
  broadcastAdminOverview()
  res.json({ ok: true, announcement: ann, overview: buildAdminOverview() })
})

app.post('/api/feedback', (req, res) => {
  const { userId, username, content } = req.body ?? {}
  const cleanContent = String(content || '').trim().slice(0, 1000)
  if (!cleanContent) {
    res.status(400).json({ ok: false, reason: 'Nội dung góp ý không được để trống.' })
    return
  }
  const cleanUsername = String(username || 'Khách K-CHILL').trim().slice(0, 50)
  const cleanUserId = String(userId || 'anonymous').trim().slice(0, 60)
  const item = saveFeedback(cleanUserId, cleanUsername, cleanContent)
  broadcastAdminOverview()
  res.json({ ok: true, message: 'Cảm ơn bạn đã gửi góp ý cho K-CHILL Café!', feedback: item })
})

// === SOCKET.IO REALTIME MULTIPLAYER ===

io.on('connection', (socket) => {
  socket.on('admin:subscribe', (ack?: (res: unknown) => void) => {
    socket.join(ADMIN_ROOM)
    const overview = buildAdminOverview()
    ack?.({ ok: true, overview })
  })

  socket.on(
    'cafe:join',
    (
      payload: { userId: string; username: string; avatarId: string; level?: string },
      ack?: (res: unknown) => void,
    ) => {
      if (!payload?.userId) {
        ack?.({ ok: false, reason: 'Thiếu mã phiên người chơi.' })
        return
      }
      const userCheck = validateUsername(payload.username)
      if (!userCheck.valid) {
        ack?.({ ok: false, reason: userCheck.reason })
        return
      }
      const result = room.joinPlayer(socket.id, payload)
      if (!result.ok) {
        ack?.(result)
        return
      }

      socket.join(MAIN_ROOM)
      const learningProfile = getOrCreateLearningProfile(result.player.userId, result.player.level)
      const syncedMe =
        room.setXpMeta(
          result.player.userId,
          learningProfile.xp,
          learningProfile.levelNum,
          learningProfile.topikLevel,
        ) ?? result.player

      savePlayerProfile(syncedMe.userId, syncedMe.username, syncedMe.avatarId, syncedMe.level)

      ack?.({
        ok: true,
        me: syncedMe,
        players: room.getAllPlayers(),
        seats: room.getAllSeats(),
        messages: [],
        musicState: musicManager.getState(),
        suggestCooldownSec: musicManager.getRemainingCooldownSec(syncedMe.userId),
        learningProfile,
        openMiniGameRooms: gameCenter.getPublicWaitingRooms(),
      })

      socket.to(MAIN_ROOM).emit('player:joined', syncedMe)
      io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
      broadcastAdminOverview()
    },
  )

  socket.on(
    'seat:sit',
    (payload: { seatId: string }, ack?: (res: { ok: boolean; seatId?: string; reason?: string }) => void) => {
      const userId = room.getUserBySocket(socket.id)
      if (!userId || !payload?.seatId) {
        ack?.({ ok: false, reason: 'Phiên kết nối chưa sẵn sàng.' })
        return
      }
      const previousSeatId = room.getPlayer(userId)?.seatId
      const previousTableId = getTableIdForSeat(previousSeatId)
      const nextTableId = getTableIdForSeat(payload.seatId)
      if (previousTableId && previousTableId !== nextTableId) {
        const me = room.getPlayer(userId)
        cleanupUserVoiceAndBroadcast(userId, `${me?.username ?? 'Đối phương'} đã chuyển sang bàn khác.`)
        cleanupUserGamesAndBroadcast(userId)
      }

      const res = room.sitAtSeat(userId, payload.seatId)
      if (!res.ok) {
        ack?.({ ok: false, reason: res.reason })
        return
      }
      ack?.({ ok: true, seatId: payload.seatId })
      io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
      io.to(MAIN_ROOM).emit('player:updated', res.player)
      broadcastAdminOverview()
    },
  )

  socket.on('seat:stand', (payload?: { u?: number; v?: number }) => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId) return
    const me = room.getPlayer(userId)
    cleanupUserVoiceAndBroadcast(userId, `${me?.username ?? 'Đối phương'} đã đứng dậy rời bàn.`)
    cleanupUserGamesAndBroadcast(userId)
    const updated = room.standUp(userId, payload?.u, payload?.v)
    if (!updated) return
    io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
    io.to(MAIN_ROOM).emit('player:updated', updated)
    broadcastAdminOverview()
  })

  socket.on('player:move', (payload: { u: number; v: number; direction: Direction; animation: CharacterAnimation }) => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId || !payload) return
    const current = room.getPlayer(userId)
    const hadSeat = Boolean(current?.seatId)
    if (hadSeat) {
      cleanupUserVoiceAndBroadcast(userId, `${current?.username ?? 'Đối phương'} đã rời khỏi bàn.`)
      cleanupUserGamesAndBroadcast(userId)
    }
    const updated = room.movePlayer(userId, payload.u, payload.v, payload.direction, payload.animation)
    if (!updated) return
    if (hadSeat) {
      io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
      broadcastAdminOverview()
    }
    socket.to(MAIN_ROOM).emit('player:moved', {
      userId,
      u: updated.u,
      v: updated.v,
      direction: updated.direction,
      animation: updated.animation,
      seatId: null,
    })
  })

  socket.on('player:profile', (payload: { username: string; avatarId: string; level: string }) => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId || !payload) return
    const updated = room.updateProfile(userId, payload.username, payload.avatarId, payload.level)
    if (!updated) return
    savePlayerProfile(updated.userId, updated.username, updated.avatarId, updated.level)
    const { profile, unlockedCodes } = mutateLearningProfile(userId, { topikLevel: updated.level })
    broadcastLearningUpdate(userId, profile, unlockedCodes)
    io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
    broadcastAdminOverview()
  })

  socket.on(
    'player:interact',
    (
      payload: { targetId: string; action: 'wave' | 'talk' },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const userId = room.getUserBySocket(socket.id)
      if (!userId || !payload?.targetId) {
        ack?.({ ok: false, reason: 'Thiếu thông tin người chơi.' })
        return
      }
      const sender = room.getPlayer(userId)
      const target = room.getPlayer(payload.targetId)
      if (!sender || !target) {
        ack?.({ ok: false, reason: 'Người chơi này đã rời quán.' })
        return
      }
      const check = room.canInteractSameTable(userId, payload.targetId)
      if (!check.ok) {
        ack?.({ ok: false, reason: `Bạn cần ngồi cùng bàn với ${target.username} mới có thể tương tác nhé!` })
        return
      }
      ack?.({ ok: true })
      emitToTable(check.tableId, 'player:action', {
        fromId: userId,
        fromName: sender.username,
        targetId: payload.targetId,
        targetName: target.username,
        tableId: check.tableId,
        action: payload.action,
      })
      const { profile, unlockedCodes } = mutateLearningProfile(userId, {
        deltaXp: 5,
        unlockAchievementCodes: payload.action === 'wave' ? ['first-wave'] : undefined,
      })
      broadcastLearningUpdate(userId, profile, unlockedCodes)

      if (target.isNpc) {
        setTimeout(() => {
          emitToTable(check.tableId, 'player:action', {
            fromId: target.userId,
            fromName: target.username,
            targetId: userId,
            targetName: sender.username,
            tableId: check.tableId,
            action: payload.action,
          })
        }, 750)
      }
    },
  )

  // === STORY CONVERSATION SYNC (SAME TABLE / VOICE PARTNER) ===
  socket.on(
    'story:sync',
    (
      payload: { targetId: string; storyId: string; lineIndex: number; action: 'open' | 'step' | 'close' },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const senderId = room.getUserBySocket(socket.id)
      const sender = senderId ? room.getPlayer(senderId) : undefined
      if (!senderId || !sender || !payload?.targetId || !payload?.storyId) {
        ack?.({ ok: false, reason: 'Thiếu thông tin đồng bộ câu chuyện.' })
        return
      }
      const sameTable = room.canInteractSameTable(senderId, payload.targetId)
      if (!sameTable.ok) {
        ack?.({ ok: false, reason: 'Hai bạn cần ngồi cùng bàn để đọc câu chuyện chung nhé!' })
        return
      }
      const syncMsg: StorySyncPayload = {
        fromId: senderId,
        fromName: sender.username,
        storyId: payload.storyId,
        lineIndex: Math.max(0, Math.floor(payload.lineIndex || 0)),
        action: payload.action || 'step',
      }
      emitToUser(payload.targetId, 'story:synced', syncMsg)
      ack?.({ ok: true })
    },
  )

  // === PHASE 3: PRIVATE 1-ON-1 WEBRTC VOICE SIGNALING ===

  socket.on(
    'voice:invite',
    (
      payload: { targetId: string },
      ack?: (res: { ok: boolean; invite?: VoiceInvitePayload; reason?: string }) => void,
    ) => {
      const senderId = room.getUserBySocket(socket.id)
      if (!senderId || !payload?.targetId) {
        ack?.({ ok: false, reason: 'Phiên kết nối chưa sẵn sàng.' })
        return
      }
      const res = voiceManager.createInvite(senderId, payload.targetId)
      if (!res.ok) {
        ack?.({ ok: false, reason: res.reason })
        return
      }
      ack?.({ ok: true, invite: res.invite })
      emitToUser(res.invite.receiverId, 'voice:incoming-invite', res.invite)
    },
  )

  socket.on('voice:cancel', (payload: { inviteId: string }) => {
    const senderId = room.getUserBySocket(socket.id)
    if (!senderId || !payload?.inviteId) return
    const cancelled = voiceManager.cancelInvite(senderId, payload.inviteId)
    if (!cancelled) return
    emitToUser(cancelled.receiverId, 'voice:invite-cancelled', {
      inviteId: cancelled.inviteId,
      reason: `${cancelled.senderName} đã hủy lời mời trò chuyện.`,
    })
  })

  socket.on(
    'voice:respond',
    (
      payload: { inviteId: string; accept: boolean },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const receiverId = room.getUserBySocket(socket.id)
      if (!receiverId || !payload?.inviteId) {
        ack?.({ ok: false, reason: 'Thiếu thông tin lời mời.' })
        return
      }
      const res = voiceManager.respondToInvite(receiverId, payload.inviteId, Boolean(payload.accept))
      if (!res.ok) {
        ack?.({ ok: false, reason: res.reason })
        return
      }
      ack?.({ ok: true })

      if (!res.accepted) {
        emitToUser(res.invite.senderId, 'voice:invite-result', {
          inviteId: res.invite.inviteId,
          accepted: false,
          receiverName: res.invite.receiverName,
          reason: `${res.invite.receiverName} đã từ chối lời mời trò chuyện riêng.`,
        })
        return
      }

      emitToUser(res.session.hostUserId, 'voice:invite-result', {
        inviteId: res.invite.inviteId,
        accepted: true,
        receiverName: res.invite.receiverName,
      })
      emitToUser(res.session.hostUserId, 'voice:session-started', res.session)
      emitToUser(res.session.guestUserId, 'voice:session-started', res.session)

      for (const memberId of [res.session.hostUserId, res.session.guestUserId]) {
        const { profile, unlockedCodes } = mutateLearningProfile(memberId, {
          deltaXp: 15,
          unlockAchievementCodes: ['voice-talk'],
        })
        broadcastLearningUpdate(memberId, profile, unlockedCodes)
      }

      const pHost = room.getPlayer(res.session.hostUserId)
      const pGuest = room.getPlayer(res.session.guestUserId)
      if (pHost) io.to(MAIN_ROOM).emit('player:updated', pHost)
      if (pGuest) io.to(MAIN_ROOM).emit('player:updated', pGuest)
      broadcastAdminOverview()
    },
  )

  socket.on(
    'voice:signal',
    (
      payload: { sessionId: string; targetId: string; signal: VoiceSignalPayload },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const senderId = room.getUserBySocket(socket.id)
      if (!senderId || !payload?.sessionId || !payload?.targetId || !payload?.signal) {
        ack?.({ ok: false, reason: 'Dữ liệu tín hiệu không hợp lệ.' })
        return
      }
      if (!voiceManager.validatePeerSignal(senderId, payload.sessionId, payload.targetId)) {
        ack?.({ ok: false, reason: 'Không có quyền gửi tín hiệu vào phiên trò chuyện riêng này.' })
        return
      }
      ack?.({ ok: true })
      emitToUser(payload.targetId, 'voice:signal', {
        sessionId: payload.sessionId,
        fromId: senderId,
        signal: payload.signal,
      })
    },
  )

  socket.on('voice:mute', (payload: { sessionId: string; muted: boolean }) => {
    const senderId = room.getUserBySocket(socket.id)
    if (!senderId || !payload?.sessionId) return
    const partnerId = voiceManager.getPartnerId(senderId, payload.sessionId)
    if (!partnerId) return
    const updated = room.setVoiceState(senderId, true, Boolean(payload.muted))
    if (updated) {
      io.to(MAIN_ROOM).emit('player:updated', updated)
    }
    emitToUser(partnerId, 'voice:peer-mute', {
      sessionId: payload.sessionId,
      userId: senderId,
      muted: Boolean(payload.muted),
    })
  })

  socket.on('voice:end', () => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId) return
    const me = room.getPlayer(userId)
    cleanupUserVoiceAndBroadcast(userId, `${me?.username ?? 'Đối phương'} đã kết thúc trò chuyện riêng.`)
    broadcastAdminOverview()
  })

  // === MINI-GAME CENTER (6 GAMES, REAL MULTIPLAYER LOBBY & ROOM CODES) ===

  socket.on('mg:list-rooms', (payload: { gameId?: MiniGameId } | undefined, ack?: (res: unknown) => void) => {
    ack?.({ ok: true, rooms: gameCenter.getPublicWaitingRooms(payload?.gameId) })
  })

  socket.on(
    'mg:create-room',
    (
      payload: {
        gameId: MiniGameId
        difficulty: GameDifficulty
        isPrivate?: boolean
        memoryPairs?: MemoryPairCount
        memoryTimed?: boolean
      },
      ack?: (res: unknown) => void,
    ) => {
      const userId = room.getUserBySocket(socket.id)
      const me = userId ? room.getPlayer(userId) : undefined
      if (!userId || !me || !payload?.gameId) {
        ack?.({ ok: false, reason: 'Chưa sẵn sàng tạo phòng chơi.' })
        return
      }
      const { room: created, leftPreviousRoom } = gameCenter.createRoom(
        { userId, username: me.username, avatarId: me.avatarId },
        payload,
      )
      if (leftPreviousRoom) emitMiniGameRoomUpdate(leftPreviousRoom)
      emitMiniGameRoomUpdate(created)
      broadcastOpenMiniGameRooms()
      ack?.({ ok: true, room: created })
    },
  )

  socket.on('mg:join-room', (payload: { roomId: string }, ack?: (res: unknown) => void) => {
    const userId = room.getUserBySocket(socket.id)
    const me = userId ? room.getPlayer(userId) : undefined
    if (!userId || !me || !payload?.roomId) {
      ack?.({ ok: false, reason: 'Thiếu mã phòng.' })
      return
    }
    const res = gameCenter.joinRoom({ userId, username: me.username, avatarId: me.avatarId }, payload.roomId)
    if (!res.ok) {
      ack?.(res)
      return
    }
    if (res.leftPreviousRoom) emitMiniGameRoomUpdate(res.leftPreviousRoom)
    emitMiniGameRoomUpdate(res.room)
    broadcastOpenMiniGameRooms()
    ack?.({ ok: true, room: res.room })
  })

  socket.on('mg:join-code', (payload: { roomCode: string }, ack?: (res: unknown) => void) => {
    const userId = room.getUserBySocket(socket.id)
    const me = userId ? room.getPlayer(userId) : undefined
    if (!userId || !me || !payload?.roomCode) {
      ack?.({ ok: false, reason: 'Hãy nhập mã phòng.' })
      return
    }
    const res = gameCenter.joinByCode({ userId, username: me.username, avatarId: me.avatarId }, payload.roomCode)
    if (!res.ok) {
      ack?.(res)
      return
    }
    if (res.leftPreviousRoom) emitMiniGameRoomUpdate(res.leftPreviousRoom)
    emitMiniGameRoomUpdate(res.room)
    broadcastOpenMiniGameRooms()
    ack?.({ ok: true, room: res.room })
  })

  socket.on(
    'mg:invite-friend',
    (
      payload: {
        targetId: string
        roomId: string
        roomCode: string
        gameId: string
        gameTitle: string
        difficulty: string
      },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const senderId = room.getUserBySocket(socket.id)
      const sender = senderId ? room.getPlayer(senderId) : undefined
      const target = payload?.targetId ? room.getPlayer(payload.targetId) : undefined
      if (!senderId || !sender || !target || target.isNpc) {
        ack?.({ ok: false, reason: 'Chỉ có thể mời người chơi thật đang online trong quán!' })
        return
      }
      const invitePayload: MiniGameDirectInvite = {
        roomId: payload.roomId,
        roomCode: payload.roomCode,
        gameId: payload.gameId,
        gameTitle: payload.gameTitle,
        difficulty: payload.difficulty,
        senderId,
        senderName: sender.username,
        senderAvatarId: sender.avatarId,
      }
      emitToUser(target.userId, 'mg:incoming-invite', invitePayload)
      ack?.({ ok: true })
    },
  )

  socket.on('mg:start-room', (payload: { roomId: string }, ack?: (res: unknown) => void) => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId || !payload?.roomId) {
      ack?.({ ok: false, reason: 'Phòng không hợp lệ.' })
      return
    }
    const res = gameCenter.startRoom(userId, payload.roomId)
    if (!res.ok) {
      ack?.(res)
      return
    }
    emitMiniGameRoomUpdate(res.room)
    broadcastOpenMiniGameRooms()
    ack?.({ ok: true, room: res.room })
  })

  socket.on('mg:restart-room', (payload: { roomId: string }, ack?: (res: unknown) => void) => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId || !payload?.roomId) {
      ack?.({ ok: false, reason: 'Phòng không hợp lệ.' })
      return
    }
    const res = gameCenter.restartRoom(userId, payload.roomId)
    if (!res.ok) {
      ack?.(res)
      return
    }
    emitMiniGameRoomUpdate(res.room)
    broadcastOpenMiniGameRooms()
    ack?.({ ok: true, room: res.room })
  })

  socket.on(
    'mg:progress',
    (payload: { roomId: string; score: number; correctCount: number; finished?: boolean }) => {
      const userId = room.getUserBySocket(socket.id)
      if (!userId || !payload?.roomId) return
      const res = gameCenter.updateProgress(userId, payload.roomId, payload)
      if (!res) return
      emitMiniGameRoomUpdate(res.room)
      if (res.justFinishedMatch) {
        for (const p of res.room.players) {
          const isWinner = res.room.winnerUserId === p.userId
          const bonusXp = Math.min(80, 15 + Math.floor(p.score / 25) + (isWinner ? 20 : 0))
          const { profile, unlockedCodes } = mutateLearningProfile(p.userId, {
            deltaXp: bonusXp,
            incrementGamesPlayed: true,
            incrementGamesWon: isWinner,
            unlockAchievementCodes: isWinner ? ['first-game', 'game-winner'] : ['first-game'],
          })
          broadcastLearningUpdate(p.userId, profile, unlockedCodes)
        }
        broadcastAdminOverview()
      }
    },
  )

  socket.on('mg:leave-room', () => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId) return
    cleanupUserMiniGameCenter(userId)
  })

  // === LEGACY PHASE 4 TABLE GAMES (KEPT COMPATIBLE) ===

  socket.on(
    'game:start-solo',
    (
      payload: { gameKind: GameKind; topikLevel?: string },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const userId = room.getUserBySocket(socket.id)
      if (!userId || !payload?.gameKind) {
        ack?.({ ok: false, reason: 'Chưa sẵn sàng khởi tạo trò chơi.' })
        return
      }
      const res = gameManager.startSoloSession(userId, payload.gameKind, payload.topikLevel)
      ack?.(res.ok ? { ok: true } : { ok: false, reason: res.reason })
    },
  )

  socket.on(
    'game:invite',
    (
      payload: { targetId: string; gameKind: GameKind; topikLevel?: string },
      ack?: (res: { ok: boolean; mode?: 'invited' | 'npc-started'; invite?: GameInvitePayload; reason?: string }) => void,
    ) => {
      const senderId = room.getUserBySocket(socket.id)
      if (!senderId || !payload?.targetId || !payload?.gameKind) {
        ack?.({ ok: false, reason: 'Thiếu thông tin lời mời chơi game.' })
        return
      }
      const res = gameManager.createInviteOrNpcMatch(senderId, payload.targetId, payload.gameKind, payload.topikLevel)
      if (!res.ok) {
        ack?.({ ok: false, reason: res.reason })
        return
      }
      if (res.mode === 'npc-started') {
        ack?.({ ok: true, mode: 'npc-started' })
        return
      }
      ack?.({ ok: true, mode: 'invited', invite: res.invite })
      emitToUser(res.invite.receiverId, 'game:incoming-invite', res.invite)
    },
  )

  socket.on('game:cancel', (payload: { inviteId: string }) => {
    const senderId = room.getUserBySocket(socket.id)
    if (!senderId || !payload?.inviteId) return
    const cancelled = gameManager.cancelInvite(senderId, payload.inviteId)
    if (!cancelled) return
    emitToUser(cancelled.receiverId, 'game:invite-cancelled', {
      inviteId: cancelled.inviteId,
      reason: `${cancelled.senderName} đã hủy lời mời chơi game.`,
    })
  })

  socket.on(
    'game:respond',
    (
      payload: { inviteId: string; accept: boolean },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const receiverId = room.getUserBySocket(socket.id)
      if (!receiverId || !payload?.inviteId) {
        ack?.({ ok: false, reason: 'Thiếu mã lời mời.' })
        return
      }
      const res = gameManager.respondToInvite(receiverId, payload.inviteId, Boolean(payload.accept))
      if (!res.ok) {
        ack?.({ ok: false, reason: res.reason })
        return
      }
      ack?.({ ok: true })
      if (!res.accepted) {
        emitToUser(res.invite.senderId, 'game:invite-result', {
          inviteId: res.invite.inviteId,
          accepted: false,
          receiverName: res.invite.receiverName,
          reason: `${res.invite.receiverName} đã từ chối lời mời chơi game.`,
        })
        return
      }
      emitToUser(res.invite.senderId, 'game:invite-result', {
        inviteId: res.invite.inviteId,
        accepted: true,
        receiverName: res.invite.receiverName,
      })
    },
  )

  socket.on(
    'game:progress',
    (payload: {
      roomId: string
      score: number
      combo: number
      maxCombo: number
      correctCount: number
      finished?: boolean
    }) => {
      const userId = room.getUserBySocket(socket.id)
      if (!userId || !payload?.roomId) return
      gameManager.updateProgress(userId, payload.roomId, payload)
    },
  )

  socket.on('game:leave', () => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId) return
    cleanupUserGamesAndBroadcast(userId)
  })

  // === PHASE 5: ADMIN-CONTROLLED MUSIC & 10-MINUTE SUGGESTION COOLDOWN ===

  socket.on('music:cooldown', (ack?: (res: { cooldownSec: number }) => void) => {
    const userId = room.getUserBySocket(socket.id)
    ack?.({ cooldownSec: userId ? musicManager.getRemainingCooldownSec(userId) : 0 })
  })

  socket.on(
    'music:suggest',
    (
      payload: { title: string; artist?: string; mood?: string; style?: string; audioUrl?: string },
      ack?: (res: { ok: boolean; cooldownSec?: number; reason?: string }) => void,
    ) => {
      const userId = room.getUserBySocket(socket.id)
      const me = userId ? room.getPlayer(userId) : undefined
      if (!userId || !me) {
        ack?.({ ok: false, reason: 'Bạn chưa kết nối vào phòng.' })
        return
      }
      const res = musicManager.suggestTrack(userId, me.username, payload ?? { title: '' })
      if (!res.ok) {
        ack?.({ ok: false, cooldownSec: res.cooldownSec, reason: res.reason })
        return
      }
      ack?.({ ok: true, cooldownSec: res.cooldownSec })
      const { profile, unlockedCodes } = mutateLearningProfile(userId, {
        deltaXp: 12,
        unlockAchievementCodes: ['dj-vibe'],
      })
      broadcastLearningUpdate(userId, profile, unlockedCodes)
    },
  )

  socket.on(
    'music:vote',
    (
      payload: { trackId: string },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const userId = room.getUserBySocket(socket.id)
      if (!userId || !payload?.trackId) {
        ack?.({ ok: false, reason: 'Thiếu mã bài hát.' })
        return
      }
      const res = musicManager.voteTrack(userId, payload.trackId)
      ack?.(res.ok ? { ok: true } : { ok: false, reason: res.reason })
    },
  )

  socket.on('music:track-ended', (payload: { trackId?: string }) => {
    if (payload?.trackId) {
      musicManager.handleTrackEnded(payload.trackId)
    }
  })

  socket.on('music:update-duration', (payload: { trackId?: string; durationSec?: number }) => {
    if (payload?.trackId && typeof payload.durationSec === 'number') {
      musicManager.updateTrackDuration(payload.trackId, payload.durationSec)
    }
  })

  socket.on('music:claim-dj', (ack?: (res: { ok: boolean; reason?: string }) => void) => {
    ack?.({ ok: false, reason: 'Nhạc của quán được phát và điều khiển trực tiếp từ trang Admin!' })
  })

  socket.on('music:dj-action', (_payload: unknown, ack?: (res: { ok: boolean; reason?: string }) => void) => {
    ack?.({ ok: false, reason: 'Chỉ Admin tại trang Quản trị mới được đổi bài hát đang phát.' })
  })

  // === SELF-STUDY MILESTONES & LEARNING ===

  socket.on('learning:toggle-word', (payload: { vocabId: number; learned: boolean }) => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId || typeof payload?.vocabId !== 'number') return
    const { profile, unlockedCodes } = mutateLearningProfile(
      userId,
      payload.learned ? { addLearnedWordId: payload.vocabId } : { removeLearnedWordId: payload.vocabId },
    )
    broadcastLearningUpdate(userId, profile, unlockedCodes)
  })

  socket.on('learning:study-tick', () => {
    const userId = room.getUserBySocket(socket.id)
    if (!userId) return
    const { profile, unlockedCodes } = mutateLearningProfile(userId, {
      addStudyMinutes: 1,
      deltaXp: 4,
    })
    broadcastLearningUpdate(userId, profile, unlockedCodes)
  })

  socket.on(
    'learning:award-xp',
    (payload: { xp: number; addStudyMinutes?: number; gameCompleted?: boolean; won?: boolean }) => {
      const userId = room.getUserBySocket(socket.id)
      if (!userId || !payload) return
      const safeXp = Math.max(1, Math.min(120, Math.round(payload.xp || 0)))
      const safeMins = Math.max(0, Math.min(60, Math.round(payload.addStudyMinutes || 0)))
      const achCodes: string[] = []
      if (payload.gameCompleted) achCodes.push('first-game')
      if (payload.won) achCodes.push('game-winner')
      const { profile, unlockedCodes } = mutateLearningProfile(userId, {
        deltaXp: safeXp,
        addStudyMinutes: safeMins || undefined,
        incrementGamesPlayed: Boolean(payload.gameCompleted),
        incrementGamesWon: Boolean(payload.won),
        unlockAchievementCodes: achCodes.length > 0 ? achCodes : undefined,
      })
      broadcastLearningUpdate(userId, profile, unlockedCodes)
    },
  )

  socket.on('learning:order-item', (payload: { itemId: string }) => {
    const userId = room.getUserBySocket(socket.id)
    const sender = userId ? room.getPlayer(userId) : undefined
    if (!userId || !sender || !payload?.itemId) return
    const menuItem = KOREAN_CAFE_MENU.find((m) => m.id === payload.itemId)
    if (!menuItem) return

    const { profile, unlockedCodes } = mutateLearningProfile(userId, {
      deltaXp: 10,
      unlockAchievementCodes: ['first-order'],
    })
    broadcastLearningUpdate(userId, profile, unlockedCodes)

    const tableId = getTableIdForSeat(sender.seatId)
    const orderMsg: ChatMessagePayload = {
      id: crypto.randomUUID(),
      userId: sender.userId,
      username: sender.username,
      avatarId: sender.avatarId,
      text: `☕ ${menuItem.orderPhraseKo} (${menuItem.nameVi})`,
      scope: 'table',
      tableId,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    }
    if (tableId) {
      emitToTable(tableId, 'chat:message', orderMsg)
    } else {
      emitToUser(userId, 'chat:message', orderMsg)
    }

    // Barista delivers food/drink directly to the customer's table in cafe
    io.to(MAIN_ROOM).emit('barista:delivery', {
      targetUserId: sender.userId,
      targetUsername: sender.username,
      seatId: sender.seatId,
      tableId,
      itemId: payload.itemId,
      itemHangul: menuItem.hangul,
      assetKey: menuItem.assetKey,
    })
  })

  // === TABLE-ONLY CHAT (NO ROOM-WIDE PUBLIC CHAT TO PREVENT LAG) ===
  socket.on(
    'chat:send',
    (
      payload: { text: string; tableId?: string; seatId?: string },
      ack?: (res: { ok: boolean; reason?: string }) => void,
    ) => {
      const userId = room.getUserBySocket(socket.id)
      if (!userId) {
        ack?.({ ok: false, reason: 'Chưa kết nối phiên.' })
        return
      }
      const sender = room.getPlayer(userId)
      const text = payload?.text?.trim().slice(0, 280)
      if (!sender || !text) {
        ack?.({ ok: false })
        return
      }

      let currentSeatId = sender.seatId
      if (!currentSeatId && payload.seatId) {
        const sitRes = room.sitAtSeat(userId, payload.seatId)
        if (sitRes.ok) {
          currentSeatId = payload.seatId
          io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
          io.to(MAIN_ROOM).emit('player:updated', sitRes.player)
          broadcastAdminOverview()
        }
      }

      let tableId = getTableIdForSeat(currentSeatId)
      if (!tableId && payload.tableId) {
        tableId = payload.tableId
      }

      if (!tableId) {
        ack?.({
          ok: false,
          reason: 'Không gian riêng tư yên tĩnh. Hãy ngồi vào bàn (phím E) để trò chuyện cùng bàn nhé!',
        })
        return
      }

      const cleanText = sanitizeText(text)
      const message: ChatMessagePayload = {
        id: crypto.randomUUID(),
        userId: sender.userId,
        username: sender.username,
        avatarId: sender.avatarId,
        text: cleanText,
        scope: 'table',
        tableId,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      }

      saveChatMessage(message)
      emitToTable(tableId, 'chat:message', message)
      emitToTable(tableId, 'player:action', {
        fromId: sender.userId,
        fromName: sender.username,
        targetId: null,
        targetName: null,
        tableId,
        action: 'talk',
      })
      ack?.({ ok: true })

      // Auto-reply if seated partner is an NPC study buddy!
      const partnerSeat = currentSeatId ? getPartnerSeatId(currentSeatId) : null
      const partner = partnerSeat ? room.getAllPlayers().find((p) => p.seatId === partnerSeat) : null

      if (partner && partner.isNpc) {
        const lower = text.toLowerCase()
        let replyKo = ''
        if (lower.includes('chào') || lower.includes('hello') || lower.includes('hi') || lower.includes('안녕')) {
          replyKo = `안녕하세요 ${sender.username}님! 만나서 반가워요~ 오늘 같이 한국어 즐겁게 공부해 봐요! ☕✨`
        } else if (lower.includes('cảm ơn') || lower.includes('thanks') || lower.includes('gamsa') || lower.includes('고마')) {
          replyKo = '별말씀을요! 서로 도우면서 같이 공부해요~ 힘내요! 💪'
        } else if (lower.includes('học') || lower.includes('từ') || lower.includes('topik') || lower.includes('bài') || lower.includes('game')) {
          replyKo = '단어는 매일 조금씩 외우는 게 제일 좋아요! 저랑 6 Mini-Games에서 단어 연습해 볼까요? 📖🎮'
        } else if (lower.includes('nhạc') || lower.includes('chill') || lower.includes('hay') || lower.includes('quán')) {
          replyKo = '맞아요! 카페 음악이 정말 편안해서 집중이 쏙쏙 잘 돼요~ 🎵'
        } else if (lower.includes('cà phê') || lower.includes('uống') || lower.includes('ăn') || lower.includes('bánh')) {
          replyKo = '따뜻한 라떼 한잔 마시면서 쉬엄쉬엄 공부해요! ☕🍰'
        } else {
          const pool = [
            '좋은 하루 보내고 계신가요? 오늘도 파이팅이에요! 같이 열공해요 ✨',
            '한국어 공부하다가 어려운 부분 있으면 언제든 편하게 물어보세요! 📚',
            '우와, 꾸준히 공부하시는 모습이 정말 멋져요! 대단해요 👍',
            '오늘도 함께 앉아서 공부하니까 더 힘이 나네요! 힘내요 우리 🌿',
            '차근차근 하나씩 외우다 보면 한국어 실력이 쑥쑥 늘 거예요! 🎯',
          ]
          replyKo = pool[Math.floor(Math.random() * pool.length)]
        }

        setTimeout(() => {
          const currentSender = room.getPlayer(sender.userId)
          if (!currentSender || getTableIdForSeat(currentSender.seatId) !== tableId) return

          const npcMsg: ChatMessagePayload = {
            id: crypto.randomUUID(),
            userId: partner.userId,
            username: partner.username,
            avatarId: partner.avatarId,
            text: replyKo,
            scope: 'table',
            tableId,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          }

          saveChatMessage(npcMsg)
          emitToTable(tableId, 'chat:message', npcMsg)
          emitToTable(tableId, 'player:action', {
            fromId: partner.userId,
            fromName: partner.username,
            targetId: sender.userId,
            targetName: sender.username,
            tableId,
            action: 'talk',
          })
        }, 1100)
      }
    },
  )

  socket.on(
    'feedback:send',
    (payload: { content: string; username?: string }, ack?: (res: { ok: boolean; message?: string; reason?: string }) => void) => {
      const cleanContent = String(payload?.content || '').trim().slice(0, 1000)
      if (!cleanContent) {
        ack?.({ ok: false, reason: 'Nội dung góp ý không được để trống.' })
        return
      }
      const userId = room.getUserBySocket(socket.id)
      const user = userId ? room.getPlayer(userId) : undefined
      const username = user?.username || payload?.username || 'Khách K-CHILL'
      saveFeedback(userId || socket.id, username, cleanContent)
      broadcastAdminOverview()
      ack?.({ ok: true, message: 'Đã gửi góp ý thành công! Cảm ơn bạn rất nhiều 💖' })
    },
  )

  socket.on('disconnect', () => {
    const userId = room.getUserBySocket(socket.id)
    const oldName = userId ? room.getPlayer(userId)?.username : undefined
    const { removedUserId } = room.disconnectSocket(socket.id)
    if (removedUserId) {
      cleanupUserVoiceAndBroadcast(removedUserId, `${oldName ?? 'Đối phương'} đã mất kết nối khỏi quán.`)
      cleanupUserGamesAndBroadcast(removedUserId)
      cleanupUserMiniGameCenter(removedUserId)
      io.to(MAIN_ROOM).emit('player:left', { userId: removedUserId })
      io.to(MAIN_ROOM).emit('room:seats', room.getAllSeats())
      broadcastAdminOverview()
    }
  })
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '../dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      return res.sendFile(path.join(distPath, 'index.html'))
    }
    next()
  })
}

httpServer.listen(PORT, () => {
  console.log(`[K-CHILL Server] Full System + 6-Game Center + Admin Control listening on http://localhost:${PORT}`)
})
