import type { VoiceSessionInfo, VoiceSignalPayload } from '../domain/types'
import { multiplayerClient } from './multiplayer'

export type VoiceCallUiState = {
  session: VoiceSessionInfo | null
  connectionState: 'idle' | 'connecting' | 'connected' | 'reconnecting'
  localMuted: boolean
  peerMuted: boolean
  micAvailable: boolean
  localSpeaking: boolean
  remoteSpeaking: boolean
}

function buildIceServers(): RTCIceServer[] {
  const rawStun = (import.meta.env.VITE_STUN_URLS as string | undefined) || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'
  const stunUrls = rawStun
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const servers: RTCIceServer[] = [{ urls: stunUrls }]

  const turnUrl = (import.meta.env.VITE_TURN_URL as string | undefined)?.trim()
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: (import.meta.env.VITE_TURN_USERNAME as string | undefined) || undefined,
      credential: (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) || undefined,
    })
  }
  return servers
}

const INITIAL_STATE: VoiceCallUiState = {
  session: null,
  connectionState: 'idle',
  localMuted: false,
  peerMuted: false,
  micAvailable: true,
  localSpeaking: false,
  remoteSpeaking: false,
}

class PrivateVoiceService {
  private state: VoiceCallUiState = { ...INITIAL_STATE }
  private listeners = new Set<(state: VoiceCallUiState) => void>()
  private noticeListeners = new Set<(text: string, kind?: 'success' | 'tip') => void>()

  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private fallbackCtx: AudioContext | null = null
  private vadCtx: AudioContext | null = null
  private vadInterval: number | null = null
  private disconnectTimeout: number | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private remoteAudio: HTMLAudioElement | null = null
  private speakerEnabled = true
  private bound = false

  subscribe(fn: (state: VoiceCallUiState) => void): () => void {
    this.ensureBound()
    this.listeners.add(fn)
    fn(this.state)
    return () => {
      this.listeners.delete(fn)
    }
  }

  onNotice(fn: (text: string, kind?: 'success' | 'tip') => void): () => void {
    this.ensureBound()
    this.noticeListeners.add(fn)
    return () => {
      this.noticeListeners.delete(fn)
    }
  }

  private emitState(patch: Partial<VoiceCallUiState>) {
    this.state = { ...this.state, ...patch }
    for (const fn of this.listeners) fn(this.state)
  }

  private emitNotice(text: string, kind?: 'success' | 'tip') {
    for (const fn of this.noticeListeners) fn(text, kind)
  }

  private ensureBound() {
    if (this.bound) return
    this.bound = true

    multiplayerClient.on('voiceSessionStarted', (session) => {
      void this.startPeerSession(session)
    })

    multiplayerClient.on('voiceSignal', (payload) => {
      void this.handleIncomingSignal(payload.sessionId, payload.fromId, payload.signal)
    })

    multiplayerClient.on('voicePeerMute', (payload) => {
      if (this.state.session?.sessionId === payload.sessionId) {
        this.emitState({ peerMuted: payload.muted })
      }
    })

    multiplayerClient.on('voiceEnded', (payload) => {
      if (!this.state.session || this.state.session.sessionId === payload.sessionId) {
        this.cleanupSession()
        if (payload.reason) this.emitNotice(payload.reason)
      }
    })

    multiplayerClient.on('connectionChanged', (connected) => {
      if (!connected && this.state.session) {
        this.cleanupSession()
        this.emitNotice('Mất kết nối máy chủ — cuộc trò chuyện riêng đã tạm dừng.')
      }
    })
  }

  setSpeakerEnabled(enabled: boolean) {
    this.speakerEnabled = enabled
    if (this.remoteAudio) {
      this.remoteAudio.muted = !enabled
    }
  }

  private getPartnerId(session: VoiceSessionInfo): string {
    const myId = multiplayerClient.userId
    return session.hostUserId === myId ? session.guestUserId : session.hostUserId
  }

