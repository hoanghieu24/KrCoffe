import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Award,
  Check,
  Copy,
  Gamepad2,
  History,
  KeyRound,
  Play,
  Send,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import type { RoomPlayerState } from '../domain/types'
import { multiplayerClient } from '../services/multiplayer'
import { KoreanListeningGame } from './modules/KoreanListeningGame'
import { KoreanMemoryGame } from './modules/KoreanMemoryGame'
import { KoreanQuizBattleGame } from './modules/KoreanQuizBattleGame'
import { KoreanWordBuilderGame } from './modules/KoreanWordBuilderGame'
import { FallingWordsPhaserGame } from './phaser/FallingWordsPhaserGame'
import { WordShooterPhaserGame } from './phaser/WordShooterPhaserGame'
import {
  loadDuoLeaderboard,
  loadMiniGameStats,
  loadSoloLeaderboard,
  MINIGAME_ACHIEVEMENTS,
  recordDuoLeaderboard,
  recordMiniGameFinish,
  recordSoloLeaderboard,
  type DuoLeaderboardEntry,
  type SoloLeaderboardEntry,
} from './services/gameScoreStore'
import type {
  GameDifficulty,
  MiniGameCardMeta,
  MiniGameId,
  MiniGameLobbyRoom,
  MiniGameStatsSummary,
} from './types'

export const MINI_GAMES_CATALOG: MiniGameCardMeta[] = [
  {
    id: 'falling-words',
    title: 'Korean Falling Words',
    subtitleKo: '비 오는 단어',
    shortDescription: 'Từ tiếng Hàn rơi từ trên xuống — nhập nhanh nghĩa tiếng Việt trước khi chạm đáy!',
    imageUrl: '/assets/games/card-falling-words.png',
    defaultDifficulty: 'easy',
    supportedModes: ['solo', 'multiplayer', 'invite-friend', 'private-room'],
    engineLabel: 'Phaser 3',
  },
  {
    id: 'word-shooter',
    title: 'Korean Word Shooter',
    subtitleKo: '단어 슈팅',
    shortDescription: 'Ngắm bắn chính xác đám mây chứa từ tiếng Hàn khớp với nghĩa tiếng Việt được giao.',
    imageUrl: '/assets/games/card-word-shooter.png',
    defaultDifficulty: 'normal',
    supportedModes: ['solo', 'multiplayer', 'invite-friend', 'private-room'],
    engineLabel: 'Phaser 3',
  },
  {
    id: 'korean-memory',
    title: 'Korean Memory',
    subtitleKo: '단어 기억 카드',
    shortDescription: 'Lật mở từng cặp thẻ để ghép từ vựng Hangul với nghĩa tiếng Việt tương ứng (4 / 8 / 12 cặp).',
    imageUrl: '/assets/games/card-korean-memory.png',
    defaultDifficulty: 'easy',
    supportedModes: ['solo', 'multiplayer', 'invite-friend', 'private-room'],
    engineLabel: 'React Interactive',
  },
  {
    id: 'quiz-battle',
    title: 'Korean Quiz Battle',
    subtitleKo: '한국어 퀴즈 배틀',
    shortDescription: '10 câu hỏi tốc độ (10 giây/câu), thưởng điểm phản xạ nhanh & thi đấu trực tiếp 2 người!',
    imageUrl: '/assets/games/card-quiz-battle.png',
    defaultDifficulty: 'normal',
    supportedModes: ['solo', 'multiplayer', 'invite-friend', 'private-room'],
    engineLabel: 'React Interactive',
  },
  {
    id: 'word-builder',
    title: 'Korean Word Builder',
    subtitleKo: '음절 블록 조립',
    shortDescription: 'Kéo thả hoặc chọn các âm tiết tiếng Hàn bị xáo trộn để ghép thành từ vựng hoàn chỉnh.',
    imageUrl: '/assets/games/card-word-builder.png',
    defaultDifficulty: 'easy',
    supportedModes: ['solo', 'multiplayer', 'invite-friend', 'private-room'],
    engineLabel: 'React Interactive',
  },
  {
    id: 'listening-challenge',
    title: 'Korean Listening Challenge',
    subtitleKo: '듣기 챌린지',
    shortDescription: 'Luyện nghe phát âm tiếng Hàn chuẩn (tối đa 3 lần nghe lại/câu) kèm giải thích chi tiết.',
    imageUrl: '/assets/games/card-listening-challenge.png',
    defaultDifficulty: 'normal',
    supportedModes: ['solo', 'multiplayer', 'invite-friend', 'private-room'],
    engineLabel: 'React Interactive',
  },
]

const MODE_LABELS: Record<string, string> = {
  solo: 'Chơi đơn',
  multiplayer: 'Nhiều người',
  'invite-friend': 'Mời bạn',
  'private-room': 'Phòng riêng',
}

