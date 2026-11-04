import { areSeatsAtSameTable, getPartnerSeatId, getTableIdForSeat } from '../src/domain/seatUtils.ts'
import type { CafeSeat, CharacterAnimation, Direction, RoomPlayerState } from '../src/domain/types.ts'

export const MAX_REAL_PLAYERS = 30

type CanonicalSeatMeta = {
  id: string
  tableId: string
  direction: Direction
  u: number
  v: number
}

function buildCanonicalSeats(): Map<string, CanonicalSeatMeta> {
  const rowConfigs: [number, number[]][] = [
    [11.6, [-6.0, -3.0, 0.0, 3.0, 6.0]],
    [17.2, [-7.6, -3.8, 0.0, 3.8, 7.6]],
    [22.6, [-6.0, -3.0, 0.0, 3.0, 6.0]],
  ]
  const map = new Map<string, CanonicalSeatMeta>()
  let seatNumber = 1
  for (let row = 0; row < rowConfigs.length; row++) {
    const [sum, columnOffsets] = rowConfigs[row]
    for (let col = 0; col < columnOffsets.length; col++) {
      const tableIndex = row * 5 + col
      const diff = columnOffsets[col]
      const cu = (sum + diff) / 2
      const cv = (sum - diff) / 2
      const tableId = `Table_${String(tableIndex + 1).padStart(2, '0')}`

      const leftId = `Seat_${String(seatNumber++).padStart(2, '0')}`
      map.set(leftId, {
        id: leftId,
        tableId,
        direction: 'right',
        u: Number((cu - 0.38).toFixed(3)),
        v: Number((cv + 0.76).toFixed(3)),
      })

      const rightId = `Seat_${String(seatNumber++).padStart(2, '0')}`
      map.set(rightId, {
        id: rightId,
        tableId,
        direction: 'left',
        u: Number((cu + 0.76).toFixed(3)),
        v: Number((cv - 0.38).toFixed(3)),
      })
    }
  }
  return map
}

const SEAT_META = buildCanonicalSeats()

export const BARISTA_NPC_ID = 'npc-barista'
export const BARISTA_NPC: RoomPlayerState = {
  userId: BARISTA_NPC_ID,
  username: 'Soo-jin (Barista ☕)',
  avatarId: 'look-barista',
  level: '바리스타',
  u: 1.45,
  v: 5.0,
  direction: 'right',
  animation: 'idle',
  seatId: null,
  onlineStatus: 'online',
  mood: 'studying',
  isNpc: true,
}

// When launched, mock table NPCs are removed so all 30 seats are 100% available for real users.
// Only 1 Barista NPC is active at the counter. Set ENABLE_MOCK_TABLE_NPCS=true if ever needed for testing.
const INITIAL_NPCS: Array<{
  userId: string
  username: string
  avatarId: string
  level: string
  seatId: string
  mood: 'chatting' | 'studying' | 'listening'
}> = process.env.ENABLE_MOCK_TABLE_NPCS === 'true'
  ? [
      { userId: 'demo-minh-anh', username: 'Minh Anh', avatarId: 'look-03', level: 'TOPIK 2', seatId: 'Seat_04', mood: 'chatting' },
      { userId: 'demo-gia-huy', username: 'Gia Huy', avatarId: 'look-01', level: 'TOPIK 1', seatId: 'Seat_07', mood: 'studying' },
      { userId: 'demo-thao-vy', username: 'Thảo Vy', avatarId: 'look-02', level: 'TOPIK 3', seatId: 'Seat_11', mood: 'chatting' },
      { userId: 'demo-duc-anh', username: 'Đức Anh', avatarId: 'look-08', level: 'TOPIK 2', seatId: 'Seat_16', mood: 'listening' },
      { userId: 'demo-ha-linh', username: 'Hà Linh', avatarId: 'look-07', level: 'TOPIK 1', seatId: 'Seat_23', mood: 'studying' },
    ]
  : []

