import { useEffect, useState, type FormEvent } from 'react'
import { io } from 'socket.io-client'
import {
  ArrowLeft,
  Armchair,
  Gamepad2,
  Megaphone,
  Mic,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react'
import type { MusicTrackDef } from '../data/koreanVocabulary'
import { extractYouTubeId } from '../services/cafeMusicEngine'
import { getTableIdForSeat } from '../domain/seatUtils'
import type { AdminAnnouncement, CafeSeat, MusicRoomState, RoomPlayerState } from '../domain/types'
import type { MiniGameLobbyRoom } from '../games/types'

type AdminOverviewData = {
  onlineRealPlayers: number
  totalCharacters: number
  maxPlayers: number
  occupiedSeats: number
  totalSeats: number
  activeVoiceSessions: number
  activeGames: number
  musicState: MusicRoomState
  musicLibrary: MusicTrackDef[]
  players: RoomPlayerState[]
  seats: CafeSeat[]
  miniGameRooms: MiniGameLobbyRoom[]
  recentAnnouncements: AdminAnnouncement[]
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

export function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null)
  const [connected, setConnected] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Custom song form
  const [customTitle, setCustomTitle] = useState('')
  const [customArtist, setCustomArtist] = useState('')
  const [customStyle, setCustomStyle] = useState<MusicTrackDef['style']>('lofi-rain')
  const [customAudioUrl, setCustomAudioUrl] = useState('')
  const [customDuration, setCustomDuration] = useState('')
  const [inspectingYt, setInspectingYt] = useState(false)

  // Announcement form
  const [announceText, setAnnounceText] = useState('')

  const showAdminToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((c) => (c === msg ? null : c)), 3600)
  }

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview')
      const json = (await res.json()) as { ok: boolean; overview?: AdminOverviewData }
      if (json.ok && json.overview) setOverview(json.overview)
    } catch {
      // Ignore fetch errors while reconnecting
    }
  }

  useEffect(() => {
    void fetchOverview()
    const sock = io({ transports: ['websocket', 'polling'] })
    sock.on('connect', () => {
      setConnected(true)
      sock.emit('admin:subscribe', (res: { ok?: boolean; overview?: AdminOverviewData }) => {
        if (res?.overview) setOverview(res.overview)
      })
    })
    sock.on('disconnect', () => setConnected(false))
    sock.on('admin:overview', (data: AdminOverviewData) => {
      setOverview(data)
    })
    return () => {
      sock.disconnect()
    }
  }, [])

  const postAdminMusic = async (body: Record<string, unknown>, okMessage?: string) => {
    try {
      const res = await fetch('/api/admin/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { ok: boolean; overview?: AdminOverviewData; reason?: string }
      if (json.ok && json.overview) {
        setOverview(json.overview)
        if (okMessage) showAdminToast(okMessage)
      } else if (json.reason) {
        showAdminToast(json.reason)
      }
    } catch {
      showAdminToast('Lỗi kết nối tới máy chủ Admin.')
    }
  }

  const parseDurationSec = (val: string): number | undefined => {
    const clean = val.trim()
    if (!clean) return undefined
    if (clean.includes(':')) {
      const parts = clean.split(':').map(Number)
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1]
      }
    }
    const num = Number(clean)
    return !isNaN(num) && num >= 15 ? num : undefined
  }

  const handleInspectUrl = async (url: string) => {
    setCustomAudioUrl(url)
    const ytId = extractYouTubeId(url)
    if (!ytId) return
    setInspectingYt(true)
    try {
      const res = await fetch(`/api/admin/music-inspect?url=${encodeURIComponent(url)}`)
      const data = (await res.json()) as {
        ok: boolean
        info?: { title?: string; author?: string; durationSec: number }
      }
      if (data.ok && data.info) {
        if (!customTitle.trim() && data.info.title) setCustomTitle(decodeHtmlEntities(data.info.title))
        if (!customArtist.trim() && data.info.author) setCustomArtist(decodeHtmlEntities(data.info.author))
        if (data.info.durationSec && data.info.durationSec >= 15) {
          const m = Math.floor(data.info.durationSec / 60)
          const s = String(data.info.durationSec % 60).padStart(2, '0')
          setCustomDuration(`${m}:${s}`)
        }
      }
    } catch {
      // Ignore
    } finally {
      setInspectingYt(false)
    }
  }

  const handleSubmitCustomTrack = async (playNow: boolean) => {
    const cleanUrl = customAudioUrl.trim()
    const ytId = extractYouTubeId(cleanUrl)
    const effectiveTitle = decodeHtmlEntities(
      customTitle.trim() || (ytId ? `YouTube Track (${ytId})` : cleanUrl ? 'Bản Nhạc Admin' : ''),
    )

    if (!effectiveTitle) {
      showAdminToast('Vui lòng nhập tên bài hát hoặc dán link YouTube/MP3!')
      return
    }

    const parsedDur = parseDurationSec(customDuration)

    await postAdminMusic(
      {
        action: 'add-custom',
        customTrack: {
          title: effectiveTitle,
          artist: customArtist.trim() || (ytId ? 'YouTube Audio' : 'Admin Playlist'),
          style: customStyle,
          audioUrl: cleanUrl || undefined,
          durationSec: parsedDur,
          playNow,
        },
      },
      playNow
        ? ytId
          ? `🎵 Đã kết nối và phát nhạc YouTube (${ytId}) với thời lượng ${customDuration || 'tự động'}!`
          : `🎵 Đã phát ngay bài “${effectiveTitle}” ra ngoài quán!`
        : `🎵 Đã thêm bài “${effectiveTitle}” vào hàng đợi phát tiếp theo!`,
    )
    setCustomTitle('')
    setCustomArtist('')
    setCustomAudioUrl('')
    setCustomDuration('')
  }

  const handleUserAction = async (userId: string, username: string, action: 'force-stand' | 'kick') => {
    try {
      const res = await fetch('/api/admin/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      })
      const json = (await res.json()) as { ok: boolean; overview?: AdminOverviewData; reason?: string }
      if (json.ok && json.overview) {
        setOverview(json.overview)
        showAdminToast(
          action === 'kick'
            ? `Đã ngắt kết nối ${username} khỏi quán.`
            : `Đã giải phóng ghế ngồi của ${username}.`,
        )
      }
    } catch {
      showAdminToast('Không thể thực hiện thao tác người dùng.')
    }
  }

  const handleBroadcastAnnouncement = async (e: FormEvent) => {
    e.preventDefault()
    if (!announceText.trim()) return
    try {
      const res = await fetch('/api/admin/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: announceText.trim() }),
      })
      const json = (await res.json()) as { ok: boolean; overview?: AdminOverviewData }
      if (json.ok && json.overview) {
        setOverview(json.overview)
        setAnnounceText('')
        showAdminToast('📢 Đã phát thông báo toàn quán thành công!')
      }
    } catch {
      showAdminToast('Không thể gửi thông báo.')
    }
  }

  const realPlayers = overview?.players.filter((p) => !p.isNpc) ?? []
  const npcPlayers = overview?.players.filter((p) => p.isNpc) ?? []

  return (
    <div className="admin-page-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <span className="admin-shield">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h1>K-CHILL Café · Trung Tâm Quản Trị Admin</h1>
            <small>
              <i className={connected ? 'live' : ''} />{' '}
              {connected ? 'Đồng bộ Realtime trực tiếp với quán' : 'Đang kết nối Socket…'}
            </small>
          </div>
        </div>

        <div className="admin-top-actions">
          <button type="button" className="secondary-modal-btn" onClick={() => void fetchOverview()}>
            <RefreshCw size={14} /> Làm mới
          </button>
          <a href="/" className="confirm-button" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={15} /> Ra ngoài Quán Cà Phê
          </a>
        </div>
      </header>

      {toast && <div className="admin-toast">{toast}</div>}

      {/* KPI Metrics Row */}
      <section className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <Users size={20} />
          <div>
            <span>User thật đang Online</span>
            <strong>
              {overview?.onlineRealPlayers ?? 0} / {overview?.maxPlayers ?? 30}
            </strong>
            <small>{npcPlayers.length > 0 ? '1 Barista quầy pha chế ☕' : 'Không có NPC'}</small>
          </div>
        </div>

        <div className="admin-kpi-card">
          <Armchair size={20} />
          <div>
            <span>Trạng thái Ghế ngồi</span>
            <strong>
              {overview?.occupiedSeats ?? 0} / {overview?.totalSeats ?? 30} ghế
            </strong>
            <small>Còn {(overview?.totalSeats ?? 30) - (overview?.occupiedSeats ?? 0)} ghế trống</small>
          </div>
        </div>

        <div className="admin-kpi-card">
          <Music size={20} />
          <div>
            <span>Bài nhạc đang phát ngoài quán</span>
            <strong>{overview?.musicState.currentTrack.title ?? 'Đang tải…'}</strong>
            <small>
              {overview?.musicState.isPlaying ? '▶ Đang phát' : '⏸ Đang tạm dừng'} ·{' '}
              {overview?.musicState.queue.length ?? 0} bài khách đề xuất
            </small>
          </div>
        </div>

        <div className="admin-kpi-card">
          <Gamepad2 size={20} />
          <div>
            <span>Phiên Voice 1-1 &amp; Phòng Game</span>
            <strong>
              {overview?.activeVoiceSessions ?? 0} Voice · {overview?.activeGames ?? 0} Game
            </strong>
            <small>Hoạt động tương tác trực tiếp</small>
          </div>
        </div>
      </section>

      <div className="admin-main-columns">
        {/* LEFT COLUMN: FULL MUSIC CONTROL + SUGGESTION QUEUE */}
        <section className="admin-panel-card">
          <div className="admin-card-head">
            <h2>🎧 Điều Khiển Âm Nhạc Toàn Quán</h2>
            <p>Admin bật bài nào ở đây thì tất cả người chơi ngoài quán sẽ lập tức thấy &amp; nghe bài đó.</p>
          </div>

          {overview && (
            <div className="admin-now-playing-box">
              <div>
                <span className="mg-topic-badge">
                  {overview.musicState.isPlaying ? 'ĐANG PHÁT TRỰC TIẾP' : 'ĐANG TẠM DỪNG'}
                </span>
                <h3>{decodeHtmlEntities(overview.musicState.currentTrack.title)}</h3>
                <small>
                  {overview.musicState.currentTrack.artist} · Phong cách: {overview.musicState.currentTrack.style} · Thời lượng:{' '}
                  <b>
                    {Math.floor(overview.musicState.currentTrack.durationSec / 60)}:
                    {String(overview.musicState.currentTrack.durationSec % 60).padStart(2, '0')}
                  </b>{' '}
                  · Đề xuất bởi: <b>{overview.musicState.currentTrack.suggestedBy ?? 'Admin'}</b>
                </small>
              </div>
              <div className="admin-music-btns">
                <button
                  type="button"
                  className="confirm-button"
                  onClick={() =>
                    void postAdminMusic(
                      { action: 'toggle-play' },
                      overview.musicState.isPlaying ? 'Đã tạm dừng nhạc ngoài quán.' : 'Đã tiếp tục phát nhạc.',
                    )
                  }
                >
                  {overview.musicState.isPlaying ? <Pause size={15} /> : <Play size={15} />}
                  {overview.musicState.isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
                </button>
                <button
                  type="button"
                  className="secondary-modal-btn"
                  onClick={() => void postAdminMusic({ action: 'skip' }, 'Đã chuyển sang bài tiếp theo!')}
                >
                  <SkipForward size={15} /> Bài tiếp
                </button>
              </div>
            </div>
          )}

          {/* Add & Play Custom Song (YouTube or MP3) */}
          <form
            className="admin-custom-song-form"
            onSubmit={(e) => {
              e.preventDefault()
              void handleSubmitCustomTrack(true)
            }}
          >
            <div className="admin-custom-form-title">
              <strong>+ Mở bài hát mới (Hỗ trợ dán link YouTube hoặc MP3)</strong>
              {extractYouTubeId(customAudioUrl) && (
                <span className="admin-yt-chip">
                  ▶ YouTube Video ID: <b>{extractYouTubeId(customAudioUrl)}</b>
                  {inspectingYt
                    ? ' · Đang đọc thông tin & thời lượng…'
                    : customDuration
                      ? ` · Thời lượng: ${customDuration}`
                      : ' · Sẵn sàng phát'}
                </span>
              )}
            </div>
            <div className="admin-form-row">
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Tên bài hát (VD: 밤편지 - IU hoặc tự động điền khi dán link YouTube)…"
                maxLength={65}
              />
              <input
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                placeholder="Nghệ sĩ…"
                maxLength={40}
              />
              <input
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                placeholder="Thời lượng (VD: 4:30 hoặc 270s)…"
                title="Thời lượng bài hát (mm:ss hoặc số giây). Tự động nhận diện khi dán link YouTube."
                style={{ maxWidth: '160px' }}
              />
            </div>
            <div className="admin-form-row">
              <select
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value as MusicTrackDef['style'])}
              >
                <option value="lofi-rain">Lofi Rain</option>
                <option value="piano-study">Piano Study</option>
                <option value="acoustic-warm">Acoustic Warm</option>
                <option value="seoul-night">Seoul Night</option>
                <option value="spring-breeze">Spring Breeze</option>
                <option value="latte-jazz">Latte Jazz</option>
              </select>
              <input
                value={customAudioUrl}
                onChange={(e) => handleInspectUrl(e.target.value)}
                placeholder="Dán link YouTube (youtube.com, youtu.be) hoặc link file MP3…"
              />
              <button
                type="submit"
                className="confirm-button"
                title="Phát ngay bài này ra ngoài quán lập tức"
              >
                <Play size={14} /> Phát ngay
              </button>
              <button
                type="button"
                className="secondary-modal-btn"
                onClick={() => void handleSubmitCustomTrack(false)}
                title="Thêm bài này vào danh sách hàng đợi phát tiếp theo"
              >
                <Plus size={14} /> Thêm vào hàng chờ
              </button>
            </div>
          </form>

          {/* User Suggested Pending Approval Queue */}
          <div className="admin-sub-block">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4>⏳ Bài hát khách đề xuất chờ duyệt (Cần Admin duyệt mới được phát)</h4>
              {Boolean(overview?.musicState.pendingQueue?.length) && (
                <span className="mg-tag-badge" style={{ background: '#f59e0b', color: '#fff' }}>
                  {overview?.musicState.pendingQueue?.length} bài chờ duyệt
                </span>
              )}
            </div>
            {overview?.musicState.pendingQueue?.length ? (
              <div className="admin-track-list">
                {overview.musicState.pendingQueue.map((t) => (
                  <div key={t.id} className="admin-track-row" style={{ borderLeft: '3px solid #f59e0b' }}>
                    <div>
                      <strong>
                        {decodeHtmlEntities(t.title)} <span>❤️ {t.votes ?? 1}</span>
                        <span className="mg-tag-badge" style={{ background: '#fef3c7', color: '#b45309', marginLeft: '6px', fontSize: '11px' }}>
                          ⏳ Chờ duyệt
                        </span>
                        {extractYouTubeId(t.audioUrl) ? (
                          <span className="admin-media-tag yt">▶ YouTube</span>
                        ) : t.audioUrl ? (
                          <span className="admin-media-tag mp3">🎵 Audio Link</span>
                        ) : null}
                      </strong>
                      <small>
                        {t.artist} · Thời lượng: <b>{Math.floor(t.durationSec / 60)}:{String(t.durationSec % 60).padStart(2, '0')}</b> · Đề xuất bởi: <b>{t.suggestedBy ?? 'Khách'}</b>
                      </small>
                    </div>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="confirm-button"
                        onClick={() =>
                          void postAdminMusic(
                            { action: 'approve-and-play', trackId: t.id },
                            `Đã duyệt và phát ngay bài “${t.title}”!`,
                          )
                        }
                        title="Duyệt bài và phát ra toàn quán ngay lập tức"
                      >
                        <Play size={13} /> Duyệt &amp; Phát ngay
                      </button>
                      <button
                        type="button"
                        className="secondary-modal-btn"
                        onClick={() =>
                          void postAdminMusic(
                            { action: 'approve-to-queue', trackId: t.id },
                            `Đã duyệt bài “${t.title}” vào hàng đợi phát tiếp theo!`,
                          )
                        }
                        title="Duyệt bài này vào danh sách chờ phát tiếp sau bài hiện tại"
                      >
                        <Plus size={13} /> Duyệt vào hàng đợi
                      </button>
                      <button
                        type="button"
                        className="admin-danger-btn"
                        onClick={() => void postAdminMusic({ action: 'reject-track', trackId: t.id }, 'Đã từ chối bài đề xuất.')}
                        title="Từ chối đề xuất này"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-empty-text">Hiện không có bài hát nào đang chờ duyệt.</p>
            )}
          </div>

          {/* Approved Active Playback Queue */}
          <div className="admin-sub-block">
            <h4>🎶 Hàng đợi bài hát đã duyệt ({overview?.musicState.queue.length ?? 0} bài)</h4>
            {overview?.musicState.queue.length ? (
              <div className="admin-track-list">
                {overview.musicState.queue.map((t) => (
                  <div key={t.id} className="admin-track-row">
                    <div>
                      <strong>
                        {decodeHtmlEntities(t.title)} <span>❤️ {t.votes ?? 1}</span>
                        {extractYouTubeId(t.audioUrl) ? (
                          <span className="admin-media-tag yt">▶ YouTube</span>
                        ) : t.audioUrl ? (
                          <span className="admin-media-tag mp3">🎵 Audio Link</span>
                        ) : null}
                      </strong>
                      <small>
                        {t.artist} · Thời lượng: <b>{Math.floor(t.durationSec / 60)}:{String(t.durationSec % 60).padStart(2, '0')}</b> · Nguồn: <b>{t.suggestedBy ?? 'Khách'}</b>
                      </small>
                    </div>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="confirm-button"
                        onClick={() =>
                          void postAdminMusic(
                            { action: 'play-track', trackId: t.id },
                            `Đã bật bài “${t.title}” ra ngoài quán!`,
                          )
                        }
                      >
                        <Play size={13} /> Bật bài này
                      </button>
                      <button
                        type="button"
                        className="admin-danger-btn"
                        onClick={() => void postAdminMusic({ action: 'remove-track', trackId: t.id }, 'Đã xóa bài khỏi hàng đợi.')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-empty-text">Chưa có bài hát nào trong hàng đợi phát tiếp.</p>
            )}
          </div>

          {/* Built-in Cafe Music Library */}
          <div className="admin-sub-block">
            <h4>Kho Nhạc Mặc Định Của Quán ({overview?.musicLibrary.length ?? 0} bài)</h4>
            <div className="admin-track-list compact">
              {(overview?.musicLibrary ?? []).map((lib) => {
                const isCurrent = overview?.musicState.currentTrack.id === lib.id
                return (
                  <div key={lib.id} className={`admin-track-row ${isCurrent ? 'playing' : ''}`}>
                    <div>
                      <strong>{lib.title}</strong>
                      <small>
                        {lib.artist} · {lib.mood}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={isCurrent ? 'secondary-modal-btn' : 'confirm-button'}
                      onClick={() =>
                        void postAdminMusic(
                          { action: 'play-track', trackId: lib.id },
                          `Đã chuyển sang phát “${lib.title}”!`,
                        )
                      }
                    >
                      <Play size={13} /> {isCurrent ? 'Phát lại từ đầu' : 'Bật ngay'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: LIVE USERS, SEATS, GAME ROOMS & ANNOUNCEMENTS */}
        <section className="admin-panel-card">
          <div className="admin-card-head">
            <h2>👥 Quản Lý Người Dùng, Ghế Ngồi &amp; Thông Báo</h2>
            <p>Theo dõi mọi người chơi đang có mặt trong K-CHILL Café, vị trí bàn ghế và phát thông báo hệ thống.</p>
          </div>

          <form className="admin-announce-form" onSubmit={handleBroadcastAnnouncement}>
            <Megaphone size={16} />
            <input
              value={announceText}
              onChange={(e) => setAnnounceText(e.target.value)}
              placeholder="Gửi thông báo nổi (toast) tới toàn bộ người chơi trong quán…"
              maxLength={200}
            />
            <button type="submit" className="confirm-button">
              Phát thông báo
            </button>
          </form>

          <div className="admin-sub-block">
            <h4>Người Chơi Thật Đang Online ({realPlayers.length})</h4>
            {realPlayers.length === 0 ? (
              <p className="admin-empty-text">Hiện chưa có người chơi thật nào vào quán.</p>
            ) : (
              <div className="admin-users-list">
                {realPlayers.map((u) => {
                  const tableId = getTableIdForSeat(u.seatId)
                  return (
                    <div key={u.userId} className="admin-user-row">
                      <div>
                        <strong>
                          {u.username} <span>{u.level}</span>
                          {u.inVoiceCall && <em className="adm-tag green"><Mic size={11} /> Voice</em>}
                          {u.inGame && <em className="adm-tag amber"><Gamepad2 size={11} /> Đang chơi</em>}
                        </strong>
                        <small>
                          ID: {u.userId} · Vị trí:{' '}
                          <b>{u.seatId ? `${u.seatId} (${tableId})` : 'Đang đứng đi dạo'}</b> · Lv.{u.levelNum ?? 1} (
                          {u.xp ?? 0} XP)
                        </small>
                      </div>
                      <div className="admin-row-actions">
                        {u.seatId && (
                          <button
                            type="button"
                            className="secondary-modal-btn"
                            onClick={() => void handleUserAction(u.userId, u.username, 'force-stand')}
                          >
                            Giải phóng ghế
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-danger-btn"
                          onClick={() => void handleUserAction(u.userId, u.username, 'kick')}
                          title="Ngắt kết nối người chơi này"
                        >
                          <UserMinus size={14} /> Kick
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="admin-sub-block">
            <h4>Phòng Mini-Game Đang Hoạt Động ({overview?.miniGameRooms.length ?? 0})</h4>
            {overview?.miniGameRooms.length ? (
              <div className="admin-users-list">
                {overview.miniGameRooms.map((r) => (
                  <div key={r.roomId} className="admin-user-row">
                    <div>
                      <strong>
                        #{r.roomCode} · {r.gameId} ({r.difficulty.toUpperCase()})
                      </strong>
                      <small>
                        Trạng thái: <b>{r.status}</b> · Người chơi: {r.players.map((p) => p.username).join(', ')}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-empty-text">Chưa có phòng Mini-Game nhiều người nào đang mở.</p>
            )}
          </div>

          <div className="admin-sub-block">
            <h4>Sơ Đồ 30 Ghế Ngồi Realtime</h4>
            <div className="admin-seat-grid">
              {(overview?.seats ?? []).map((s) => (
                <div key={s.id} className={`admin-seat-cell ${s.status}`}>
                  <strong>{s.id.replace('Seat_', 'Ghế ')}</strong>
                  <small>{s.status === 'occupied' ? s.occupantName || 'Có người' : 'Trống'}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
