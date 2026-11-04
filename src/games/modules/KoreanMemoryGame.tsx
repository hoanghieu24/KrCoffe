import { useEffect, useMemo, useState } from 'react'
import { Clock, RotateCcw, Sparkles, Trophy } from 'lucide-react'
import { getWordsByDifficulty, playVocabPronunciation } from '../data/sharedKoreanVocab'
import { seededShuffle } from '../services/seededRandom'
import type { GameDifficulty, MemoryPairCount, MiniGameLobbyRoom } from '../types'
import { cafeMusicEngine } from '../../services/cafeMusicEngine'

type MemoryCardItem = {
  uid: string
  pairId: number
  kind: 'hangul' | 'vi'
  display: string
  subLabel: string
  hangulToSpeak: string
}

export function KoreanMemoryGame({
  difficulty,
  initialPairs = 8,
  initialTimed = true,
  seed,
  room,
  myUserId,
  onProgress,
  onFinish,
  onExit,
}: {
  difficulty: GameDifficulty
  initialPairs?: MemoryPairCount
  initialTimed?: boolean
  seed: number
  room: MiniGameLobbyRoom | null
  myUserId: string
  onProgress?: (score: number, correctCount: number, finished?: boolean) => void
  onFinish: (score: number, correctCount: number) => void
  onExit: () => void
}) {
  const [pairCount, setPairCount] = useState<MemoryPairCount>(room?.memoryPairs ?? initialPairs)
  const [timedMode, setTimedMode] = useState<boolean>(room?.memoryTimed ?? initialTimed)
  const [roundNonce, setRoundNonce] = useState(0)

  const cards = useMemo<MemoryCardItem[]>(() => {
    const words = seededShuffle(getWordsByDifficulty(difficulty), seed + roundNonce * 31).slice(0, pairCount)
    const raw: MemoryCardItem[] = []
    for (const w of words) {
      raw.push({
        uid: `ko-${w.id}`,
        pairId: w.id,
        kind: 'hangul',
        display: w.hangul,
        subLabel: w.romanization,
        hangulToSpeak: w.hangul,
      })
      raw.push({
        uid: `vi-${w.id}`,
        pairId: w.id,
        kind: 'vi',
        display: w.meaningVi,
        subLabel: w.topic,
        hangulToSpeak: w.hangul,
      })
    }
    return seededShuffle(raw, seed + roundNonce * 97 + 13)
  }, [difficulty, pairCount, seed, roundNonce])

  const maxTimeSec = pairCount === 4 ? 50 : pairCount === 8 ? 90 : 135

  const [flippedUids, setFlippedUids] = useState<string[]>([])
  const [matchedPairIds, setMatchedPairIds] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [turns, setTurns] = useState(0)
  const [seconds, setSeconds] = useState(timedMode ? maxTimeSec : 0)
  const [locked, setLocked] = useState(false)
  const [finished, setFinished] = useState(false)

  const resetBoard = (nextPairs: MemoryPairCount, nextTimed: boolean) => {
    setPairCount(nextPairs)
    setTimedMode(nextTimed)
    setFlippedUids([])
    setMatchedPairIds([])
    setScore(0)
    setTurns(0)
    setLocked(false)
    setFinished(false)
    const nextMax = nextPairs === 4 ? 50 : nextPairs === 8 ? 90 : 135
    setSeconds(nextTimed ? nextMax : 0)
    setRoundNonce((n) => n + 1)
  }

  useEffect(() => {
    if (finished) return
    const timer = window.setInterval(() => {
      setSeconds((prev) => {
        if (timedMode) {
          if (prev <= 1) {
            setFinished(true)
            onProgress?.(score, matchedPairIds.length, true)
            onFinish(score, matchedPairIds.length)
            return 0
          }
          return prev - 1
        }
        return prev + 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [finished, timedMode, score, matchedPairIds.length, onFinish, onProgress])

  const handleCardClick = (card: MemoryCardItem) => {
    if (locked || finished) return
    if (matchedPairIds.includes(card.pairId)) return
    if (flippedUids.includes(card.uid)) return

    if (card.kind === 'hangul') {
      playVocabPronunciation({ hangul: card.hangulToSpeak })
    }

    const nextFlipped = [...flippedUids, card.uid]
    setFlippedUids(nextFlipped)

    if (nextFlipped.length === 2) {
      setLocked(true)
      setTurns((t) => t + 1)
      const first = cards.find((c) => c.uid === nextFlipped[0])!
      const second = card

      if (first.pairId === second.pairId && first.kind !== second.kind) {
        const nextMatched = [...matchedPairIds, card.pairId]
        const gained = 30 + (timedMode ? Math.min(15, Math.floor(seconds / 8)) : 5)
        const nextScore = score + gained
        cafeMusicEngine.playChime('correct')
        playVocabPronunciation({ hangul: card.hangulToSpeak })

        window.setTimeout(() => {
          setMatchedPairIds(nextMatched)
          setFlippedUids([])
          setScore(nextScore)
          setLocked(false)

          const allDone = nextMatched.length >= pairCount
          onProgress?.(nextScore, nextMatched.length, allDone)
          if (allDone) {
            cafeMusicEngine.playChime('win')
            setFinished(true)
            onFinish(nextScore, nextMatched.length)
          }
        }, 380)
      } else {
        cafeMusicEngine.playChime('miss')
        window.setTimeout(() => {
          setFlippedUids([])
          setLocked(false)
        }, 850)
      }
    }
  }

  const opponent = room?.players.find((p) => p.userId !== myUserId)
  const cols = pairCount === 4 ? 4 : pairCount === 8 ? 4 : 6

  return (
    <div className="mg-stage-wrap">
      {!room && (
        <div className="mg-mode-toolbar">
          <div className="mg-pill-group">
            {([4, 8, 12] as MemoryPairCount[]).map((cnt) => (
              <button
                key={cnt}
                type="button"
                className={`mg-mini-opt ${pairCount === cnt ? 'active' : ''}`}
                onClick={() => resetBoard(cnt, timedMode)}
              >
                {cnt} cặp thẻ
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`mg-mini-opt ${timedMode ? 'active' : ''}`}
            onClick={() => resetBoard(pairCount, !timedMode)}
          >
            <Clock size={13} /> {timedMode ? 'Chế độ tính giờ: BẬT' : 'Chế độ tự do'}
          </button>
        </div>
      )}

      <div className="mg-hud-bar">
        <div className="mg-hud-pill">
          <span>Điểm số</span>
          <strong>{score}</strong>
        </div>
        <div className="mg-hud-pill">
          <span>Đã ghép</span>
          <strong>
            {matchedPairIds.length} / {pairCount} cặp
          </strong>
        </div>
        <div className="mg-hud-pill">
          <span>Số lượt lật</span>
          <strong>{turns}</strong>
        </div>
        <div className="mg-hud-pill">
          <span>{timedMode ? 'Còn lại' : 'Thời gian'}</span>
          <strong>
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
          </strong>
        </div>
        {opponent && (
          <div className="mg-hud-pill opponent">
            <span>Đối thủ: {opponent.username}</span>
            <strong>
              {opponent.score} đ ({opponent.correctCount}/{pairCount})
            </strong>
          </div>
        )}
      </div>

      <div
        className="mg-memory-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cards.map((card) => {
          const isMatched = matchedPairIds.includes(card.pairId)
          const isOpen = isMatched || flippedUids.includes(card.uid)
          return (
            <button
              key={card.uid}
              type="button"
              className={`mg-mem-card ${isOpen ? 'open' : ''} ${isMatched ? 'matched' : ''} ${card.kind}`}
              onClick={() => handleCardClick(card)}
              disabled={isOpen || finished}
            >
              {isOpen ? (
                <div className="mg-mem-front">
                  <span className="mg-mem-tag">{card.kind === 'hangul' ? 'KR' : 'VN'}</span>
                  <strong>{card.display}</strong>
                  <small>{card.subLabel}</small>
                </div>
              ) : (
                <div className="mg-mem-back">
                  <img src="/assets/games/card-back-pattern.png" alt="Thẻ úp" draggable={false} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {finished && (
        <div className="mg-result-panel">
          <img src="/assets/games/badge-game-trophy.png" alt="Hoàn thành" className="mg-result-badge" />
          <div>
            <h4>
              {matchedPairIds.length >= pairCount ? <Sparkles size={16} /> : <Trophy size={16} />}{' '}
              {matchedPairIds.length >= pairCount
                ? 'Tuyệt vời! Bạn đã lật mở toàn bộ các cặp thẻ!'
                : 'Hết giờ! Bảng tổng kết Korean Memory'}
            </h4>
            <p>
              Điểm số: <b>{score}</b> · Ghép đúng: <b>{matchedPairIds.length}/{pairCount}</b> cặp · Số lượt:{' '}
              <b>{turns}</b>
            </p>
          </div>
          <div className="mg-result-actions">
            <button type="button" className="confirm-button" onClick={() => resetBoard(pairCount, timedMode)}>
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
