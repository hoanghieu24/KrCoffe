import crypto from 'node:crypto'
import type { CafeRoomState } from './roomState.ts'
import {
  endVoiceSessionRecord,
  saveVoiceInvitation,
  startVoiceSessionRecord,
  updateVoiceInvitationStatus,
} from './store.ts'
import type { VoiceInvitePayload, VoiceSessionInfo } from '../src/domain/types.ts'

const INVITE_TIMEOUT_MS = 30_000
const SPAM_COOLDOWN_MS = 10_000

type PendingInvite = VoiceInvitePayload & {
  timer: ReturnType<typeof setTimeout>
}

export class VoiceSessionManager {
  private readonly invites = new Map<string, PendingInvite>()
  private readonly sessions = new Map<string, VoiceSessionInfo>()
  private readonly userSession = new Map<string, string>()
  private readonly pairCooldown = new Map<string, number>()

  constructor(
    private readonly room: CafeRoomState,
    private readonly onInviteExpired: (invite: VoiceInvitePayload) => void,
  ) {}

  getActiveSessionCount(): number {
    return this.sessions.size
  }

  getSessionForUser(userId: string): VoiceSessionInfo | undefined {
    const sessionId = this.userSession.get(userId)
    return sessionId ? this.sessions.get(sessionId) : undefined
  }

  private pairKey(a: string, b: string): string {
    return `${a}::${b}`
  }

  createInvite(
    senderId: string,
    receiverId: string,
  ): { ok: true; invite: VoiceInvitePayload } | { ok: false; reason: string } {
    if (senderId === receiverId) {
      return { ok: false, reason: 'Không thể tự mời chính mình.' }
    }
    const sender = this.room.getPlayer(senderId)
    const receiver = this.room.getPlayer(receiverId)
    if (!sender || !receiver) {
      return { ok: false, reason: 'Người chơi này hiện không còn trong quán.' }
    }
    if (receiver.isNpc) {
      return {
        ok: false,
        reason: `${receiver.username} là NPC mô phỏng của quán nên không có micro. Hãy rủ bạn học thật cùng bàn để trò chuyện giọng nói 1-1 nhé! 🎙️`,
      }
    }

    const tableCheck = this.room.canInteractSameTable(senderId, receiverId)
    if (!tableCheck.ok || !tableCheck.tableId) {
      return {
        ok: false,
        reason: `Bạn cần ngồi cùng bàn với ${receiver.username} mới có thể mời trò chuyện riêng nhé!`,
      }
    }

    if (this.userSession.has(senderId)) {
      return { ok: false, reason: 'Bạn đang trong một cuộc trò chuyện riêng rồi.' }
    }
    if (this.userSession.has(receiverId)) {
      return { ok: false, reason: `${receiver.username} đang trong cuộc trò chuyện riêng khác.` }
    }

    // Check existing pending invites involving either player
    for (const inv of this.invites.values()) {
      if (inv.senderId === senderId) {
        return { ok: false, reason: `Đang chờ ${inv.receiverName} phản hồi lời mời trước đó…` }
      }
      if (inv.receiverId === receiverId || inv.senderId === receiverId) {
        return { ok: false, reason: `${receiver.username} đang có một lời mời trò chuyện khác.` }
      }
    }

    // Anti-spam cooldown check
    const cooldownUntil = this.pairCooldown.get(this.pairKey(senderId, receiverId)) ?? 0
    const remainingSec = Math.ceil((cooldownUntil - Date.now()) / 1000)
    if (remainingSec > 0) {
      return {
        ok: false,
        reason: `Vui lòng đợi ${remainingSec}s trước khi gửi lại lời mời cho ${receiver.username} nhé.`,
      }
    }

    const inviteId = crypto.randomUUID()
    const expiresAt = Date.now() + INVITE_TIMEOUT_MS
    const payload: VoiceInvitePayload = {
      inviteId,
      senderId,
      senderName: sender.username,
      senderAvatarId: sender.avatarId,
      senderLevel: sender.level,
      receiverId,
      receiverName: receiver.username,
      tableId: tableCheck.tableId,
      expiresAt,
    }

    const timer = setTimeout(() => {
      const current = this.invites.get(inviteId)
      if (!current) return
      this.invites.delete(inviteId)
      updateVoiceInvitationStatus(inviteId, 'expired')
      this.onInviteExpired(payload)
    }, INVITE_TIMEOUT_MS)

    this.invites.set(inviteId, { ...payload, timer })
    saveVoiceInvitation(inviteId, senderId, receiverId, tableCheck.tableId, 'pending')

    return { ok: true, invite: payload }
  }

  cancelInvite(senderId: string, inviteId: string): VoiceInvitePayload | null {
    const inv = this.invites.get(inviteId)
    if (!inv || inv.senderId !== senderId) return null
    clearTimeout(inv.timer)
    this.invites.delete(inviteId)
    this.pairCooldown.set(this.pairKey(inv.senderId, inv.receiverId), Date.now() + 4_000)
    updateVoiceInvitationStatus(inviteId, 'cancelled')
    const { timer: _t, ...clean } = inv
    return clean
  }