const PREFERRED_JOIN_SEATS = [
  'Seat_13', 'Seat_14',
  'Seat_15', 'Seat_17', 'Seat_18',
  'Seat_03', 'Seat_08', 'Seat_12',
  'Seat_25', 'Seat_26', 'Seat_05', 'Seat_06',
]

export class CafeRoomState {
  private readonly seats = new Map<string, CafeSeat>()
  private readonly players = new Map<string, RoomPlayerState>()
  private readonly socketToUser = new Map<string, string>()

  constructor() {
    for (let i = 1; i <= 30; i++) {
      const id = `Seat_${String(i).padStart(2, '0')}`
      this.seats.set(id, { id, status: 'available' })
    }
    for (const npc of INITIAL_NPCS) {
      const meta = SEAT_META.get(npc.seatId)
      if (!meta) continue
      this.seats.set(npc.seatId, {
        id: npc.seatId,
        status: 'occupied',
        occupantId: npc.userId,
        occupantName: npc.username,
      })
      this.players.set(npc.userId, {
        userId: npc.userId,
        username: npc.username,
        avatarId: npc.avatarId,
        level: npc.level,
        u: meta.u,
        v: meta.v,
        direction: meta.direction,
        animation: 'sit',
        seatId: npc.seatId,
        onlineStatus: 'online',
        mood: npc.mood,
        isNpc: true,
      })
    }

    // Single active Barista NPC at the coffee counter
    this.players.set(BARISTA_NPC.userId, { ...BARISTA_NPC })
  }

  getRealPlayerCount(): number {
    let count = 0
    for (const p of this.players.values()) {
      if (!p.isNpc) count++
    }
    return count
  }

  getAllSeats(): CafeSeat[] {
    return [...this.seats.values()].map((s) => ({ ...s }))
  }

  getAllPlayers(): RoomPlayerState[] {
    return [...this.players.values()].map((p) => ({ ...p }))
  }

  getPlayer(userId: string): RoomPlayerState | undefined {
    return this.players.get(userId)
  }

  getUserBySocket(socketId: string): string | undefined {
    return this.socketToUser.get(socketId)
  }

  getSocketIdsForUser(userId: string): string[] {
    const ids: string[] = []
    for (const [sockId, uid] of this.socketToUser.entries()) {
      if (uid === userId) ids.push(sockId)
    }
    return ids
  }

  setVoiceState(userId: string, inVoiceCall: boolean, voiceMuted = false): RoomPlayerState | null {
    const player = this.players.get(userId)
    if (!player) return null
    player.inVoiceCall = inVoiceCall
    player.voiceMuted = inVoiceCall ? voiceMuted : false
    return { ...player }
  }

  setGameState(userId: string, inGame: boolean): RoomPlayerState | null {
    const player = this.players.get(userId)
    if (!player) return null
    player.inGame = inGame
    return { ...player }
  }

  setXpMeta(userId: string, xp: number, levelNum: number, topikLevel?: string): RoomPlayerState | null {
    const player = this.players.get(userId)
    if (!player) return null
    player.xp = xp
    player.levelNum = levelNum
    if (topikLevel) player.level = topikLevel
    return { ...player }
  }

  private freeOneNpcIfNeeded() {
    const availableCount = [...this.seats.values()].filter((s) => s.status === 'available').length
    if (availableCount > 0) return
    const npc = [...this.players.values()].find((p) => p.isNpc)
    if (npc) {
      if (npc.seatId) this.seats.set(npc.seatId, { id: npc.seatId, status: 'available' })
      this.players.delete(npc.userId)
    }
  }

