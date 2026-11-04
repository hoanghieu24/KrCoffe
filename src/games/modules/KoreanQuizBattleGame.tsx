import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Crown, RotateCcw, Timer, Trophy, Users, Volume2 } from 'lucide-react'
import { getWordsByDifficulty, playVocabPronunciation, SHARED_KOREAN_VOCAB } from '../data/sharedKoreanVocab'
import { seededShuffle } from '../services/seededRandom'
import type { GameDifficulty, MiniGameLobbyRoom, QuizQuestionSeed } from '../types'
import { cafeMusicEngine } from '../../services/cafeMusicEngine'

const QUESTION_TIME_MS = 10_000

function buildLocalQuestions(difficulty: GameDifficulty, seed: number): QuizQuestionSeed[] {
  const pool = seededShuffle(getWordsByDifficulty(difficulty), seed).slice(0, 10)
  return pool.map((word, idx) => {
    const distractors = seededShuffle(
      SHARED_KOREAN_VOCAB.filter((w) => w.id !== word.id && w.hangul !== word.hangul),
      seed + idx * 41 + 7,
    ).slice(0, 3)
    const opts = seededShuffle(
      [word, ...distractors].map((w) => ({
        hangul: w.hangul,
        meaningVi: w.meaningVi,
        romanization: w.romanization,
      })),
      seed + idx * 19 + 3,
    )
    return {
      index: idx,
      vocabId: word.id,
      hangul: word.hangul,
      romanization: word.romanization,
      meaningVi: word.meaningVi,
      options: opts,
      correctHangul: word.hangul,
    }
  })
}

