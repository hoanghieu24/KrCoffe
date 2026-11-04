import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Mic,
  MicOff,
  PhoneCall,
  Sparkles,
  Users,
  Volume2,
  X,
} from 'lucide-react'
import { CONVERSATION_STORIES, type ConversationStory } from '../data/conversationStories'
import type { StorySyncPayload } from '../domain/types'
import { speakKorean } from '../services/cafeMusicEngine'
import { multiplayerClient } from '../services/multiplayer'

export function StoryReaderModal({
  partnerId,
  partnerName,
  incomingSync,
  onClose,
  onNotice,
}: {
  partnerId: string | null
  partnerName: string | null
  incomingSync: StorySyncPayload | null
  onClose: () => void
  onNotice: (text: string, kind?: 'success' | 'tip') => void
}) {
  // Always default to interactive turn-by-turn mode with live mic & native audio
  const [readMode, setReadMode] = useState<'turn' | 'script'>('turn')
  const [storyId, setStoryId] = useState<string>(CONVERSATION_STORIES[0].id)
  const [lineIndex, setLineIndex] = useState<number>(0)
  const [showRom, setShowRom] = useState<boolean>(true)
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set())

  // Interactive Live Mic Practice & Sound Level Meter
  const [isMicActive, setIsMicActive] = useState<boolean>(false)
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [micFeedback, setMicFeedback] = useState<string>('')
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const story: ConversationStory =
    CONVERSATION_STORIES.find((s) => s.id === storyId) ?? CONVERSATION_STORIES[0]

  // Cleanup mic stream on unmount
  useEffect(() => {
    return () => {
      stopMic()
    }
  }, [])

  const stopMic = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
    setIsMicActive(false)
    setAudioLevel(0)
  }

  const toggleMicPractice = async () => {
    if (isMicActive) {
      stopMic()
      setMicFeedback('Đã dừng thu âm mic.')
      return
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        onNotice('Trình duyệt chưa hỗ trợ truy cập Micro.', 'tip')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyserRef.current = analyser
      source.connect(analyser)

      setIsMicActive(true)
      setMicFeedback('🎙️ Đang nghe giọng bạn... Hãy thử đọc to câu tiếng Hàn nhé!')

      const buffer = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i]
        }
        const avg = sum / buffer.length
        const normalized = Math.min(100, Math.round((avg / 128) * 100))
        setAudioLevel(normalized)

        if (normalized > 35) {
          setMicFeedback('✨ Giọng bạn rất rõ ràng! Phát âm chuẩn lắm!')
        }

        animationFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      onNotice('Không thể mở micro. Bạn hãy cấp quyền micro trên trình duyệt nhé!', 'tip')
    }
  }

  // Apply incoming real-time sync from tablemate when in turn-by-turn mode
  useEffect(() => {
    if (!incomingSync || readMode !== 'turn') return
    if (incomingSync.action === 'close') return
    if (incomingSync.storyId && incomingSync.storyId !== storyId) {
      setStoryId(incomingSync.storyId)
    }
    setLineIndex(incomingSync.lineIndex)
  }, [incomingSync, readMode, storyId])

  const emitSyncIfTogether = (nextStoryId: string, nextLineIdx: number, action: 'open' | 'step' = 'step') => {
    if (readMode === 'turn' && partnerId) {
      void multiplayerClient.sendStorySync({
        targetId: partnerId,
        storyId: nextStoryId,
        lineIndex: nextLineIdx,
        action,
      })
    }
  }

  const handleSelectStory = (id: string) => {
    setStoryId(id)
    setLineIndex(0)
    emitSyncIfTogether(id, 0, 'open')
  }

  const handleStep = (delta: number) => {
    const next = Math.max(0, Math.min(story.lines.length - 1, lineIndex + delta))
    setLineIndex(next)
    emitSyncIfTogether(story.id, next, 'step')

    if (next === story.lines.length - 1 && !completedIds.has(story.id)) {
      setCompletedIds((prev) => new Set(prev).add(story.id))
      multiplayerClient.awardBonusXp({ xp: 18 })
      onNotice(`📖 Hoàn thành câu chuyện “${story.titleVi}” (+18 XP)!`, 'success')
    }
  }

  const handleVoiceCallInvite = async () => {
    if (partnerId && partnerName) {
      const res = await multiplayerClient.sendVoiceInvite(partnerId)
      if (res.ok) {
        onNotice(`Đã gửi yêu cầu kết nối Voice 1-1 tới ${partnerName} 🎙️`, 'success')
      } else {
        onNotice(res.reason || `Chưa thể kết nối Voice tới ${partnerName}.`, 'tip')
      }
    }
  }

  const activeLine = story.lines[lineIndex] ?? story.lines[0]

  return (
    <div
      className="modal-backdrop story-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          stopMic()
          onClose()
        }
      }}
    >
      <div className="story-modal-shell" role="dialog" aria-modal="true" aria-label="Trò chuyện bằng mic & Luyện nói tiếng Hàn">
        {/* Header Bar */}
        <div className="story-modal-header">
          <div className="story-header-left">
            <div className="story-header-icon">
              <Headphones size={22} />
            </div>
            <div>
              <div className="modal-kicker">
                <Sparkles size={14} /> TRÒ CHUYỆN BẰNG MIC · K-CHILL SPEAKING ROOM
              </div>
              <h2>Trò Chuyện &amp; Luyện Nói Tiếng Hàn 🎙️</h2>
            </div>
          </div>
          <button
            className="modal-close"
            onClick={() => {
              stopMic()
              onClose()
            }}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Partner Connection Bar */}
        <div className="story-partner-bar">
          {partnerName ? (
            <div className="story-partner-info">
              <span className="story-partner-tag active">
                <Users size={14} /> Đang kết nối cùng bạn học: <strong>{partnerName}</strong>
              </span>
              <button
                type="button"
                className="story-voice-call-btn"
                onClick={handleVoiceCallInvite}
                title="Bật cuộc gọi thoại trực tiếp qua micro"
              >
                <PhoneCall size={14} /> Kết nối Micro 1-1
              </button>
            </div>
          ) : (
            <div className="story-partner-info solo">
              <span className="story-partner-tag">
                <Mic size={14} /> Chế độ tự luyện phát âm bằng Mic cá nhân
              </span>
              <small>Ngồi cùng bàn với một bạn học thật để mở tính năng Cùng đọc 2 người qua Mic!</small>
            </div>
          )}
        </div>

        {/* Controls Row: Mode Toggle & Latin Switch */}
        <div className="story-toolbar-row">
          <div className="story-mode-toggle">
            <button
              type="button"
              className={readMode === 'turn' ? 'active' : ''}
              onClick={() => {
                setReadMode('turn')
                emitSyncIfTogether(story.id, lineIndex, 'open')
              }}
            >
              <Mic size={15} /> Luyện nói từng câu (Mic &amp; Nghe) {partnerName ? `· Cùng ${partnerName}` : ''}
            </button>
            <button
              type="button"
              className={readMode === 'script' ? 'active' : ''}
              onClick={() => setReadMode('script')}
            >
              <BookOpen size={15} /> Xem toàn bộ kịch bản
            </button>
          </div>

          <label className="story-rom-toggle-btn">
            <input
              type="checkbox"
              checked={showRom}
              onChange={(e) => setShowRom(e.target.checked)}
            />
            <span className="rom-toggle-box">{showRom && <Check size={12} />}</span>
            <span>Hiện phiên âm Latin</span>
          </label>
        </div>

        {/* Story Selector Cards (Clear, spacious grid) */}
        <div className="story-picker-section">
          <div className="story-section-label">CHỌN TÌNH HUỐNG HỘI THOẠI:</div>
          <div className="story-picker-row">
            {CONVERSATION_STORIES.map((st) => {
              const isSelected = st.id === story.id
              return (
                <button
                  key={st.id}
                  type="button"
                  className={`story-pick-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectStory(st.id)}
                >
                  <div className="story-pick-top">
                    <span className="story-badge-level">{st.level}</span>
                    <span className="story-badge-dur">{st.durationHint}</span>
                  </div>
                  <strong className="story-pick-ko">{st.titleKo}</strong>
                  <span className="story-pick-vi">{st.titleVi}</span>
                </button>
              )
            })}
          </div>
        </div>

        {readMode === 'turn' ? (
          /* ========================================================
             SYNCHRONIZED TURN-BY-TURN READING VIEW (HERO FOCUS CARD)
             ======================================================== */
          <div className="story-sync-stage">
            <div className="story-sync-meta">
              <span className="story-progress-indicator">
                Lượt thoại <b>{lineIndex + 1}</b> / {story.lines.length}
              </span>
              <span className="story-summary-text">{story.summaryVi}</span>
            </div>

            <div className={`story-focus-card role-${activeLine.speaker.toLowerCase()}`}>
              <div className="story-focus-top">
                <span className={`story-role-pill role-${activeLine.speaker.toLowerCase()}`}>
                  Vai {activeLine.speaker} · {activeLine.roleLabel}
                </span>
                <span className="story-turn-hint">
                  {activeLine.speaker === 'A' ? '👤 Lượt người mở đầu' : '👥 Lượt người hồi đáp'}
                </span>
              </div>

              {/* Main Korean Hangul Typography */}
              <h3 className="story-hangul-hero">{activeLine.ko}</h3>

              {/* Optional Latin Romanization */}
              {showRom && <div className="story-rom-hero">[{activeLine.rom}]</div>}

              {/* Vietnamese Meaning */}
              <p className="story-vi-hero">{activeLine.vi}</p>

              {/* Pronunciation Audio & Interactive Live Mic Buttons */}
              <div className="story-action-buttons-strip">
                <button
                  type="button"
                  className="story-btn-play-audio"
                  onClick={() => speakKorean(activeLine.ko)}
                  title="Nghe phát âm chuẩn tiếng Hàn"
                >
                  <Volume2 size={18} />
                  <span>Nghe phát âm mẫu</span>
                </button>

                <button
                  type="button"
                  className={`story-btn-test-mic ${isMicActive ? 'active' : ''}`}
                  onClick={() => void toggleMicPractice()}
                  title="Bật/Tắt Micro để luyện nói câu này"
                >
                  {isMicActive ? <MicOff size={18} /> : <Mic size={18} />}
                  <span>{isMicActive ? 'Tắt Micro thử giọng' : 'Bật Mic luyện nói câu này'}</span>
                </button>
              </div>

              {/* Live Mic Waveform Feedback */}
              {isMicActive && (
                <div className="story-mic-monitor-box">
                  <div className="mic-monitor-top">
                    <span className="mic-live-dot" />
                    <strong>{micFeedback}</strong>
                  </div>
                  <div className="mic-meter-track">
                    <div
                      className="mic-meter-bar"
                      style={{ width: `${Math.max(6, audioLevel)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step Controls Bar */}
            <div className="story-step-controls">
              <button
                type="button"
                className="story-nav-btn prev"
                disabled={lineIndex === 0}
                onClick={() => handleStep(-1)}
              >
                <ChevronLeft size={18} /> Câu trước
              </button>

              <div className="story-dots">
                {story.lines.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`story-dot ${idx === lineIndex ? 'active' : ''}`}
                    onClick={() => {
                      setLineIndex(idx)
                      emitSyncIfTogether(story.id, idx, 'step')
                    }}
                    aria-label={`Chuyển tới câu ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="story-nav-btn next"
                onClick={() => handleStep(1)}
                disabled={lineIndex >= story.lines.length - 1}
              >
                Câu tiếp theo <ChevronRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================
             INDEPENDENT FULL-SCRIPT SELF-READING VIEW (ALL CARDS)
             ======================================================== */
          <div className="story-full-script">
            <div className="story-summary-banner">
              <strong>📖 Ngữ cảnh:</strong> {story.summaryVi}
            </div>

            <div className="story-lines-scroll">
              {story.lines.map((ln, idx) => (
                <div key={idx} className={`story-script-row role-${ln.speaker.toLowerCase()}`}>
                  <div className="story-script-speaker">
                    <span className={`role-badge role-${ln.speaker.toLowerCase()}`}>
                      Vai {ln.speaker}
                    </span>
                    <small>{ln.roleLabel}</small>
                  </div>

                  <div className="story-script-text">
                    <strong className="script-hangul">{ln.ko}</strong>
                    {showRom && <span className="script-rom">[{ln.rom}]</span>}
                    <span className="script-vi">{ln.vi}</span>
                  </div>

                  <div className="story-script-actions">
                    <button
                      type="button"
                      className="story-audio-pill-btn"
                      onClick={() => speakKorean(ln.ko)}
                      title="Nghe phát âm câu này"
                    >
                      <Volume2 size={15} />
                      <span>Nghe</span>
                    </button>
                    <button
                      type="button"
                      className="story-audio-pill-btn story-mic-pill"
                      onClick={() => {
                        setLineIndex(idx)
                        setReadMode('turn')
                        emitSyncIfTogether(story.id, idx, 'step')
                      }}
                      title="Chuyển sang chế độ luyện nói Mic cho câu này"
                    >
                      <Mic size={15} />
                      <span>Luyện nói</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
