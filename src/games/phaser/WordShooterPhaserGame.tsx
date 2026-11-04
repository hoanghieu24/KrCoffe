import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { Crosshair, RotateCcw, Trophy } from 'lucide-react'
import { getWordsByDifficulty, playVocabPronunciation, type SharedVocabWord } from '../data/sharedKoreanVocab'
import { createSeededRng, seededShuffle } from '../services/seededRandom'
import type { GameDifficulty, MiniGameLobbyRoom } from '../types'
import { cafeMusicEngine } from '../../services/cafeMusicEngine'

type CloudTarget = {
  word: SharedVocabWord
  isCorrect: boolean
  container: Phaser.GameObjects.Container
  vx: number
  baseY: number
  phase: number
}

export function WordShooterPhaserGame({
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

  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [promptVi, setPromptVi] = useState<string>('Đang chuẩn bị mục tiêu…')
  const [promptTopic, setPromptTopic] = useState<string>('')
  const [feedback, setFeedback] = useState<string>('Di chuyển chuột hoặc phím ◀ ▶ để ngắm, Click hoặc nhấn Space để bắn!')
  const [finished, setFinished] = useState(false)

  const onProgressRef = useRef(onProgress)
  const onFinishRef = useRef(onFinish)
  onProgressRef.current = onProgress
  onFinishRef.current = onFinish

  useEffect(() => {
    if (!mountRef.current) return
    let destroyed = false
    let gameOver = false

    const pool = seededShuffle(getWordsByDifficulty(difficulty), seed)
    const rng = createSeededRng(seed + 303)
    const targetCount = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 4 : 5
    const speedScale = difficulty === 'easy' ? 48 : difficulty === 'normal' ? 76 : 108

    let roundIdx = 0
    let localScore = 0
    let localCorrect = 0
    let remainingSec = 60

    const countdownId = window.setInterval(() => {
      if (gameOver || destroyed) return
      remainingSec = Math.max(0, remainingSec - 1)
      setTimeLeft(remainingSec)
      if (remainingSec <= 0) {
        gameOver = true
        setFinished(true)
        onProgressRef.current?.(localScore, localCorrect, true)
        onFinishRef.current(localScore, localCorrect)
      }
    }, 1000)

    class WordShooterScene extends Phaser.Scene {
      private targets: CloudTarget[] = []
      private launcher!: Phaser.GameObjects.Image
      private crosshair!: Phaser.GameObjects.Container
      private aimX = 340
      private aimY = 120
      private leftKey!: Phaser.Input.Keyboard.Key
      private rightKey!: Phaser.Input.Keyboard.Key
      private spaceKey!: Phaser.Input.Keyboard.Key
      private shotCooldownMs = 0

      constructor() {
        super('WordShooterScene')
      }

      preload() {
        if (!this.textures.exists('mg-cloud')) {
          this.load.image('mg-cloud', '/assets/games/sprite-target-cloud.png')
        }
        if (!this.textures.exists('mg-launcher')) {
          this.load.image('mg-launcher', '/assets/games/sprite-chibi-launcher.png')
        }
        if (!this.textures.exists('mg-star')) {
          this.load.image('mg-star', '/assets/games/sprite-star-shot.png')
        }
      }

      create() {
        const w = this.scale.width
        const h = this.scale.height

        const bg = this.add.graphics()
        bg.fillGradientStyle(0x52403a, 0x52403a, 0x342825, 0x342825, 1)
        bg.fillRect(0, 0, w, h)

        // Warm wooden cafe counter at bottom
        bg.fillStyle(0x7d573c, 0.95)
        bg.fillRoundedRect(0, h - 42, w, 46, 10)
        bg.lineStyle(2, 0xc99c72, 0.45)
        bg.strokeRoundedRect(2, h - 42, w - 4, 42, 10)

        this.launcher = this.add
          .image(w / 2, h - 38, 'mg-launcher')
          .setDisplaySize(64, 84)
          .setOrigin(0.5, 0.72)
          .setDepth(5)

        // Cozy crosshair reticle
        const ring = this.add.circle(0, 0, 16, 0xffe4b5, 0.12).setStrokeStyle(2, 0xffdfa8, 0.9)
        const dot = this.add.circle(0, 0, 3, 0xffdfa8, 1)
        this.crosshair = this.add.container(w / 2, 120, [ring, dot]).setDepth(8)

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
          this.aimX = Phaser.Math.Clamp(pointer.x, 45, w - 45)
          this.aimY = Phaser.Math.Clamp(pointer.y, 35, h - 85)
        })

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.aimX = Phaser.Math.Clamp(pointer.x, 45, w - 45)
          this.aimY = Phaser.Math.Clamp(pointer.y, 35, h - 85)
          this.fireShot()
        })

        if (this.input.keyboard) {
          this.leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false)
          this.rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false)
          this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false)
        }

        this.spawnWave()
      }

      private clearTargets() {
        for (const t of this.targets) {
          t.container.destroy()
        }
        this.targets = []
      }

      private spawnWave() {
        if (gameOver || destroyed) return
        this.clearTargets()

        const answerWord = pool[roundIdx % pool.length]
        roundIdx += 1
        setPromptVi(answerWord.meaningVi)
        setPromptTopic(answerWord.topic)

        const distractors = pool.filter((w) => w.id !== answerWord.id && w.hangul !== answerWord.hangul)
        const pickedDistractors: SharedVocabWord[] = []
        let guard = 0
        while (pickedDistractors.length < targetCount - 1 && guard < 60) {
          guard++
          const cand = distractors[Math.floor(rng() * distractors.length)]
          if (cand && !pickedDistractors.some((d) => d.id === cand.id)) {
            pickedDistractors.push(cand)
          }
        }

        const waveWords = seededShuffle([answerWord, ...pickedDistractors], seed + roundIdx * 17)
        const w = this.scale.width

        waveWords.forEach((word, idx) => {
          const laneW = (w - 140) / waveWords.length
          const x = 70 + laneW * idx + laneW * 0.5
          const y = 68 + (idx % 2) * 66 + (idx === 2 ? 32 : 0)

          const cloud = this.add.image(0, 0, 'mg-cloud').setDisplaySize(146, 92)
          const label = this.add
            .text(0, 3, word.hangul, {
              fontFamily: '"Nunito", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
              fontSize: word.hangul.length >= 4 ? '18px' : '22px',
              fontStyle: 'bold',
              color: '#2d1810',
              stroke: '#ffffff',
              strokeThickness: 3,
              align: 'center',
            })
            .setOrigin(0.5)

          const container = this.add.container(x, y, [cloud, label]).setDepth(3)
          const dir = idx % 2 === 0 ? 1 : -1
          this.targets.push({
            word,
            isCorrect: word.id === answerWord.id,
            container,
            vx: dir * (speedScale + (idx % 3) * 14),
            baseY: y,
            phase: idx * 1.3,
          })
        })
      }

      private fireShot() {
        if (gameOver || this.shotCooldownMs > 0) return
        this.shotCooldownMs = 240

        const targetX = this.aimX
        const targetY = this.aimY

        const star = this.add
          .image(this.launcher.x, this.launcher.y - 24, 'mg-star')
          .setDisplaySize(30, 30)
          .setDepth(6)

        // Check closest cloud target at impact point
        let hitTarget: CloudTarget | null = null
        let bestDist = 66
        for (const t of this.targets) {
          const dist = Phaser.Math.Distance.Between(targetX, targetY, t.container.x, t.container.y)
          if (dist < bestDist) {
            bestDist = dist
            hitTarget = t
          }
        }

        this.tweens.add({
          targets: star,
          x: hitTarget ? hitTarget.container.x : targetX,
          y: hitTarget ? hitTarget.container.y : targetY,
          rotation: 3.14,
          duration: 150,
          onComplete: () => {
            star.destroy()
            if (gameOver || destroyed) return
            if (!hitTarget || !this.targets.includes(hitTarget)) return

            if (hitTarget.isCorrect) {
              localScore += difficulty === 'hard' ? 30 : difficulty === 'normal' ? 25 : 20
              localCorrect += 1
              cafeMusicEngine.playChime('correct')
              playVocabPronunciation(hitTarget.word)
              setScore(localScore)
              setCorrectCount(localCorrect)
              setFeedback(`🎯 Bắn trúng "${hitTarget.word.hangul}" [${hitTarget.word.romanization}]! Tuyệt vời!`)
              onProgressRef.current?.(localScore, localCorrect, false)
              this.spawnWave()
            } else {
              localScore = Math.max(0, localScore - 10)
              remainingSec = Math.max(0, remainingSec - 3)
              cafeMusicEngine.playChime('miss')
              setScore(localScore)
              setTimeLeft(remainingSec)
              setFeedback(
                `⚠️ Bắn nhầm "${hitTarget.word.hangul}" (${hitTarget.word.meaningVi})! -10 điểm & -3 giây.`,
              )
              onProgressRef.current?.(localScore, localCorrect, false)
              if (remainingSec <= 0) {
                gameOver = true
                setFinished(true)
                onProgressRef.current?.(localScore, localCorrect, true)
                onFinishRef.current(localScore, localCorrect)
              } else {
                this.spawnWave()
              }
            }
          },
        })
      }

      update(time: number, delta: number) {
        if (gameOver || destroyed) return
        const dt = delta / 1000
        const w = this.scale.width

        if (this.shotCooldownMs > 0) {
          this.shotCooldownMs = Math.max(0, this.shotCooldownMs - delta)
        }

        if (this.leftKey?.isDown) {
          this.aimX = Math.max(50, this.aimX - 280 * dt)
        }
        if (this.rightKey?.isDown) {
          this.aimX = Math.min(w - 50, this.aimX + 280 * dt)
        }
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
          // If aiming with keyboard, snap Y to nearest cloud horizontally
          let nearestY = this.aimY
          let bestDx = 999
          for (const t of this.targets) {
            const dx = Math.abs(t.container.x - this.aimX)
            if (dx < bestDx) {
              bestDx = dx
              nearestY = t.container.y
            }
          }
          this.aimY = nearestY
          this.fireShot()
        }

        this.crosshair.setPosition(this.aimX, this.aimY)
        this.launcher.x = Phaser.Math.Linear(this.launcher.x, this.aimX, 0.22)
        const angleRad = Phaser.Math.Angle.Between(this.launcher.x, this.launcher.y, this.aimX, this.aimY)
        this.launcher.setRotation(Phaser.Math.Clamp(angleRad + Math.PI / 2, -0.55, 0.55))

        for (const t of this.targets) {
          t.container.x += t.vx * dt
          t.container.y = t.baseY + Math.sin(time / 480 + t.phase) * 7
          if (t.container.x < 74) {
            t.container.x = 74
            t.vx = Math.abs(t.vx)
          } else if (t.container.x > w - 74) {
            t.container.x = w - 74
            t.vx = -Math.abs(t.vx)
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
      scene: [WordShooterScene],
    })

    return () => {
      destroyed = true
      window.clearInterval(countdownId)
      game.destroy(true)
    }
  }, [difficulty, seed])

  const opponent = room?.players.find((p) => p.userId !== myUserId)

  return (
    <div className="mg-stage-wrap">
      <div className="mg-hud-bar">
        <div className="mg-hud-pill">
          <span>Điểm số</span>
          <strong>{score}</strong>
        </div>
        <div className="mg-hud-pill">
          <span>Bắn trúng</span>
          <strong>{correctCount} mục tiêu</strong>
        </div>
        <div className="mg-hud-pill">
          <span>Cấp độ</span>
          <strong>{difficulty.toUpperCase()}</strong>
        </div>
        <div className="mg-hud-pill">
          <span>Thời gian còn</span>
          <strong>{timeLeft}s</strong>
        </div>
        {opponent && (
          <div className="mg-hud-pill opponent">
            <span>Đối thủ: {opponent.username}</span>
            <strong>{opponent.score} đ</strong>
          </div>
        )}
      </div>

      <div className="mg-shooter-prompt">
        <span className="mg-topic-badge">{promptTopic || 'Từ vựng'}</span>
        <div>
          <small>HÃY BẮN MỤC TIÊU CÓ NGHĨA TIẾNG VIỆT:</small>
          <h3>“{promptVi}”</h3>
        </div>
        <span className="mg-shooter-keyhint">
          <Crosshair size={14} /> Click / Space
        </span>
      </div>

      <div className="mg-phaser-frame" ref={mountRef} />

      <div className="mg-feedback-banner neutral">
        <span>{feedback}</span>
      </div>

      {finished && (
        <div className="mg-result-panel">
          <img src="/assets/games/badge-game-trophy.png" alt="Kết quả" className="mg-result-badge" />
          <div>
            <h4>
              <Trophy size={16} /> Hoàn Thành · Korean Word Shooter
            </h4>
            <p>
              Tổng điểm: <b>{score}</b> · Bắn trúng: <b>{correctCount}</b> mục tiêu ({difficulty.toUpperCase()})
            </p>
            {opponent && (
              <p className="mg-vs-line">
                Đấu cùng <b>{opponent.username}</b>: {score}đ vs {opponent.score}đ
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