  private async acquireAudioStream(): Promise<{ stream: MediaStream; realMic: boolean }> {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        })
        return { stream, realMic: true }
      } catch {
        // Fall through to silent track fallback so WebRTC P2P still connects cleanly
      }
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.fallbackCtx = new AudioCtx()
    const dest = this.fallbackCtx.createMediaStreamDestination()
    for (const track of dest.stream.getAudioTracks()) {
      track.enabled = false
    }
    return { stream: dest.stream, realMic: false }
  }

  private async startPeerSession(session: VoiceSessionInfo) {
    this.cleanupSession()

    const myId = multiplayerClient.userId
    const isHost = session.hostUserId === myId
    const partnerId = this.getPartnerId(session)
    const partnerName = isHost ? session.guestName : session.hostName

    this.emitState({
      session,
      connectionState: 'connecting',
      localMuted: false,
      peerMuted: false,
      micAvailable: true,
      localSpeaking: false,
      remoteSpeaking: false,
    })

    const { stream, realMic } = await this.acquireAudioStream()
    // Verify session wasn't cancelled while awaiting mic permission
    if (this.state.session?.sessionId !== session.sessionId) {
      for (const t of stream.getTracks()) t.stop()
      return
    }

    this.localStream = stream
    if (!realMic) {
      this.emitState({ localMuted: true, micAvailable: false })
      multiplayerClient.sendVoiceMute(session.sessionId, true)
      this.emitNotice(
        `Chưa cấp quyền hoặc chưa cắm micro — bạn đang ở chế độ Nghe cùng ${partnerName}. Bấm Micro để thử bật lại nhé!`,
      )
    } else {
      this.emitNotice(`Đã bắt đầu trò chuyện riêng 1-1 với ${partnerName} tại ${session.tableId}! 🎙️`, 'success')
    }

    const pc = new RTCPeerConnection({ iceServers: buildIceServers() })
    this.pc = pc
    this.pendingCandidates = []

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream)
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.state.session?.sessionId === session.sessionId) {
        void multiplayerClient.sendVoiceSignal(session.sessionId, partnerId, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        })
      }
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      if (!remoteStream) return
      if (!this.remoteAudio) {
        this.remoteAudio = new Audio()
        this.remoteAudio.autoplay = true
      }
      this.remoteAudio.srcObject = remoteStream
      this.remoteAudio.muted = !this.speakerEnabled
      void this.remoteAudio.play().catch(() => {
        // Autoplay resumes automatically on user click if needed
      })
      this.setupVoiceActivityMeter(this.localStream, remoteStream)
    }

    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return
      const st = pc.connectionState
      if (st === 'connected') {
        if (this.disconnectTimeout) {
          window.clearTimeout(this.disconnectTimeout)
          this.disconnectTimeout = null
        }
        this.emitState({ connectionState: 'connected' })
      } else if (st === 'disconnected') {
        this.emitState({ connectionState: 'reconnecting' })
        if (isHost) {
          try {
            pc.restartIce()
          } catch {
            // Ignore
          }
        }
        if (!this.disconnectTimeout) {
          this.disconnectTimeout = window.setTimeout(() => {
            if (this.pc === pc && pc.connectionState !== 'connected') {
              this.endCall()
              this.emitNotice('Kết nối âm thanh P2P bị gián đoạn nên cuộc gọi đã đóng.')
            }
          }, 6000)
        }
      } else if (st === 'failed') {
        this.endCall()
        this.emitNotice('Không thể thiết lập kênh âm thanh trực tiếp với đối phương.')
      }
    }

    if (realMic) {
      this.setupVoiceActivityMeter(this.localStream, null)
    }

    if (isHost) {
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true })
        await pc.setLocalDescription(offer)
        if (offer.sdp) {
          await multiplayerClient.sendVoiceSignal(session.sessionId, partnerId, {
            type: 'offer',
            sdp: offer.sdp,
          })
        }
      } catch {
        this.emitNotice('Không thể tạo tín hiệu kết nối giọng nói.')
      }
    }
  }

  private async handleIncomingSignal(sessionId: string, fromId: string, signal: VoiceSignalPayload) {
    const session = this.state.session
    if (!session || session.sessionId !== sessionId) return
    const expectedPartner = this.getPartnerId(session)
    if (fromId !== expectedPartner) return

    // Wait briefly if local getUserMedia prompt is still open on guest
    for (let attempt = 0; attempt < 25 && !this.pc; attempt++) {
      await new Promise((r) => window.setTimeout(r, 120))
      if (!this.state.session || this.state.session.sessionId !== sessionId) return
    }
    const pc = this.pc
    if (!pc) return

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }))
        await this.flushPendingCandidates(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        if (answer.sdp) {
          await multiplayerClient.sendVoiceSignal(sessionId, fromId, {
            type: 'answer',
            sdp: answer.sdp,
          })
        }
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }))
        await this.flushPendingCandidates(pc)
      } else if (signal.type === 'ice-candidate') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
        } else {
          this.pendingCandidates.push(signal.candidate)
        }
      }
    } catch {
      // Ignore benign ICE race errors
    }
  }

  private async flushPendingCandidates(pc: RTCPeerConnection) {
    const queued = [...this.pendingCandidates]
    this.pendingCandidates = []
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // Ignore stale candidate
      }
    }
  }

  private setupVoiceActivityMeter(localStream: MediaStream | null, remoteStream: MediaStream | null) {
    try {
      if (this.vadInterval) {
        window.clearInterval(this.vadInterval)
        this.vadInterval = null
      }
      if (this.vadCtx) {
        void this.vadCtx.close().catch(() => undefined)
        this.vadCtx = null
      }

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      this.vadCtx = ctx

      const makeMeter = (stream: MediaStream | null) => {
        if (!stream || stream.getAudioTracks().length === 0) return null
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        src.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        return () => {
          analyser.getByteFrequencyData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i]
          return sum / data.length > 13
        }
      }

      const checkLocal = this.state.micAvailable ? makeMeter(localStream) : null
      const checkRemote = makeMeter(remoteStream)

      this.vadInterval = window.setInterval(() => {
        const localSpeaking = !this.state.localMuted && Boolean(checkLocal?.())
        const remoteSpeaking = !this.state.peerMuted && Boolean(checkRemote?.())
        if (
          localSpeaking !== this.state.localSpeaking ||
          remoteSpeaking !== this.state.remoteSpeaking
        ) {
          this.emitState({ localSpeaking, remoteSpeaking })
        }
      }, 150)
    } catch {
      // Non-critical visual meter fallback
    }
  }

  async toggleMute(): Promise<void> {
    const session = this.state.session
    if (!session) return

    // If previously using silent fallback, try acquiring real mic on unmute!
    if (!this.state.micAvailable && this.state.localMuted && navigator.mediaDevices?.getUserMedia) {
      try {
        const realStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        })
        const newTrack = realStream.getAudioTracks()[0]
        if (newTrack && this.pc) {
          const sender = this.pc.getSenders().find((s) => s.track?.kind === 'audio')
          if (sender) await sender.replaceTrack(newTrack)
          if (this.localStream) {
            for (const old of this.localStream.getTracks()) old.stop()
          }
          this.localStream = realStream
          this.emitState({ micAvailable: true, localMuted: false })
          multiplayerClient.sendVoiceMute(session.sessionId, false)
          this.emitNotice('Đã kết nối micro thành công! 🎙️', 'success')
          return
        }
      } catch {
        this.emitNotice('Trình duyệt chưa cấp quyền micro hoặc thiết bị chưa có micro.')
        return
      }
    }

    const nextMuted = !this.state.localMuted
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !nextMuted
      }
    }
    this.emitState({ localMuted: nextMuted, localSpeaking: false })
    multiplayerClient.sendVoiceMute(session.sessionId, nextMuted)
  }

  endCall() {
    const hadSession = Boolean(this.state.session)
    this.cleanupSession()
    if (hadSession) {
      multiplayerClient.endVoiceSession()
    }
  }

  cleanupSession() {
    if (this.disconnectTimeout) {
      window.clearTimeout(this.disconnectTimeout)
      this.disconnectTimeout = null
    }
    if (this.vadInterval) {
      window.clearInterval(this.vadInterval)
      this.vadInterval = null
    }
    if (this.vadCtx) {
      void this.vadCtx.close().catch(() => undefined)
      this.vadCtx = null
    }
    if (this.fallbackCtx) {
      void this.fallbackCtx.close().catch(() => undefined)
      this.fallbackCtx = null
    }
    if (this.pc) {
      this.pc.onicecandidate = null
      this.pc.ontrack = null
      this.pc.onconnectionstatechange = null
      this.pc.close()
      this.pc = null
    }
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop()
      this.localStream = null
    }
    if (this.remoteAudio) {
      this.remoteAudio.pause()
      this.remoteAudio.srcObject = null
      this.remoteAudio = null
    }
    this.pendingCandidates = []
    this.emitState({ ...INITIAL_STATE })
  }
}

export const privateVoiceService = new PrivateVoiceService()