export function KoreanQuizBattleGame({
  difficulty,
  seed,
  room,
  myUserId,
  onProgress,
  onFinish,
  onRestart,
  onExit,
}: {
  difficulty: GameDifficulty
  seed: number
  room: MiniGameLobbyRoom | null
  myUserId: string
  onProgress?: (score: number, correctCount: number, finished?: boolean) => void
  onFinish: (score: number, correctCount: number, won?: boolean) => void
  onRestart: () => void
  onExit: () => void
}) {
  const questions = useMemo<QuizQuestionSeed[]>(() => {
    if (room?.quizQuestions && room.quizQuestions.length > 0) {
      return room.quizQuestions
    }
    return buildLocalQuestions(difficulty, seed)
  }, [room?.quizQuestions, difficulty, seed])

  const [qIndex, setQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [selectedHangul, setSelectedHangul] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [remainingMs, setRemainingMs] = useState(QUESTION_TIME_MS)
  const [finished, setFinished] = useState(false)

  const questionStartRef = useRef<number>(Date.now())
  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  scoreRef.current = score
  correctRef.current = correctCount

  const currentQ = questions[qIndex]

  // Reset if room restarts
  useEffect(() => {
    setQIndex(0)
    setScore(0)
    setCorrectCount(0)
    setSelectedHangul(null)
    setRevealed(false)
    setRemainingMs(QUESTION_TIME_MS)
    setFinished(false)
    questionStartRef.current = Date.now()
  }, [seed, room?.startedAt])

  const advanceOrFinish = (nextScore: number, nextCorrect: number) => {
    if (qIndex + 1 >= questions.length) {
      setFinished(true)
      onProgress?.(nextScore, nextCorrect, true)
      if (!room) {
        onFinish(nextScore, nextCorrect, true)
      }
      return
    }
    setQIndex((i) => i + 1)
    setSelectedHangul(null)
    setRevealed(false)
    setRemainingMs(QUESTION_TIME_MS)
    questionStartRef.current = Date.now()
  }

  // Record multiplayer win/loss once room transitions to finished
  const recordedRoomEndRef = useRef<number | null>(null)
  useEffect(() => {
    if (room && room.status === 'finished' && recordedRoomEndRef.current !== room.startedAt) {
      recordedRoomEndRef.current = room.startedAt
      const won = room.winnerUserId === myUserId
      if (won) cafeMusicEngine.playChime('win')
      onFinish(scoreRef.current, correctRef.current, won)
    }
  }, [room, myUserId, onFinish])

  useEffect(() => {
    if (finished || revealed || !currentQ) return
    questionStartRef.current = Date.now()
    setRemainingMs(QUESTION_TIME_MS)

    const id = window.setInterval(() => {
      const elapsed = Date.now() - questionStartRef.current
      const left = Math.max(0, QUESTION_TIME_MS - elapsed)
      setRemainingMs(left)
      if (left <= 0) {
        window.clearInterval(id)
        setRevealed(true)
        cafeMusicEngine.playChime('miss')
        window.setTimeout(() => {
          advanceOrFinish(scoreRef.current, correctRef.current)
        }, 1500)
      }
    }, 80)

    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, finished, revealed, currentQ])

  const handleChoose = (optHangul: string) => {
    if (revealed || finished || !currentQ) return
    setSelectedHangul(optHangul)
    setRevealed(true)

    const isRight = optHangul === currentQ.correctHangul
    let nextScore = score
    let nextCorrect = correctCount

    if (isRight) {
      const speedBonus = Math.round((remainingMs / QUESTION_TIME_MS) * 50)
      nextScore += 100 + speedBonus
      nextCorrect += 1
      setScore(nextScore)
      setCorrectCount(nextCorrect)
      cafeMusicEngine.playChime('correct')
      playVocabPronunciation({ hangul: currentQ.correctHangul })
    } else {
      cafeMusicEngine.playChime('miss')
    }

    onProgress?.(nextScore, nextCorrect, false)

    window.setTimeout(() => {
      advanceOrFinish(nextScore, nextCorrect)
    }, 1550)
  }

  const meInRoom = room?.players.find((p) => p.userId === myUserId)
  const opponent = room?.players.find((p) => p.userId !== myUserId)

  return (
    <div className="mg-stage-wrap">
      {/* 2-Player Scoreboard when in Multiplayer Room, or Solo HUD */}
      {room ? (
        <div className="mg-battle-scoreboard">
          <div className="mg-battle-player me">
            <span>Bạn · {meInRoom?.username ?? 'Người chơi 1'}</span>
            <strong>{score} điểm</strong>
            <small>{correctCount}/10 câu đúng</small>
          </div>
          <div className="mg-battle-vs">VS</div>
          <div className="mg-battle-player opp">
            <span>
              <Users size={13} /> {opponent ? opponent.username : 'Đang chờ người chơi…'}
            </span>
            <strong>{opponent ? `${opponent.score} điểm` : '—'}</strong>
            <small>{opponent ? `${opponent.correctCount}/10 câu đúng` : 'Phòng 2 người'}</small>
          </div>
        </div>
      ) : (
        <div className="mg-hud-bar">
          <div className="mg-hud-pill">
            <span>Điểm số</span>
            <strong>{score}</strong>
          </div>
          <div className="mg-hud-pill">
            <span>Câu hỏi</span>
            <strong>
              {Math.min(questions.length, qIndex + 1)} / {questions.length}
            </strong>
          </div>
          <div className="mg-hud-pill">
            <span>Trả lời đúng</span>
            <strong>{correctCount}</strong>
          </div>
          <div className="mg-hud-pill">
            <span>Thời gian câu</span>
            <strong>{(remainingMs / 1000).toFixed(1)}s</strong>
          </div>
        </div>
      )}

      {!finished && currentQ ? (
        <div className="mg-quiz-card">
          <div className="mg-quiz-top">
            <span>
              CÂU HỎI {qIndex + 1} / {questions.length}
            </span>
            <span className="mg-quiz-timer">
              <Timer size={14} /> {(remainingMs / 1000).toFixed(1)}s
            </span>
          </div>

          <div className="mg-timer-track">
            <div style={{ width: `${(remainingMs / QUESTION_TIME_MS) * 100}%` }} />
          </div>

          <div className="mg-quiz-prompt">
            <small>Từ tiếng Hàn nào có nghĩa là:</small>
            <h3>“{currentQ.meaningVi}”</h3>
          </div>

          <div className="mg-quiz-options">
            {currentQ.options.map((opt, idx) => {
              const isCorrectOpt = opt.hangul === currentQ.correctHangul
              const isPicked = selectedHangul === opt.hangul
              let stateCls = ''
              if (revealed) {
                if (isCorrectOpt) stateCls = 'correct'
                else if (isPicked) stateCls = 'wrong'
                else stateCls = 'dim'
              }

              return (
                <button
                  key={`${currentQ.index}-${opt.hangul}-${idx}`}
                  type="button"
                  className={`mg-quiz-opt-btn ${stateCls}`}
                  disabled={revealed}
                  onClick={() => handleChoose(opt.hangul)}
                >
                  <kbd>{idx + 1}</kbd>
                  <div>
                    <strong>{opt.hangul}</strong>
                    {revealed && <small>[{opt.romanization}] · {opt.meaningVi}</small>}
                  </div>
                  {revealed && isCorrectOpt && <Check size={17} className="mg-opt-check" />}
                </button>
              )
            })}
          </div>

          {revealed && (
            <div className="mg-quiz-reveal-note">
              <Volume2 size={15} />
              <span>
                Đáp án đúng: <b>{currentQ.correctHangul}</b> [{currentQ.romanization}] — {currentQ.meaningVi}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mg-result-panel">
          <img src="/assets/games/badge-game-trophy.png" alt="Chiến thắng" className="mg-result-badge" />
          <div>
            <h4>
              {room ? <Crown size={17} /> : <Trophy size={17} />}{' '}
              {room
                ? room.status !== 'finished'
                  ? 'Bạn đã hoàn thành 10 câu! Đang chờ đối thủ hoàn tất…'
                  : room.winnerUserId
                    ? `🏆 Người chiến thắng: ${room.winnerName}!`
                    : '🤝 Trận đấu kết thúc Hòa kịch tính!'
                : 'Hoàn Thành 10 Câu · Korean Quiz Battle'}
            </h4>
            <p>
              Điểm của bạn: <b>{score}</b> · Trả lời đúng: <b>{correctCount}/10</b> câu (cộng thưởng tốc độ)
            </p>
            {room && opponent && (
              <p className="mg-vs-line">
                Bảng điểm 2 người: <b>Bạn ({score}đ)</b> vs <b>{opponent.username} ({opponent.score}đ)</b>
              </p>
            )}
          </div>
          <div className="mg-result-actions">
            {(!room || room.status === 'finished') && (
              <button type="button" className="confirm-button" onClick={onRestart}>
                <RotateCcw size={15} /> Chơi lại
              </button>
            )}
            <button type="button" className="secondary-modal-btn" onClick={onExit}>
              Về sảnh Game
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