  respondToInvite(
    receiverId: string,
    inviteId: string,
    accept: boolean,
  ):
    | { ok: true; accepted: false; invite: VoiceInvitePayload }
    | { ok: true; accepted: true; invite: VoiceInvitePayload; session: VoiceSessionInfo }
    | { ok: false; reason: string } {
    const inv = this.invites.get(inviteId)
    if (!inv || inv.receiverId !== receiverId) {
      return { ok: false, reason: 'Lời mời đã hết hạn hoặc không còn hiệu lực.' }
    }

    clearTimeout(inv.timer)
    this.invites.delete(inviteId)
    const { timer: _t, ...cleanInvite } = inv

    if (!accept) {
      this.pairCooldown.set(this.pairKey(inv.senderId, inv.receiverId), Date.now() + SPAM_COOLDOWN_MS)
      updateVoiceInvitationStatus(inviteId, 'declined')
      return { ok: true, accepted: false, invite: cleanInvite }
    }

    const sender = this.room.getPlayer(inv.senderId)
    const receiver = this.room.getPlayer(inv.receiverId)
    const tableCheck = this.room.canInteractSameTable(inv.senderId, inv.receiverId)
    if (!sender || !receiver || !tableCheck.ok || !tableCheck.tableId) {
      updateVoiceInvitationStatus(inviteId, 'expired')
      return { ok: false, reason: 'Một trong hai người đã rời khỏi bàn nên không thể bắt đầu cuộc gọi.' }
    }
    if (this.userSession.has(inv.senderId) || this.userSession.has(inv.receiverId)) {
      updateVoiceInvitationStatus(inviteId, 'expired')
      return { ok: false, reason: 'Đối phương hiện đang trong cuộc gọi khác.' }
    }

    updateVoiceInvitationStatus(inviteId, 'accepted')

    const sessionId = crypto.randomUUID()
    const startedAt = Date.now()
    const session: VoiceSessionInfo = {
      sessionId,
      tableId: tableCheck.tableId,
      hostUserId: sender.userId,
      hostName: sender.username,
      hostAvatarId: sender.avatarId,
      guestUserId: receiver.userId,
      guestName: receiver.username,
      guestAvatarId: receiver.avatarId,
      startedAt,
    }

    this.sessions.set(sessionId, session)
    this.userSession.set(sender.userId, sessionId)
    this.userSession.set(receiver.userId, sessionId)
    this.room.setVoiceState(sender.userId, true, false)
    this.room.setVoiceState(receiver.userId, true, false)
    startVoiceSessionRecord(sessionId, session.tableId, sender.userId, receiver.userId, startedAt)

    return { ok: true, accepted: true, invite: cleanInvite, session }
  }

  validatePeerSignal(senderId: string, sessionId: string, targetId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    const isHostToGuest = session.hostUserId === senderId && session.guestUserId === targetId
    const isGuestToHost = session.guestUserId === senderId && session.hostUserId === targetId
    return isHostToGuest || isGuestToHost
  }

  getPartnerId(userId: string, sessionId?: string): string | null {
    const sid = sessionId ?? this.userSession.get(userId)
    if (!sid) return null
    const session = this.sessions.get(sid)
    if (!session) return null
    if (session.hostUserId === userId) return session.guestUserId
    if (session.guestUserId === userId) return session.hostUserId
    return null
  }

  endSessionForUser(
    userId: string,
  ): { endedSession?: VoiceSessionInfo; partnerId?: string; cancelledInvites: VoiceInvitePayload[] } {
    const cancelledInvites: VoiceInvitePayload[] = []
    for (const [id, inv] of this.invites.entries()) {
      if (inv.senderId === userId || inv.receiverId === userId) {
        clearTimeout(inv.timer)
        this.invites.delete(id)
        updateVoiceInvitationStatus(id, 'cancelled')
        const { timer: _t, ...clean } = inv
        cancelledInvites.push(clean)
      }
    }

    const sessionId = this.userSession.get(userId)
    if (!sessionId) return { cancelledInvites }

    const session = this.sessions.get(sessionId)
    this.sessions.delete(sessionId)
    if (!session) {
      this.userSession.delete(userId)
      return { cancelledInvites }
    }

    this.userSession.delete(session.hostUserId)
    this.userSession.delete(session.guestUserId)
    this.room.setVoiceState(session.hostUserId, false, false)
    this.room.setVoiceState(session.guestUserId, false, false)
    endVoiceSessionRecord(sessionId)

    const partnerId = session.hostUserId === userId ? session.guestUserId : session.hostUserId
    return { endedSession: session, partnerId, cancelledInvites }
  }
}