  private pickBestInitialSeat(existingSeatId?: string | null): string | null {
    if (existingSeatId) {
      const s = this.seats.get(existingSeatId)
      if (s && s.status === 'available') return existingSeatId
    }

    // First: if another real player is sitting alone at a table, pair them at the same table so testing 2 tabs lets them interact immediately!
    for (const p of this.players.values()) {
      if (p.isNpc || !p.seatId) continue
      const partnerId = getPartnerSeatId(p.seatId)
      if (partnerId && this.seats.get(partnerId)?.status === 'available') {
        return partnerId
      }
    }

    for (const id of PREFERRED_JOIN_SEATS) {
      if (this.seats.get(id)?.status === 'available') return id
    }
    for (const [id, seat] of this.seats.entries()) {
      if (seat.status === 'available') return id
    }
    return null
  }

  joinPlayer(
    socketId: string,
    payload: { userId: string; username: string; avatarId: string; level?: string },
  ): { ok: true; player: RoomPlayerState } | { ok: false; reason: string } {
    const existing = this.players.get(payload.userId)
    if (!existing && this.getRealPlayerCount() >= MAX_REAL_PLAYERS) {
      return { ok: false, reason: 'Quán hiện đã đủ 30/30 người. Vui lòng thử lại sau ít phút nhé!' }
    }

    this.freeOneNpcIfNeeded()
    this.socketToUser.set(socketId, payload.userId)

    const cleanName = (payload.username || 'Bạn mới').trim().slice(0, 20) || 'Bạn mới'
    const avatarId = payload.avatarId || 'look-01'
    const level = payload.level || 'TOPIK 1'

    if (existing && !existing.isNpc) {
      existing.username = cleanName
      existing.avatarId = avatarId
      existing.level = level
      existing.onlineStatus = 'online'
      if (existing.seatId) {
        const seat = this.seats.get(existing.seatId)
        if (seat && seat.occupantId === existing.userId) {
          seat.occupantName = cleanName
        }
      }
      return { ok: true, player: { ...existing } }
    }

    const assignedSeatId = this.pickBestInitialSeat()
    const seatMeta = assignedSeatId ? SEAT_META.get(assignedSeatId) : undefined

    let player: RoomPlayerState
    if (assignedSeatId && seatMeta) {
      this.seats.set(assignedSeatId, {
        id: assignedSeatId,
        status: 'occupied',
        occupantId: payload.userId,
        occupantName: cleanName,
      })
      player = {
        userId: payload.userId,
        username: cleanName,
        avatarId,
        level,
        u: seatMeta.u,
        v: seatMeta.v,
        direction: seatMeta.direction,
        animation: 'sit',
        seatId: assignedSeatId,
        onlineStatus: 'online',
      }
    } else {
      player = {
        userId: payload.userId,
        username: cleanName,
        avatarId,
        level,
        u: 11.8,
        v: 15.2,
        direction: 'down',
        animation: 'idle',
        seatId: null,
        onlineStatus: 'online',
      }
    }

    this.players.set(payload.userId, player)
    return { ok: true, player: { ...player } }
  }

  sitAtSeat(userId: string, seatId: string): { ok: true; player: RoomPlayerState } | { ok: false; reason: string } {
    const player = this.players.get(userId)
    if (!player) return { ok: false, reason: 'Không tìm thấy phiên người chơi.' }
    const seat = this.seats.get(seatId)
    const meta = SEAT_META.get(seatId)
    if (!seat || !meta) return { ok: false, reason: 'Ghế không hợp lệ.' }

    if (seat.status === 'occupied' && seat.occupantId !== userId) {
      return { ok: false, reason: `Ghế ${seatId} đã có ${seat.occupantName ?? 'người khác'} ngồi rồi nhé!` }
    }

    if (player.seatId && player.seatId !== seatId) {
      const prev = this.seats.get(player.seatId)
      if (prev?.occupantId === userId) {
        this.seats.set(player.seatId, { id: player.seatId, status: 'available' })
      }
    }

    this.seats.set(seatId, {
      id: seatId,
      status: 'occupied',
      occupantId: userId,
      occupantName: player.username,
    })

    player.seatId = seatId
    player.u = meta.u
    player.v = meta.v
    player.direction = meta.direction
    player.animation = 'sit'

    return { ok: true, player: { ...player } }
  }

