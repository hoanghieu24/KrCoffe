import { useEffect, useRef, useState, type FormEvent } from 'react'
import Phaser from 'phaser'
import { Heart, RotateCcw, Send, Trophy, Volume2 } from 'lucide-react'
import {
  getWordsByDifficulty,
  isVietnameseMeaningMatch,
  playVocabPronunciation,
  type SharedVocabWord,
} from '../data/sharedKoreanVocab'
import { createSeededRng, seededShuffle } from '../services/seededRandom'
import type { GameDifficulty, MiniGameLobbyRoom } from '../types'
import { cafeMusicEngine } from '../../services/cafeMusicEngine'

type FallingDrop = {
  id: number
  word: SharedVocabWord
  container: Phaser.GameObjects.Container
  y: number
  speedPxPerSec: number
}

export function FallingWordsPhaserGame({
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
  const mountRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const submitFnRef = useRef<((typed: string) => void) | null>(null)

  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [lives, setLives] = useState(3)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [typed, setTyped] = useState('')
  const [activeHint, setActiveHint] = useState<string>('Nhập nghĩa tiếng Việt của từ đang rơi rồi nhấn Enter!')
  const [feedbackKind, setFeedbackKind] = useState<'neutral' | 'ok' | 'err'>('neutral')
  const [finished, setFinished] = useState(false)

  const onProgressRef = useRef(onProgress)
  const onFinishRef = useRef(onFinish)
  onProgressRef.current = onProgress
  onFinishRef.current = onFinish

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (finished) return
    const timer = window.setInterval(() => {
      setElapsedSec((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [finished])

  useEffect(() => {
    if (!mountRef.current) return
    let destroyed = false

    const deck = seededShuffle(getWordsByDifficulty(difficulty), seed)
    const rng = createSeededRng(seed + 77)
    let deckCursor = 0
    let dropSeq = 1
    let localScore = 0
    let localCorrect = 0
    let localLives = 3
    let gameOver = false

    const baseSpeed = difficulty === 'easy' ? 42 : difficulty === 'normal' ? 56 : 72

    class FallingWordsScene extends Phaser.Scene {
      private drops: FallingDrop[] = []
      private spawnTimerMs = 0

      constructor() {
        super('FallingWordsScene')
      }

      preload() {
        if (!this.textures.exists('mg-raindrop')) {
          this.load.image('mg-raindrop', '/assets/games/sprite-raindrop-capsule.png')
        }
        if (!this.textures.exists('mg-star')) {
          this.load.image('mg-star', '/assets/games/sprite-star-shot.png')
        }
      }

      create() {
        const w = this.scale.width
        const h = this.scale.height

        // Warm pastel rainy cafe window backdrop
        const bg = this.add.graphics()
        bg.fillGradientStyle(0x4b3d39, 0x4b3d39, 0x2f2624, 0x2f2624, 1)
        bg.fillRect(0, 0, w, h)

        // Subtle wooden sill at bottom
        const sill = this.add.graphics()
        sill.fillStyle(0x8c6244, 0.92)
        sill.fillRoundedRect(8, h - 22, w - 16, 16, 8)
        sill.lineStyle(2, 0xc79a72, 0.5)
        sill.strokeRoundedRect(8, h - 22, w - 16, 16, 8)

        // Gentle diagonal rain streaks
        for (let i = 0; i < 18; i++) {
          const line = this.add.rectangle(
            40 + ((i * 53) % (w - 60)),
            (i * 37) % h,
            2,
            22,
            0xcfe4ff,
            0.16,
          )
          line.setAngle(12)
          this.tweens.add({
            targets: line,
            y: h + 30,
            duration: 1600 + (i % 5) * 320,
            repeat: -1,
            onRepeat: () => {
              line.y = -20
            },
          })
        }

        this.spawnWordDrop()

        submitFnRef.current = (rawInput: string) => {
          if (gameOver) return
          const clean = rawInput.trim()
          if (!clean) return

          // Match lowest matching drop first
          const sorted = [...this.drops].sort((a, b) => b.y - a.y)
          const hit = sorted.find((d) => isVietnameseMeaningMatch(clean, d.word))

          if (hit) {
            const speedBonus = Math.max(0, Math.round(((h - hit.y) / h) * 10))
            localScore += 20 + speedBonus
            localCorrect += 1
            cafeMusicEngine.playChime('correct')
            playVocabPronunciation(hit.word)

            setScore(localScore)
            setCorrectCount(localCorrect)
            setFeedbackKind('ok')
            setActiveHint(`✨ Chính xác! ${hit.word.hangul} [${hit.word.romanization}] = ${hit.word.meaningVi} (+${20 + speedBonus}đ)`)
            onProgressRef.current?.(localScore, localCorrect, false)

            this.popDropEffect(hit.container.x, hit.container.y)
            hit.container.destroy()
            this.drops = this.drops.filter((d) => d.id !== hit.id)

            if (this.drops.length === 0) {
              this.spawnWordDrop()
              this.spawnTimerMs = 0
            }
          } else {
            cafeMusicEngine.playChime('miss')
            setFeedbackKind('err')
            const lowest = sorted[0]
            setActiveHint(
              lowest
                ? `❌ Đáp án chưa chính xác! Gợi ý chủ đề của "${lowest.word.hangul}": ${lowest.word.topic}`
                : '❌ Chưa chính xác, hãy thử lại nhé!',
            )
          }
        }
      }

      private popDropEffect(x: number, y: number) {
        for (let i = 0; i < 4; i++) {
          const star = this.add.image(x, y, 'mg-star').setDisplaySize(24, 24)
          const angle = (Math.PI * 2 * i) / 4 + 0.4
          this.tweens.add({
            targets: star,
            x: x + Math.cos(angle) * 44,
            y: y + Math.sin(angle) * 44 - 12,
            alpha: 0,
            scale: 0.2,
            duration: 420,
            onComplete: () => star.destroy(),
          })
        }
      }

      private spawnWordDrop() {
        if (gameOver || this.drops.length >= 3) return
        const word = deck[deckCursor % deck.length]
        deckCursor += 1

        const w = this.scale.width
        const margin = 95
        const x = margin + rng() * Math.max(80, w - margin * 2)
        const y = -36

        const sprite = this.add.image(0, 0, 'mg-raindrop').setDisplaySize(108, 128)
        const hangulText = this.add
          .text(0, 10, word.hangul, {
            fontFamily: '"Nunito", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
            fontSize: word.hangul.length >= 4 ? '19px' : '23px',
            fontStyle: 'bold',
            color: '#2d1810',
            stroke: '#ffffff',
            strokeThickness: 3,
            align: 'center',
          })
          .setOrigin(0.5)

        const container = this.add.container(x, y, [sprite, hangulText])
        // Speed scales smoothly with score!
        const speedPxPerSec = baseSpeed + Math.min(85, localScore * 0.22)

        this.drops.push({
          id: dropSeq++,
          word,
          container,
          y,
          speedPxPerSec,
        })
      }

      update(_time: number, delta: number) {
        if (gameOver || destroyed) return
        const dt = delta / 1000
        const bottomLimit = this.scale.height - 38

        this.spawnTimerMs += delta
        const spawnInterval = Math.max(1650, 3300 - localScore * 5)
        if (this.spawnTimerMs >= spawnInterval && this.drops.length < 2 + (localScore >= 100 ? 1 : 0)) {
          this.spawnTimerMs = 0
          this.spawnWordDrop()
        }

        const missed: FallingDrop[] = []
        for (const drop of this.drops) {
          drop.y += drop.speedPxPerSec * dt
          drop.container.y = drop.y
          if (drop.y >= bottomLimit) {
            missed.push(drop)
          }
        }

        if (missed.length > 0) {
          for (const m of missed) {
            m.container.destroy()
            this.drops = this.drops.filter((d) => d.id !== m.id)
            localLives = Math.max(0, localLives - 1)
            cafeMusicEngine.playChime('miss')
            setLives(localLives)
            setFeedbackKind('err')
            setActiveHint(`💧 Từ "${m.word.hangul}" (${m.word.meaningVi}) đã chạm đáy! Còn ${localLives} mạng.`)
          }

          if (localLives <= 0) {
            gameOver = true
            setFinished(true)
            onProgressRef.current?.(localScore, localCorrect, true)
            onFinishRef.current(localScore, localCorrect)
          } else if (this.drops.length === 0) {
            this.spawnWordDrop()
          }
        }
      }
    }

    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      render: { antialias: true, roundPixels: true },
      parent: mountRef.current,
      width: 680,
      height: 330,
      backgroundColor: '#362b28',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [FallingWordsScene],
    })

    return () => {
      destroyed = true
      submitFnRef.current = null
      game.destroy(true)
    }
  }, [difficulty, seed])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!typed.trim() || finished) return
    submitFnRef.current?.(typed)
    setTyped('')
    inputRef.current?.focus()
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
          <span>Đã đúng</span>
          <strong>{correctCount} từ</strong>
        </div>
        <div className="mg-hud-pill">
          <span>Thời gian</span>
          <strong>
            {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
          </strong>
        </div>
        <div className="mg-hud-pill">
          <span>Số mạng</span>
          <strong className="mg-hearts">
            {[0, 1, 2].map((idx) => (
              <Heart
                key={idx}
                size={16}
                fill={idx < lives ? '#e48379' : 'transparent'}
                color={idx < lives ? '#e48379' : '#8d7b70'}
              />
            ))}
          </strong>
        </div>
        {opponent && (
          <div className="mg-hud-pill opponent">
            <span>Đối thủ: {opponent.username}</span>
            <strong>{opponent.score} đ</strong>
          </div>
        )}
      </div>

      <div className="mg-phaser-frame" ref={mountRef} />

      <div className={`mg-feedback-banner ${feedbackKind}`}>
        <Volume2 size={15} />
        <span>{activeHint}</span>
      </div>

      {!finished ? (
        <form className="mg-answer-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Nhập nghĩa tiếng Việt (có dấu hoặc không dấu đều được)…"
            autoComplete="off"
          />
          <button type="submit" className="confirm-button">
            <Send size={15} /> Trả lời
          </button>
        </form>
      ) : (
        <div className="mg-result-panel">
          <img src="/assets/games/badge-game-trophy.png" alt="Kết quả" className="mg-result-badge" />
          <div>
            <h4>
              <Trophy size={16} /> Bảng Kết Quả · Korean Falling Words
            </h4>
            <p>
              Tổng điểm: <b>{score}</b> · Từ đúng: <b>{correctCount}</b> · Thời gian trụ vững:{' '}
              <b>{elapsedSec}s</b>
            </p>
            {opponent && (
              <p className="mg-vs-line">
                Đấu cùng <b>{opponent.username}</b>: {score}đ vs {opponent.score}đ{' '}
                {opponent.finished
                  ? score > opponent.score
                    ? '— 🏆 Bạn chiến thắng!'
                    : score < opponent.score
                      ? `— ${opponent.username} chiến thắng!`
                      : '— Hòa kịch tính!'
                  : '— Đang chờ đối thủ hoàn thành…'}
              </p>
            )}
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
