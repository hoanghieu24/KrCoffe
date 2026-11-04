import { useEffect, useMemo, useState } from 'react'
import { Check, Eraser, RotateCcw, Sparkles, Trophy, Volume2 } from 'lucide-react'
import {
  getBuilderWordsByDifficulty,
  playVocabPronunciation,
  type SharedVocabWord,
} from '../data/sharedKoreanVocab'
import { seededShuffle } from '../services/seededRandom'
import type { GameDifficulty, MiniGameLobbyRoom } from '../types'
import { cafeMusicEngine } from '../../services/cafeMusicEngine'

type SyllableTile = {
  id: string
  char: string
}

function scrambleSyllables(word: SharedVocabWord, seed: number): SyllableTile[] {
  const base: SyllableTile[] = word.syllables.map((char, idx) => ({
    id: `${word.id}-syl-${idx}`,
    char,
  }))
  let shuffled = seededShuffle(base, seed)
  if (shuffled.map((s) => s.char).join('') === word.hangul && shuffled.length > 1) {
    shuffled = [...shuffled.slice(1), shuffled[0]]
  }
  return shuffled
}

export function KoreanWordBuilderGame({
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
  const words = useMemo(() => {
    const pool = getBuilderWordsByDifficulty(difficulty)
    return seededShuffle(pool, seed).slice(0, 8)
  }, [difficulty, seed])

  const [wordIdx, setWordIdx] = useState(0)
  const [poolTiles, setPoolTiles] = useState<SyllableTile[]>([])
  const [placedTiles, setPlacedTiles] = useState<SyllableTile[]>([])
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [attemptsOnCurrent, setAttemptsOnCurrent] = useState(0)
  const [feedback, setFeedback] = useState<{ kind: 'idle' | 'wrong' | 'solved'; message: string }>({
    kind: 'idle',
    message: 'Chọn hoặc kéo thả các âm tiết tiếng Hàn vào ô trống theo đúng thứ tự!',
  })
  const [finished, setFinished] = useState(false)

  const currentWord = words[wordIdx]

  useEffect(() => {
    if (!currentWord) return
    const tiles = scrambleSyllables(currentWord, seed + wordIdx * 29)
    setPoolTiles(tiles)
    setPlacedTiles([])
    setAttemptsOnCurrent(0)
    setFeedback({
      kind: 'idle',
      message: 'Chọn hoặc kéo thả các âm tiết tiếng Hàn để ghép thành từ hoàn chỉnh.',
    })
  }, [currentWord, seed, wordIdx])

  const evaluatePlaced = (nextPlaced: SyllableTile[]) => {
    if (!currentWord || nextPlaced.length < currentWord.syllables.length) return
    const assembled = nextPlaced.map((t) => t.char).join('')
    if (assembled === currentWord.hangul) {
      const gained = Math.max(15, (difficulty === 'hard' ? 40 : difficulty === 'normal' ? 30 : 25) - attemptsOnCurrent * 5)
      const nextScore = score + gained
      const nextCorrect = correctCount + 1
      setScore(nextScore)
      setCorrectCount(nextCorrect)
      cafeMusicEngine.playChime('correct')
      playVocabPronunciation(currentWord)
      setFeedback({
        kind: 'solved',
        message: `Chính xác! +${gained} điểm`,
      })
      onProgress?.(nextScore, nextCorrect, false)
    } else {
      setAttemptsOnCurrent((a) => a + 1)
      cafeMusicEngine.playChime('miss')
      setFeedback({
        kind: 'wrong',
        message: `“${assembled}” chưa đúng thứ tự rồi — hãy bấm "Xếp lại" hoặc bấm vào âm tiết để thử lại nhé!`,
      })
    }
  }

  const pickTileFromPool = (tile: SyllableTile) => {
    if (feedback.kind === 'solved' || finished) return
    const nextPool = poolTiles.filter((t) => t.id !== tile.id)
    const nextPlaced = [...placedTiles, tile]
    setPoolTiles(nextPool)
    setPlacedTiles(nextPlaced)
    evaluatePlaced(nextPlaced)
  }

  const returnTileToPool = (tile: SyllableTile) => {
    if (feedback.kind === 'solved' || finished) return
    setPlacedTiles((prev) => prev.filter((t) => t.id !== tile.id))
    setPoolTiles((prev) => [...prev, tile])
    setFeedback({ kind: 'idle', message: 'Hãy thử sắp xếp lại thứ tự các âm tiết nhé!' })
  }

  const handleResetCurrentSlots = () => {
    if (!currentWord || feedback.kind === 'solved') return
    setPoolTiles(scrambleSyllables(currentWord, seed + wordIdx * 29 + attemptsOnCurrent + 1))
    setPlacedTiles([])
    setFeedback({ kind: 'idle', message: 'Đã đặt lại các âm tiết — mời bạn ghép tiếp!' })
  }

  const handleNextWord = () => {
    if (wordIdx + 1 >= words.length) {
      cafeMusicEngine.playChime('win')
      setFinished(true)
      onProgress?.(score, correctCount, true)
      onFinish(score, correctCount)
      return
    }
    setWordIdx((i) => i + 1)
  }

  const opponent = room?.players.find((p) => p.userId !== myUserId)

  return (
    <div className="mg-stage-wrap">
      <div className="mg-hud-bar">
        <div className="mg-hud-pill">
          <span>Điểm số</span>
          <strong>{score}</strong>
        </div>
        <div className="mg-hud-pill">
          <span>Từ hiện tại</span>
          <strong>
            {Math.min(words.length, wordIdx + 1)} / {words.length}
          </strong>
        </div>
        <div className="mg-hud-pill">
          <span>Cấp độ</span>
          <strong>
            {difficulty === 'easy' ? 'Easy (2 âm)' : difficulty === 'normal' ? 'Normal (3 âm)' : 'Hard (4+ âm)'}
          </strong>
        </div>
        {opponent && (
          <div className="mg-hud-pill opponent">
            <span>Đối thủ: {opponent.username}</span>
            <strong>{opponent.score} đ</strong>
          </div>
        )}
      </div>

      {!finished && currentWord ? (
        <div className="mg-builder-card">
          <div className="mg-builder-hint">
            <span className="mg-topic-badge">Chủ đề: {currentWord.topic}</span>
            <h3>Nghĩa tiếng Việt: “{currentWord.meaningVi}”</h3>
            <small>Gợi ý ngữ cảnh: {currentWord.exampleVi}</small>
          </div>

          {/* Target Drop Zone */}
          <div
            className={`mg-builder-slots ${feedback.kind}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const tileId = e.dataTransfer.getData('text/plain')
              const found = poolTiles.find((t) => t.id === tileId)
              if (found) pickTileFromPool(found)
            }}
          >
            {currentWord.syllables.map((_, slotIdx) => {
              const placed = placedTiles[slotIdx]
              return placed ? (
                <button
                  key={placed.id}
                  type="button"
                  className="mg-syllable-block placed"
                  onClick={() => returnTileToPool(placed)}
                  title="Bấm để bỏ âm tiết này xuống"
                >
                  {placed.char}
                </button>
              ) : (
                <div key={`empty-${slotIdx}`} className="mg-syllable-slot-empty">
                  {slotIdx + 1}
                </div>
              )
            })}
          </div>

          {/* Scrambled Syllable Pool */}
          {feedback.kind !== 'solved' && (
            <div className="mg-builder-pool">
              {poolTiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', tile.id)}
                  className="mg-syllable-block"
                  onClick={() => pickTileFromPool(tile)}
                >
                  {tile.char}
                </button>
              ))}
              {placedTiles.length > 0 && (
                <button type="button" className="mg-clear-slots-btn" onClick={handleResetCurrentSlots}>
                  <Eraser size={14} /> Xếp lại
                </button>
              )}
            </div>
          )}

          {/* Solved Word Card (Shows Hangul + Romanization + Vietnamese Meaning!) */}
          {feedback.kind === 'solved' ? (
            <div className="mg-builder-complete-box">
              <div className="mg-builder-complete-main">
                <Sparkles size={18} />
                <div>
                  <h4>
                    {currentWord.hangul} <span>[{currentWord.romanization}]</span>
                  </h4>
                  <p>Nghĩa tiếng Việt: <b>{currentWord.meaningVi}</b></p>
                  <small>Ví dụ: {currentWord.exampleKo} — {currentWord.exampleVi}</small>
                </div>
                <button
                  type="button"
                  className="tts-round-btn"
                  onClick={() => playVocabPronunciation(currentWord)}
                  title="Nghe phát âm"
                >
                  <Volume2 size={16} />
                </button>
              </div>
              <button type="button" className="confirm-button" onClick={handleNextWord}>
                <Check size={15} /> {wordIdx + 1 >= words.length ? 'Xem kết quả' : 'Câu tiếp theo'}
              </button>
            </div>
          ) : (
            <div className={`mg-feedback-banner ${feedback.kind === 'wrong' ? 'err' : 'neutral'}`}>
              <span>{feedback.message}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mg-result-panel">
          <img src="/assets/games/badge-game-trophy.png" alt="Kết quả" className="mg-result-badge" />
          <div>
            <h4>
              <Trophy size={16} /> Hoàn Thành · Korean Word Builder
            </h4>
            <p>
              Tổng điểm: <b>{score}</b> · Đã ghép hoàn chỉnh: <b>{correctCount}/{words.length}</b> từ tiếng Hàn
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