export function MiniGameCenterModal({
  myUserId,
  onlinePlayers,
  openRooms,
  activeRoom,
  initialInviteTarget,
  onClose,
  onNotice,
  onActiveRoomChange,
}: {
  myUserId: string
  onlinePlayers: RoomPlayerState[]
  openRooms: MiniGameLobbyRoom[]
  activeRoom: MiniGameLobbyRoom | null
  initialInviteTarget?: RoomPlayerState | null
  onClose: () => void
  onNotice: (text: string, kind?: 'success' | 'tip') => void
  onActiveRoomChange: (room: MiniGameLobbyRoom | null) => void
}) {
  const [centerTab, setCenterTab] = useState<'games' | 'rooms' | 'stats'>('games')
  const [selectedDifficultyByGame, setSelectedDifficultyByGame] = useState<Record<MiniGameId, GameDifficulty>>({
    'falling-words': 'easy',
    'word-shooter': 'normal',
    'korean-memory': 'easy',
    'quiz-battle': 'normal',
    'word-builder': 'easy',
    'listening-challenge': 'normal',
  })

  const [soloSession, setSoloSession] = useState<{
    gameId: MiniGameId
    difficulty: GameDifficulty
    seed: number
  } | null>(null)

  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [stats, setStats] = useState<MiniGameStatsSummary>(() => loadMiniGameStats())
  const [pickerDuoGameId, setPickerDuoGameId] = useState<MiniGameId | null>(null)
  const [leaderboardTab, setLeaderboardTab] = useState<'solo' | 'duo' | 'achievements'>('solo')
  const [soloLeaderboard, setSoloLeaderboard] = useState<SoloLeaderboardEntry[]>(() => loadSoloLeaderboard())
  const [duoLeaderboard, setDuoLeaderboard] = useState<DuoLeaderboardEntry[]>(() => loadDuoLeaderboard())

  const realFriends = useMemo(
    () => onlinePlayers.filter((p) => !p.isNpc && p.userId !== myUserId),
    [onlinePlayers, myUserId],
  )

  useEffect(() => {
    void multiplayerClient.listMiniGameRooms()
  }, [])

  const getGameMeta = (gameId: MiniGameId): MiniGameCardMeta =>
    MINI_GAMES_CATALOG.find((g) => g.id === gameId) ?? MINI_GAMES_CATALOG[0]

  const startSolo = (gameId: MiniGameId) => {
    if (activeRoom) {
      multiplayerClient.leaveMiniGameRoom()
      onActiveRoomChange(null)
    }
    const diff = selectedDifficultyByGame[gameId] ?? 'easy'
    setSoloSession({
      gameId,
      difficulty: diff,
      seed: Math.floor(100000 + Math.random() * 899999),
    })
  }

  const handleDirectDuoLaunch = async (gameId: MiniGameId, target: RoomPlayerState) => {
    setPickerDuoGameId(null)
    const diff = selectedDifficultyByGame[gameId] ?? 'normal'
    const res = await multiplayerClient.createMiniGameRoom({
      gameId,
      difficulty: diff,
      isPrivate: true,
      memoryPairs: diff === 'easy' ? 4 : diff === 'normal' ? 8 : 12,
      memoryTimed: true,
    })
    if (!res.ok || !res.room) {
      onNotice(res.reason || 'Không thể tạo phòng chơi Duo lúc này.')
      return
    }
    setSoloSession(null)
    onActiveRoomChange(res.room)

    const meta = getGameMeta(gameId)
    await multiplayerClient.inviteFriendToMiniGameRoom({
      targetId: target.userId,
      roomId: res.room.roomId,
      roomCode: res.room.roomCode,
      gameId,
      gameTitle: meta.title,
      difficulty: diff,
    })
    onNotice(`⚔️ Đã gửi lời mời chiến đấu Duo tới ${target.username}! Khi bạn ấy chấp nhận, trận đấu sẽ bắt đầu ngay.`, 'success')
  }

  const handleCreateRoom = async (gameId: MiniGameId, isPrivate: boolean) => {
    const diff = selectedDifficultyByGame[gameId] ?? 'easy'
    const res = await multiplayerClient.createMiniGameRoom({
      gameId,
      difficulty: diff,
      isPrivate,
      memoryPairs: diff === 'easy' ? 4 : diff === 'normal' ? 8 : 12,
      memoryTimed: true,
    })
    if (!res.ok || !res.room) {
      onNotice(res.reason || 'Không thể tạo phòng chơi lúc này.')
      return
    }
    setSoloSession(null)
    onActiveRoomChange(res.room)

    if (initialInviteTarget && !initialInviteTarget.isNpc) {
      const meta = getGameMeta(gameId)
      await multiplayerClient.inviteFriendToMiniGameRoom({
        targetId: initialInviteTarget.userId,
        roomId: res.room.roomId,
        roomCode: res.room.roomCode,
        gameId,
        gameTitle: meta.title,
        difficulty: diff,
      })
      onNotice(`⚔️ Đã gửi lời mời Duo tới ${initialInviteTarget.username}! Đang chờ đối thủ sẵn sàng…`, 'success')
    } else {
      onNotice(
        `Đã tạo ${isPrivate ? 'phòng riêng' : 'phòng công khai'} mã #${res.room.roomCode}! Mời bạn bè vào cùng đấu nhé.`,
        'success',
      )
    }
  }

  const handleJoinRoom = async (roomId: string) => {
    const res = await multiplayerClient.joinMiniGameRoom(roomId)
    if (!res.ok || !res.room) {
      onNotice(res.reason || 'Không thể tham gia phòng.')
      return
    }
    setSoloSession(null)
    onActiveRoomChange(res.room)
    onNotice(`Đã vào phòng #${res.room.roomCode}!`, 'success')
  }

  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!joinCodeInput.trim()) return
    const res = await multiplayerClient.joinMiniGameByCode(joinCodeInput.trim())
    if (!res.ok || !res.room) {
      onNotice(res.reason || 'Không tìm thấy mã phòng này.')
      return
    }
    setJoinCodeInput('')
    setSoloSession(null)
    onActiveRoomChange(res.room)
    onNotice(`Đã tham gia phòng #${res.room.roomCode} thành công!`, 'success')
  }

  const handleInviteFriendToCurrentRoom = async (target: RoomPlayerState) => {
    if (!activeRoom) return
    const meta = getGameMeta(activeRoom.gameId)
    const res = await multiplayerClient.inviteFriendToMiniGameRoom({
      targetId: target.userId,
      roomId: activeRoom.roomId,
      roomCode: activeRoom.roomCode,
      gameId: activeRoom.gameId,
      gameTitle: meta.title,
      difficulty: activeRoom.difficulty,
    })
    if (res.ok) {
      onNotice(`⚔️ Đã gửi lời mời chiến đấu Duo tới ${target.username}!`, 'success')
    } else {
      onNotice(res.reason || 'Không thể gửi lời mời.')
    }
  }

  const handleStartRoomMatch = async () => {
    if (!activeRoom) return
    const res = await multiplayerClient.startMiniGameRoom(activeRoom.roomId)
    if (!res.ok) {
      onNotice(res.reason || 'Cần đủ 2 người chơi thật trong phòng để bắt đầu!')
    }
  }

  const handleLeaveCurrentMode = () => {
    if (activeRoom) {
      multiplayerClient.leaveMiniGameRoom()
      onActiveRoomChange(null)
    }
    setSoloSession(null)
  }

  const handleRecordFinish = (
    gameId: MiniGameId,
    mode: 'solo' | 'multiplayer',
    difficulty: GameDifficulty,
    score: number,
    correctCount: number,
    won?: boolean,
  ) => {
    const meta = getGameMeta(gameId)
    const { nextStats, newlyUnlocked } = recordMiniGameFinish({
      gameId,
      gameTitle: meta.title,
      mode,
      difficulty,
      score,
      correctCount,
      won,
    })
    setStats(nextStats)

    const me = onlinePlayers.find((p) => p.userId === myUserId)
    const myName = me?.username || 'Bạn'
    const myLevel = me?.level || 'TOPIK I'

    if (mode === 'solo') {
      const updatedSolo = recordSoloLeaderboard({
        playerName: myName,
        playerLevel: myLevel,
        gameId,
        gameTitle: meta.title,
        difficulty,
        score: Math.round(score),
        correctCount,
      })
      setSoloLeaderboard(updatedSolo)

      const earnedXp = Math.max(10, Math.min(75, 12 + Math.floor(score / 25)))
      multiplayerClient.awardBonusXp({ xp: earnedXp, gameCompleted: true, won: score > 0 })
    } else {
      const opponent = activeRoom?.players.find((p) => p.userId !== myUserId)
      const p1Name = myName
      const p2Name = opponent?.username || 'Đồng đội'
      const p1Score = Math.round(score)
      const p2Score = opponent?.score ?? 0
      const combined = p1Score + p2Score
      const outcome =
        p1Score > p2Score
          ? `${p1Name} chiến thắng (${p1Score}đ vs ${p2Score}đ)`
          : p1Score < p2Score
            ? `${p2Name} chiến thắng (${p2Score}đ vs ${p1Score}đ)`
            : 'Hòa điểm đồng đội xuất sắc ⚔️'

      const updatedDuo = recordDuoLeaderboard({
        p1Name,
        p2Name,
        gameId,
        gameTitle: meta.title,
        difficulty,
        combinedScore: combined,
        p1Score,
        p2Score,
        p1Correct: correctCount,
        p2Correct: opponent?.correctCount ?? 0,
        outcomeText: outcome,
      })
      setDuoLeaderboard(updatedDuo)
    }

    if (newlyUnlocked.length > 0) {
      onNotice(`🏅 Thành tích Game mới: ${newlyUnlocked[0].icon} ${newlyUnlocked[0].title}!`, 'success')
    }
  }

  // Determine if we are currently playing a game (Solo OR Multiplayer Room in 'playing'/'finished' status)
  const playingGameId: MiniGameId | null = soloSession
    ? soloSession.gameId
    : activeRoom && (activeRoom.status === 'playing' || activeRoom.status === 'finished')
      ? activeRoom.gameId
      : null

  const playingDifficulty: GameDifficulty = soloSession
    ? soloSession.difficulty
    : activeRoom?.difficulty ?? 'easy'

  const playingSeed: number = soloSession ? soloSession.seed : activeRoom?.sharedSeed ?? 123456

  const handleRestartCurrentGame = () => {
    if (soloSession) {
      setSoloSession({
        ...soloSession,
        seed: Math.floor(100000 + Math.random() * 899999),
      })
      return
    }
    if (activeRoom) {
      void multiplayerClient.restartMiniGameRoom(activeRoom.roomId)
    }
  }

  const handleRoomProgress = (score: number, correctCount: number, finished?: boolean) => {
    if (!activeRoom) return
    multiplayerClient.sendMiniGameProgress({
      roomId: activeRoom.roomId,
      score,
      correctCount,
      finished,
    })
  }

  return (
    <div
      className="modal-backdrop mg-center-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !playingGameId && !activeRoom) onClose()
      }}
    >
      <div className="mg-center-shell" role="dialog" aria-modal="true" aria-label="K-CHILL Mini-Game Center">
        {/* Header */}
        <header className="mg-center-header">
          <div className="mg-center-brand">
            <div className="mg-header-emblem">
              <img src="/assets/games/badge-game-trophy.png" alt="K-CHILL Game Center" />
            </div>
            <div>
              <span className="mg-eyebrow">K-CHILL CAFÉ · MINI-GAME CENTER</span>
              <h2>
                {playingGameId
                  ? `${getGameMeta(playingGameId).title} · ${getGameMeta(playingGameId).subtitleKo}`
                  : activeRoom
                    ? `Phòng chờ #${activeRoom.roomCode} · ${getGameMeta(activeRoom.gameId).title}`
                    : 'Trung Tâm Trò Chơi Tiếng Hàn 🎮'}
              </h2>
            </div>
          </div>

          <div className="mg-header-right">
            {(playingGameId || activeRoom) ? (
              <button type="button" className="secondary-modal-btn" onClick={handleLeaveCurrentMode}>
                <ArrowLeft size={15} /> Quay lại danh sách 6 Game
              </button>
            ) : (
              <div className="mg-nav-tabs">
                <button
                  type="button"
                  className={centerTab === 'games' ? 'active' : ''}
                  onClick={() => setCenterTab('games')}
                >
                  <Gamepad2 size={14} /> 6 Mini-Games
                </button>
                <button
                  type="button"
                  className={centerTab === 'rooms' ? 'active' : ''}
                  onClick={() => setCenterTab('rooms')}
                >
                  <Users size={14} /> Phòng Chơi ({openRooms.length})
                </button>
                <button
                  type="button"
                  className={centerTab === 'stats' ? 'active' : ''}
                  onClick={() => setCenterTab('stats')}
                >
                  <Trophy size={14} /> BXH &amp; Kỷ Lục
                </button>
              </div>
            )}

            <button
              type="button"
              className="mg-close-btn"
              onClick={() => {
                if (activeRoom) {
                  multiplayerClient.leaveMiniGameRoom()
                  onActiveRoomChange(null)
                }
                onClose()
              }}
              aria-label="Đóng Mini-Game Center"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="mg-center-body">
          {/* 1. Active Gameplay View */}
          {playingGameId ? (
            <>
              {playingGameId === 'falling-words' && (
                <FallingWordsPhaserGame
                  key={`fw-${playingSeed}`}
                  difficulty={playingDifficulty}
                  seed={playingSeed}
                  room={activeRoom}
                  myUserId={myUserId}
                  onProgress={activeRoom ? handleRoomProgress : undefined}
                  onFinish={(s, c) =>
                    handleRecordFinish('falling-words', activeRoom ? 'multiplayer' : 'solo', playingDifficulty, s, c)
                  }
                  onRestart={handleRestartCurrentGame}
                  onExit={handleLeaveCurrentMode}
                />
              )}
              {playingGameId === 'word-shooter' && (
                <WordShooterPhaserGame
                  key={`ws-${playingSeed}`}
                  difficulty={playingDifficulty}
                  seed={playingSeed}
                  room={activeRoom}
                  myUserId={myUserId}
                  onProgress={activeRoom ? handleRoomProgress : undefined}
                  onFinish={(s, c) =>
                    handleRecordFinish('word-shooter', activeRoom ? 'multiplayer' : 'solo', playingDifficulty, s, c)
                  }
                  onRestart={handleRestartCurrentGame}
                  onExit={handleLeaveCurrentMode}
                />
              )}
              {playingGameId === 'korean-memory' && (
                <KoreanMemoryGame
                  key={`km-${playingSeed}`}
                  difficulty={playingDifficulty}
                  initialPairs={playingDifficulty === 'easy' ? 4 : playingDifficulty === 'normal' ? 8 : 12}
                  seed={playingSeed}
                  room={activeRoom}
                  myUserId={myUserId}
                  onProgress={activeRoom ? handleRoomProgress : undefined}
                  onFinish={(s, c) =>
                    handleRecordFinish('korean-memory', activeRoom ? 'multiplayer' : 'solo', playingDifficulty, s, c)
                  }
                  onExit={handleLeaveCurrentMode}
                />
              )}
              {playingGameId === 'quiz-battle' && (
                <KoreanQuizBattleGame
                  key={`qb-${playingSeed}-${activeRoom?.startedAt ?? 0}`}
                  difficulty={playingDifficulty}
                  seed={playingSeed}
                  room={activeRoom}
                  myUserId={myUserId}
                  onProgress={activeRoom ? handleRoomProgress : undefined}
                  onFinish={(s, c, won) =>
                    handleRecordFinish('quiz-battle', activeRoom ? 'multiplayer' : 'solo', playingDifficulty, s, c, won)
                  }
                  onRestart={handleRestartCurrentGame}
                  onExit={handleLeaveCurrentMode}
                />
              )}
              {playingGameId === 'word-builder' && (
                <KoreanWordBuilderGame
                  key={`wb-${playingSeed}`}
                  difficulty={playingDifficulty}
                  seed={playingSeed}
                  room={activeRoom}
                  myUserId={myUserId}
                  onProgress={activeRoom ? handleRoomProgress : undefined}
                  onFinish={(s, c) =>
                    handleRecordFinish('word-builder', activeRoom ? 'multiplayer' : 'solo', playingDifficulty, s, c)
                  }
                  onRestart={handleRestartCurrentGame}
                  onExit={handleLeaveCurrentMode}
                />
              )}
              {playingGameId === 'listening-challenge' && (
                <KoreanListeningGame
                  key={`lc-${playingSeed}`}
                  difficulty={playingDifficulty}
                  seed={playingSeed}
                  room={activeRoom}
                  myUserId={myUserId}
                  onProgress={activeRoom ? handleRoomProgress : undefined}
                  onFinish={(s, c) =>
                    handleRecordFinish(
                      'listening-challenge',
                      activeRoom ? 'multiplayer' : 'solo',
                      playingDifficulty,
                      s,
                      c,
                    )
                  }
                  onRestart={handleRestartCurrentGame}
                  onExit={handleLeaveCurrentMode}
                />
              )}
            </>
          ) : activeRoom && activeRoom.status === 'waiting' ? (
            /* 2. Real Multiplayer Waiting Room Lobby (NO fake bots!) */
            <div className="mg-waiting-lobby">
              <div className="mg-waiting-card">
                <img
                  src={getGameMeta(activeRoom.gameId).imageUrl}
                  alt={getGameMeta(activeRoom.gameId).title}
                  className="mg-waiting-art"
                />
                <div className="mg-waiting-info">
                  <span className="mg-topic-badge">
                    {activeRoom.isPrivate ? '⚔️ Chế Độ Duo 2 Người' : '🌐 Phòng Chờ Công Khai'} · Độ khó:{' '}
                    {activeRoom.difficulty.toUpperCase()}
                  </span>
                  <h3>{getGameMeta(activeRoom.gameId).title}</h3>
                  <p>
                    {activeRoom.isPrivate
                      ? 'Ghép đôi chiến đấu trực tiếp cùng bạn học trong quán — Không cần nhập mã phòng!'
                      : 'Chia sẻ mã phòng bên dưới hoặc mời người bạn đang online trong quán cùng tham gia:'}
                  </p>

                  {activeRoom.isPrivate ? (
                    <div className="mg-duo-direct-badge-box">
                      <div className="mg-duo-versus-banner">
                        <span className="mg-duo-p1">
                          <Sparkles size={14} /> {activeRoom.players[0]?.username || 'Bạn'}
                        </span>
                        <span className="mg-duo-vs-badge">⚔️ VS ⚔️</span>
                        <span className="mg-duo-p2">
                          {activeRoom.players[1] ? (
                            activeRoom.players[1].username
                          ) : (
                            '⏳ Đang đợi đối thủ vào…'
                          )}
                        </span>
                      </div>
                      <small className="mg-duo-direct-sub">
                        {activeRoom.players[1]
                          ? 'Đã kết nối thành công 2 chiến binh! Chủ phòng có thể bấm Bắt đầu ván đấu ngay.'
                          : 'Lời mời thách đấu Duo đã được gửi tới đối thủ trong quán.'}
                      </small>
                    </div>
                  ) : (
                    <div className="mg-room-code-box">
                      <span>MÃ PHÒNG:</span>
                      <strong>{activeRoom.roomCode}</strong>
                      <button
                        type="button"
                        className="secondary-modal-btn"
                        onClick={() => {
                          void navigator.clipboard?.writeText(activeRoom.roomCode)
                          setCopiedCode(true)
                          window.setTimeout(() => setCopiedCode(false), 1800)
                        }}
                      >
                        {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                        {copiedCode ? 'Đã chép' : 'Sao chép mã'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mg-waiting-slots">
                <div className="mg-slot-box filled">
                  <span className="mg-slot-role">Chủ phòng (P1)</span>
                  <strong>{activeRoom.players[0]?.username}</strong>
                  <small>Đã sẵn sàng</small>
                </div>

                <div className={`mg-slot-box ${activeRoom.players[1] ? 'filled' : 'empty'}`}>
                  <span className="mg-slot-role">Đối thủ (P2)</span>
                  {activeRoom.players[1] ? (
                    <>
                      <strong>{activeRoom.players[1].username}</strong>
                      <small>Đã vào phòng — sẵn sàng thi đấu!</small>
                    </>
                  ) : (
                    <>
                      <strong>Đang chờ đối thủ tham gia…</strong>
                      <small>Chưa có người thứ 2 (hệ thống không tạo bot giả)</small>
                    </>
                  )}
                </div>
              </div>

              {activeRoom.players.length < 2 && (
                <div className="mg-invite-friends-strip">
                  <strong>Mời trực tiếp bạn học đang online trong quán ({realFriends.length}):</strong>
                  {realFriends.length > 0 ? (
                    <div className="mg-friend-chips">
                      {realFriends.map((f) => (
                        <button
                          key={f.userId}
                          type="button"
                          className="mg-friend-invite-btn"
                          onClick={() => void handleInviteFriendToCurrentRoom(f)}
                        >
                          <Send size={13} /> Mời {f.username}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <small>
                      Hiện chưa có bạn học khác cùng phòng mini-game — bạn có thể rủ bạn bè vào quán so tài, hoặc chuyển sang Chơi Đơn để luyện tập nhé!
                    </small>
                  )}
                </div>
              )}

              <div className="mg-waiting-actions">
                <button
                  type="button"
                  className="secondary-modal-btn"
                  onClick={() => startSolo(activeRoom.gameId)}
                >
                  Chuyển sang Chơi Đơn
                </button>
                {activeRoom.hostUserId === myUserId ? (
                  <button
                    type="button"
                    className="confirm-button"
                    disabled={activeRoom.players.length < 2}
                    onClick={() => void handleStartRoomMatch()}
                  >
                    <Play size={15} />{' '}
                    {activeRoom.players.length >= 2 ? 'Bắt đầu ván đấu Duo 2 người!' : 'Đang chờ đối thủ sẵn sàng…'}
                  </button>
                ) : (
                  <span className="mg-guest-wait-note">Đang chờ chủ phòng {activeRoom.hostName} bấm Bắt đầu…</span>
                )}
              </div>
            </div>
          ) : centerTab === 'games' ? (
            /* 3. Main 6-Game Cards Grid */
            <>
              {initialInviteTarget && !initialInviteTarget.isNpc && (
                <div className="mg-duo-target-banner">
                  <div className="mg-duo-target-left">
                    <Swords size={18} />
                    <span>
                      Đang chuẩn bị thách đấu Duo cùng: <b>{initialInviteTarget.username}</b> ({initialInviteTarget.level || 'TOPIK I'})
                    </span>
                  </div>
                  <span className="mg-duo-target-tip">
                    Bấm <b>Duo (Chiến Đấu)</b> ở game bạn muốn chơi để ghép đôi ngay — Không cần nhập mã!
                  </span>
                </div>
              )}

              <div className="mg-quick-join-strip">
                <div>
                  <Sparkles size={15} />
                  <span>
                    Tất cả 6 trò chơi dùng chung <b>10 chủ đề từ vựng chuẩn TOPIK I &amp; II</b> — chọn <b>Solo (1 Người)</b> để luyện tập hoặc <b>Duo (Chiến Đấu)</b> để so tài trực tiếp!
                  </span>
                </div>
                <form className="mg-code-form" onSubmit={handleJoinByCode}>
                  <KeyRound size={14} />
                  <input
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Mã phòng công khai…"
                  />
                  <button type="submit" className="secondary-modal-btn">
                    Vào phòng
                  </button>
                </form>
              </div>

              <div className="mg-cards-grid">
                {MINI_GAMES_CATALOG.map((game) => {
                  const diff = selectedDifficultyByGame[game.id] ?? game.defaultDifficulty
                  const gStat = stats.byGame[game.id]
                  return (
                    <article key={game.id} className="mg-game-card">
                      <div className="mg-card-art-wrap">
                        <img src={game.imageUrl} alt={game.title} loading="lazy" draggable={false} />
                        <span className="mg-engine-pill">{game.engineLabel}</span>
                        {gStat?.highScore > 0 && (
                          <span className="mg-highscore-pill">🏆 Kỷ lục: {gStat.highScore}đ</span>
                        )}
                      </div>

                      <div className="mg-card-content">
                        <div className="mg-card-titles">
                          <h3>{game.title}</h3>
                          <small>{game.subtitleKo}</small>
                        </div>

                        <p className="mg-card-desc">{game.shortDescription}</p>

                        <div className="mg-mode-pills">
                          {game.supportedModes.map((m) => (
                            <span key={m}>{MODE_LABELS[m]}</span>
                          ))}
                        </div>

                        <div className="mg-diff-selector" role="group" aria-label={`Độ khó ${game.title}`}>
                          <span>Độ khó:</span>
                          {(['easy', 'normal', 'hard'] as GameDifficulty[]).map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={diff === d ? 'active' : ''}
                              onClick={() =>
                                setSelectedDifficultyByGame((prev) => ({
                                  ...prev,
                                  [game.id]: d,
                                }))
                              }
                            >
                              {d === 'easy' ? 'Easy' : d === 'normal' ? 'Normal' : 'Hard'}
                            </button>
                          ))}
                        </div>

                        <div className="mg-card-actions">
                          <button
                            type="button"
                            className="confirm-button mg-btn-solo"
                            onClick={() => startSolo(game.id)}
                            title="Bắt đầu chơi luyện tập 1 mình ngay lập tức"
                          >
                            <Play size={14} fill="currentColor" /> Solo (1 Người)
                          </button>
                          <button
                            type="button"
                            className="mg-btn-duo"
                            onClick={() => {
                              if (initialInviteTarget && !initialInviteTarget.isNpc) {
                                void handleDirectDuoLaunch(game.id, initialInviteTarget)
                              } else if (realFriends.length === 1) {
                                void handleDirectDuoLaunch(game.id, realFriends[0])
                              } else {
                                setPickerDuoGameId(game.id)
                              }
                            }}
                            title="Thách đấu cùng bạn bè trong quán (không cần mã phòng)"
                          >
                            <Swords size={14} /> Duo (Chiến Đấu)
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          ) : centerTab === 'rooms' ? (
            /* 4. Open Multiplayer Rooms Tab */
            <div className="mg-rooms-tab">
              <div className="mg-rooms-top">
                <div>
                  <h3>Phòng Chơi Đang Mở ({openRooms.length})</h3>
                  <p>Tham gia phòng công khai đang chờ người thứ 2 hoặc nhập mã phòng riêng từ bạn bè.</p>
                </div>
                <form className="mg-code-form" onSubmit={handleJoinByCode}>
                  <KeyRound size={14} />
                  <input
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Nhập mã phòng…"
                  />
                  <button type="submit" className="confirm-button">
                    Tham gia bằng mã
                  </button>
                </form>
              </div>

              {openRooms.length === 0 ? (
                <div className="mg-empty-rooms">
                  <Users size={28} />
                  <strong>Hiện chưa có phòng công khai nào đang chờ</strong>
                  <p>Hãy quay sang tab 6 Mini-Games hoặc bấm nút bên dưới để tạo phòng công khai mới nhé!</p>
                  <button
                    type="button"
                    className="confirm-button"
                    onClick={() => void handleCreateRoom('quiz-battle', false)}
                  >
                    Tạo phòng công khai mới
                  </button>
                </div>
              ) : (
                <div className="mg-open-rooms-list">
                  {openRooms.map((r) => {
                    const meta = getGameMeta(r.gameId)
                    return (
                      <div key={r.roomId} className="mg-open-room-row">
                        <img src={meta.imageUrl} alt={meta.title} />
                        <div>
                          <strong>
                            {meta.title} <span>#{r.roomCode}</span>
                          </strong>
                          <small>
                            Chủ phòng: <b>{r.hostName}</b> · Độ khó: {r.difficulty.toUpperCase()} · {r.players.length}/2
                            người
                          </small>
                        </div>
                        <button
                          type="button"
                          className="confirm-button"
                          onClick={() => void handleJoinRoom(r.roomId)}
                        >
                          Vào phòng đấu
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 5. Dual Leaderboards & Personal Achievements Tab */
            <div className="mg-stats-tab">
              <div className="mg-lb-switcher">
                <button
                  type="button"
                  className={`mg-lb-tab ${leaderboardTab === 'solo' ? 'active' : ''}`}
                  onClick={() => setLeaderboardTab('solo')}
                >
                  <Trophy size={14} /> BXH Cá Nhân (Solo)
                </button>
                <button
                  type="button"
                  className={`mg-lb-tab ${leaderboardTab === 'duo' ? 'active' : ''}`}
                  onClick={() => setLeaderboardTab('duo')}
                >
                  <Swords size={14} /> BXH Duo (Cặp Đôi Đồng Đội)
                </button>
                <button
                  type="button"
                  className={`mg-lb-tab ${leaderboardTab === 'achievements' ? 'active' : ''}`}
                  onClick={() => setLeaderboardTab('achievements')}
                >
                  <Award size={14} /> Thành Tích &amp; Lịch Sử ({stats.personalAchievements.length}/{MINIGAME_ACHIEVEMENTS.length})
                </button>
              </div>

              {leaderboardTab === 'solo' ? (
                <div className="mg-lb-table-wrap">
                  <div className="mg-lb-header-note">
                    <div>
                      <strong>🏆 BẢNG VINH DANH CAO THỦ SOLO</strong>
                      <small>Kỷ lục điểm số cá nhân khi vượt ải 6 mini-games tiếng Hàn trong quán</small>
                    </div>
                    <span className="mg-lb-live-badge">🟢 Realtime Sync</span>
                  </div>

                  <div className="mg-lb-table">
                    <div className="mg-lb-row header">
                      <span className="col-rank">Hạng</span>
                      <span className="col-player">Người chơi</span>
                      <span className="col-game">Trò chơi</span>
                      <span className="col-diff">Độ khó</span>
                      <span className="col-score">Điểm số</span>
                      <span className="col-accuracy">Chính xác</span>
                      <span className="col-date">Thời gian</span>
                    </div>

                    {soloLeaderboard.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`mg-lb-row ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}`}
                      >
                        <span className="col-rank">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                        </span>
                        <div className="col-player">
                          <div className="mg-lb-avatar-ring">
                            <Users size={14} />
                          </div>
                          <div>
                            <strong>{item.playerName}</strong>
                            <small>{item.playerLevel}</small>
                          </div>
                        </div>
                        <span className="col-game">{item.gameTitle}</span>
                        <span className="col-diff">
                          <span className={`mg-diff-badge ${item.difficulty}`}>
                            {item.difficulty.toUpperCase()}
                          </span>
                        </span>
                        <span className="col-score">
                          <b>{item.score.toLocaleString()}</b> đ
                        </span>
                        <span className="col-accuracy">{item.correctCount} từ / câu đúng</span>
                        <span className="col-date">{item.dateStr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : leaderboardTab === 'duo' ? (
                <div className="mg-lb-table-wrap">
                  <div className="mg-lb-header-note duo">
                    <div>
                      <strong>⚔️ BẢNG XẾP HẠNG DUO ĐỒNG ĐỘI &amp; CHIẾN ĐẤU</strong>
                      <small>Kỷ lục thi đấu và phối hợp 2 người chơi trong K-CHILL Café</small>
                    </div>
                    <span className="mg-lb-live-badge duo">⚔️ Real Duo Sync</span>
                  </div>

                  <div className="mg-lb-table duo-mode">
                    <div className="mg-lb-row header">
                      <span className="col-rank">Hạng</span>
                      <span className="col-team">Cặp đôi Duo (P1 ⚔️ P2)</span>
                      <span className="col-game">Trò chơi</span>
                      <span className="col-score">Tổng điểm Duo</span>
                      <span className="col-outcome">Kết quả trận</span>
                      <span className="col-date">Thời gian</span>
                    </div>

                    {duoLeaderboard.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`mg-lb-row ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}`}
                      >
                        <span className="col-rank">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                        </span>
                        <div className="col-team">
                          <span className="mg-p-name p1">{item.p1Name}</span>
                          <span className="mg-vs-pill">⚔️</span>
                          <span className="mg-p-name p2">{item.p2Name}</span>
                        </div>
                        <span className="col-game">{item.gameTitle}</span>
                        <span className="col-score">
                          <b>{item.combinedScore.toLocaleString()}</b> đ
                        </span>
                        <span className="col-outcome">
                          <span className="mg-outcome-badge">{item.outcomeText}</span>
                        </span>
                        <span className="col-date">{item.dateStr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mg-stats-summary-grid">
                    <div className="mg-stat-box">
                      <span>Tổng số lần chơi</span>
                      <strong>{stats.totalPlays}</strong>
                    </div>
                    <div className="mg-stat-box">
                      <span>Tổng câu trả lời đúng</span>
                      <strong>{stats.totalCorrect}</strong>
                    </div>
                    <div className="mg-stat-box">
                      <span>Thành tích cá nhân</span>
                      <strong>
                        {stats.personalAchievements.length} / {MINIGAME_ACHIEVEMENTS.length}
                      </strong>
                    </div>
                  </div>

                  <div className="mg-stats-columns">
                    <div className="mg-stats-col">
                      <h4>
                        <Trophy size={15} /> Điểm Cao Nhất Cá Nhân Theo Từng Game
                      </h4>
                      <div className="mg-highscores-list">
                        {MINI_GAMES_CATALOG.map((g) => {
                          const st = stats.byGame[g.id]
                          return (
                            <div key={g.id} className="mg-highscore-row">
                              <img src={g.imageUrl} alt="" />
                              <div>
                                <strong>{g.title}</strong>
                                <small>
                                  Đã chơi: {st.plays} ván · Đúng: {st.totalCorrect} câu
                                </small>
                              </div>
                              <b>{st.highScore} đ</b>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="mg-stats-col">
                      <h4>
                        <Award size={15} /> Thành Tích Đã Mở Khóa
                      </h4>
                      <div className="mg-ach-grid">
                        {MINIGAME_ACHIEVEMENTS.map((ach) => {
                          const unlocked = stats.personalAchievements.includes(ach.code)
                          return (
                            <div key={ach.code} className={`mg-ach-item ${unlocked ? 'unlocked' : ''}`}>
                              <span>{ach.icon}</span>
                              <div>
                                <strong>{ach.title}</strong>
                                <small>{ach.description}</small>
                              </div>
                              {unlocked && <Check size={15} />}
                            </div>
                          )
                        })}
                      </div>

                      <h4 style={{ marginTop: 14 }}>
                        <History size={15} /> Lịch Sử Chơi Gần Đây
                      </h4>
                      <div className="mg-history-list">
                        {stats.history.length === 0 ? (
                          <small className="mg-empty-note">Chưa có lịch sử ván đấu nào.</small>
                        ) : (
                          stats.history.slice(0, 8).map((h) => (
                            <div key={h.id} className="mg-history-row">
                              <div>
                                <strong>{h.gameTitle}</strong>
                                <small>
                                  {h.mode === 'multiplayer' ? 'Đấu Duo / Nhiều người' : 'Chơi đơn Solo'} ·{' '}
                                  {h.difficulty.toUpperCase()} · {h.playedAt}
                                </small>
                              </div>
                              <b>
                                {h.score}đ ({h.correctCount} đúng)
                              </b>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Online Friend Direct Duo Picker Modal */}
      {pickerDuoGameId && (
        <div className="mg-duo-picker-backdrop" onClick={() => setPickerDuoGameId(null)}>
          <div className="mg-duo-picker-card" onClick={(e) => e.stopPropagation()}>
            <div className="mg-duo-picker-top">
              <div>
                <span className="mg-topic-badge">⚔️ CHẾ ĐỘ DUO CHIẾN ĐẤU</span>
                <h3>Chọn Bạn Học Trong Quán Để Thi Đấu</h3>
                <small>
                  Trò chơi: <b>{getGameMeta(pickerDuoGameId).title}</b> · Kết nối trực tiếp, không cần mã phòng!
                </small>
              </div>
              <button
                type="button"
                className="mg-close-btn"
                onClick={() => setPickerDuoGameId(null)}
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mg-duo-picker-list">
              {realFriends.length === 0 ? (
                <div className="mg-duo-picker-empty">
                  <Users size={32} />
                  <strong>Chưa có bạn học nào khác đang online trong quán</strong>
                  <p>
                    Hệ thống ghép cặp người thật thời gian thực. Hãy rủ bạn bè cùng vào quán để so tài Duo, hoặc chọn chế độ Chơi Đơn để luyện tập nhé!
                  </p>
                  <button
                    type="button"
                    className="confirm-button"
                    onClick={() => {
                      const gId = pickerDuoGameId
                      setPickerDuoGameId(null)
                      startSolo(gId)
                    }}
                  >
                    <Play size={14} fill="currentColor" /> Chơi Solo Game Này
                  </button>
                </div>
              ) : (
                realFriends.map((friend) => (
                  <div key={friend.userId} className="mg-duo-friend-row">
                    <div className="mg-duo-friend-avatar">
                      <img
                        src={`/assets/characters/${friend.avatarId || 'chibi-girl'}.png`}
                        alt=""
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).src = '/assets/characters/chibi-girl.png'
                        }}
                      />
                    </div>
                    <div className="mg-duo-friend-info">
                      <strong>{friend.username}</strong>
                      <small>
                        {friend.level || 'TOPIK I'} · {friend.seatId ? 'Đang ngồi tại bàn' : 'Đang đi dạo'}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="confirm-button mg-btn-challenge"
                      onClick={() => void handleDirectDuoLaunch(pickerDuoGameId, friend)}
                    >
                      <Swords size={14} /> Thách Đấu Ngay
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
