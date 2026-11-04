import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, Flame, Gamepad2, Heart, Sparkles, Trophy, Volume2, X } from 'lucide-react'
import { avatarLooks } from '../data/demoData'
import type { TopikLevel } from '../data/koreanVocabulary'
import type {
  AvatarLook,
  GameKind,
  GameResultSummary,
  GameRoomSession,
  RainWordSeed,
  RoomPlayerState,
} from '../domain/types'
import { CHARACTER_ASSETS } from '../game/AssetManifest'
import { cafeMusicEngine, speakKorean } from '../services/cafeMusicEngine'
import { multiplayerClient } from '../services/multiplayer'

const ALL_TOPIK_LEVELS: TopikLevel[] = ['TOPIK 1', 'TOPIK 2', 'TOPIK 3', 'TOPIK 4', 'TOPIK 5', 'TOPIK 6']

function lookById(id?: string): AvatarLook {
  return avatarLooks.find((item) => item.id === id) ?? avatarLooks[0]
}

function normalizeAnswer(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
}

export function GameSetupModal({
  defaultLevel,
  targetPlayer,
  tableId,
  onClose,
  onStartSolo,
  onInvitePlayer,
}: {
  defaultLevel: string
  targetPlayer: RoomPlayerState | null
  tableId: string | null
  onClose: () => void
  onStartSolo: (kind: GameKind, level: TopikLevel) => void
  onInvitePlayer: (targetId: string, targetName: string, kind: GameKind, level: TopikLevel) => void
}) {
  const [gameKind, setGameKind] = useState<GameKind>('word-battle')
  const [selectedLevel, setSelectedLevel] = useState<TopikLevel>(
    (ALL_TOPIK_LEVELS.includes(defaultLevel as TopikLevel) ? defaultLevel : 'TOPIK 1') as TopikLevel,
  )

  return (
    <div
      className="modal-backdrop game-arena-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="avatar-modal game-setup-modal" role="dialog" aria-modal="true" aria-labelledby="game-setup-title">
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <div className="modal-kicker">
          <Gamepad2 size={15} /> K-CHILL MINI-GAMES · 한국어 게임
        </div>
        <h2 id="game-setup-title">
          {targetPlayer ? `Đấu tiếng Hàn cùng ${targetPlayer.username}` : 'Chọn trò chơi tiếng Hàn'}
        </h2>
        <p>
          {targetPlayer
            ? `Hai bạn đang ngồi cùng ${tableId ?? 'bàn'} — cùng thi từ vựng nhận thưởng XP và mở khóa thành tích nhé!`
            : 'Vừa nghe nhạc mưa rơi vừa luyện phản xạ từ vựng Hangul theo cấp độ TOPIK của bạn.'}
        </p>

        <div className="game-kind-grid">
          <button
            type="button"
            className={`game-kind-card ${gameKind === 'word-battle' ? 'active' : ''}`}
            onClick={() => setGameKind('word-battle')}
          >
            <div className="game-kind-badge">⚔️ 단어 배틀</div>
            <strong>Word Battle</strong>
            <small>10 câu trắc nghiệm tốc độ: nhìn nghĩa tiếng Việt &amp; chọn từ Hangul đúng nhanh nhất.</small>
          </button>

          <button
            type="button"
            className={`game-kind-card ${gameKind === 'korean-rain' ? 'active' : ''}`}
            onClick={() => setGameKind('korean-rain')}
          >
            <div className="game-kind-badge">🌧️ 비 오는 단어</div>
            <strong>Korean Rain</strong>
            <small>Từ vựng rơi như mưa ngoài cửa sổ — gõ Hangul hoặc phiên âm Latin trước khi chạm đáy!</small>
          </button>
        </div>

        <div className="topik-picker">
          <span>Chọn cấp độ từ vựng</span>
          <div className="topik-pills">
            {ALL_TOPIK_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`topik-pill ${selectedLevel === lvl ? 'active' : ''}`}
                onClick={() => setSelectedLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="game-setup-actions">
          {targetPlayer ? (
            <>
              <button
                type="button"
                className="secondary-modal-btn"
                onClick={() => onStartSolo(gameKind, selectedLevel)}
              >
                Luyện đơn 1 mình
              </button>
              <button
                type="button"
                className="confirm-button"
                onClick={() => onInvitePlayer(targetPlayer.userId, targetPlayer.username, gameKind, selectedLevel)}
              >
                <Gamepad2 size={16} />
                {targetPlayer.isNpc
                  ? `Đấu ngay với ${targetPlayer.username} (AI)`
                  : `Gửi lời mời tới ${targetPlayer.username}`}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="confirm-button full"
              onClick={() => onStartSolo(gameKind, selectedLevel)}
            >
              <Sparkles size={16} /> Bắt đầu chơi ngay ({selectedLevel})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function KoreanGameArena({
  session,
  myUserId,
  onLeave,
}: {
  session: GameRoomSession
  myUserId: string
  onLeave: () => void
}) {
  return (
    <div className="modal-backdrop game-arena-backdrop" role="dialog" aria-modal="true">
      <div className="game-arena-shell">
        <header className="game-arena-header">
          <div className="game-arena-title">
            <span className="arena-tag">
              {session.gameKind === 'korean-rain' ? '🌧️ 비 오는 단어 · KOREAN RAIN' : '⚔️ 단어 배틀 · WORD BATTLE'}
            </span>
            <strong>
              {session.topikLevel}
              {session.tableId ? ` · ${session.tableId}` : ' · Luyện đơn'}
            </strong>
          </div>

          <div className="arena-scoreboard">
            {session.players.map((pl) => {
              const avatarUrl =
                CHARACTER_ASSETS[lookById(pl.avatarId).id]?.avatarUrl ?? CHARACTER_ASSETS['look-01'].avatarUrl
              const isMe = pl.userId === myUserId
              return (
                <div key={pl.userId} className={`arena-player-chip ${isMe ? 'me' : 'opponent'}`}>
                  <img src={avatarUrl} alt={pl.username} />
                  <div>
                    <span>
                      {pl.username} {isMe ? '(Bạn)' : ''}
                    </span>
                    <strong>
                      {pl.score} điểm
                      {pl.combo >= 2 && (
                        <em>
                          <Flame size={11} /> x{pl.combo}
                        </em>
                      )}
                    </strong>
                  </div>
                </div>
              )
            })}
          </div>

          <button type="button" className="arena-leave-btn" onClick={onLeave}>
            <X size={15} /> Thoát ván
          </button>
        </header>

        {session.gameKind === 'korean-rain' ? (
          <KoreanRainBoard session={session} myUserId={myUserId} />
        ) : (
          <WordBattleBoard session={session} myUserId={myUserId} />
        )}
      </div>
    </div>
  )
}

type ActiveRainDrop = RainWordSeed & {
  idx: number
  progress: number // 0..1
}

function KoreanRainBoard({ session, myUserId }: { session: GameRoomSession; myUserId: string }) {
  const deck = useMemo(() => session.rainDeck ?? [], [session.rainDeck])
  const inputRef = useRef<HTMLInputElement>(null)

  const [typed, setTyped] = useState('')
  const [showHints, setShowHints] = useState(true)
  const [lives, setLives] = useState(5)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [remainingSec, setRemainingSec] = useState(session.durationSec)
  const [activeDrops, setActiveDrops] = useState<ActiveRainDrop[]>([])
  const [popNotice, setPopNotice] = useState<{ key: number; text: string } | null>(null)
  const [localDone, setLocalDone] = useState(false)

  const resolvedSetRef = useRef<Set<number>>(new Set())
  const missedSetRef = useRef<Set<number>>(new Set())
  const statsRef = useRef({ score: 0, combo: 0, maxCombo: 0, correctCount: 0, lives: 5, done: false })
  const mountTimeRef = useRef<number>(performance.now())

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus(), 60)
  }, [])

  const syncServer = (finished = false) => {
    const s = statsRef.current
    multiplayerClient.sendGameProgress({
      roomId: session.roomId,
      score: s.score,
      combo: s.combo,
      maxCombo: s.maxCombo,
      correctCount: s.correctCount,
      finished,
    })
  }

  useEffect(() => {
    mountTimeRef.current = performance.now()
    let rafId = 0

    const loop = (now: number) => {
      if (statsRef.current.done) return
      const elapsedMs = now - mountTimeRef.current
      const rem = Math.max(0, Math.ceil((session.durationSec * 1000 - elapsedMs) / 1000))
      setRemainingSec(rem)

      const nextActive: ActiveRainDrop[] = []
      let newlyMissed = 0

      for (let i = 0; i < deck.length; i++) {
        if (resolvedSetRef.current.has(i) || missedSetRef.current.has(i)) continue
        const item = deck[i]
        if (elapsedMs < item.spawnAtMs) continue
        const prog = (elapsedMs - item.spawnAtMs) / item.fallDurationMs
        if (prog >= 1) {
          missedSetRef.current.add(i)
          newlyMissed++
        } else {
          nextActive.push({ ...item, idx: i, progress: prog })
        }
      }

      if (newlyMissed > 0) {
        cafeMusicEngine.playChime('miss')
        statsRef.current.lives = Math.max(0, statsRef.current.lives - newlyMissed)
        statsRef.current.combo = 0
        setLives(statsRef.current.lives)
        setCombo(0)
        syncServer(false)
      }

      setActiveDrops(nextActive)

      const allResolved = resolvedSetRef.current.size + missedSetRef.current.size >= deck.length
      if (rem <= 0 || statsRef.current.lives <= 0 || allResolved) {
        statsRef.current.done = true
        setLocalDone(true)
        syncServer(true)
        return
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, session.durationSec, session.roomId])

  const matchDrop = (drop: ActiveRainDrop) => {
    if (resolvedSetRef.current.has(drop.idx) || statsRef.current.done) return
    resolvedSetRef.current.add(drop.idx)

    const nextCombo = statsRef.current.combo + 1
    const nextMax = Math.max(statsRef.current.maxCombo, nextCombo)
    const gained = 80 + Math.min(5, nextCombo) * 20 + Math.round((1 - drop.progress) * 30)
    const nextScore = statsRef.current.score + gained
    const nextCorrect = statsRef.current.correctCount + 1

    statsRef.current.combo = nextCombo
    statsRef.current.maxCombo = nextMax
    statsRef.current.score = nextScore
    statsRef.current.correctCount = nextCorrect

    setCombo(nextCombo)
    setMaxCombo(nextMax)
    setScore(nextScore)
    setCorrectCount(nextCorrect)
    setTyped('')
    setPopNotice({ key: Date.now(), text: `${drop.hangul} (${drop.meaningVi}) +${gained}` })

    cafeMusicEngine.playChime('correct')
    speakKorean(drop.hangul)
    syncServer(false)
  }

  const checkTypedCandidate = (rawValue: string, forceSubmit: boolean) => {
    const clean = rawValue.trim()
    if (!clean) return false
    const norm = normalizeAnswer(clean)

    // Prioritize lowest falling drop (highest progress)
    const sorted = [...activeDrops].sort((a, b) => b.progress - a.progress)

    for (const drop of sorted) {
      const hangulMatch = clean === drop.hangul
      const romMatch = norm === normalizeAnswer(drop.romanization)
      const viMatch = forceSubmit && norm.length >= 2 && normalizeAnswer(drop.meaningVi).split('/').some((part) => part.trim() === norm)

      if (hangulMatch || romMatch || viMatch) {
        // If not forced by Enter, make sure no other active drop has a longer romanization starting with norm
        if (!forceSubmit && !hangulMatch) {
          const ambiguous = sorted.some(
            (other) => other.idx !== drop.idx && normalizeAnswer(other.romanization).startsWith(norm) && normalizeAnswer(other.romanization) !== norm,
          )
          if (ambiguous) continue
        }
        matchDrop(drop)
        return true
      }
    }
    return false
  }

  const handleInputChange = (val: string) => {
    setTyped(val)
    checkTypedCandidate(val, false)
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    const matched = checkTypedCandidate(typed, true)
    if (!matched && typed.trim()) {
      cafeMusicEngine.playChime('miss')
      statsRef.current.combo = 0
      setCombo(0)
      setTyped('')
    }
  }

  const myPlayer = session.players.find((p) => p.userId === myUserId)
  const lowestDrops = useMemo(() => {
    return [...activeDrops].sort((a, b) => b.progress - a.progress).slice(0, 4)
  }, [activeDrops])

  return (
    <div className="rain-arena-body">
      <div className="rain-hud-strip">
        <div className="rain-hearts" aria-label="Số tim còn lại">
          {Array.from({ length: 5 }).map((_, i) => (
            <Heart key={i} size={16} fill={i < lives ? '#ef8e84' : 'transparent'} color={i < lives ? '#ef8e84' : '#8d7a6f'} />
          ))}
        </div>
        <div className="rain-timer-pill">⏱️ Còn {remainingSec}s</div>
        <div className="rain-combo-pill">
          Đã bắt: <b>{correctCount}</b> · Combo: <b>x{combo}</b> (Max x{maxCombo}) · Điểm: <b>{myPlayer?.score ?? score}</b>
        </div>
        <button type="button" className="hint-toggle-btn" onClick={() => setShowHints((v) => !v)}>
          {showHints ? 'Ẩn gợi ý Latin' : 'Hiện gợi ý Latin'}
        </button>
      </div>

      <div className="rain-sky-viewport" onClick={() => inputRef.current?.focus()}>
        <div className="rain-streaks" />
        {activeDrops.map((drop) => (
          <button
            type="button"
            key={drop.idx}
            className={`rain-word-drop ${drop.progress > 0.72 ? 'urgent' : ''}`}
            style={{
              left: `${drop.lane * 100}%`,
              top: `${drop.progress * 84}%`,
            }}
            onClick={() => matchDrop(drop)}
            title="Gõ từ này hoặc click nhanh để bắt giọt mưa!"
          >
            <strong>{drop.hangul}</strong>
            {showHints && (
              <small>
                {drop.romanization} · {drop.meaningVi}
              </small>
            )}
          </button>
        ))}

        {popNotice && (
          <div key={popNotice.key} className="rain-pop-feedback">
            <Check size={14} /> {popNotice.text}
          </div>
        )}

        {localDone && (
          <div className="arena-waiting-banner">
            <Sparkles size={18} /> Đã hoàn thành lượt mưa từ vựng! Đang tổng kết điểm…
          </div>
        )}
      </div>

      {lowestDrops.length > 0 && !localDone && (
        <div className="rain-quick-chips">
          <span>Gợi ý gõ nhanh:</span>
          {lowestDrops.map((d) => (
            <button
              key={d.idx}
              type="button"
              onClick={() => {
                matchDrop(d)
                inputRef.current?.focus()
              }}
            >
              <b>{d.hangul}</b> <em>({d.romanization})</em>
            </button>
          ))}
        </div>
      )}

      <form className="rain-input-bar" onSubmit={handleFormSubmit}>
        <input
          ref={inputRef}
          value={typed}
          disabled={localDone}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Gõ Hangul (예: 커피), phiên âm (keopi) hoặc nghĩa Việt rồi Enter…"
          aria-label="Nhập từ vựng Korean Rain"
        />
        <button type="submit" className="confirm-button" disabled={localDone}>
          Bắt từ ↵
        </button>
      </form>
    </div>
  )
}

function WordBattleBoard({ session, myUserId }: { session: GameRoomSession; myUserId: string }) {
  const deck = useMemo(() => session.battleDeck ?? [], [session.battleDeck])
  const [qIndex, setQIndex] = useState(0)
  const [questionMsLeft, setQuestionMsLeft] = useState(8000)
  const [pickedHangul, setPickedHangul] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [localDone, setLocalDone] = useState(false)

  const statsRef = useRef({ score: 0, combo: 0, maxCombo: 0, correctCount: 0 })
  const currentQuestion = deck[qIndex]

  const advanceOrFinish = (nextIdx: number) => {
    if (nextIdx >= deck.length) {
      setLocalDone(true)
      multiplayerClient.sendGameProgress({
        roomId: session.roomId,
        ...statsRef.current,
        finished: true,
      })
    } else {
      setQIndex(nextIdx)
      setPickedHangul(null)
      setQuestionMsLeft(8000)
    }
  }

  const handleSelectOption = (hangul: string) => {
    if (!currentQuestion || pickedHangul !== null || localDone) return
    setPickedHangul(hangul)

    const isCorrect = hangul === currentQuestion.correctHangul
    speakKorean(currentQuestion.correctHangul)

    if (isCorrect) {
      cafeMusicEngine.playChime('correct')
      const nextCombo = statsRef.current.combo + 1
      const nextMax = Math.max(statsRef.current.maxCombo, nextCombo)
      const speedBonus = Math.round((questionMsLeft / 8000) * 60)
      const gained = 100 + speedBonus + Math.min(5, nextCombo) * 15

      statsRef.current.combo = nextCombo
      statsRef.current.maxCombo = nextMax
      statsRef.current.score += gained
      statsRef.current.correctCount += 1
    } else {
      cafeMusicEngine.playChime('miss')
      statsRef.current.combo = 0
    }

    setScore(statsRef.current.score)
    setCombo(statsRef.current.combo)
    setMaxCombo(statsRef.current.maxCombo)
    setCorrectCount(statsRef.current.correctCount)

    multiplayerClient.sendGameProgress({
      roomId: session.roomId,
      ...statsRef.current,
      finished: false,
    })

    window.setTimeout(() => {
      advanceOrFinish(qIndex + 1)
    }, 920)
  }

  // Per-question 8-second countdown timer
  useEffect(() => {
    if (!currentQuestion || pickedHangul !== null || localDone) return
    const started = performance.now()
    const timer = window.setInterval(() => {
      const left = Math.max(0, 8000 - (performance.now() - started))
      setQuestionMsLeft(left)
      if (left <= 0) {
        window.clearInterval(timer)
        handleSelectOption('__timeout__')
      }
    }, 80)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, pickedHangul, localDone, currentQuestion])

  // Number keys 1..4 shortcut
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!currentQuestion || pickedHangul !== null || localDone) return
      const idx = ['1', '2', '3', '4'].indexOf(ev.key)
      if (idx >= 0 && currentQuestion.options[idx]) {
        ev.preventDefault()
        handleSelectOption(currentQuestion.options[idx].hangul)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, pickedHangul, localDone])

  if (!currentQuestion) return null
  const myPlayer = session.players.find((p) => p.userId === myUserId)

  return (
    <div className="battle-arena-body">
      <div className="battle-progress-top">
        <span>
          Câu <b>{Math.min(deck.length, qIndex + 1)}</b> / {deck.length}
        </span>
        <span>
          Đúng: <b>{correctCount}</b> · Combo: <b>x{combo}</b> (Max x{maxCombo}) · Điểm: <b>{myPlayer?.score ?? score}</b>
        </span>
      </div>

      <div className="battle-timer-track">
        <div className="battle-timer-fill" style={{ width: `${(questionMsLeft / 8000) * 100}%` }} />
      </div>

      {localDone ? (
        <div className="battle-waiting-card">
          <Sparkles size={28} />
          <h3>Bạn đã hoàn thành cả {deck.length} câu hỏi!</h3>
          <p>Đang đồng bộ kết quả cuối cùng với bàn đấu…</p>
        </div>
      ) : (
        <>
          <div className="battle-prompt-card">
            <span className="battle-prompt-kicker">CHỌN TỪ TIẾNG HÀN TƯƠNG ỨNG VỚI:</span>
            <h3>“{currentQuestion.meaningVi}”</h3>
            <p>Ví dụ: {currentQuestion.exampleVi}</p>
          </div>

          <div className="battle-options-grid">
            {currentQuestion.options.map((opt, idx) => {
              const isCorrect = opt.hangul === currentQuestion.correctHangul
              const isChosen = opt.hangul === pickedHangul
              let stateClass = ''
              if (pickedHangul !== null) {
                if (isCorrect) stateClass = 'correct'
                else if (isChosen) stateClass = 'wrong'
                else stateClass = 'dimmed'
              }

              return (
                <button
                  key={opt.hangul}
                  type="button"
                  disabled={pickedHangul !== null}
                  className={`battle-option-btn ${stateClass}`}
                  onClick={() => handleSelectOption(opt.hangul)}
                >
                  <kbd>{idx + 1}</kbd>
                  <div>
                    <strong>{opt.hangul}</strong>
                    <small>{opt.romanization}</small>
                  </div>
                  <Volume2 size={15} className="opt-speaker" />
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function GameResultModal({
  summary,
  myUserId,
  onClose,
  onPlayAgain,
}: {
  summary: GameResultSummary
  myUserId: string
  onClose: () => void
  onPlayAgain: () => void
}) {
  useEffect(() => {
    cafeMusicEngine.playChime('win')
  }, [])

  const isSolo = summary.players.length === 1
  const iWon = summary.winnerUserId === myUserId
  const myXp = summary.xpEarnedByUser[myUserId] ?? 20

  return (
    <div
      className="modal-backdrop game-arena-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="avatar-modal game-result-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>

        <div className="result-trophy-wrap">
          <Trophy size={32} />
        </div>

        <div className="modal-kicker" style={{ justifyContent: 'center' }}>
          {summary.gameKind === 'korean-rain' ? '비 오는 단어 · KOREAN RAIN' : '단어 배틀 · WORD BATTLE'} · {summary.topikLevel}
        </div>

        <h2 style={{ textAlign: 'center', marginTop: 6 }}>
          {isSolo
            ? 'Hoàn thành xuất sắc! 🎉'
            : summary.isTie
              ? 'Hòa điểm kịch tính! 🤝'
              : iWon
                ? 'Chiến thắng tuyệt vời! 🏆'
                : `${summary.winnerName} đã chiến thắng! ✨`}
        </h2>

        <div className="result-xp-pill">+{myXp} XP kinh nghiệm tiếng Hàn</div>

        <div className="result-players-list">
          {summary.players.map((pl) => {
            const avatarUrl =
              CHARACTER_ASSETS[lookById(pl.avatarId).id]?.avatarUrl ?? CHARACTER_ASSETS['look-01'].avatarUrl
            const winner = !summary.isTie && summary.winnerUserId === pl.userId
            return (
              <div key={pl.userId} className={`result-player-row ${winner ? 'winner' : ''}`}>
                <img src={avatarUrl} alt={pl.username} />
                <div className="result-player-meta">
                  <strong>
                    {pl.username} {pl.userId === myUserId ? '(Bạn)' : ''} {winner ? '👑' : ''}
                  </strong>
                  <small>
                    Đúng {pl.correctCount} từ · Max Combo x{pl.maxCombo}
                  </small>
                </div>
                <b className="result-score-num">{pl.score} đ</b>
              </div>
            )
          })}
        </div>

        <div className="game-setup-actions">
          <button type="button" className="secondary-modal-btn" onClick={onClose}>
            Quay lại bàn cà phê
          </button>
          <button type="button" className="confirm-button" onClick={onPlayAgain}>
            <Gamepad2 size={16} /> Chơi ván nữa
          </button>
        </div>
      </div>
    </div>
  )
}