  standUp(userId: string, u?: number, v?: number): RoomPlayerState | null {
    const player = this.players.get(userId)
    if (!player) return null
    if (player.seatId) {
      const prev = this.seats.get(player.seatId)
      if (prev?.occupantId === userId) {
        this.seats.set(player.seatId, { id: player.seatId, status: 'available' })
      }
      player.seatId = null
    }
    if (typeof u === 'number' && Number.isFinite(u)) player.u = Math.max(0.4, Math.min(18.6, u))
    if (typeof v === 'number' && Number.isFinite(v)) player.v = Math.max(0.4, Math.min(16.6, v))
    player.animation = 'idle'
    player.direction = 'down'
    return { ...player }
  }

  movePlayer(userId: string, u: number, v: number, direction: Direction, animation: CharacterAnimation): RoomPlayerState | null {
    const player = this.players.get(userId)
    if (!player) return null
    // If they were still marked seated on server, release seat automatically on walk
    if (player.seatId) {
      const prev = this.seats.get(player.seatId)
      if (prev?.occupantId === userId) {
        this.seats.set(player.seatId, { id: player.seatId, status: 'available' })
      }
      player.seatId = null
    }
    player.u = Number(Math.max(0.3, Math.min(18.7, u)).toFixed(3))
    player.v = Number(Math.max(0.3, Math.min(16.7, v)).toFixed(3))
    player.direction = direction
    player.animation = animation === 'sit' ? 'idle' : animation
    return { ...player }
  }

  updateProfile(userId: string, username: string, avatarId: string, level: string): RoomPlayerState | null {
    const player = this.players.get(userId)
    if (!player) return null
    const cleanName = (username || player.username).trim().slice(0, 20) || player.username
    player.username = cleanName
    player.avatarId = avatarId || player.avatarId
    player.level = level || player.level
    if (player.seatId) {
      const seat = this.seats.get(player.seatId)
      if (seat?.occupantId === userId) {
        seat.occupantName = cleanName
      }
    }
    return { ...player }
  }

  canInteractSameTable(userA: string, userB: string): { ok: boolean; tableId: string | null } {
    const pA = this.players.get(userA)
    const pB = this.players.get(userB)
    if (!pA?.seatId || !pB?.seatId) return { ok: false, tableId: null }
    const same = areSeatsAtSameTable(pA.seatId, pB.seatId)
    return { ok: same, tableId: same ? getTableIdForSeat(pA.seatId) : null }
  }

  disconnectSocket(socketId: string): { removedUserId?: string } {
    const userId = this.socketToUser.get(socketId)
    this.socketToUser.delete(socketId)
    if (!userId) return {}

    // Check if same user still has another active socket (e.g. fast reload)
    for (const activeUid of this.socketToUser.values()) {
      if (activeUid === userId) return {}
    }

    const player = this.players.get(userId)
    if (player && !player.isNpc) {
      if (player.seatId) {
        const seat = this.seats.get(player.seatId)
        if (seat?.occupantId === userId) {
          this.seats.set(player.seatId, { id: player.seatId, status: 'available' })
        }
      }
      this.players.delete(userId)
      return { removedUserId: userId }
    }
    return {}
  }

  forceRemovePlayer(userId: string): string[] {
    const socketIds = this.getSocketIdsForUser(userId)
    for (const sid of socketIds) {
      this.socketToUser.delete(sid)
    }
    const player = this.players.get(userId)
    if (player && !player.isNpc) {
      if (player.seatId) {
        const seat = this.seats.get(player.seatId)
        if (seat?.occupantId === userId) {
          this.seats.set(player.seatId, { id: player.seatId, status: 'available' })
        }
      }
      this.players.delete(userId)
    }
    return socketIds
  }
}
