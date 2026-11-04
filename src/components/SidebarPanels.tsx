import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Award,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudRain,
  Coffee,
  Disc3,
  Gamepad2,
  Heart,
  MessageSquareQuote,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Tv,
  Volume2,
  X,
} from 'lucide-react'
import {
  ACHIEVEMENTS_CATALOG,
  DEFAULT_MUSIC_TRACKS,
  KOREAN_CAFE_MENU,
  type CafeMenuItem,
} from '../data/koreanVocabulary'
import { apiUrl } from '../config'
import type {
  MusicRoomState,
  PlayerLearningProfile,
  RoomPlayerState,
} from '../domain/types'
import { SCENE_IMAGES } from '../game/AssetManifest'
import {
  playVocabPronunciation,
  SHARED_KOREAN_VOCAB,
  VOCAB_TOPICS,
  type VocabTopic,
} from '../games/data/sharedKoreanVocab'
import { MINI_GAMES_CATALOG } from '../games/MiniGameCenter'
import { cafeMusicEngine, extractYouTubeId, speakKorean } from '../services/cafeMusicEngine'
import { multiplayerClient } from '../services/multiplayer'

function formatSec(sec: number): string {
  const safe = Math.max(0, Math.floor(sec))
  const m = String(Math.floor(safe / 60)).padStart(2, '0')
  const s = String(safe % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function GamesSidebarPanel({
  currentTablemate,
  myTableId,
  openRoomsCount,
  onOpenGameCenter,
}: {
  currentTablemate: RoomPlayerState | null
  myTableId: string | null
  openRoomsCount: number
  onOpenGameCenter: (inviteTarget?: RoomPlayerState | null) => void
}) {
  return (
    <div className="sidebar-scroll-panel">
      <div className="mg-sidebar-hero">
        <img src="/assets/games/badge-game-trophy.png" alt="" />
        <div>
          <strong>Mini-Game Center (6 Games)</strong>
          <small>Chơi đơn rèn từ vựng hoặc lập phòng đấu trực tiếp cùng bạn bè!</small>
        </div>
      </div>

      {currentTablemate && !currentTablemate.isNpc ? (
        <div className="tablemate-ready-banner">
          <Sparkles size={14} />
          <span>
            Bạn đang ngồi cùng <b>{currentTablemate.username}</b> ({myTableId}) — mời đấu ngay!
          </span>
          <button
            type="button"
            className="join-table-btn"
            onClick={() => onOpenGameCenter(currentTablemate)}
          >
            Mời bạn
          </button>
        </div>
      ) : (
        <div className="tablemate-tip-banner">
          {openRoomsCount > 0
            ? `🔥 Đang có ${openRoomsCount} phòng chơi công khai chờ người thứ 2!`
            : 'Mở Mini-Game Center để chơi đơn hoặc tạo phòng mời bạn bè trong quán nhé!'}
        </div>
      )}

      <button
        type="button"
        className="confirm-button full mg-open-big-btn"
        onClick={() => onOpenGameCenter(null)}
      >
        <Gamepad2 size={16} /> Mở Trung Tâm 6 Mini-Games
      </button>

      <div className="mg-sidebar-preview-list">
        {MINI_GAMES_CATALOG.map((g) => (
          <button
            key={g.id}
            type="button"
            className="mg-sidebar-card"
            onClick={() => onOpenGameCenter(null)}
          >
            <img src={g.imageUrl} alt={g.title} />
            <div>
              <strong>{g.title}</strong>
              <small>{g.subtitleKo} · Chơi đơn &amp; Chung</small>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function MusicRoomPanel({
  musicState,
  initialCooldownSec = 0,
  rainOn,
  onToggleRain,
  vinylOn = true,
  onToggleVinyl,
  cafeAmbianceOn = true,
  onToggleCafeAmbiance,
  onNotice,
}: {
  musicState: MusicRoomState
  initialCooldownSec?: number
  rainOn: boolean
  onToggleRain: () => void
  vinylOn?: boolean
  onToggleVinyl?: () => void
  cafeAmbianceOn?: boolean
  onToggleCafeAmbiance?: () => void
  onNotice: (text: string, kind?: 'success' | 'tip') => void
}) {
  const [elapsedSec, setElapsedSec] = useState(0)
  const [volume, setVolume] = useState(() => Math.round(cafeMusicEngine.getVolume() * 100))
  const [ambientVol, setAmbientVol] = useState(() => Math.round(cafeMusicEngine.getAmbientVolume() * 100))
  const [videoOn, setVideoOn] = useState(() => cafeMusicEngine.isVideoVisible())
  const [showSuggestForm, setShowSuggestForm] = useState(false)
  const [sugTitle, setSugTitle] = useState('')
  const [sugAudioUrl, setSugAudioUrl] = useState('')
  const [isInspecting, setIsInspecting] = useState(false)
  const [inspectedInfo, setInspectedInfo] = useState<{
    title?: string
    author?: string
    durationSec?: number
  } | null>(null)
  const [cooldownSec, setCooldownSec] = useState<number>(initialCooldownSec)

  useEffect(() => {
    void multiplayerClient.getMusicCooldown().then((sec) => {
      if (sec > 0) setCooldownSec(sec)
    })
  }, [])

  useEffect(() => {
    if (cooldownSec <= 0) return
    const id = window.setInterval(() => {
      setCooldownSec((c) => Math.max(0, c - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldownSec])

  useEffect(() => {
    const update = () => {
      if (!musicState.isPlaying) return
      const sec = Math.min(
        musicState.currentTrack.durationSec,
        Math.max(0, Math.floor((Date.now() - musicState.startedAtMs) / 1000)),
      )
      setElapsedSec(sec)
    }
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [musicState.startedAtMs, musicState.isPlaying, musicState.currentTrack.durationSec])

  const handleVote = async (trackId: string) => {
    const res = await multiplayerClient.voteTrack(trackId)
    if (!res.ok && res.reason) {
      onNotice(res.reason)
    } else {
      onNotice('Đã thả tim ủng hộ bài hát đề xuất! ❤️', 'success')
    }
  }

  const handleUrlChange = (url: string) => {
    setSugAudioUrl(url)
    const ytId = extractYouTubeId(url)
    if (ytId) {
      setIsInspecting(true)
      void fetch(apiUrl(`/api/music/inspect?url=${encodeURIComponent(url.trim())}`))
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.info) {
            setInspectedInfo(data.info)
            setSugTitle((prev) => (prev.trim() ? prev : (data.info.title || '')))
          }
        })
        .catch(() => {})
        .finally(() => setIsInspecting(false))
    } else {
      setInspectedInfo(null)
    }
  }

  const handleSuggestSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (cooldownSec > 0) {
      onNotice(`Mỗi 10 phút được đề xuất 1 bài hát. Vui lòng đợi ${formatSec(cooldownSec)} nữa nhé!`)
      return
    }

    const cleanUrl = sugAudioUrl.trim()
    const ytId = extractYouTubeId(cleanUrl)
    if (!cleanUrl || !ytId) {
      onNotice('Vui lòng dán link YouTube hợp lệ (VD: https://youtu.be/... hoặc youtube.com/watch?v=...) nhé!', 'tip')
      return
    }

    const cleanTitle = (sugTitle.trim() || inspectedInfo?.title || '').trim()
    if (!cleanTitle) {
      onNotice('Hãy nhập tên bài hát bạn muốn đề xuất cho quán nhé!')
      return
    }

    const res = await multiplayerClient.suggestTrack({
      title: cleanTitle,
      artist: inspectedInfo?.author || 'YouTube',
      style: 'lofi-rain',
      audioUrl: cleanUrl,
    })
    if (!res.ok) {
      if (res.cooldownSec && res.cooldownSec > 0) {
        setCooldownSec(res.cooldownSec)
      }
      onNotice(res.reason || 'Không thể gửi đề xuất bài hát.')
      return
    }
    setCooldownSec(res.cooldownSec ?? 600)
    setSugTitle('')
    setSugAudioUrl('')
    setInspectedInfo(null)
    setShowSuggestForm(false)
    onNotice('Đã gửi đề xuất bài hát tới K-CHILL Radio (+12 XP)! Bài hát đang chờ duyệt trước khi phát nhé 🎵', 'success')
  }

  const pct = Math.min(100, (elapsedSec / Math.max(1, musicState.currentTrack.durationSec)) * 100)

  return (
    <div className="sidebar-scroll-panel">
      <div className="music-now-card">
        <div className="music-now-top">
          <span className="music-disc">
            <Music size={16} />
          </span>
          <div className="music-now-meta">
            <span className="admin-dj-tag">K-CHILL RADIO CHILL VIBES</span>
            <strong>{musicState.currentTrack.title}</strong>
            <small>
              {musicState.currentTrack.artist} · Tuyển chọn bởi: <b>{musicState.currentTrack.suggestedBy ?? 'K-CHILL Café'}</b>
            </small>
          </div>
        </div>

        <div className="music-progress-bar">
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="music-time-row">
          <span>{formatSec(elapsedSec)}</span>
          <span>{musicState.isPlaying ? musicState.currentTrack.mood : '⏸ Đài phát đang tạm dừng'}</span>
          <span>{formatSec(musicState.currentTrack.durationSec)}</span>
        </div>

        <div className="music-user-tools">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`music-ctrl-btn ${rainOn ? 'active' : ''}`}
              onClick={onToggleRain}
              title="Bật/tắt tiếng mưa rơi bên cửa sổ quán cho riêng bạn"
            >
              <CloudRain size={13} /> Mưa: {rainOn ? 'Bật' : 'Tắt'}
            </button>
            <button
              type="button"
              className={`music-ctrl-btn ${vinylOn ? 'active' : ''}`}
              onClick={onToggleVinyl}
              title="Bật/tắt tiếng đĩa than lofi vintage lách tách"
            >
              <Disc3 size={13} /> Đĩa than: {vinylOn ? 'Bật' : 'Tắt'}
            </button>
            <button
              type="button"
              className={`music-ctrl-btn ${cafeAmbianceOn ? 'active' : ''}`}
              onClick={onToggleCafeAmbiance}
              title="Bật/tắt không gian quán (tiếng ly tách sứ lách cách nhẹ nhàng)"
            >
              <Coffee size={13} /> Quán: {cafeAmbianceOn ? 'Bật' : 'Tắt'}
            </button>
            <button
              type="button"
              className={`music-ctrl-btn ${videoOn ? 'active' : ''}`}
              onClick={() => {
                const next = !videoOn
                setVideoOn(next)
                cafeMusicEngine.setVideoVisible(next)
              }}
              title="Xem video YouTube / MV ca nhạc trực tiếp góc màn hình"
            >
              <Tv size={13} /> MV: {videoOn ? 'Hiện' : 'Ẩn'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '4px' }}>
            <label className="music-vol-row" title="Âm lượng bài hát (YouTube / Lo-fi)">
              <Volume2 size={14} />
              <span style={{ fontSize: '11px', width: '42px', color: 'var(--c-sand-400)' }}>Nhạc:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVolume(v)
                  cafeMusicEngine.setVolume(v / 100)
                }}
              />
              <span>{volume}%</span>
            </label>
            <label className="music-vol-row" title="Âm lượng không gian chill (Mưa cửa kính, đĩa than, ly tách)">
              <Sliders size={14} />
              <span style={{ fontSize: '11px', width: '42px', color: 'var(--c-sand-400)' }}>Chill:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={ambientVol}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setAmbientVol(v)
                  cafeMusicEngine.setAmbientVolume(v / 100)
                }}
              />
              <span>{ambientVol}%</span>
            </label>
          </div>
        </div>
      </div>

      {/* 10-Minute Cooldown Song Suggestion Box */}
      <div className="dj-banner-row">
        <div>
          <small>ĐỀ XUẤT NHẠC CHO QUÁN (1 BÀI / 10 PHÚT · DANH SÁCH CHỜ)</small>
          <strong>
            {cooldownSec > 0 ? (
              <>
                <Clock size={13} /> Đề xuất tiếp sau {formatSec(cooldownSec)}
              </>
            ) : (
              'Bạn đang có 1 lượt gửi bài cho K-CHILL Radio!'
            )}
          </strong>
        </div>
        <button
          type="button"
          disabled={cooldownSec > 0}
          onClick={() => setShowSuggestForm((s) => !s)}
        >
          {cooldownSec > 0 ? formatSec(cooldownSec) : showSuggestForm ? 'Đóng' : '+ Đề xuất'}
        </button>
      </div>

      {showSuggestForm && cooldownSec <= 0 && (
        <form className="suggest-song-form" onSubmit={handleSuggestSubmit}>
          <div className="suggest-form-header">
            <span className="suggest-form-title">Đề xuất nhạc YouTube</span>
            <small>Chỉ cần link YouTube &amp; tên bài hát</small>
          </div>

          <div className="suggest-field-block">
            <label className="suggest-field-label">
              <span className="suggest-step-badge">1</span> Link YouTube (Bắt buộc):
            </label>
            <input
              type="text"
              required
              value={sugAudioUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Dán link (VD: https://youtu.be/... hoặc youtube.com/watch?v=...)"
              autoFocus
            />
            {isInspecting && (
              <span className="suggest-inspect-status">⏳ Đang đọc tiêu đề &amp; thời lượng video...</span>
            )}
            {inspectedInfo && !isInspecting && (
              <div className="suggest-inspect-success">
                <span>🎬 {inspectedInfo.title || 'Video YouTube'}</span>
                {inspectedInfo.durationSec && (
                  <b style={{ marginLeft: '4px' }}>
                    ({Math.floor(inspectedInfo.durationSec / 60)}:
                    {String(inspectedInfo.durationSec % 60).padStart(2, '0')})
                  </b>
                )}
              </div>
            )}
          </div>

          <div className="suggest-field-block">
            <label className="suggest-field-label">
              <span className="suggest-step-badge">2</span> Tên bài hát:
            </label>
            <input
              type="text"
              maxLength={70}
              required
              value={sugTitle}
              onChange={(e) => setSugTitle(e.target.value)}
              placeholder="Tên bài hát (VD: IU - Through the Night / 봄날 - BTS)..."
            />
          </div>

          <button type="submit" className="side-btn-primary full suggest-submit-btn">
            <Plus size={14} /> Gửi đề xuất bài hát (+12 XP)
          </button>

          <small className="suggest-form-hint">
            💡 Bài hát sẽ chuyển vào hàng đợi duyệt. Sau khi duyệt, bài hát kèm hiệu ứng mưa rơi &amp; tiếng đĩa than lofi sẽ tự động phát trên toàn quán!
          </small>
        </form>
      )}

      {/* Pending User Suggestions Waiting for Approval */}
      {Boolean(musicState.pendingQueue?.length) && (
        <>
          <div className="queue-header-row" style={{ marginTop: '12px' }}>
            <strong style={{ color: '#d97706' }}>
              ⏳ Bài hát trong danh sách chờ phát ({musicState.pendingQueue?.length})
            </strong>
          </div>
          <div className="music-queue-list">
            {musicState.pendingQueue?.map((track) => (
              <div key={track.id} className="music-queue-item" style={{ borderLeft: '3px solid #f59e0b' }}>
                <div className="queue-item-meta">
                  <strong>
                    {track.title}
                    <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px' }}>
                      Chờ duyệt
                    </span>
                  </strong>
                  <small>
                    {track.artist} · Đề xuất bởi {track.suggestedBy ?? 'Khách'}
                  </small>
                </div>
                <div className="queue-item-actions">
                  <button
                    type="button"
                    className="vote-heart-btn"
                    onClick={() => void handleVote(track.id)}
                    title="Thả tim ủng hộ để ưu tiên phát sớm"
                  >
                    <Heart size={12} fill="currentColor" /> {track.votes ?? 1}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Approved Queue Ready to Play Next */}
      <div className="queue-header-row" style={{ marginTop: '12px' }}>
        <strong>🎶 Hàng đợi đã duyệt chuẩn bị phát ({musicState.queue.length})</strong>
      </div>

      <div className="music-queue-list">
        {musicState.queue.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#a89487', textAlign: 'center', padding: '10px 0' }}>
            Chưa có bài hát nào trong hàng đợi. Hãy đề xuất bài hát yêu thích của bạn!
          </p>
        ) : (
          musicState.queue.map((track) => (
            <div key={track.id} className="music-queue-item">
              <div className="queue-item-meta">
                <strong>
                  {track.title}
                  <span style={{ fontSize: '10px', background: '#d1fae5', color: '#065f46', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px' }}>
                    Đã duyệt
                  </span>
                </strong>
                <small>
                  {track.artist} · Đề xuất bởi {track.suggestedBy ?? 'Khách'}
                </small>
              </div>
              <div className="queue-item-actions">
                <button
                  type="button"
                  className="vote-heart-btn"
                  onClick={() => void handleVote(track.id)}
                  title="Thả tim ủng hộ bài này"
                >
                  <Heart size={12} fill="currentColor" /> {track.votes ?? 1}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const SELF_STUDY_MILESTONES = [
  { minutes: 5, label: '5 phút', xp: 15 },
  { minutes: 15, label: '15 phút', xp: 35 },
  { minutes: 30, label: '30 phút', xp: 70 },
  { minutes: 60, label: '60 phút', xp: 120 },
]

export function KoreanLearningPanel({
  profile,
  onOpenMenu,
  onNotice,
}: {
  profile: PlayerLearningProfile
  defaultLevel?: string
  onOpenMenu: () => void
  onNotice: (text: string, kind?: 'success' | 'tip') => void
}) {
  const [tab, setTab] = useState<'self-study' | 'vocab' | 'achievements'>('self-study')
  const [topic, setTopic] = useState<VocabTopic | 'Tất cả'>('Tất cả')
  const [cardIndex, setCardIndex] = useState(0)

  // Timed Self-Study Session state (persisted in sessionStorage so switching tabs inside drawer keeps timer!)
  const [isStudying, setIsStudying] = useState<boolean>(() => sessionStorage.getItem('kchill_study_running') === '1')
  const [studyElapsedSec, setStudyElapsedSec] = useState<number>(() => {
    return Number(sessionStorage.getItem('kchill_study_sec') || '0')
  })
  const [targetMinutes, setTargetMinutes] = useState<number>(30)
  const [claimedMilestones, setClaimedMilestones] = useState<number[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('kchill_study_claimed') || '[]') as number[]
    } catch {
      return []
    }
  })

  useEffect(() => {
    sessionStorage.setItem('kchill_study_running', isStudying ? '1' : '0')
  }, [isStudying])

  useEffect(() => {
    if (!isStudying) return
    const id = window.setInterval(() => {
      setStudyElapsedSec((prev) => {
        const next = prev + 1
        sessionStorage.setItem('kchill_study_sec', String(next))
        const reachedMins = Math.floor(next / 60)
        for (const m of SELF_STUDY_MILESTONES) {
          if (reachedMins >= m.minutes && !claimedMilestones.includes(m.minutes)) {
            const updatedClaimed = [...claimedMilestones, m.minutes]
            setClaimedMilestones(updatedClaimed)
            sessionStorage.setItem('kchill_study_claimed', JSON.stringify(updatedClaimed))
            multiplayerClient.awardBonusXp({ xp: m.xp })
            onNotice(`🎯 Chạm mốc tự học ${m.label}! Nhận thưởng +${m.xp} XP!`, 'success')
          }
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [isStudying, claimedMilestones, onNotice])

  const words = useMemo(() => {
    return topic === 'Tất cả' ? SHARED_KOREAN_VOCAB : SHARED_KOREAN_VOCAB.filter((w) => w.topic === topic)
  }, [topic])

  useEffect(() => {
    setCardIndex(0)
  }, [topic])

  const currentWord = words[cardIndex % words.length]
  const isLearned = currentWord ? profile.wordsLearnedIds.includes(currentWord.id) : false

  const toggleLearned = () => {
    if (!currentWord) return
    const nextState = !isLearned
    multiplayerClient.toggleLearnedWord(currentWord.id, nextState)
    if (nextState) {
      playVocabPronunciation(currentWord)
      onNotice(`Đã ghi nhớ từ “${currentWord.hangul}” (${currentWord.meaningVi}) +10 XP! 📖`, 'success')
    }
  }

  const studyMinutesFloat = studyElapsedSec / 60
  const progressPct = Math.min(100, (studyMinutesFloat / targetMinutes) * 100)

  return (
    <div className="sidebar-scroll-panel">
      <div className="learn-stats-strip">
        <div>
          <b>{profile.wordsLearnedIds.length}</b>
          <small>Từ thuộc</small>
        </div>
        <div>
          <b>{profile.studyMinutes + Math.floor(studyElapsedSec / 60)}p</b>
          <small>Phút tự học</small>
        </div>
        <div>
          <b>{profile.gamesPlayed}</b>
          <small>Ván game</small>
        </div>
        <div>
          <b>{profile.xp}</b>
          <small>Tổng XP</small>
        </div>
      </div>

      <div className="learn-subtabs three">
        <button
          type="button"
          className={tab === 'self-study' ? 'active' : ''}
          onClick={() => setTab('self-study')}
        >
          <Clock size={13} /> Tự học
        </button>
        <button
          type="button"
          className={tab === 'vocab' ? 'active' : ''}
          onClick={() => setTab('vocab')}
        >
          <BookOpen size={13} /> 10 Chủ đề
        </button>
        <button
          type="button"
          className={tab === 'achievements' ? 'active' : ''}
          onClick={() => setTab('achievements')}
        >
          <Award size={13} /> Huy hiệu
        </button>
      </div>

      {tab === 'self-study' ? (
        <div className="self-study-box">
          <div className="self-study-timer-card">
            <span className="self-study-kicker">ĐỒNG HỒ TỰ HỌC TIẾNG HÀN · 자습 타이머</span>
            <div className="self-study-clock">{formatSec(studyElapsedSec)}</div>
            <small>Mục tiêu phiên học: {targetMinutes} phút</small>

            <div className="self-study-goal-pills">
              {[15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={targetMinutes === m ? 'active' : ''}
                  onClick={() => setTargetMinutes(m)}
                >
                  Mốc {m}p
                </button>
              ))}
            </div>

            <div className="music-progress-bar">
              <div style={{ width: `${progressPct}%` }} />
            </div>

            <div className="self-study-btns">
              <button
                type="button"
                className="confirm-button"
                onClick={() => setIsStudying((s) => !s)}
              >
                {isStudying ? <Pause size={15} /> : <Play size={15} />}
                {isStudying ? 'Tạm nghỉ' : studyElapsedSec > 0 ? 'Học tiếp' : 'Bắt đầu tự học'}
              </button>
              <button
                type="button"
                className="secondary-modal-btn"
                onClick={() => {
                  setIsStudying(false)
                  setStudyElapsedSec(0)
                  sessionStorage.setItem('kchill_study_sec', '0')
                }}
                title="Đặt lại đồng hồ phiên này"
              >
                <RotateCcw size={14} /> Đặt lại
              </button>
            </div>
          </div>

          <div className="milestones-card">
            <strong>Mốc thời gian tự học nhận thưởng XP:</strong>
            <div className="milestones-list">
              {SELF_STUDY_MILESTONES.map((ms) => {
                const done = claimedMilestones.includes(ms.minutes) || studyElapsedSec >= ms.minutes * 60
                return (
                  <div key={ms.minutes} className={`milestone-item ${done ? 'done' : ''}`}>
                    <span className="ms-dot">{done ? '✓' : `${ms.minutes}p`}</span>
                    <div>
                      <strong>Mốc tự học {ms.label}</strong>
                      <small>{done ? 'Đã hoàn thành mốc này!' : 'Giữ tập trung để mở khóa'}</small>
                    </div>
                    <b>+{ms.xp} XP</b>
                  </div>
                )
              })}
            </div>
          </div>

          <button type="button" className="side-btn-outline-full" onClick={() => setTab('vocab')}>
            <BookOpen size={14} /> Mở Flashcard 10 chủ đề TOPIK ngay trong lúc tự học
          </button>
        </div>
      ) : tab === 'vocab' ? (
        <>
          <select
            className="topic-select-box"
            value={topic}
            onChange={(e) => setTopic(e.target.value as VocabTopic | 'Tất cả')}
          >
            <option value="Tất cả">Tất cả 10 chủ đề ({SHARED_KOREAN_VOCAB.length} từ)</option>
            {VOCAB_TOPICS.map((t) => (
              <option key={t} value={t}>
                Chủ đề: {t}
              </option>
            ))}
          </select>

          {currentWord && (
            <div className={`vocab-flashcard ${isLearned ? 'learned' : ''}`}>
              <div className="flashcard-top">
                <span className="vocab-cat-tag">
                  {currentWord.topic} · {currentWord.level}
                </span>
                <span className="vocab-idx">
                  {(cardIndex % words.length) + 1} / {words.length}
                </span>
              </div>

              <div className="flashcard-hangul-row">
                <h3>{currentWord.hangul}</h3>
                <button
                  type="button"
                  className="tts-round-btn"
                  onClick={() => playVocabPronunciation(currentWord)}
                  title="Nghe phát âm tiếng Hàn"
                >
                  <Volume2 size={16} />
                </button>
              </div>

              <div className="flashcard-rom">[{currentWord.romanization}]</div>
              <div className="flashcard-meaning">{currentWord.meaningVi}</div>

              <div className="flashcard-example" onClick={() => speakKorean(currentWord.exampleKo)}>
                <strong>
                  <Volume2 size={12} /> {currentWord.exampleKo}
                </strong>
                <small>{currentWord.exampleVi}</small>
              </div>

              <div className="flashcard-Controls">
                <button
                  type="button"
                  className="card-nav-btn"
                  onClick={() => setCardIndex((i) => (i - 1 + words.length) % words.length)}
                  aria-label="Từ trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className={`mark-learned-btn ${isLearned ? 'done' : ''}`}
                  onClick={toggleLearned}
                >
                  <Check size={14} />
                  {isLearned ? 'Đã thuộc từ này' : 'Đánh dấu đã thuộc (+10 XP)'}
                </button>
                <button
                  type="button"
                  className="card-nav-btn"
                  onClick={() => setCardIndex((i) => (i + 1) % words.length)}
                  aria-label="Từ tiếp theo"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          <button type="button" className="side-btn-outline-full" onClick={onOpenMenu}>
            <Coffee size={13} /> Thực hành gọi món tại Quầy Menu Hàn
          </button>
        </>
      ) : (
        <div className="achievements-list">
          {ACHIEVEMENTS_CATALOG.map((ach) => {
            const unlocked = profile.achievements.includes(ach.code)
            return (
              <div key={ach.code} className={`achievement-row ${unlocked ? 'unlocked' : ''}`}>
                <span className="ach-badge">{ach.badge}</span>
                <div>
                  <strong>
                    {ach.title} <em>+{ach.xpReward} XP</em>
                  </strong>
                  <small>{ach.description}</small>
                </div>
                {unlocked && <Check size={14} className="ach-check" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SettingsSidebarPanel({
  soundOn,
  rainOn,
  vinylOn = true,
  cafeAmbianceOn = true,
  onToggleSound,
  onToggleRain,
  onToggleVinyl,
  onToggleCafeAmbiance,
  onOpenAvatarModal,
  onOpenCafeMenu,
  onOpenRulesModal,
}: {
  soundOn: boolean
  rainOn: boolean
  vinylOn?: boolean
  cafeAmbianceOn?: boolean
  onToggleSound: () => void
  onToggleRain: () => void
  onToggleVinyl?: () => void
  onToggleCafeAmbiance?: () => void
  onOpenAvatarModal: () => void
  onOpenCafeMenu: () => void
  onOpenRulesModal?: () => void
}) {
  return (
    <div className="sidebar-scroll-panel">
      <div className="settings-list-card">
        <div className="setting-toggle-row">
          <div>
            <strong>Âm thanh quán &amp; phát âm</strong>
            <small>Nhạc nền lofi, hiệu ứng game &amp; âm thanh</small>
          </div>
          <button type="button" className={`pill-switch ${soundOn ? 'on' : ''}`} onClick={onToggleSound}>
            {soundOn ? 'Đang bật' : 'Đã tắt'}
          </button>
        </div>

        <div className="setting-toggle-row">
          <div>
            <strong>Tiếng mưa rơi cửa kính</strong>
            <small>Âm thanh mưa Seoul tí tách ngoài khung cửa</small>
          </div>
          <button type="button" className={`pill-switch ${rainOn ? 'on' : ''}`} onClick={onToggleRain}>
            {rainOn ? 'Đang bật' : 'Đã tắt'}
          </button>
        </div>

        <div className="setting-toggle-row">
          <div>
            <strong>Đĩa than Lo-Fi vintage</strong>
            <small>Tiếng đĩa than lách tách ấm áp mộc mạc</small>
          </div>
          <button type="button" className={`pill-switch ${vinylOn ? 'on' : ''}`} onClick={onToggleVinyl}>
            {vinylOn ? 'Đang bật' : 'Đã tắt'}
          </button>
        </div>

        <div className="setting-toggle-row">
          <div>
            <strong>Không gian quán cà phê</strong>
            <small>Tiếng ly tách sứ lách cách nhẹ nhàng thi thoảng</small>
          </div>
          <button type="button" className={`pill-switch ${cafeAmbianceOn ? 'on' : ''}`} onClick={onToggleCafeAmbiance}>
            {cafeAmbianceOn ? 'Đang bật' : 'Đã tắt'}
          </button>
        </div>
      </div>

      <button type="button" className="side-btn-primary full" onClick={onOpenAvatarModal}>
        Đổi tên hiển thị, TOPIK &amp; Avatar
      </button>

      <button type="button" className="side-btn-outline-full" onClick={onOpenCafeMenu}>
        <Coffee size={14} /> Mở Thực đơn K-CHILL (메뉴판)
      </button>

      <button type="button" className="side-btn-outline-full" onClick={onOpenRulesModal}>
        <Shield size={14} /> Nội quy quán &amp; Pháp lý phi thương mại 📜
      </button>
    </div>
  )
}

export function CafeMenuModal({
  onClose,
  onOrder,
  onOpenFeedback,
}: {
  onClose: () => void
  onOrder: (item: CafeMenuItem) => void
  onOpenFeedback?: () => void
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="avatar-modal cafe-menu-modal" role="dialog" aria-modal="true" aria-labelledby="cafe-menu-title">
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <div className="modal-kicker">
          <Coffee size={15} /> K-CHILL BARISTA COUNTER · 메뉴판
        </div>
        <h2 id="cafe-menu-title">Thực đơn Quán &amp; Luyện gọi món ☕</h2>
        <p>Nghe mẫu câu gọi món chuẩn Hàn và đặt đồ uống yêu thích cho nhân vật của bạn (+10 XP)!</p>

        <div className="cafe-menu-grid">
          {KOREAN_CAFE_MENU.map((item) => {
            const imgUrl = SCENE_IMAGES[item.assetKey] ?? SCENE_IMAGES['item-latte']
            return (
              <div key={item.id} className="cafe-menu-card">
                <div className="menu-card-top">
                  <img src={imgUrl} alt={item.nameVi} />
                  <div>
                    <span className="menu-price">{item.priceWon}</span>
                    <strong>{item.hangul}</strong>
                    <small>{item.nameVi}</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="menu-phrase-box"
                  onClick={() => speakKorean(item.orderPhraseKo)}
                  title="Bấm để nghe câu gọi món tiếng Hàn"
                >
                  <Volume2 size={14} />
                  <span>
                    <b>“{item.orderPhraseKo}”</b>
                    <em>{item.orderPhraseVi}</em>
                  </span>
                </button>
                <button
                  type="button"
                  className="confirm-button full"
                  onClick={() => onOrder(item)}
                >
                  Gọi món bằng tiếng Hàn (+10 XP)
                </button>
              </div>
            )
          })}
        </div>

        {/* Feedback Section at bottom of Cafe Menu */}
        {onOpenFeedback && (
          <div className="cafe-menu-support-footer">
            <div className="menu-support-left">
              <span className="menu-heart-icon"><MessageSquareQuote size={14} color="#e07a5f" /></span>
              <div>
                <strong>Hòm thư góp ý quán 💌</strong>
                <small>Góp ý tính năng mới hoặc đề xuất món nước yêu thích cho quán</small>
              </div>
            </div>
            <div className="menu-support-actions">
              <button
                type="button"
                className="menu-feedback-btn"
                onClick={() => {
                  onClose()
                  onOpenFeedback()
                }}
              >
                <MessageSquareQuote size={12} /> Góp ý quán
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const INITIAL_CLIENT_MUSIC_STATE: MusicRoomState = {
  currentTrack: DEFAULT_MUSIC_TRACKS[0],
  startedAtMs: Date.now(),
  isPlaying: true,
  djUserId: 'admin',
  djName: 'K-CHILL Radio',
  queue: DEFAULT_MUSIC_TRACKS.slice(1),
}
