import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { Game as PhaserGame } from 'phaser'
import {
  ArrowUpRight,
  Ban,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Coffee,
  Gamepad2,
  Heart,
  LocateFixed,
  Lock,
  Menu,
  MessageCircle,
  MessageSquareQuote,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Shield,
  Smile,
  Sparkles,
  UserCheck,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { GameResultModal, KoreanGameArena } from './components/KoreanGameOverlay'
import {
  CafeMenuModal,
  GamesSidebarPanel,
  INITIAL_CLIENT_MUSIC_STATE,
  KoreanLearningPanel,
  MusicRoomPanel,
  SettingsSidebarPanel,
} from './components/SidebarPanels'
import { StoryReaderModal } from './components/StoryReaderModal'
import { avatarLooks, createSeats, demoPlayers } from './data/demoData'
import {
  ACHIEVEMENTS_CATALOG,
  type CafeMenuItem,
  type TopikLevel,
} from './data/koreanVocabulary'
import { areSeatsAtSameTable, getPartnerSeatId, getTableIdForSeat } from './domain/seatUtils'
import { apiUrl } from './config'
import type {
  AvatarLook,
  CafeSceneEvent,
  ChatMessagePayload,
  GameInvitePayload,
  GameResultSummary,
  GameRoomSession,
  MiniGameDirectInvite,
  MusicRoomState,
  PlayerLearningProfile,
  RoomPlayerState,
  SceneSnapshot,
  SelectedPlayerInfo,
  StorySyncPayload,
  VoiceInvitePayload,
} from './domain/types'
import { CHARACTER_ASSETS, UI_ICONS } from './game/AssetManifest'
import { MiniGameCenterModal } from './games/MiniGameCenter'
import type { MiniGameLobbyRoom } from './games/types'
import { cafeMusicEngine, speakKorean } from './services/cafeMusicEngine'
import { loadTabSession, multiplayerClient, saveTabSession, type CharacterAction } from './services/multiplayer'
import { privateVoiceService, type VoiceCallUiState } from './services/voiceChat'
import { validateUsername } from './domain/contentFilter'

type NavKey = 'friends' | 'chat' | 'games' | 'music' | 'learn' | 'settings'
type Notice = { text: string; kind?: 'success' | 'tip' }

const TOPIK_LEVELS: TopikLevel[] = ['TOPIK 1', 'TOPIK 2', 'TOPIK 3', 'TOPIK 4', 'TOPIK 5', 'TOPIK 6']

const navItems: { id: NavKey; label: string; iconUrl: string }[] = [
  { id: 'friends', label: 'Bạn bè', iconUrl: UI_ICONS.friends },
  { id: 'chat', label: 'Chat bàn', iconUrl: UI_ICONS.chat },
  { id: 'games', label: '6 Games', iconUrl: UI_ICONS.games },
  { id: 'music', label: 'Nhạc quán', iconUrl: UI_ICONS.music },
  { id: 'learn', label: 'Tự học Hàn', iconUrl: UI_ICONS.learn },
  { id: 'settings', label: 'Cài đặt', iconUrl: UI_ICONS.settings },
]

const CHARACTER_ACTIONS: { id: CharacterAction; icon: string; label: string; name: string }[] = [
  { id: 'wave', icon: '👋', label: 'Chào hỏi', name: 'Vẫy tay & cúi chào lịch sự' },
  { id: 'heart', icon: '❤️', label: 'Bắn tim', name: 'Bắn tim K-Heart ngọt ngào' },
  { id: 'coffee', icon: '☕', label: 'Uống nước', name: 'Nhấp một ngụm cà phê thơm ngát' },
  { id: 'music', icon: '🎵', label: 'Lắc lư', name: 'Nhún nhảy chill theo điệu nhạc' },
  { id: 'study', icon: '📖', label: 'Học bài', name: 'Chăm chú tập trung học từ vựng' },
  { id: 'cheer', icon: '✨', label: 'Reo hò', name: 'Reo hò vỗ tay phấn khích' },
]

function lookById(id?: string): AvatarLook {
  return avatarLooks.find((item) => item.id === id) ?? avatarLooks[0]
}

function formatDuration(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function AssetIcon({ src, size = 20, className = '' }: { src: string; size?: number; className?: string }) {
  return <img src={src} alt="" width={size} height={size} className={`ui-asset-icon ${className}`} draggable={false} />
}

function Portrait({ look, className = '' }: { look: AvatarLook; className?: string }) {
  const avatarUrl = CHARACTER_ASSETS[look.id]?.avatarUrl ?? CHARACTER_ASSETS['look-01'].avatarUrl
  return (
    <div className={`portrait ${className}`} aria-label={`Avatar ${look.name}`}>
      <img src={avatarUrl} alt={look.name} draggable={false} />
    </div>
  )
}

const fallbackRoomPlayers = (): RoomPlayerState[] =>
  demoPlayers.map((p) => ({
    userId: p.id,
    username: p.name,
    avatarId: p.avatar.id,
    level: p.level,
    u: 10,
    v: 10,
    direction: 'left',
    animation: 'sit',
    seatId: p.seatId,
    onlineStatus: 'online',
    mood: p.mood,
    isNpc: true,
  }))

function App() {
  const initialSession = useMemo(() => loadTabSession(), [])
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<PhaserGame | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Left Collapsible & Resizable Drawer States
  const [drawerOpen, setDrawerOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 768
    }
    return true
  })
  const [drawerWidth, setDrawerWidth] = useState<number>(376)
  const isResizingDrawerRef = useRef<boolean>(false)

  const [hasEntered, setHasEntered] = useState<boolean>(initialSession.entered)
  const [entryName, setEntryName] = useState<string>(initialSession.username)
  const [displayName, setDisplayName] = useState<string>(initialSession.username || 'Khách mới')
  const [avatar, setAvatar] = useState<AvatarLook>(() => lookById(initialSession.avatarId))
  const [topikLevel, setTopikLevel] = useState<string>(initialSession.level || 'TOPIK 1')
  const [isConnected, setIsConnected] = useState<boolean>(multiplayerClient.isConnected)

  const [snapshot, setSnapshot] = useState<SceneSnapshot>({
    seats: createSeats(),
    seated: false,
    playerX: 0.49,
    playerY: 0.77,
    avatarId: initialSession.avatarId || avatarLooks[0].id,
  })
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayerState[]>(fallbackRoomPlayers)
  const [selected, setSelected] = useState<SelectedPlayerInfo | null>(null)
  const [activeNav, setActiveNav] = useState<NavKey>('friends')
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [cafeMenuOpen, setCafeMenuOpen] = useState(false)
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [emoteBarOpen, setEmoteBarOpen] = useState(false)
  const [notice, setNotice] = useState<Notice | null>({
    text: 'Chào mừng đến K-CHILL Café! Ngồi cùng bàn để chat riêng, đọc câu chuyện & chơi 6 Mini-Games nhé ✨',
  })
  const [soundOn, setSoundOn] = useState(true)
  const [rainOn, setRainOn] = useState(true)
  const [vinylOn, setVinylOn] = useState(true)
  const [cafeAmbianceOn, setCafeAmbianceOn] = useState(true)
  const [search, setSearch] = useState('')
  const [chatValue, setChatValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [messages, setMessages] = useState<ChatMessagePayload[]>([
    {
      id: 'init-1',
      userId: 'system',
      username: 'K-CHILL',
      avatarId: 'look-01',
      text: '안녕하세요! Chế độ chat chỉ gửi riêng tại bàn bạn đang ngồi để giữ quán luôn mượt mà 🌿',
      scope: 'table',
      tableId: null,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [favoriteIds, setFavoriteIds] = useState(
    () => new Set(demoPlayers.filter((person) => person.favorite).map((person) => person.id)),
  )
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set())
  const [profilePlayer, setProfilePlayer] = useState<RoomPlayerState | null>(null)

  // Phase 3: Private 1-on-1 Voice States
  const [incomingInvite, setIncomingInvite] = useState<VoiceInvitePayload | null>(null)
  const [outgoingInvite, setOutgoingInvite] = useState<VoiceInvitePayload | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceCallUiState>({
    session: null,
    connectionState: 'idle',
    localMuted: false,
    peerMuted: false,
    micAvailable: true,
    localSpeaking: false,
    remoteSpeaking: false,
  })
  const [callElapsedSec, setCallElapsedSec] = useState(0)

  // Story Conversation Mode States
  const [storyModalOpen, setStoryModalOpen] = useState(false)
  const [storyPartner, setStoryPartner] = useState<{ id: string; name: string } | null>(null)
  const [incomingStorySync, setIncomingStorySync] = useState<StorySyncPayload | null>(null)

  // 6-Game Mini-Game Center States
  const [gameCenterOpen, setGameCenterOpen] = useState(false)
  const [gameCenterInviteTarget, setGameCenterInviteTarget] = useState<RoomPlayerState | null>(null)
  const [openMiniGameRooms, setOpenMiniGameRooms] = useState<MiniGameLobbyRoom[]>([])
  const [activeMiniGameRoom, setActiveMiniGameRoom] = useState<MiniGameLobbyRoom | null>(null)
  const [incomingMgInvite, setIncomingMgInvite] = useState<MiniGameDirectInvite | null>(null)

  // Legacy table games compatibility
  const [incomingGameInvite, setIncomingGameInvite] = useState<GameInvitePayload | null>(null)
  const [activeGameSession, setActiveGameSession] = useState<GameRoomSession | null>(null)
  const [gameResultSummary, setGameResultSummary] = useState<GameResultSummary | null>(null)

  // Admin-Controlled Music & Learning Profile
  const [musicState, setMusicState] = useState<MusicRoomState>(INITIAL_CLIENT_MUSIC_STATE)
  const [suggestCooldownSec, setSuggestCooldownSec] = useState<number>(0)
  const [learningProfile, setLearningProfile] = useState<PlayerLearningProfile>(() => ({
    userId: initialSession.userId,
    topikLevel: (TOPIK_LEVELS.includes(initialSession.level as TopikLevel) ? initialSession.level : 'TOPIK 1') as TopikLevel,
    xp: 0,
    levelNum: 1,
    wordsLearnedIds: [],
    gamesPlayed: 0,
    gamesWon: 0,
    studyMinutes: 0,
    achievements: [],
  }))

  const avatarRef = useRef(avatar)
  const displayNameRef = useRef(displayName)
  const topikRef = useRef(topikLevel)
  const blockedRef = useRef(blockedIds)
  avatarRef.current = avatar
  displayNameRef.current = displayName
  topikRef.current = topikLevel
  blockedRef.current = blockedIds

  const showNotice = (text: string, kind?: Notice['kind']) => {
    setNotice({ text, kind })
    window.setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 4800)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeNav])

  // Refresh Phaser scale smoothly when Left Drawer toggles or resizes
  useEffect(() => {
    const t = window.setTimeout(() => {
      gameRef.current?.scale.refresh()
    }, 60)
    return () => window.clearTimeout(t)
  }, [drawerOpen, drawerWidth])

  // Drag-resize handler for Right Drawer
  const startDrawerResize = (e: ReactMouseEvent) => {
    e.preventDefault()
    isResizingDrawerRef.current = true
    const onMove = (ev: MouseEvent) => {
      if (!isResizingDrawerRef.current) return
      const newWidth = window.innerWidth - ev.clientX
      const clamped = Math.max(300, Math.min(650, newWidth))
      setDrawerWidth(clamped)
    }
    const onUp = () => {
      isResizingDrawerRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      gameRef.current?.scale.refresh()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    if (!hasEntered) {
      window.setTimeout(() => nameInputRef.current?.focus(), 60)
    }
  }, [hasEntered])

  useEffect(() => {
    privateVoiceService.setSpeakerEnabled(soundOn)
    cafeMusicEngine.setMasterSound(soundOn)
  }, [soundOn])

  useEffect(() => {
    cafeMusicEngine.setRainEnabled(rainOn)
  }, [rainOn])

  useEffect(() => {
    cafeMusicEngine.setVinylEnabled(vinylOn)
  }, [vinylOn])

  useEffect(() => {
    cafeMusicEngine.setCafeAmbianceEnabled(cafeAmbianceOn)
  }, [cafeAmbianceOn])

  useEffect(() => {
    cafeMusicEngine.onTrackEnded = (trackId) => {
      multiplayerClient.notifyTrackEnded(trackId)
    }
    cafeMusicEngine.onUpdateDuration = (trackId, dur) => {
      multiplayerClient.notifyTrackDuration(trackId, dur)
    }
  }, [])

  useEffect(() => {
    cafeMusicEngine.syncRoomState(musicState)
  }, [musicState])

  // Ambient study timer (+1m & +4 XP per minute in café)
  useEffect(() => {
    if (!hasEntered) return
    const timer = window.setInterval(() => {
      multiplayerClient.sendStudyTick()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [hasEntered])

  // Call duration timer
  useEffect(() => {
    const startedAt = voiceState.session?.startedAt
    if (!startedAt) {
      setCallElapsedSec(0)
      return
    }
    const update = () => setCallElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [voiceState.session?.startedAt])

  // Subscribe to Socket.IO multiplayer + Voice + Mini-Game Center + Story + Music + Admin
  useEffect(() => {
    const unsubs = [
      privateVoiceService.subscribe((next) => {
        setVoiceState(next)
        if (next.session) {
          setIncomingInvite(null)
          setOutgoingInvite(null)
        }
      }),
      privateVoiceService.onNotice((text, kind) => showNotice(text, kind)),
      multiplayerClient.on('connectionChanged', (connected) => setIsConnected(connected)),
      multiplayerClient.on('snapshot', (snap) => {
        setRoomPlayers(snap.players)
        if (snap.musicState) setMusicState(snap.musicState)
        if (typeof snap.suggestCooldownSec === 'number') setSuggestCooldownSec(snap.suggestCooldownSec)
        if (snap.learningProfile) setLearningProfile(snap.learningProfile)
        if (snap.openMiniGameRooms) setOpenMiniGameRooms(snap.openMiniGameRooms)
      }),
      multiplayerClient.on('playersChanged', (players) => {
        setRoomPlayers(players)
      }),
      multiplayerClient.on('chatMessage', (msg) => {
        if (blockedRef.current.has(msg.userId)) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev.slice(-39), msg]
        })
      }),
      multiplayerClient.on('playerAction', (payload) => {
        if (payload.targetId === initialSession.userId && payload.action === 'wave' && !blockedRef.current.has(payload.fromId)) {
          showNotice(`${payload.fromName} vừa vẫy tay chào bạn tại bàn! 👋`, 'success')
        }
      }),
      // Voice invites
      multiplayerClient.on('voiceIncomingInvite', (invite) => {
        if (blockedRef.current.has(invite.senderId)) {
          void multiplayerClient.respondVoiceInvite(invite.inviteId, false)
          return
        }
        setIncomingInvite(invite)
      }),
      multiplayerClient.on('voiceInviteCancelled', (payload) => {
        setIncomingInvite((curr) => (curr?.inviteId === payload.inviteId ? null : curr))
        if (payload.reason) showNotice(payload.reason)
      }),
      multiplayerClient.on('voiceInviteResult', (payload) => {
        setOutgoingInvite((curr) => (curr?.inviteId === payload.inviteId ? null : curr))
        if (!payload.accepted && payload.reason) {
          showNotice(payload.reason)
        }
      }),
      // Story Conversation Sync
      multiplayerClient.on('storySynced', (payload) => {
        if (blockedRef.current.has(payload.fromId)) return
        setIncomingStorySync(payload)
        setStoryPartner({ id: payload.fromId, name: payload.fromName })
        if (payload.action === 'open') {
          setStoryModalOpen(true)
          showNotice(`📖 ${payload.fromName} đã mở chế độ Cùng đọc câu chuyện tiếng Hàn với bạn!`, 'success')
        }
      }),
      // Mini-Game Center (6 Games)
      multiplayerClient.on('mgOpenRooms', (rooms) => {
        setOpenMiniGameRooms(rooms)
      }),
      multiplayerClient.on('mgRoomUpdated', (mgRoom) => {
        setActiveMiniGameRoom(mgRoom)
        setGameCenterOpen(true)
      }),
      multiplayerClient.on('mgIncomingInvite', (inv) => {
        if (blockedRef.current.has(inv.senderId)) return
        setIncomingMgInvite(inv)
      }),
      // Legacy Table Games
      multiplayerClient.on('gameIncomingInvite', (invite) => {
        if (blockedRef.current.has(invite.senderId)) {
          void multiplayerClient.respondGameInvite(invite.inviteId, false)
          return
        }
        setIncomingGameInvite(invite)
      }),
      multiplayerClient.on('gameInviteCancelled', (payload) => {
        setIncomingGameInvite((curr) => (curr?.inviteId === payload.inviteId ? null : curr))
        if (payload.reason) showNotice(payload.reason)
      }),
      multiplayerClient.on('gameStarted', (session) => {
        setIncomingGameInvite(null)
        setGameResultSummary(null)
        setActiveGameSession(session)
      }),
      multiplayerClient.on('gameState', (session) => {
        setActiveGameSession(session)
      }),
      multiplayerClient.on('gameEnded', (summary) => {
        setActiveGameSession(null)
        setGameResultSummary(summary)
      }),
      // Music, Learning & Admin
      multiplayerClient.on('musicState', (state) => {
        setMusicState(state)
      }),
      multiplayerClient.on('learningUpdated', ({ profile, unlockedCodes }) => {
        setLearningProfile(profile)
        if (unlockedCodes.length > 0) {
          const firstAch = ACHIEVEMENTS_CATALOG.find((a) => a.code === unlockedCodes[0])
          if (firstAch) {
            showNotice(`🎉 Mở khóa thành tích: ${firstAch.badge} ${firstAch.title} (+${firstAch.xpReward} XP)!`, 'success')
          }
        }
      }),
      multiplayerClient.on('adminAnnouncement', (ann) => {
        showNotice(`📢 Thông báo từ K-CHILL Café: ${ann.text}`, 'success')
      }),
      multiplayerClient.on('adminForceStand', (payload) => {
        gameRef.current?.events.emit('stand-command')
        showNotice(payload.reason || 'Chỗ ngồi của bạn đã được giải phóng.')
      }),
      multiplayerClient.on('adminKicked', (payload) => {
        setHasEntered(false)
        showNotice(payload.reason || 'Bạn đã ngắt kết nối khỏi quán.')
      }),
    ]

    if (initialSession.entered && initialSession.username.trim()) {
      void multiplayerClient.joinCafe(initialSession).then((res) => {
        if (!res.ok && res.reason) showNotice(res.reason)
      })
    }

    return () => {
      for (const u of unsubs) u()
    }
  }, [initialSession])

  // Boot Phaser 2.5D Café Canvas
  useEffect(() => {
    let game: PhaserGame | null = null
    let disposed = false
    const onCafeEvent = (event: CafeSceneEvent) => {
      if (event.type === 'snapshot') setSnapshot(event.snapshot)
      if (event.type === 'select-player') {
        if (blockedRef.current.has(event.player.id)) {
          showNotice(`Bạn đã chặn ${event.player.name}.`)
          return
        }
        setSelected(event.player)
      }
      if (event.type === 'open-cafe-menu') {
        setSelected(null)
        setCafeMenuOpen(true)
      }
      if (event.type === 'message') showNotice(event.text, event.kind)
    }
    void Promise.all([import('phaser'), import('./game/CafeScene')]).then(([phaserModule, sceneModule]) => {
      if (disposed || !mountRef.current) return
      const Phaser = phaserModule.default
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: mountRef.current,
        backgroundColor: '#3a2d28',
        resolution: Math.max(1, Math.min(2.5, window.devicePixelRatio || 1)),
        antialias: true,
        antialiasGL: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.RESIZE, width: 1380, height: 900 },
        render: {
          powerPreference: 'high-performance',
          transparent: false,
          pixelArt: false,
          roundPixels: true,
          mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
        },
        scene: [sceneModule.CafeScene],
      } as unknown as Phaser.Types.Core.GameConfig)
      gameRef.current = game
      ;(window as unknown as { __PHASER_GAME__?: unknown }).__PHASER_GAME__ = game
      game.events.on('cafe-event', onCafeEvent)
      game.events.on('scene-ready', () => {
        game?.events.emit('avatar-change', avatarRef.current, displayNameRef.current, topikRef.current)
      })
    })
    return () => {
      disposed = true
      if (game) {
        game.events.off('cafe-event', onCafeEvent)
        game.destroy(true)
      }
      gameRef.current = null
    }
  }, [])

  const myUserId = initialSession.userId
  const mySeatId = snapshot.seatedId ?? null
  const myTableId = getTableIdForSeat(mySeatId)

  const handleEnterCafe = async (event: FormEvent) => {
    event.preventDefault()
    const clean = entryName.trim()
    if (!clean) {
      showNotice('Bạn hãy nhập tên hiển thị để mọi người trong quán nhận ra nhé! ✨')
      nameInputRef.current?.focus()
      return
    }
    const val = validateUsername(clean)
    if (!val.valid) {
      showNotice(val.reason || 'Tên hiển thị không hợp lệ.', 'tip')
      nameInputRef.current?.focus()
      return
    }
    setDisplayName(clean)
    setHasEntered(true)
    const nextProfile = {
      userId: myUserId,
      username: clean,
      avatarId: avatar.id,
      level: topikLevel,
      entered: true,
    }
    saveTabSession(nextProfile)
    gameRef.current?.events.emit('avatar-change', avatar, clean, topikLevel)

    const res = await multiplayerClient.joinCafe(nextProfile)
    if (!res.ok) {
      showNotice(res.reason || 'Không thể vào phòng lúc này.')
    } else {
      showNotice(`안녕하세요 ${clean}! Bạn đã vào K-CHILL Café ☕`, 'success')
    }
  }

  const occupiedSeats = snapshot.seats.filter((seat) => seat.status === 'occupied').length

  const otherPlayers = useMemo(() => {
    return roomPlayers.filter((p) => p.userId !== myUserId && !blockedIds.has(p.userId))
  }, [roomPlayers, myUserId, blockedIds])

  const onlineCount = Math.min(30, otherPlayers.length + 1)

  const currentTablemate = useMemo(() => {
    if (!mySeatId) return null
    return otherPlayers.find((p) => areSeatsAtSameTable(mySeatId, p.seatId)) ?? null
  }, [otherPlayers, mySeatId])

  const visiblePlayers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi')
    const filtered = q
      ? otherPlayers.filter((person) => person.username.toLocaleLowerCase('vi').includes(q))
      : otherPlayers
    return [...filtered].sort((a, b) => {
      const aSame = areSeatsAtSameTable(mySeatId, a.seatId) ? 1 : 0
      const bSame = areSeatsAtSameTable(mySeatId, b.seatId) ? 1 : 0
      if (aSame !== bSame) return bSame - aSame
      const aReal = a.isNpc ? 0 : 1
      const bReal = b.isNpc ? 0 : 1
      return bReal - aReal
    })
  }, [otherPlayers, search, mySeatId])

  // Table-only messages! Never render room-wide spam.
  const visibleMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (blockedIds.has(msg.userId)) return false
      if (msg.userId === 'system') return true
      return Boolean(myTableId && msg.tableId === myTableId)
    })
  }, [messages, blockedIds, myTableId])

  const changeAvatar = (look: AvatarLook) => {
    setAvatar(look)
    if (hasEntered) {
      gameRef.current?.events.emit('avatar-change', look, displayName, topikLevel)
    }
  }

  const sitAtSeat = (seatId: string) => {
    setSelected(null)
    setProfilePlayer(null)
    gameRef.current?.events.emit('sit-seat-command', seatId)
  }

  const triggerCharacterAction = (action: CharacterAction) => {
    gameRef.current?.events.emit('action-command', action)
    if (currentTablemate) {
      void multiplayerClient.interactSameTable(currentTablemate.userId, action)
    }
    const match = CHARACTER_ACTIONS.find((a) => a.id === action)
    showNotice(`Hành động nhân vật: ${match?.name ?? action} ✨ (+5 XP)`, 'success')
    setEmoteBarOpen(false)
  }

  // === Voice & Story Actions ===
  const inviteToPrivateVoice = async (targetId: string, targetName: string) => {
    setSelected(null)
    setProfilePlayer(null)
    openStoryConversationWith({ id: targetId, name: targetName })
    const res = await multiplayerClient.sendVoiceInvite(targetId)
    if (!res.ok || !res.invite) {
      showNotice(res.reason || `Không thể gửi lời mời tới ${targetName}.`)
      return
    }
    setOutgoingInvite(res.invite)
    showNotice(`Đã mở phòng trò chuyện & gửi lời mời Voice tới ${targetName}… 🎙️`, 'success')
  }

  const openStoryConversationWith = (partner: { id: string; name: string } | null) => {
    setSelected(null)
    setProfilePlayer(null)
    setStoryPartner(partner)
    setStoryModalOpen(true)
    if (partner) {
      void multiplayerClient.sendStorySync({
        targetId: partner.id,
        storyId: 'story-rainy-meet',
        lineIndex: 0,
        action: 'open',
      })
    }
  }

  const respondToVoiceInvite = async (accept: boolean) => {
    if (!incomingInvite) return
    const invite = incomingInvite
    setIncomingInvite(null)
    const res = await multiplayerClient.respondVoiceInvite(invite.inviteId, accept)
    if (!res.ok) {
      showNotice(res.reason || 'Lời mời không còn hiệu lực.')
      return
    }
    if (!accept) {
      showNotice(`Bạn đã từ chối lời mời từ ${invite.senderName}. Hai bạn vẫn giữ nguyên chỗ ngồi.`)
    }
  }

  const cancelPendingOutgoingInvite = () => {
    if (!outgoingInvite) return
    multiplayerClient.cancelVoiceInvite(outgoingInvite.inviteId)
    setOutgoingInvite(null)
    showNotice('Đã hủy lời mời trò chuyện riêng.')
  }

  const handleDockMicButton = () => {
    if (voiceState.session) {
      void privateVoiceService.toggleMute()
      openStoryConversationWith(voicePartner ? { id: voicePartner.userId, name: voicePartner.name } : null)
      return
    }
    if (currentTablemate && !currentTablemate.isNpc) {
      void inviteToPrivateVoice(currentTablemate.userId, currentTablemate.username)
      return
    }
    openStoryConversationWith(null)
  }

  // === Mini-Game Center Actions ===
  const openMiniGameCenter = (inviteTarget?: RoomPlayerState | null) => {
    setSelected(null)
    setProfilePlayer(null)
    setGameCenterInviteTarget(inviteTarget ?? null)
    setGameCenterOpen(true)
  }

  const acceptIncomingMgInvite = async () => {
    if (!incomingMgInvite) return
    const inv = incomingMgInvite
    setIncomingMgInvite(null)
    const res = await multiplayerClient.joinMiniGameRoom(inv.roomId)
    if (!res.ok || !res.room) {
      showNotice(res.reason || 'Phòng chơi không còn mở.')
      return
    }
    setActiveMiniGameRoom(res.room)
    setGameCenterOpen(true)
  }

  const respondToLegacyGameInvite = async (accept: boolean) => {
    if (!incomingGameInvite) return
    const inv = incomingGameInvite
    setIncomingGameInvite(null)
    const res = await multiplayerClient.respondGameInvite(inv.inviteId, accept)
    if (!res.ok) {
      showNotice(res.reason || 'Lời mời chơi game không còn hiệu lực.')
    }
  }

  const handleLeaveActiveGame = () => {
    multiplayerClient.leaveGame()
    setActiveGameSession(null)
  }

  // === Barista Menu Order Action ===
  const handleOrderMenuItem = (item: CafeMenuItem) => {
    setCafeMenuOpen(false)
    speakKorean(item.orderPhraseKo)
    gameRef.current?.events.emit('order-item-command', item.assetKey, item.orderPhraseKo)
    multiplayerClient.orderMenuItem(item.id)
    showNotice(`☕ Đã gọi món: ${item.hangul} (${item.nameVi}) +10 XP!`, 'success')
  }

  const handleSendFeedback = async (e: FormEvent) => {
    e.preventDefault()
    const content = feedbackContent.trim()
    if (!content) return
    setSubmittingFeedback(true)
    try {
      const res = await fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: myUserId,
          username: displayName,
          content,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        showNotice('Đã gửi góp ý thành công! Nhà phát triển sẽ đọc ngay nhé 💖', 'success')
        setFeedbackContent('')
        setFeedbackModalOpen(false)
      } else {
        showNotice(data.reason || 'Không thể gửi góp ý.', 'tip')
      }
    } catch {
      showNotice('Không thể kết nối máy chủ để gửi góp ý.', 'tip')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const waveToTablemate = async (targetId: string, targetName: string) => {
    const res = await multiplayerClient.interactSameTable(targetId, 'wave')
    if (!res.ok) {
      showNotice(res.reason || 'Cần ngồi cùng bàn để tương tác nhé!')
      return
    }
    if (!multiplayerClient.isConnected) {
      gameRef.current?.events.emit('wave-command', 'self')
      gameRef.current?.events.emit('wave-command', targetId)
    }
    showNotice(`Đã vẫy tay chào ${targetName} tại ${myTableId ?? 'bàn'}! 👋`, 'success')
  }

  // Strictly Table-Only Chat Submit!
  const submitChat = async (event: FormEvent) => {
    event.preventDefault()
    const text = chatValue.trim()
    if (!text) return

    if (!myTableId) {
      showNotice('Không gian riêng tư yên tĩnh — hãy ngồi vào ghế (phím E) để trò chuyện cùng bàn nhé! 🪑')
      return
    }

    setChatValue('')
    gameRef.current?.events.emit('talk-command', text)

    const res = await multiplayerClient.sendTableChat(text, myTableId, mySeatId)
    if (!res.ok) {
      if (res.reason === 'offline') {
        const now = new Date()
        setMessages((current) => [
          ...current.slice(-39),
          {
            id: `local-${Date.now()}`,
            userId: myUserId,
            username: displayName,
            avatarId: avatar.id,
            text,
            scope: 'table',
            tableId: myTableId,
            time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      } else if (res.reason) {
        showNotice(res.reason)
      }
    }
  }

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const blockPlayer = (id: string, name: string) => {
    if (voiceState.session && (voiceState.session.hostUserId === id || voiceState.session.guestUserId === id)) {
      privateVoiceService.endCall()
    }
    setBlockedIds((current) => {
      const next = new Set(current)
      next.add(id)
      return next
    })
    setSelected(null)
    setProfilePlayer(null)
    showNotice(`Đã chặn tương tác từ ${name}.`)
  }

  const handleSidebarPlayerClick = (person: RoomPlayerState) => {
    const sameTable = areSeatsAtSameTable(mySeatId, person.seatId)
    if (sameTable) {
      setProfilePlayer(person)
      setSelected(null)
      return
    }
    const partnerSeat = getPartnerSeatId(person.seatId)
    const partnerFree = partnerSeat
      ? snapshot.seats.find((s) => s.id === partnerSeat)?.status === 'available'
      : false

    if (person.seatId && partnerFree && partnerSeat) {
      showNotice(`Ngồi cùng bàn mới tương tác được với ${person.username}. Bấm “Ngồi cùng” để qua ghế ${partnerSeat} nhé!`)
    } else if (person.seatId) {
      showNotice(`Bạn cần ngồi cùng bàn (${getTableIdForSeat(person.seatId)}) để tương tác với ${person.username}, nhưng bàn này đã đủ 2 người.`)
    } else {
      showNotice(`${person.username} đang đi dạo. Hãy ngồi cùng một bàn để tương tác nhé!`)
    }
  }

  const activeTitle = navItems.find((item) => item.id === activeNav)?.label ?? 'Bạn bè'
  const occupiedBySelf = snapshot.seats.find(
    (seat) => seat.id === snapshot.seatedId || seat.occupantId === myUserId,
  )

  const liveSelected = useMemo(() => {
    if (!selected) return null
    if (selected.id === 'self') return selected
    const livePerson = roomPlayers.find((p) => p.userId === selected.id)
    const theirSeat = livePerson ? livePerson.seatId : selected.seatId
    const partnerSeatId = getPartnerSeatId(theirSeat)
    const partnerSeatAvailable = Boolean(
      partnerSeatId && snapshot.seats.find((s) => s.id === partnerSeatId)?.status === 'available',
    )
    return {
      ...selected,
      name: livePerson?.username ?? selected.name,
      avatarId: livePerson?.avatarId ?? selected.avatarId,
      level: livePerson?.level ?? selected.level,
      seatId: theirSeat,
      tableId: getTableIdForSeat(theirSeat),
      sameTable: areSeatsAtSameTable(mySeatId, theirSeat),
      partnerSeatId,
      partnerSeatAvailable,
      isNpc: livePerson?.isNpc ?? selected.isNpc,
      inVoiceCall: livePerson?.inVoiceCall ?? selected.inVoiceCall,
      inGame: livePerson?.inGame ?? selected.inGame,
    }
  }, [selected, roomPlayers, mySeatId, snapshot.seats])

  const voicePartner = useMemo(() => {
    const s = voiceState.session
    if (!s) return null
    const isHost = s.hostUserId === myUserId
    return {
      userId: isHost ? s.guestUserId : s.hostUserId,
      name: isHost ? s.guestName : s.hostName,
      avatarLook: lookById(isHost ? s.guestAvatarId : s.hostAvatarId),
      tableId: s.tableId,
    }
  }, [voiceState.session, myUserId])

  const isSelectedMyCallPartner = Boolean(liveSelected && voicePartner && liveSelected.id === voicePartner.userId)
  const xpInCurrentLevel = learningProfile.xp % 100
  const hasTopBanner = Boolean(voicePartner || incomingInvite || outgoingInvite || incomingGameInvite || incomingMgInvite)

  return (
    <div className="app-shell">
      {/* === MAIN 2.5D CAFÉ VIEWPORT === */}
      <main className="cafe-main">
        <div className="game-canvas" ref={mountRef} aria-label="Không gian 2.5D K-CHILL Café" />

        {/* Reopen Drawer Floating Handle when Right Drawer is collapsed */}
        {!drawerOpen && (
          <button
            type="button"
            className="drawer-reopen-tab right-reopen"
            onClick={() => setDrawerOpen(true)}
            title="Mở thanh menu bên phải"
          >
            <ChevronLeft size={18} />
            <span>Mở Bảng Menu</span>
          </button>
        )}

        <div className="brand-pill">
          <div className="brand-cup"><AssetIcon src={UI_ICONS.logo} size={32} /></div>
          <div className="brand-copy">
            <strong>K-CHILL Café</strong>
            <span>
              <Users size={13} fill="currentColor" /> {onlineCount} / 30 online
              <i className={isConnected ? '' : 'offline'} title={isConnected ? 'Đã kết nối Realtime' : 'Chế độ cục bộ'} />
            </span>
          </div>
        </div>

        {/* Active Private 1-on-1 Voice Session Bar (with Story Conversation Launcher!) */}
        {voicePartner && voiceState.session && (
          <div className="voice-call-bar" role="region" aria-label="Phiên trò chuyện riêng 1-1">
            <div className={`voice-peer-avatar ${voiceState.remoteSpeaking ? 'speaking' : ''}`}>
              <Portrait look={voicePartner.avatarLook} className="small" />
            </div>
            <div className="voice-call-meta">
              <strong>
                {voicePartner.name}
                <span className="voice-timer">{formatDuration(callElapsedSec)}</span>
              </strong>
              <small>
                <i className={voiceState.connectionState === 'connected' ? 'ok' : 'wait'} />
                {voiceState.peerMuted
                  ? `${voicePartner.tableId} · Đối phương tắt mic`
                  : voiceState.connectionState === 'connected'
                    ? `${voicePartner.tableId} · Riêng tư 1-1`
                    : `${voicePartner.tableId} · Đang kết nối…`}
              </small>
            </div>
            <button
              type="button"
              className="voice-bar-btn story"
              onClick={() => openStoryConversationWith({ id: voicePartner.userId, name: voicePartner.name })}
              title="Trò chuyện theo câu chuyện (2 người cùng đọc hoặc tự đọc)"
            >
              <BookOpen size={15} />
              <span>Câu chuyện</span>
            </button>
            <button
              type="button"
              className={`voice-bar-btn ${voiceState.localMuted ? 'muted' : ''} ${voiceState.localSpeaking ? 'speaking' : ''}`}
              onClick={() => void privateVoiceService.toggleMute()}
              title={voiceState.localMuted ? 'Bật micro' : 'Tắt tiếng micro'}
            >
              {voiceState.localMuted ? <MicOff size={15} /> : <Mic size={15} />}
              <span>{voiceState.localMuted ? 'Đã tắt mic' : 'Đang bật'}</span>
            </button>
            <button
              type="button"
              className="voice-bar-btn end"
              onClick={() => privateVoiceService.endCall()}
              title="Kết thúc cuộc trò chuyện riêng"
            >
              <PhoneOff size={15} />
              <span>Kết thúc</span>
            </button>
          </div>
        )}

        {/* Outgoing Voice Invite Waiting Pill */}
        {outgoingInvite && !voiceState.session && (
          <div className="voice-outgoing-pill">
            <PhoneCall size={14} className="ring-pulse" />
            <span>Đang mời <b>{outgoingInvite.receiverName}</b> trò chuyện riêng…</span>
            <button type="button" onClick={cancelPendingOutgoingInvite}>Hủy</button>
          </div>
        )}

        {/* Incoming Voice Invitation Card */}
        {incomingInvite && !voiceState.session && (
          <div className="voice-invite-card" role="alertdialog" aria-labelledby="voice-inv-title">
            <div className="voice-invite-top">
              <Portrait look={lookById(incomingInvite.senderAvatarId)} />
              <div>
                <span className="voice-invite-kicker">LỜI MỜI GIỌNG NÓI TẠI {incomingInvite.tableId}</span>
                <strong id="voice-inv-title">{incomingInvite.senderName} muốn trò chuyện riêng với bạn.</strong>
                <small>Âm thanh chỉ kết nối riêng giữa 2 bạn tại bàn — có thể mở thêm mục Đọc câu chuyện chung!</small>
              </div>
            </div>
            <div className="voice-invite-actions">
              <button type="button" className="voice-btn-decline" onClick={() => void respondToVoiceInvite(false)}>
                Từ chối
              </button>
              <button type="button" className="voice-btn-accept" onClick={() => void respondToVoiceInvite(true)}>
                <Mic size={15} /> Chấp nhận
              </button>
            </div>
          </div>
        )}

        {/* Incoming Mini-Game Center Direct Invite Card */}
        {incomingMgInvite && !gameCenterOpen && (
          <div className="voice-invite-card" role="alertdialog">
            <div className="voice-invite-top">
              <Portrait look={lookById(incomingMgInvite.senderAvatarId)} />
              <div>
                <span className="voice-invite-kicker">
                  MỜI PHÒNG MINI-GAME #{incomingMgInvite.roomCode} · {incomingMgInvite.difficulty.toUpperCase()}
                </span>
                <strong>
                  {incomingMgInvite.senderName} mời bạn chơi {incomingMgInvite.gameTitle}!
                </strong>
                <small>Vào phòng chờ trực tiếp để bắt đầu thi đấu 2 người thật.</small>
              </div>
            </div>
            <div className="voice-invite-actions">
              <button type="button" className="voice-btn-decline" onClick={() => setIncomingMgInvite(null)}>
                Để sau
              </button>
              <button type="button" className="voice-btn-accept" onClick={() => void acceptIncomingMgInvite()}>
                <Gamepad2 size={15} /> Vào phòng ngay
              </button>
            </div>
          </div>
        )}

        {/* Legacy Incoming Game Invite */}
        {incomingGameInvite && !activeGameSession && (
          <div className="voice-invite-card" role="alertdialog">
            <div className="voice-invite-top">
              <Portrait look={lookById(incomingGameInvite.senderAvatarId)} />
              <div>
                <span className="voice-invite-kicker">THÁCH ĐẤU CÙNG BÀN</span>
                <strong>{incomingGameInvite.senderName} mời bạn đấu từ vựng!</strong>
              </div>
            </div>
            <div className="voice-invite-actions">
              <button type="button" className="voice-btn-decline" onClick={() => void respondToLegacyGameInvite(false)}>
                Để sau
              </button>
              <button type="button" className="voice-btn-accept" onClick={() => void respondToLegacyGameInvite(true)}>
                <Gamepad2 size={15} /> Vào đấu
              </button>
            </div>
          </div>
        )}

        {/* Top-Right HUD */}
        <div className="top-right-hud">
          <button
            type="button"
            className="menu-hud-pill game-center-pill"
            onClick={() => openMiniGameCenter(null)}
            title="Mở Mini-Game Center (6 trò chơi tiếng Hàn)"
          >
            <Gamepad2 size={15} /> <span>Mini-Game Center</span>
          </button>
          <button
            type="button"
            className="menu-hud-pill"
            onClick={() => setCafeMenuOpen(true)}
            title="Mở thực đơn gọi món tiếng Hàn (메뉴판)"
          >
            <Coffee size={15} /> <span>Thực đơn Hàn</span>
          </button>
          <button
            className="seat-counter"
            onClick={() => showNotice(`${occupiedSeats} / 30 ghế đang có người ngồi.`)}
          >
            <AssetIcon src={UI_ICONS.chair} size={18} /> {occupiedSeats} / 30 ghế
          </button>
          <button
            type="button"
            className={`menu-hud-pill drawer-hud-pill ${drawerOpen ? 'active' : ''}`}
            onClick={() => setDrawerOpen((prev) => !prev)}
            title={drawerOpen ? 'Thu gọn menu bên phải' : 'Mở rộng menu bên phải'}
          >
            <Menu size={15} /> <span>{drawerOpen ? 'Đóng Menu' : 'Mở Menu'}</span>
          </button>
        </div>

        {notice && (
          <div className={`toast ${notice.kind ?? ''} ${hasTopBanner ? 'shifted' : ''}`}>
            <span className="toast-icon">{notice.kind === 'success' ? <Check size={15} /> : <Sparkles size={15} />}</span>
            {notice.text}
            <button onClick={() => setNotice(null)} aria-label="Đóng thông báo"><X size={14} /></button>
          </div>
        )}

        {liveSelected && (
          <div
            className="person-popover"
            style={{
              left: `clamp(12px, ${liveSelected.x}px, calc(100% - 274px))`,
              top: `clamp(88px, ${liveSelected.y - 42}px, calc(100% - 365px))`,
            }}
          >
            <button className="popover-close" onClick={() => setSelected(null)} aria-label="Đóng"><X size={14} /></button>
            <div className="popover-person">
              <Portrait look={liveSelected.id === 'self' ? avatar : lookById(liveSelected.avatarId)} />
              <div>
                <strong>{liveSelected.id === 'self' ? displayName : liveSelected.name}</strong>
                <span>
                  {liveSelected.id === 'self' ? `${topikLevel} · Bạn` : liveSelected.level}
                  <i />
                </span>
                {liveSelected.id !== 'self' && (
                  <em className={`table-badge ${liveSelected.sameTable ? 'same' : 'diff'}`}>
                    {liveSelected.sameTable
                      ? `Cùng bàn · ${liveSelected.tableId}`
                      : liveSelected.tableId
                        ? `Khác bàn · ${liveSelected.tableId}`
                        : 'Đang đi dạo'}
                  </em>
                )}
              </div>
            </div>

            {liveSelected.id === 'self' ? (
              <>
                <button
                  className="popover-action primary"
                  onClick={() => {
                    setAvatarOpen(true)
                    setSelected(null)
                  }}
                >
                  <CircleUserRound size={17} /> Đổi tên &amp; avatar
                </button>
                <button
                  className="popover-action"
                  onClick={() => {
                    openMiniGameCenter(null)
                  }}
                >
                  <Gamepad2 size={17} /> Mở 6 Mini-Games
                </button>
                <button
                  className="popover-action"
                  onClick={() => {
                    setCafeMenuOpen(true)
                    setSelected(null)
                  }}
                >
                  <Coffee size={17} /> Gọi đồ uống tiếng Hàn
                </button>
                {snapshot.seated && (
                  <button
                    className="popover-action"
                    onClick={() => {
                      gameRef.current?.events.emit('stand-command')
                      setSelected(null)
                    }}
                  >
                    <ArrowUpRight size={17} /> Đứng dậy (E)
                  </button>
                )}
              </>
            ) : liveSelected.sameTable ? (
              <>
                {isSelectedMyCallPartner ? (
                  <>
                    <button
                      className="popover-action primary"
                      onClick={() => {
                        void privateVoiceService.toggleMute()
                        setSelected(null)
                      }}
                    >
                      {voiceState.localMuted ? <Mic size={17} /> : <MicOff size={17} />}
                      {voiceState.localMuted ? 'Bật micro của bạn' : 'Tắt tiếng micro'}
                    </button>
                    <button
                      className="popover-action danger"
                      onClick={() => {
                        privateVoiceService.endCall()
                        setSelected(null)
                      }}
                    >
                      <PhoneOff size={17} /> Kết thúc trò chuyện riêng
                    </button>
                  </>
                ) : !liveSelected.isNpc ? (
                  <button
                    className="popover-action primary"
                    onClick={() => void inviteToPrivateVoice(liveSelected.id, liveSelected.name)}
                  >
                    <AssetIcon src={UI_ICONS.mic} size={18} /> Kết nối trò chuyện riêng
                  </button>
                ) : null}

                {/* Story Conversation Action */}
                <button
                  className="popover-action story-highlight"
                  onClick={() =>
                    openStoryConversationWith(
                      liveSelected.isNpc ? null : { id: liveSelected.id, name: liveSelected.name },
                    )
                  }
                >
                  <BookOpen size={17} /> Trò chuyện theo câu chuyện
                </button>

                <button
                  className="popover-action"
                  onClick={() => {
                    const found = roomPlayers.find((p) => p.userId === liveSelected.id) ?? null
                    openMiniGameCenter(found)
                  }}
                >
                  <Gamepad2 size={17} /> Mời chơi Mini-Game <span>6 Games</span>
                </button>

                <button
                  className="popover-action"
                  onClick={() => {
                    setDrawerOpen(true)
                    setActiveNav('chat')
                    setChatValue(`@${liveSelected.name} `)
                    setSelected(null)
                  }}
                >
                  <MessageCircle size={17} /> Nhắn tin tại bàn
                </button>
                <button
                  className="popover-action"
                  onClick={() => {
                    void waveToTablemate(liveSelected.id, liveSelected.name)
                    setSelected(null)
                  }}
                >
                  <AssetIcon src={UI_ICONS.chat} size={17} /> Chào hỏi (+XP)
                </button>
                <button
                  className="popover-action danger"
                  onClick={() => blockPlayer(liveSelected.id, liveSelected.name)}
                >
                  <Ban size={16} /> Chặn người này
                </button>
              </>
            ) : (
              <div className="same-table-gate">
                <div className="gate-notice">
                  <Lock size={14} />
                  <span>Ngồi cùng bàn mới có thể tương tác với <b>{liveSelected.name}</b> nha!</span>
                </div>
                {liveSelected.seatId && liveSelected.partnerSeatAvailable && liveSelected.partnerSeatId ? (
                  <button
                    className="popover-action primary"
                    onClick={() => sitAtSeat(liveSelected.partnerSeatId!)}
                  >
                    <AssetIcon src={UI_ICONS.chair} size={17} /> Đến ngồi cùng bàn ({liveSelected.partnerSeatId})
                  </button>
                ) : (
                  <div className="gate-sub">
                    {liveSelected.seatId
                      ? `Bàn ${liveSelected.tableId} hiện đã đủ 2/2 người.`
                      : `${liveSelected.name} đang di chuyển, chưa ngồi vào bàn.`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Dock: Admin Now Playing + Strictly Table-Only Larger Chat */}
        <div className="bottom-dock">
          <div className="now-playing">
            <span className={`sound-wave ${!musicState.isPlaying || !soundOn ? 'paused' : ''}`}>
              <i /><i /><i /><i />
            </span>
            <AssetIcon src={UI_ICONS.music} size={19} />
            <div
              className="now-playing-clickable"
              onClick={() => {
                setDrawerOpen(true)
                setActiveNav('music')
              }}
              title="Bấm để xem danh sách phát & Đề xuất bài hát"
            >
              <small>
                K-CHILL RADIO · {(musicState.currentTrack.suggestedBy ?? 'K-CHILL CAFÉ').toUpperCase()}
              </small>
              <strong>{musicState.currentTrack.title}</strong>
            </div>

            <div className="dock-chill-badges">
              <button
                type="button"
                className={`dock-chill-chip ${rainOn ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setRainOn((r) => !r)
                }}
                title="Bật/Tắt âm thanh mưa rơi bên cửa sổ quán cà phê"
              >
                🌧️ {rainOn ? 'Mưa: BẬT' : 'Mưa: TẮT'}
              </button>
              <button
                type="button"
                className={`dock-chill-chip ${vinylOn ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setVinylOn((v) => !v)
                }}
                title="Bật/Tắt âm thanh đĩa than lofi vintage lách tách"
              >
                📻 {vinylOn ? 'Đĩa than: BẬT' : 'Đĩa than: TẮT'}
              </button>
              <button
                type="button"
                className={`dock-chill-chip ${cafeAmbianceOn ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setCafeAmbianceOn((c) => !c)
                }}
                title="Bật/Tắt không gian quán (tiếng ly tách sứ lách cách nhẹ nhàng)"
              >
                ☕ {cafeAmbianceOn ? 'Quán: BẬT' : 'Quán: TẮT'}
              </button>
            </div>
            <span className="dock-divider" />
            <AssetIcon src={UI_ICONS.chat} size={19} />
            <span className="system-message large-dock-msg">
              {visibleMessages[visibleMessages.length - 1]
                ? `${visibleMessages[visibleMessages.length - 1].username}: ${visibleMessages[visibleMessages.length - 1].text}`
                : 'Ngồi vào bàn để trò chuyện riêng tư cùng bạn học ✨'}
            </span>
            <button
              className="dock-expand"
              onClick={() => {
                setDrawerOpen(true)
                setActiveNav('chat')
              }}
              aria-label="Mở khung trò chuyện bàn"
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          {emoteBarOpen && (
            <div
              className="dock-emote-popover"
              style={{
                position: 'absolute',
                bottom: '72px',
                left: '12px',
                zIndex: 9999,
                background: 'rgba(34, 25, 22, 0.96)',
                border: '1.5px solid rgba(238, 196, 133, 0.35)',
                borderRadius: '16px',
                padding: '10px 12px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(10px)',
                width: '320px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#ecc079', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} /> BIỂU CẢM &amp; HÀNH ĐỘNG
                </span>
                <button
                  type="button"
                  onClick={() => setEmoteBarOpen(false)}
                  style={{ background: 'transparent', border: 0, color: '#caa992', cursor: 'pointer', padding: '2px 4px' }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Action Buttons Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {CHARACTER_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => triggerCharacterAction(action.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      padding: '7px 4px',
                      background: 'rgba(255, 240, 225, 0.06)',
                      border: '1px solid rgba(255, 240, 225, 0.12)',
                      borderRadius: '10px',
                      color: '#f5eee6',
                      fontSize: '11px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title={action.name}
                  >
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>

              {/* Korean Phrase Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid rgba(255, 240, 225, 0.1)', paddingTop: '6px' }}>
                {['안녕하세요! 👋', '만나서 반가워요 ✨', '같이 공부해요 📖', '화이팅! 💪'].map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => {
                      setChatValue((prev) => (prev ? `${prev} ${phrase}` : phrase))
                      setEmoteBarOpen(false)
                    }}
                    style={{
                      padding: '3px 7px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 240, 225, 0.1)',
                      borderRadius: '8px',
                      color: '#dfcfbe',
                      fontSize: '10px',
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form className="chat-composer" onSubmit={(e) => void submitChat(e)}>
            <span className={`scope-pill ${myTableId ? 'table' : ''}`}>
              {myTableId ? `Tại ${myTableId}` : 'Chưa ngồi bàn'}
            </span>
            <button
              type="button"
              className={`emoji-button ${emoteBarOpen ? 'active' : ''}`}
              onClick={() => setEmoteBarOpen((prev) => !prev)}
              aria-label="Hành động & Biểu cảm nhân vật"
              title="Mở bảng Biểu cảm & Hoạt họa nhân vật (Vẫy tay, Thả tim, Nhấp cà phê...)"
            >
              <Smile size={21} />
            </button>
            <input
              className="large-chat-input"
              value={chatValue}
              onChange={(event) => setChatValue(event.target.value)}
              placeholder={
                myTableId
                  ? `Nhắn tin trò chuyện tại ${myTableId}…`
                  : 'Hãy ngồi vào ghế (phím E) để trò chuyện cùng bàn…'
              }
              aria-label="Nhập tin nhắn tại bàn"
            />
            <button className="send-button" type="submit" aria-label="Gửi tin nhắn"><Send size={21} fill="currentColor" /></button>
            <button
              type="button"
              className={`round-control ${voiceState.session && !voiceState.localMuted ? 'active' : ''} ${voiceState.session && voiceState.localMuted ? 'muted-call' : ''}`}
              onClick={handleDockMicButton}
              aria-label="Micro trò chuyện riêng"
              title="Kết nối trò chuyện riêng tại bàn"
            >
              {voiceState.session && voiceState.localMuted ? (
                <MicOff size={20} />
              ) : (
                <AssetIcon src={UI_ICONS.mic} size={23} />
              )}
            </button>
            <button
              type="button"
              className="round-control"
              onClick={() => setSoundOn((value) => !value)}
              aria-label="Âm lượng"
              title={soundOn ? 'Đang bật nhạc & âm thanh' : 'Đã tắt âm thanh'}
            >
              <AssetIcon src={soundOn ? UI_ICONS.speaker : UI_ICONS.speakerMuted} size={23} />
            </button>
          </form>
        </div>

        {/* Floating Camera Controls Dock */}
        <div className="camera-floating-dock" title="Điều khiển Camera Quán">
          <button
            type="button"
            className="cam-dock-btn"
            onClick={() => gameRef.current?.events.emit('camera-zoom-in')}
            title="Phóng to góc nhìn (Lăn chuột lên hoặc bấm đây)"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="cam-dock-btn"
            onClick={() => gameRef.current?.events.emit('camera-zoom-out')}
            title="Thu nhỏ góc nhìn (Lăn chuột xuống hoặc bấm đây)"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="cam-dock-btn recenter"
            onClick={() => gameRef.current?.events.emit('camera-recenter')}
            title="Căn giữa góc nhìn vào bạn (Nhấp đúp chuột lên sàn quán)"
          >
            <LocateFixed size={14} /> <span>Tâm điểm</span>
          </button>
        </div>

        <div className="control-hint">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> di chuyển
          <span className="hint-dot">·</span> <kbd>E</kbd> ngồi / đứng
          <span className="hint-dot">·</span> Kéo chuột để xoay · Lăn chuột zoom · Nhấp đúp căn giữa
        </div>
      </main>

      {/* Mobile Drawer Overlay Backdrop */}
      {drawerOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* === COLLAPSIBLE & RESIZABLE RIGHT DRAWER (THANH MENU GÓC PHẢI) === */}
      <aside
        className={`sidebar right-drawer ${drawerOpen ? 'open' : 'collapsed'}`}
        style={
          drawerOpen && typeof window !== 'undefined' && window.innerWidth > 768
            ? { width: `${drawerWidth}px`, flexBasis: `${drawerWidth}px` }
            : undefined
        }
      >
        <div className="side-topline">
          <div className="side-brand-mini">
            <AssetIcon src={UI_ICONS.logo} size={22} />
            <span>K-CHILL CAFÉ</span>
          </div>
          <button
            type="button"
            className="drawer-collapse-btn"
            onClick={() => setDrawerOpen(false)}
            title="Thu gọn thanh menu bên phải"
          >
            Thu gọn <ChevronRight size={16} />
          </button>
        </div>

        <div className="side-nav" role="navigation" aria-label="Các khu vực chức năng">
          {navItems.map(({ id, label, iconUrl }) => (
            <button
              key={id}
              className={`nav-item ${activeNav === id ? 'active' : ''}`}
              onClick={() => setActiveNav(id)}
            >
              <span className="nav-icon"><AssetIcon src={iconUrl} size={22} /></span>
              <span>{label}</span>
              {id === 'chat' && visibleMessages.length > 1 && <b className="nav-badge">{Math.min(99, visibleMessages.length)}</b>}
              {id === 'games' && openMiniGameRooms.length > 0 && (
                <b className="nav-badge sage">{openMiniGameRooms.length}</b>
              )}
            </button>
          ))}
        </div>

        <section className="people-section">
          <div className="section-heading">
            <div>
              <h2>{activeNav === 'friends' ? 'Người trong quán' : activeTitle}</h2>
              <p>
                {activeNav === 'friends'
                  ? `${onlineCount} bạn online${myTableId ? ` · Bạn đang ngồi ${myTableId}` : ''}`
                  : activeNav === 'chat'
                    ? myTableId
                      ? `Trò chuyện riêng tư tại ${myTableId}`
                      : 'Hãy ngồi vào bàn để mở chat riêng tại bàn'
                    : activeNav === 'games'
                      ? '6 Mini-Games tiếng Hàn (Chơi đơn & Chơi chung)'
                      : activeNav === 'music'
                        ? 'Nhạc lofi thư giãn · Đề xuất 1 bài / 10 phút'
                        : activeNav === 'learn'
                          ? 'Tự học theo mốc thời gian & 10 chủ đề TOPIK'
                          : 'Âm thanh, hồ sơ & cài đặt quán'}
              </p>
            </div>
            <span className="online-light" />
          </div>

          {activeNav === 'friends' ? (
            <>
              <label className="friend-search">
                <span>⌕</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm bạn trong quán…" />
              </label>
              <div className="friend-list">
                <button className="friend-row self-row" onClick={() => setAvatarOpen(true)}>
                  <Portrait look={avatar} className="small" />
                  <span className="friend-meta">
                    <strong>
                      {displayName} <em>Bạn</em>
                      {voiceState.session && <em className="voice-pill">Đang gọi riêng</em>}
                      {(activeGameSession || activeMiniGameRoom) && <em className="game-pill">🎮 Đang chơi</em>}
                    </strong>
                    <small>{topikLevel} · Lv.{learningProfile.levelNum} · {mySeatId ? `${myTableId} (${mySeatId})` : 'Đang đi dạo'}</small>
                  </span>
                  <span className="presence" title="Đang online" />
                </button>

                {visiblePlayers.map((person) => {
                  const sameTable = areSeatsAtSameTable(mySeatId, person.seatId)
                  const pTable = getTableIdForSeat(person.seatId)
                  const partnerSeat = getPartnerSeatId(person.seatId)
                  const canJoinTable = Boolean(
                    !sameTable &&
                    person.seatId &&
                    partnerSeat &&
                    snapshot.seats.find((s) => s.id === partnerSeat)?.status === 'available',
                  )
                  return (
                    <div className={`friend-row ${sameTable ? 'same-table-row' : ''}`} key={person.userId}>
                      <button className="friend-main" onClick={() => handleSidebarPlayerClick(person)}>
                        <Portrait look={lookById(person.avatarId)} className="small" />
                        <span className="friend-meta">
                          <strong>
                            {person.username}{' '}
                            {sameTable && <em className="same-pill">Cùng bàn</em>}
                            {person.inVoiceCall && <em className="voice-pill">🎙️ Riêng tư</em>}
                            {person.inGame && <em className="game-pill">🎮 Đang đấu</em>}
                            {!person.isNpc && !sameTable && !person.inVoiceCall && !person.inGame && (
                              <em className="live-pill">Online</em>
                            )}
                          </strong>
                          <small>
                            {person.level} · {pTable ? `${pTable} (${person.seatId})` : 'Đang đi dạo'}
                          </small>
                        </span>
                      </button>
                      {canJoinTable && partnerSeat ? (
                        <button
                          className="join-table-btn"
                          onClick={() => sitAtSeat(partnerSeat)}
                          title={`Đến ngồi ghế đối diện (${partnerSeat}) cùng bàn với ${person.username}`}
                        >
                          Ngồi cùng
                        </button>
                      ) : (
                        <button
                          className={`favorite-button ${favoriteIds.has(person.userId) ? 'favorited' : ''}`}
                          aria-label={favoriteIds.has(person.userId) ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
                          onClick={() => toggleFavorite(person.userId)}
                        >
                          {favoriteIds.has(person.userId) ? <AssetIcon src={UI_ICONS.heart} size={18} /> : <Heart size={15} />}
                        </button>
                      )}
                    </div>
                  )
                })}
                {!visiblePlayers.length && <div className="empty-search">Chưa thấy bạn nào có tên ấy 🌱</div>}
              </div>
            </>
          ) : activeNav === 'chat' ? (
            <div className="drawer-chat-wrap">
              <div className="table-chat-header">
                <span className="table-badge">🪑 {myTableId ?? 'Chưa ngồi bàn'}</span>
                <span className="table-mate-text">
                  {currentTablemate
                    ? `Cùng bàn: ${currentTablemate.username} (${currentTablemate.level})`
                    : myTableId
                      ? 'Đang ngồi một mình tại bàn'
                      : 'Hãy lại gần ghế trống & nhấn phím E để vào bàn'}
                </span>
              </div>
              <div className="chat-log large-chat-log">
                {visibleMessages.map((msg) => (
                  <div key={msg.id} className={`chat-bubble-row large ${msg.userId === myUserId ? 'mine' : ''}`}>
                    <div className="chat-bubble-top">
                      <strong>{msg.username}</strong>
                      {msg.tableId && <span className="chat-scope-tag">{msg.tableId}</span>}
                      <small>{msg.time}</small>
                    </div>
                    <p>{msg.text}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="drawer-chat-quick-strip">
                {CHARACTER_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="drawer-quick-action-btn"
                    onClick={() => triggerCharacterAction(action.id)}
                    title={action.name}
                  >
                    <span>{action.icon}</span> {action.label}
                  </button>
                ))}
              </div>
              <div className="drawer-chat-chips">
                {[
                  '안녕하세요! 👋',
                  '만나서 반가워요 ✨',
                  '같이 공부해요 📖',
                  '화이팅! 💪',
                  '감사합니다 🙏',
                ].map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    className="drawer-chat-chip"
                    onClick={() => {
                      setChatValue((prev) => (prev ? `${prev} ${phrase}` : phrase))
                    }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
              <form className="drawer-chat-form" onSubmit={(e) => void submitChat(e)}>
                <input
                  value={chatValue}
                  onChange={(e) => setChatValue(e.target.value)}
                  disabled={!myTableId}
                  placeholder={
                    myTableId ? `Nhắn tại ${myTableId}…` : 'Hãy ngồi vào ghế (E) để nhắn tại bàn…'
                  }
                />
                <button type="submit" className="send-button" disabled={!myTableId} aria-label="Gửi">
                  <Send size={18} fill="currentColor" />
                </button>
              </form>
            </div>
          ) : activeNav === 'games' ? (
            <GamesSidebarPanel
              currentTablemate={currentTablemate}
              myTableId={myTableId}
              openRoomsCount={openMiniGameRooms.length}
              onOpenGameCenter={openMiniGameCenter}
            />
          ) : activeNav === 'music' ? (
            <MusicRoomPanel
              musicState={musicState}
              initialCooldownSec={suggestCooldownSec}
              rainOn={rainOn}
              onToggleRain={() => setRainOn((r) => !r)}
              vinylOn={vinylOn}
              onToggleVinyl={() => setVinylOn((v) => !v)}
              cafeAmbianceOn={cafeAmbianceOn}
              onToggleCafeAmbiance={() => setCafeAmbianceOn((c) => !c)}
              onNotice={showNotice}
            />
          ) : activeNav === 'learn' ? (
            <KoreanLearningPanel
              profile={learningProfile}
              defaultLevel={topikLevel}
              onOpenMenu={() => setCafeMenuOpen(true)}
              onNotice={showNotice}
            />
          ) : (
            <SettingsSidebarPanel
              soundOn={soundOn}
              rainOn={rainOn}
              vinylOn={vinylOn}
              cafeAmbianceOn={cafeAmbianceOn}
              onToggleSound={() => setSoundOn((s) => !s)}
              onToggleRain={() => setRainOn((r) => !r)}
              onToggleVinyl={() => setVinylOn((v) => !v)}
              onToggleCafeAmbiance={() => setCafeAmbianceOn((c) => !c)}
              onOpenAvatarModal={() => setAvatarOpen(true)}
              onOpenCafeMenu={() => setCafeMenuOpen(true)}
              onOpenRulesModal={() => setRulesModalOpen(true)}
            />
          )}
        </section>

        <div className="seat-status-card">
          <div className="seat-status-top">
            <span className="seat-icon"><AssetIcon src={UI_ICONS.chair} size={22} /></span>
            <span>
              <strong>Chỗ ngồi hiện tại</strong>
              <small>{occupiedBySelf ? `${occupiedBySelf.id} · ${myTableId ?? ''}` : 'Đang đứng đi dạo'}</small>
            </span>
            <span className="seat-open"><i />{30 - occupiedSeats} trống</span>
          </div>
          {snapshot.seated ? (
            <button className="stand-button" onClick={() => gameRef.current?.events.emit('stand-command')}>
              <ArrowUpRight size={15} /> Đứng dậy &amp; đi dạo (E)
            </button>
          ) : (
            <div className="seat-note"><span>✦</span> Lại gần ghế trống và nhấn phím E để ngồi</div>
          )}
        </div>

        <button className="level-card" onClick={() => setActiveNav('learn')} title="Xem tiến độ tự học & Thành tích">
          <div className="level-star"><AssetIcon src={UI_ICONS.star} size={24} /></div>
          <div className="level-info">
            <span>
              <strong>{topikLevel}</strong>
              <b>Lv. {learningProfile.levelNum}</b>
            </span>
            <small>
              {xpInCurrentLevel} / 100 XP · {learningProfile.wordsLearnedIds.length} từ thuộc
            </small>
            <div className="xp-track">
              <i style={{ width: `${Math.max(6, xpInCurrentLevel)}%` }} />
            </div>
          </div>
          <ChevronDown size={15} />
        </button>

        {/* === Ô GÓP Ý CHO NHÀ PHÁT TRIỂN (DƯỚI CÙNG KHUNG MENU) === */}
        <div className="sidebar-support-box">
          <button
            type="button"
            className="feedback-trigger-btn"
            onClick={() => setFeedbackModalOpen(true)}
            title="Gửi góp ý, báo lỗi hoặc đề xuất ý tưởng cho quán"
          >
            <MessageSquareQuote size={14} />
            <span>Góp ý cho nhà phát triển 💌</span>
          </button>
        </div>

        {/* Drag-Resize Handle on Left Edge of Right Drawer */}
        <div
          className="drawer-resize-handle left-handle"
          onMouseDown={startDrawerResize}
          title="Kéo sang trái/phải để phóng to hoặc thu nhỏ thanh menu"
        />
      </aside>

      {/* Welcome Name-Only Entry Modal */}
      {!hasEntered && (
        <div className="modal-backdrop welcome-backdrop">
          <form className="avatar-modal welcome-modal" onSubmit={handleEnterCafe} role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <div className="modal-kicker"><Sparkles size={15} /> K-CHILL CAFÉ · 카페에서 만나요</div>
            <h2 id="welcome-title">Nhập tên để vào quán ☕</h2>
            <p>Không cần đăng ký hay mật khẩu — chỉ cần nhập tên hiển thị của bạn là vào ngồi học, nghe nhạc &amp; chơi 6 Mini-Games ngay!</p>

            <label className="name-field">
              <span>Tên của bạn</span>
              <input
                ref={nameInputRef}
                maxLength={18}
                value={entryName}
                onChange={(event) => setEntryName(event.target.value)}
                placeholder="Ví dụ: Minh, Hiếu, Thảo…"
              />
            </label>

            <div className="topik-picker">
              <span>Cấp độ tiếng Hàn</span>
              <div className="topik-pills">
                {TOPIK_LEVELS.map((lvl) => (
                  <button
                    type="button"
                    key={lvl}
                    className={`topik-pill ${topikLevel === lvl ? 'active' : ''}`}
                    onClick={() => setTopikLevel(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="avatar-grid">
              {avatarLooks.map((look) => (
                <button
                  type="button"
                  key={look.id}
                  className={`avatar-choice ${avatar.id === look.id ? 'chosen' : ''}`}
                  onClick={() => setAvatar(look)}
                >
                  <Portrait look={look} />
                  <span>{look.name}</span>
                  {avatar.id === look.id && <i><Check size={12} /></i>}
                </button>
              ))}
            </div>

            <div
              style={{
                background: 'rgba(238, 196, 133, 0.08)',
                border: '1px solid rgba(238, 196, 133, 0.22)',
                borderRadius: '10px',
                padding: '7px 11px',
                fontSize: '10.5px',
                color: '#eed7c5',
                lineHeight: 1.45,
                marginTop: '4px',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#ecc079', marginBottom: '2px' }}>
                <Shield size={13} /> Dự án giáo dục phi thương mại &amp; phi lợi nhuận
              </span>
              K-CHILL Café phục vụ mục đích học tiếng Hàn &amp; nghiên cứu công nghệ. Nhạc phát từ YouTube chính thức.
              <button
                type="button"
                onClick={() => setRulesModalOpen(true)}
                style={{
                  display: 'inline-block',
                  marginLeft: '6px',
                  color: '#f5c982',
                  textDecoration: 'underline',
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  fontWeight: 750,
                  fontSize: '10.5px',
                }}
              >
                Nội quy &amp; Pháp lý 📜
              </button>
            </div>

            <div className="modal-bottom">
              <span><UserCheck size={15} /> Tối đa 30 bạn trong cùng một quán</span>
              <button type="submit" className="confirm-button">
                Vào quán ngay <ArrowUpRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customize Name & Avatar Modal */}
      {hasEntered && avatarOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAvatarOpen(false) }}>
          <div className="avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-title">
            <button className="modal-close" onClick={() => setAvatarOpen(false)} aria-label="Đóng"><X size={18} /></button>
            <div className="modal-kicker"><Sparkles size={15} /> GÓC NHỎ CỦA BẠN</div>
            <h2 id="avatar-title">Đổi tên &amp; avatar</h2>
            <p>Thay đổi của bạn sẽ hiển thị ngay lập tức với mọi người trong quán.</p>
            <label className="name-field">
              <span>Tên hiển thị</span>
              <input
                maxLength={18}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Tên của bạn"
              />
            </label>
            <div className="topik-picker">
              <span>Cấp độ tiếng Hàn</span>
              <div className="topik-pills">
                {TOPIK_LEVELS.map((lvl) => (
                  <button
                    type="button"
                    key={lvl}
                    className={`topik-pill ${topikLevel === lvl ? 'active' : ''}`}
                    onClick={() => setTopikLevel(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
            <div className="avatar-grid">
              {avatarLooks.map((look) => (
                <button
                  key={look.id}
                  type="button"
                  className={`avatar-choice ${avatar.id === look.id ? 'chosen' : ''}`}
                  onClick={() => changeAvatar(look)}
                >
                  <Portrait look={look} />
                  <span>{look.name}</span>
                  {avatar.id === look.id && <i><Check size={12} /></i>}
                </button>
              ))}
            </div>
            <div className="modal-bottom">
              <span>Mẹo: Ngồi cùng bàn để gọi riêng, đọc câu chuyện &amp; đấu game.</span>
              <button
                className="confirm-button"
                onClick={() => {
                  const clean = displayName.trim() || 'Bạn'
                  setDisplayName(clean)
                  gameRef.current?.events.emit('avatar-change', avatar, clean, topikLevel)
                  setAvatarOpen(false)
                  showNotice(`Đã cập nhật hồ sơ thành công, chào ${clean}!`, 'success')
                }}
              >
                Lưu thay đổi <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Same-Table Tablemate Profile Modal */}
      {profilePlayer && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfilePlayer(null) }}>
          <div className="profile-modal" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setProfilePlayer(null)} aria-label="Đóng"><X size={18} /></button>
            <Portrait look={lookById(profilePlayer.avatarId)} className="profile-portrait" />
            <div className="profile-label">BẠN CÙNG BÀN · {getTableIdForSeat(profilePlayer.seatId) ?? 'K-CHILL'} <i /></div>
            <h2>{profilePlayer.username}</h2>
            <p>{profilePlayer.level} · Đang ngồi tại {profilePlayer.seatId ?? 'quán'}</p>
            <div className="profile-stats">
              <span><b>{profilePlayer.level}</b><small>Trình độ</small></span>
              <span><b>Lv. {profilePlayer.levelNum ?? 1}</b><small>Cấp độ</small></span>
              <span><b>{profilePlayer.inVoiceCall ? 'Đang gọi' : profilePlayer.inGame ? 'Đang đấu' : 'Online'}</b><small>Trạng thái</small></span>
            </div>
            <div className="profile-actions-stack">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#ecc079', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} /> Tương tác với {profilePlayer.username}:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {CHARACTER_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        triggerCharacterAction(action.id)
                        setProfilePlayer(null)
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        padding: '6px 4px',
                        background: 'rgba(255, 240, 225, 0.06)',
                        border: '1px solid rgba(255, 240, 225, 0.14)',
                        borderRadius: '9px',
                        color: '#f5eee6',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title={action.name}
                    >
                      <span style={{ fontSize: '16px' }}>{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {!profilePlayer.isNpc && voicePartner?.userId !== profilePlayer.userId && (
                <button
                  className="confirm-button full"
                  onClick={() => void inviteToPrivateVoice(profilePlayer.userId, profilePlayer.username)}
                >
                  <Mic size={16} /> Kết nối trò chuyện riêng
                </button>
              )}
              <button
                className="confirm-button full"
                onClick={() =>
                  openStoryConversationWith(
                    profilePlayer.isNpc ? null : { id: profilePlayer.userId, name: profilePlayer.username },
                  )
                }
              >
                <BookOpen size={16} /> Trò chuyện theo câu chuyện
              </button>
              <button
                className="secondary-modal-btn full"
                onClick={() => openMiniGameCenter(profilePlayer)}
              >
                <Gamepad2 size={16} /> Mời chơi 6 Mini-Games
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Korean Barista Menu Modal */}
      {cafeMenuOpen && (
        <CafeMenuModal
          onClose={() => setCafeMenuOpen(false)}
          onOrder={handleOrderMenuItem}
          onOpenFeedback={() => setFeedbackModalOpen(true)}
        />
      )}

      {/* User Feedback Modal */}
      {feedbackModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFeedbackModalOpen(false)
          }}
        >
          <div className="avatar-modal feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <button className="modal-close" onClick={() => setFeedbackModalOpen(false)} aria-label="Đóng">
              <X size={18} />
            </button>
            <div className="modal-kicker">
              <MessageSquareQuote size={15} /> HÒM THƯ GÓP Ý · 의견 보내기
            </div>
            <h2 id="feedback-title">Góp ý cho Nhà phát triển 💌</h2>
            <p>
              Bạn muốn quán có thêm tính năng gì, bài hát nào, hay gặp bất kỳ lỗi gì khi học tiếng Hàn? Mọi ý kiến đóng góp của bạn đều giúp K-CHILL Café ngày càng hoàn thiện hơn!
            </p>

            <form onSubmit={handleSendFeedback} className="feedback-form">
              <div className="feedback-sender-badge">
                <span>Người gửi:</span>
                <strong>{displayName}</strong>
                <small>({topikLevel})</small>
              </div>

              <textarea
                className="feedback-textarea"
                rows={4}
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                placeholder="Nhập nội dung góp ý, đề xuất bài hát mới, tính năng mới hoặc báo lỗi tại đây... (Ví dụ: Thêm mini-game ghép câu, playlist nhạc phim Reply 1988...)"
                maxLength={800}
                required
              />

              <div className="feedback-form-actions">
                <span className="char-count">{feedbackContent.length}/800 ký tự</span>
                <button type="submit" className="confirm-button" disabled={submittingFeedback || !feedbackContent.trim()}>
                  {submittingFeedback ? 'Đang gửi...' : 'Gửi góp ý ngay ✨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Story Conversation Modal (2 người cùng đọc / 2 người tự đọc) */}
      {storyModalOpen && (
        <StoryReaderModal
          partnerId={storyPartner?.id ?? (voicePartner ? voicePartner.userId : null)}
          partnerName={storyPartner?.name ?? (voicePartner ? voicePartner.name : null)}
          incomingSync={incomingStorySync}
          onClose={() => setStoryModalOpen(false)}
          onNotice={showNotice}
        />
      )}

      {/* 6-Game Mini-Game Center Modal */}
      {gameCenterOpen && (
        <MiniGameCenterModal
          myUserId={myUserId}
          onlinePlayers={roomPlayers}
          openRooms={openMiniGameRooms}
          activeRoom={activeMiniGameRoom}
          initialInviteTarget={gameCenterInviteTarget}
          onClose={() => {
            setGameCenterOpen(false)
            setGameCenterInviteTarget(null)
          }}
          onNotice={showNotice}
          onActiveRoomChange={setActiveMiniGameRoom}
        />
      )}

      {/* Legacy Active Table Game Arena */}
      {activeGameSession && (
        <KoreanGameArena
          session={activeGameSession}
          myUserId={myUserId}
          onLeave={handleLeaveActiveGame}
        />
      )}

      {gameResultSummary && !activeGameSession && (
        <GameResultModal
          summary={gameResultSummary}
          myUserId={myUserId}
          onClose={() => setGameResultSummary(null)}
          onPlayAgain={() => {
            setGameResultSummary(null)
            openMiniGameCenter(currentTablemate)
          }}
        />
      )}

      {/* Community Rules & Legal Non-Commercial Disclaimer Modal */}
      {rulesModalOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 99999 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRulesModalOpen(false)
          }}
        >
          <div
            className="avatar-modal"
            style={{ maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto' }}
            role="dialog"
            aria-modal="true"
          >
            <button
              className="modal-close"
              onClick={() => setRulesModalOpen(false)}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
            <div className="modal-kicker">
              <Shield size={14} /> K-CHILL CAFÉ · PHÁP LÝ &amp; ĐIỀU KHOẢN
            </div>
            <h2 style={{ fontSize: '18px', margin: '4px 0 10px' }}>
              Nội Quy Quán &amp; Tuyên Bố Bản Quyền 📜
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '12px', color: '#eeded1', lineHeight: '1.5' }}>
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <strong style={{ color: '#ecc079', display: 'block', marginBottom: '2px' }}>
                  1. Mục Đích Giáo Dục Phi Thương Mại
                </strong>
                K-CHILL Café là sản phẩm nghiên cứu công nghệ, phục vụ thực hành ngôn ngữ và học từ vựng tiếng Hàn (TOPIK). Nền tảng hoàn toàn phi lợi nhuận, không thu phí, không có cổng thanh toán hay nạp tiền.
              </div>

              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <strong style={{ color: '#ecc079', display: 'block', marginBottom: '2px' }}>
                  2. Bản Quyền Âm Nhạc YouTube
                </strong>
                Mọi bài hát phát trong quán được nhúng trực tiếp qua giao diện YouTube Embedded Player chính thức từ các kênh nghệ sĩ và nhà phân phối gốc. Bản quyền và doanh thu lượt xem hoàn toàn thuộc về chủ sở hữu nội dung trên YouTube.
              </div>

              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <strong style={{ color: '#ecc079', display: 'block', marginBottom: '2px' }}>
                  3. Văn Hóa Ứng Xử &amp; Luật An Ninh Mạng
                </strong>
                Nghiêm cấm phát ngôn thô tục, xúc phạm danh dự, phân biệt vùng miền, quấy rối bạn học, bàn luận chính trị hoặc vi phạm pháp luật Việt Nam. Hệ thống tự động lọc từ ngữ cấm và quán có quyền ngắt kết nối tài khoản vi phạm.
              </div>

              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <strong style={{ color: '#ecc079', display: 'block', marginBottom: '2px' }}>
                  4. Quyền Riêng Tư &amp; Thoại Trực Tuyến
                </strong>
                Hệ thống không thu thập dữ liệu định danh nhạy cảm (không yêu cầu số điện thoại, CCCD/CMND, thẻ ngân hàng). Tính năng gọi thoại 1-1 tại bàn kết nối WebRTC ngang hàng, quán không lưu bất kỳ bản ghi âm nào.
              </div>
            </div>

            <div className="modal-bottom" style={{ marginTop: '14px' }}>
              <button
                type="button"
                className="confirm-button full"
                onClick={() => setRulesModalOpen(false)}
              >
                Tôi Đã Hiểu &amp; Đồng Ý Vào Quán
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
