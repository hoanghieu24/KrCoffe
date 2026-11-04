import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Headphones, RotateCcw, Trophy, Volume2 } from 'lucide-react'
import {
  getWordsByDifficulty,
  playVocabPronunciation,
  SHARED_KOREAN_VOCAB,
  type SharedVocabWord,
} from '../data/sharedKoreanVocab'
import { seededShuffle } from '../services/seededRandom'
import type { GameDifficulty, MiniGameLobbyRoom } from '../types'
import { cafeMusicEngine } from '../../services/cafeMusicEngine'

type ListeningItem = {
  target: SharedVocabWord
  options: SharedVocabWord[]
}

const MAX_REPLAYS_PER_QUESTION = 3

export function KoreanListeningGame({
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
  onFinish: (score: number, correctCount: number) => void
  onRestart: () => void
  onExit: () => void
}) {
  const optionCount = difficulty === 'easy' ? 3 : 4

  const questions = useMemo<ListeningItem[]>(() => {
    const targets = seededShuffle(getWordsByDifficulty(difficulty), seed).slice(0, 10)
    return targets.map((target, idx) => {
      const distractors = seededShuffle(
        SHARED_KOREAN_VOCAB.filter((w) => w.id !== target.id && w.hangul !== target.hangul),
        seed + idx * 53 + 11,
      ).slice(0, optionCount - 1)
      return {
        target,
        options: seededShuffle([target, ...distractors], seed + idx * 23 + 5),
      }
    })
  }, [difficulty, optionCount, seed])

  const [qIdx, setQIdx] = useState(0)
  const [replaysUsed, setReplaysUsed] = useState(0)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  const current = questions[qIdx]
  const replaysRemaining = Math.max(0, MAX_REPLAYS_PER_QUESTION - replaysUsed)

  // Auto-play initial pronunciation when entering each question (does not consume one of the 3 manual replays)
  useEffect(() => {
    if (!current || finished) return
    setReplaysUsed(0)
    setPickedId(null)
    const timer = window.setTimeout(() => {
      playVocabPronunciation(current.target)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [current, finished])

  const handleReplay = () => {
    if (!current || replaysUsed >= MAX_REPLAYS_PER_QUESTION) return
    setReplaysUsed((u) => u + 1)
    playVocabPronunciation(current.target)
  }

  const handleSelectOption = (opt: SharedVocabWord) => {
    if (!current || pickedId !== null || finished) return
    setPickedId(opt.id)

    if (opt.id === current.target.id) {
      const replayBonus = (MAX_REPLAYS_PER_QUESTION - replaysUsed) * 5
      const nextScore = score + 25 + replayBonus
      const nextCorrect = correctCount + 1
      setScore(nextScore)
      setCorrectCount(nextCorrect)
      cafeMusicEngine.playChime('correct')
      onProgress?.(nextScore, nextCorrect, false)
    } else {
      cafeMusicEngine.playChime('miss')
      playVocabPronunciation(current.target)
      onProgress?.(score, correctCount, false)
    }
  }

  const handleNext = () => {
    if (qIdx + 1 >= questions.length) {
      cafeMusicEngine.playChime('win')
      setFinished(true)
      onProgress?.(score, correctCount, true)
      onFinish(score, correctCount)
      return
    }
    setQIdx((i) => i + 1)
  }

  const opponent = room?.players.find((p) => p.userId !== myUserId)
  const answered = pickedId !== null
  const isWrong = answered && current && pickedId !== current.target.id

  return (
    <div className="mg-stage-wrap">
      <div className="mg-hud-bar">
        <div className="mg-hud-pill">
          <span>Điểm số</span>
          <strong>{score}</strong>
        </div>
        <div className="mg-hud-pill">
          <span>Câu nghe</span>
          <strong>
            {Math.min(questions.length, qIdx + 1)} / {questions.length}
          </strong>
        </div>
        <div className="mg-hud-pill">
          <span>Nghe đúng</span>
          <strong>{correctCount}</strong>
        </div>
        <div className="mg-hud-pill">
          <span>Lượt nghe lại</span>
          <strong>{replaysRemaining} / 3</strong>
        </div>
        {opponent && (
          <div className="mg-hud-pill opponent">
            <span>Đối thủ: {opponent.username}</span>
            <strong>{opponent.score} đ</strong>
          </div>
        )}
      </div>

      {!finished && current ? (
        <div className="mg-listening-card">
          <div className="mg-listening-speaker-box">
            <div className="mg-speaker-avatar">
              <Headphones size={28} />
            </div>
            <div>
              <span className="mg-topic-badge">Chủ đề: {current.target.topic}</span>
              <h3>Nghe phát âm tiếng Hàn và chọn đáp án đúng</h3>
              <small>Mỗi câu được nghe lại tối đa 3 lần — nghe ít lần hơn nhận điểm thưởng cao hơn!</small>
            </div>
            <button
              type="button"
              className="confirm-button"
              disabled={replaysRemaining <= 0}
              onClick={handleReplay}
            >
              <Volume2 size={16} />
              {replaysRemaining > 0 ? `Nghe lại (còn ${replaysRemaining}/3)` : 'Đã hết lượt nghe lại'}
            </button>
          </div>

          <div className="mg-quiz-options">
            {current.options.map((opt, idx) => {
              const isTarget = opt.id === current.target.id
              const isChosen = pickedId === opt.id
              let cls = ''
              if (answered) {
                if (isTarget) cls = 'correct'
                else if (isChosen) cls = 'wrong'
                else cls = 'dim'
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`mg-quiz-opt-btn ${cls}`}
                  disabled={answered}
                  onClick={() => handleSelectOption(opt)}
                >
                  <kbd>{idx + 1}</kbd>
                  <div>
                    <strong>{opt.hangul}</strong>
                    <small>{opt.meaningVi}</small>
                  </div>
                  {answered && isTarget && <Check size={17} className="mg-opt-check" />}
                </button>
              )
            })}
          </div>

          {answered && (
            <div className={`mg-listening-explanation ${isWrong ? 'wrong' : 'right'}`}>
              <div>
                <strong>
                  {isWrong ? '💡 Đáp án đúng & Giải thích:' : '✨ Chính xác!'} {current.target.hangul}{' '}
                  <span>[{current.target.romanization}]</span> — {current.target.meaningVi}
                </strong>
                <p>
                  Câu mẫu: <b>{current.target.exampleKo}</b> ({current.target.exampleVi})
                </p>
              </div>
              <button type="button" className="confirm-button" onClick={handleNext}>
                {qIdx + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'} <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mg-result-panel">
          <img src="/assets/games/badge-game-trophy.png" alt="Kết quả" className="mg-result-badge" />
          <div>
            <h4>
              <Trophy size={16} /> Hoàn Thành · Korean Listening Challenge
            </h4>
            <p>
              Tổng điểm: <b>{score}</b> · Nghe chuẩn xác: <b>{correctCount}/{questions.length}</b> câu
            </p>
          </div>
          <div className="mg-result-actions">
            <button type="button" className="confirm-button" onClick={onRestart}>
              <RotateCcw size={15} /> Chơi lại
            </button>
            <button type="button" className="secondary-modal-btn" onClick={onExit}>
              Về sảnh Game
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
