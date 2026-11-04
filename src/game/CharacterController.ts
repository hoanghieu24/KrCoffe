import Phaser from 'phaser'
import type { AvatarLook, CharacterAnimation, DemoPlayer, Direction, PlayerCharacter, WorldPoint } from '../domain/types'
import type { CharacterAction } from '../services/multiplayer'
import { CharacterSpriteFactory } from './CharacterSpriteFactory'
import { CollisionMap } from './CollisionMap'

type KeyboardIntent = { x: number; y: number }
type ArrivalHandler = { arrive: () => void; cancel: () => void }

const MOOD_EMOTE: Record<DemoPlayer['mood'], string> = {
  chatting: 'emote-chat',
  studying: 'emote-study',
  listening: 'emote-music',
}

const SLIDE_ANGLES_RAD = [
  Math.PI / 6,
  -Math.PI / 6,
  (55 * Math.PI) / 180,
  (-55 * Math.PI) / 180,
  (75 * Math.PI) / 180,
  (-75 * Math.PI) / 180,
]

export class CharacterController {
  readonly actor: PlayerCharacter
  readonly speed = 148
  readonly bodyRadius = 8.5
  private readonly root: Phaser.GameObjects.Container
  private readonly footShadow: Phaser.GameObjects.Ellipse
  private sprite: Phaser.GameObjects.Sprite
  private readonly nameTag: Phaser.GameObjects.Text
  private readonly emoteSprite?: Phaser.GameObjects.Image
  private readonly tempEmote: Phaser.GameObjects.Image
  private readonly voiceBadgeBg: Phaser.GameObjects.Arc
  private readonly voiceBadgeIcon?: Phaser.GameObjects.Image
  private readonly voiceBadge: Phaser.GameObjects.Container
  private readonly speechBubble: Phaser.GameObjects.Text
  private speechToken = 0
  private collisionMap: CollisionMap
  private path: WorldPoint[] = []
  private pathIndex = 0
  private arrival?: ArrivalHandler
  private remoteTarget: WorldPoint | null = null
  private remoteTargetDirection?: Direction
  private remoteTargetAnimation?: CharacterAnimation
  private stateToken = 0
  private isDestroyed = false
  private idleAnimTime = 0
  private idlePhase = Math.random() * Math.PI * 2
  private isNodding = false
  private walkAnimTime = 0
  private isActionAnimating = false
  private ambientActionTimer = Math.random() * 15000 + 10000
  private localRing?: Phaser.GameObjects.Ellipse

  constructor(
    private readonly scene: Phaser.Scene,
    actor: PlayerCharacter,
    collisionMap: CollisionMap,
    options: { showBubble?: boolean; mood?: DemoPlayer['mood']; isLocal?: boolean } = {},
  ) {
    this.actor = actor
    this.collisionMap = collisionMap
    const texture = CharacterSpriteFactory.ensure(scene, actor.avatar)
    const isSittingAnim = actor.animation === 'sit' || actor.animation.startsWith('sit_')
    const initialY = isSittingAnim ? 2 : 4
    this.sprite = scene.add.sprite(0, initialY, texture, CharacterSpriteFactory.firstFrame(actor.avatar, actor.animation, actor.direction))
      .setOrigin(0.5, 0.96)
      .setScale(0.70)

    this.footShadow = scene.add.ellipse(0, 1, 30, 10, 0x3b261d, 0.22)
      .setVisible(!isSittingAnim)

    const textDpr = Math.max(2, Math.min(3, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2))

    this.nameTag = scene.add.text(0, -78, actor.username, {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '10.5px',
      fontStyle: '800',
      color: options.isLocal ? '#fffaf2' : '#f8efe4',
      backgroundColor: options.isLocal ? 'rgba(84, 118, 172, 0.92)' : 'rgba(72, 53, 45, 0.86)',
      padding: { x: 7, y: 2.5 },
      stroke: '#3a2821',
      strokeThickness: 1.5,
      shadow: { color: '#2b1d18', blur: 4, fill: true, offsetY: 1 },
    }).setOrigin(0.5).setResolution(textDpr)

    const children: Phaser.GameObjects.GameObject[] = [this.footShadow]
    if (options.isLocal) {
      this.localRing = scene.add.ellipse(0, 0, 44, 16, 0x7eb6ff, 0.16).setStrokeStyle(2, 0x9ecaff, 0.92)
        .setVisible(actor.animation !== 'sit')
      children.push(this.localRing)
    }

    children.push(this.sprite, this.nameTag)

    const defaultEmoteKey = options.mood ? MOOD_EMOTE[options.mood] : (options.showBubble ? 'emote-chat' : undefined)
    if (defaultEmoteKey && scene.textures.exists(defaultEmoteKey)) {
      this.emoteSprite = scene.add.image(0, -104, defaultEmoteKey).setDisplaySize(26, 26).setOrigin(0.5)
      children.push(this.emoteSprite)
      scene.tweens.add({
        targets: this.emoteSprite,
        y: -108,
        duration: 1350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    this.tempEmote = scene.add.image(0, -105, 'emote-happy').setDisplaySize(28, 28).setOrigin(0.5).setVisible(false)
    children.push(this.tempEmote)

    this.voiceBadgeBg = scene.add.circle(0, 0, 13.5, 0x3b2c26, 0.94).setStrokeStyle(2, 0x8cc985, 0.96)
    const micChildren: Phaser.GameObjects.GameObject[] = [this.voiceBadgeBg]
    if (scene.textures.exists('badge-mic')) {
      this.voiceBadgeIcon = scene.add.image(0, 0, 'badge-mic').setDisplaySize(16, 16).setOrigin(0.5)
      micChildren.push(this.voiceBadgeIcon)
    }
    this.voiceBadge = scene.add.container(0, -104, micChildren).setVisible(false)
    scene.tweens.add({
      targets: this.voiceBadge,
      y: -108,
      duration: 1150,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    children.push(this.voiceBadge)

    this.speechBubble = scene.add.text(0, -108, '', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '10.5px',
      fontStyle: '700',
      color: '#34241e',
      backgroundColor: 'rgba(255, 248, 237, 0.96)',
      padding: { x: 9, y: 4.5 },
      shadow: { color: '#2b1c16', blur: 6, fill: true, offsetY: 2 },
      wordWrap: { width: 180, useAdvancedWrap: true },
      align: 'center',
    }).setOrigin(0.5, 1).setResolution(textDpr).setVisible(false)
    children.push(this.speechBubble)

    this.root = scene.add.container(actor.position.x, actor.position.y, children).setDepth(actor.position.y + 2)
    this.sprite.play(CharacterSpriteFactory.animationKey(actor.avatar, actor.animation, actor.direction))
    this.refreshOverheadStatus()
  }

  setCollisionMap(collisionMap: CollisionMap) { this.collisionMap = collisionMap }
  get position(): WorldPoint { return { x: this.root.x, y: this.root.y } }
  get moving() { return this.pathIndex < this.path.length }

  setName(name: string) {
    this.actor.username = name
    this.nameTag.setText(name)
  }

  setVoiceIndicator(inCall: boolean, muted = false) {
    this.actor.inVoiceCall = inCall
    this.actor.voiceMuted = muted
    this.refreshOverheadStatus()
  }

  setGameIndicator(inGame: boolean) {
    this.actor.inGame = inGame
    this.refreshOverheadStatus()
  }

  private refreshOverheadStatus() {
    if (this.speechBubble.visible) {
      this.voiceBadge.setVisible(false)
      if (this.emoteSprite) this.emoteSprite.setVisible(false)
      return
    }
    if (this.actor.inVoiceCall) {
      this.voiceBadge.setVisible(true)
      if (this.voiceBadgeIcon && this.scene.textures.exists('badge-mic')) {
        this.voiceBadgeIcon.setTexture('badge-mic').setDisplaySize(16, 16)
      }
      this.voiceBadgeBg.setStrokeStyle(2, this.actor.voiceMuted ? 0xe09686 : 0x8cc985, 0.96)
      this.voiceBadge.setAlpha(this.actor.voiceMuted ? 0.82 : 1)
      if (this.emoteSprite) this.emoteSprite.setVisible(false)
    } else if (this.actor.inGame) {
      this.voiceBadge.setVisible(true)
      if (this.voiceBadgeIcon && this.scene.textures.exists('badge-game')) {
        this.voiceBadgeIcon.setTexture('badge-game').setDisplaySize(16, 16)
      }
      this.voiceBadgeBg.setStrokeStyle(2, 0xf2c57c, 0.96)
      this.voiceBadge.setAlpha(1)
      if (this.emoteSprite) this.emoteSprite.setVisible(false)
    } else {
      this.voiceBadge.setVisible(false)
      if (this.emoteSprite && !this.tempEmote.visible) {
        this.emoteSprite.setVisible(true)
      }
    }
  }

  showSpeechBubble(rawText: string) {
    if (this.isDestroyed) return
    const clean = rawText.trim()
    if (!clean) return
    const short = clean.length > 42 ? `${clean.slice(0, 41)}…` : clean
    const token = ++this.speechToken
    this.speechBubble.setText(short).setVisible(true)
    this.voiceBadge.setVisible(false)
    if (this.emoteSprite) this.emoteSprite.setVisible(false)

    this.scene.time.delayedCall(4300, () => {
      if (this.isDestroyed || token !== this.speechToken) return
      this.speechBubble.setVisible(false)
      this.refreshOverheadStatus()
    })
  }

  showOrderItem(assetKey: string) {
    if (this.isDestroyed || !this.scene.textures.exists(assetKey)) return
    const token = ++this.stateToken
    if (this.emoteSprite) this.emoteSprite.setVisible(false)
    this.voiceBadge.setVisible(false)
    this.tempEmote.setTexture(assetKey).setDisplaySize(30, 30).setVisible(true)
    this.scene.time.delayedCall(2600, () => {
      if (this.isDestroyed || token !== this.stateToken) return
      this.tempEmote.setVisible(false)
      this.refreshOverheadStatus()
    })
  }

  setAvatar(look: AvatarLook) {
    if (this.actor.avatar.id === look.id) return
    this.actor.avatar = look
    const texKey = CharacterSpriteFactory.ensure(this.scene, look)
    const spriteIdx = this.root.getIndex(this.sprite)
    this.sprite.destroy()
    this.sprite = this.scene.add.sprite(0, this.actor.animation === 'sit' ? 2 : 4, texKey, CharacterSpriteFactory.firstFrame(look, this.actor.animation, this.actor.direction))
      .setOrigin(0.5, 0.96)
      .setScale(0.70)
    this.root.addAt(this.sprite, Math.max(0, spriteIdx))
    this.sprite.play(CharacterSpriteFactory.animationKey(look, this.actor.animation, this.actor.direction))
  }

  setPosition(point: WorldPoint) {
    this.root.setPosition(point.x, point.y).setDepth(point.y + 2)
    this.actor.position = { ...point }
  }

  setRemoteState(target: WorldPoint, direction: Direction, animation: CharacterAnimation, seatId: string | null, immediate = false) {
    this.actor.seatId = seatId
    const dist = Phaser.Math.Distance.Between(this.root.x, this.root.y, target.x, target.y)
    if (immediate || seatId || dist > 220 || dist < 2) {
      this.remoteTarget = null
      this.setPosition(target)
      this.setAnimation(seatId ? 'sit' : animation, direction)
      return
    }
    this.remoteTarget = target
    this.remoteTargetDirection = direction
    this.remoteTargetAnimation = animation
  }

  hitTest(point: WorldPoint) {
    return Math.abs(point.x - this.root.x) <= 32 && point.y >= this.root.y - 82 && point.y <= this.root.y + 12
  }

  moveTo(destination: WorldPoint, handlers: ArrivalHandler) {
    this.cancelRoute()
    const route = this.collisionMap.findPath(this.position, destination, this.bodyRadius, this.actor.userId)
    if (!route.length) {
      if (Phaser.Math.Distance.Between(this.root.x, this.root.y, destination.x, destination.y) <= 8) {
        handlers.arrive()
        return true
      }
      handlers.cancel()
      this.setAnimation(this.actor.seatId ? 'sit' : 'idle', this.actor.direction)
      return false
    }
    this.path = route
    this.pathIndex = 0
    this.arrival = handlers
    this.actor.seatId = null
    return true
  }

  cancelRoute() {
    const pending = this.arrival
    this.arrival = undefined
    this.path = []
    this.pathIndex = 0
    pending?.cancel()
  }

  setAnimation(animation: CharacterAnimation, direction = this.actor.direction) {
    if (this.actor.animation === animation && this.actor.direction === direction && this.sprite.anims?.isPlaying) {
      return
    }
    const isActionAnim =
      animation === 'talk' ||
      animation === 'wave' ||
      animation === 'heart' ||
      animation === 'cheer' ||
      animation === 'coffee' ||
      animation === 'sit_wave' ||
      animation === 'sit_heart' ||
      animation === 'sit_cheer' ||
      animation === 'sit_coffee'
    if (!isActionAnim) this.stateToken++
    this.actor.direction = direction
    this.actor.animation = animation
    const isSittingAnim = animation === 'sit' || animation.startsWith('sit_')
    this.sprite.setY(isSittingAnim ? 2 : 4)
    this.footShadow.setVisible(!isSittingAnim)
    this.localRing?.setVisible(!isSittingAnim)
    const key = CharacterSpriteFactory.animationKey(this.actor.avatar, animation, direction)
    if (!this.scene.anims.exists(key)) CharacterSpriteFactory.ensure(this.scene, this.actor.avatar)
    this.sprite.play(key, true)
  }

  nodHead(onComplete?: () => void) {
    if (this.isNodding || this.isDestroyed) return
    this.isNodding = true
    const isSittingAnim = this.actor.animation === 'sit' || this.actor.animation.startsWith('sit_')
    const baseY = isSittingAnim ? 2 : 4

    // Two polite, adorable Korean greeting head nods (pure vertical bow, ZERO body swaying)
    this.sprite.setAngle(0)
    this.scene.tweens.add({
      targets: this.sprite,
      angle: 0,
      y: baseY + 7.5,
      scaleY: 0.62,
      scaleX: 0.74,
      duration: 160,
      yoyo: true,
      repeat: 1,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        if (!this.isDestroyed) {
          this.sprite.setAngle(0)
          this.sprite.setY(baseY)
          this.sprite.setScale(0.70)
          this.isNodding = false
          onComplete?.()
        }
      },
    })
  }

  animateFor(action: CharacterAction, duration = 1400) {
    if (this.isDestroyed) return
    const token = ++this.stateToken
    this.isActionAnimating = true
    const isSeated = Boolean(this.actor.seatId)
    const isSittingAnim = this.actor.animation === 'sit' || this.actor.animation.startsWith('sit_')
    const baseY = (isSeated || isSittingAnim) ? 2 : 4
    const resume: CharacterAnimation = this.actor.seatId ? 'sit' : (this.moving ? 'walk' : 'idle')

    // Always reset any residual rotation angle to keep body upright (ZERO body sway)
    this.sprite.setAngle(0)

    // Trigger frame-by-frame limb animation in spritesheet
    const animMap: Partial<Record<CharacterAction, CharacterAnimation>> = isSeated
      ? {
          wave: 'sit_wave',
          heart: 'sit_heart',
          cheer: 'sit_cheer',
          coffee: 'sit_coffee',
          talk: 'sit',
        }
      : {
          wave: 'wave',
          heart: 'heart',
          cheer: 'cheer',
          coffee: 'coffee',
          talk: 'talk',
        }
    const targetAnim = animMap[action]
    if (targetAnim) {
      this.setAnimation(targetAnim, this.actor.direction)
    }

    let emoteKey = 'emote-happy'

    switch (action) {
      case 'wave':
        emoteKey = 'emote-wave'
        this.nodHead()
        break

      case 'heart':
        emoteKey = 'emote-heart'
        this.scene.tweens.add({
          targets: this.sprite,
          angle: 0,
          y: isSeated ? baseY - 2 : baseY - 10,
          scaleY: isSeated ? 0.72 : 0.78,
          scaleX: isSeated ? 0.69 : 0.64,
          duration: 160,
          yoyo: true,
          repeat: 1,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!this.isDestroyed) {
              this.sprite.setAngle(0)
              this.sprite.setY(baseY)
              this.sprite.setScale(0.70)
            }
          },
        })
        break

      case 'cheer':
        emoteKey = 'emote-happy'
        this.scene.tweens.add({
          targets: this.sprite,
          angle: 0,
          y: isSeated ? baseY - 3 : baseY - 9,
          scaleY: isSeated ? 0.73 : 0.76,
          scaleX: isSeated ? 0.68 : 0.66,
          duration: 140,
          yoyo: true,
          repeat: 2,
          ease: 'Quad.easeInOut',
          onComplete: () => {
            if (!this.isDestroyed) {
              this.sprite.setAngle(0)
              this.sprite.setY(baseY)
              this.sprite.setScale(0.70)
            }
          },
        })
        break

      case 'coffee':
        emoteKey = this.scene.textures.exists('item-coffee-latte') ? 'item-coffee-latte' : 'emote-happy'
        this.scene.tweens.add({
          targets: this.sprite,
          angle: 0,
          y: baseY - 2,
          scaleY: 0.69,
          scaleX: 0.71,
          duration: 320,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (!this.isDestroyed) {
              this.sprite.setAngle(0)
              this.sprite.setY(baseY)
              this.sprite.setScale(0.70)
              this.nodHead()
            }
          },
        })
        break

      case 'study':
        emoteKey = 'emote-study'
        // Focus study motion: lean forward towards table and thoughtful vertical head nod (ZERO body tilt)
        this.scene.tweens.add({
          targets: this.sprite,
          angle: 0,
          y: baseY + 5,
          scaleY: 0.65,
          scaleX: 0.74,
          duration: 260,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (!this.isDestroyed) {
              this.sprite.setAngle(0)
              this.sprite.setY(baseY)
              this.sprite.setScale(0.70)
            }
          },
        })
        break

      case 'music':
        emoteKey = 'emote-music'
        // Groovy rhythmic vertical lo-fi head bobbing to the music (ZERO body tilt)
        this.scene.tweens.add({
          targets: this.sprite,
          angle: 0,
          y: baseY + 5.5,
          scaleY: 0.64,
          scaleX: 0.73,
          duration: 180,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (!this.isDestroyed) {
              this.sprite.setAngle(0)
              this.sprite.setY(baseY)
              this.sprite.setScale(0.70)
            }
          },
        })
        break

      case 'talk':
      default:
        emoteKey = 'emote-chat'
        this.nodHead()
        break
    }

    if (this.scene.textures.exists(emoteKey) && !this.speechBubble.visible) {
      if (this.emoteSprite) this.emoteSprite.setVisible(false)
      this.voiceBadge.setVisible(false)
      this.tempEmote.setTexture(emoteKey).setDisplaySize(29, 29).setVisible(true).setAlpha(1)
      this.scene.tweens.add({
        targets: this.tempEmote,
        y: -112,
        duration: duration * 0.45,
        yoyo: true,
        ease: 'Sine.easeInOut',
      })
    }

    this.scene.time.delayedCall(duration, () => {
      if (this.isDestroyed || token !== this.stateToken) return
      this.tempEmote.setVisible(false)
      this.tempEmote.setY(-105)
      this.isActionAnimating = false
      this.sprite.setAngle(0)
      this.sprite.setScale(0.70)
      this.refreshOverheadStatus()
      this.setAnimation(this.actor.seatId ? 'sit' : resume, this.actor.direction)
    })
  }

  private applyAliveMotion(deltaMs: number) {
    if (this.isNodding || this.isActionAnimating || this.isDestroyed) return
    const isSittingAnim = this.actor.animation === 'sit' || this.actor.animation.startsWith('sit_')
    const baseY = isSittingAnim ? 2 : 4

    if (this.actor.animation === 'walk') {
      this.walkAnimTime += deltaMs * 0.01257 // Synchronized with 8fps 4-frame walk cycle (500ms)
      const walkBob = Math.abs(Math.sin(this.walkAnimTime)) * 1.6
      const walkTilt = Math.sin(this.walkAnimTime) * 1.8
      this.sprite.setY(baseY - walkBob)
      this.sprite.setAngle(walkTilt)
      this.sprite.setScale(0.70)
    } else if (this.actor.animation === 'idle' || isSittingAnim) {
      this.walkAnimTime = 0
      this.idleAnimTime += deltaMs * 0.0028
      const breath = Math.sin(this.idleAnimTime + this.idlePhase) * 0.014
      this.sprite.setScale(0.70 - breath * 0.35, 0.70 + breath)
      this.sprite.setY(baseY - breath * 1.5)

      if (this.actor.animation === 'sit') {
        // Pure upright lo-fi chill posture (ZERO sideways body sway)
        this.sprite.setAngle(0)

        // Occasional ambient micro-action for NPCs sitting in cafe (coffee sip, study lean, music bop)
        if (this.actor.isNpc) {
          this.ambientActionTimer -= deltaMs
          if (this.ambientActionTimer <= 0) {
            this.ambientActionTimer = 22000 + Math.random() * 25000
            const ambientPool: CharacterAction[] = ['coffee', 'study', 'music']
            const chosen = ambientPool[Math.floor(Math.random() * ambientPool.length)]
            this.animateFor(chosen, 1200)
          }
        }
      } else {
        this.sprite.setAngle(0)
      }
    } else if (this.actor.animation === 'talk') {
      this.walkAnimTime = 0
      this.idleAnimTime += deltaMs * 0.015
      const talkBounce = Math.abs(Math.sin(this.idleAnimTime * 2.5)) * 2.2
      this.sprite.setY(baseY - talkBounce)
    }
  }

  update(deltaMs: number, intent: KeyboardIntent = { x: 0, y: 0 }) {
    if (this.isDestroyed) return

    if (this.remoteTarget) {
      const rdx = this.remoteTarget.x - this.root.x
      const rdy = this.remoteTarget.y - this.root.y
      const rDist = Math.hypot(rdx, rdy)
      const rStep = (this.speed * 1.08 * deltaMs) / 1000
      if (rDist <= Math.max(2, rStep)) {
        const dest = this.remoteTarget
        const finalDir = this.remoteTargetDirection ?? this.actor.direction
        const finalAnim = this.actor.seatId ? 'sit' : (this.remoteTargetAnimation === 'walk' ? 'idle' : (this.remoteTargetAnimation ?? 'idle'))
        this.remoteTarget = null
        this.setPosition(dest)
        this.setAnimation(finalAnim, finalDir)
        this.applyAliveMotion(deltaMs)
      } else {
        const ux = rdx / rDist
        const uy = rdy / rDist
        this.setPosition({ x: this.root.x + ux * rStep, y: this.root.y + uy * rStep })
        this.setAnimation('walk', this.directionFromVector(ux, uy))
        this.applyAliveMotion(deltaMs)
      }
      return
    }

    let dx = intent.x, dy = intent.y
    const keyboardMoving = dx !== 0 || dy !== 0
    let distanceToWaypoint = Number.POSITIVE_INFINITY
    if (keyboardMoving) {
      this.cancelRoute()
      const length = Math.hypot(dx, dy) || 1
      dx /= length; dy /= length
      const direction = this.directionFromVector(dx, dy)
      this.setAnimation('walk', direction)
      this.applyAliveMotion(deltaMs)
    } else if (this.moving) {
      const target = this.path[this.pathIndex]
      dx = target.x - this.root.x
      dy = target.y - this.root.y
      distanceToWaypoint = Math.hypot(dx, dy)
      if (distanceToWaypoint <= 2) {
        this.setPosition(target)
        this.pathIndex++
        if (!this.moving) {
          const arrive = this.arrival?.arrive
          this.arrival = undefined
          this.path = []
          this.pathIndex = 0
          arrive?.()
          if (this.actor.animation === 'walk') this.setAnimation(this.actor.seatId ? 'sit' : 'idle')
          this.applyAliveMotion(deltaMs)
          return
        }
        const next = this.path[this.pathIndex]
        dx = next.x - this.root.x
        dy = next.y - this.root.y
        distanceToWaypoint = Math.hypot(dx, dy)
      }
      const length = Math.hypot(dx, dy) || 1
      dx /= length; dy /= length
      this.setAnimation('walk', this.directionFromVector(dx, dy))
      this.applyAliveMotion(deltaMs)
    } else {
      if (!this.isActionAnimating) {
        const isAction =
          this.actor.animation === 'talk' ||
          this.actor.animation === 'wave' ||
          this.actor.animation === 'heart' ||
          this.actor.animation === 'cheer' ||
          this.actor.animation === 'coffee' ||
          this.actor.animation === 'sit_wave' ||
          this.actor.animation === 'sit_heart' ||
          this.actor.animation === 'sit_cheer' ||
          this.actor.animation === 'sit_coffee'
        if (this.actor.animation === 'walk' || (!isAction && this.actor.animation !== 'idle' && this.actor.animation !== 'sit')) {
          this.setAnimation(this.actor.seatId ? 'sit' : 'idle')
        }
      }
      this.applyAliveMotion(deltaMs)
      return
    }

    const from = this.position
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    const step = Math.min((this.speed * deltaMs) / 1000, distanceToWaypoint)
    const next = { x: from.x + ux * step, y: from.y + uy * step }

    if (this.collisionMap.canStepFrom(from, next, this.bodyRadius, this.actor.userId)) {
      this.setPosition(next)
    } else if (keyboardMoving) {
      let moved = false
      const candidates: WorldPoint[] = [
        { x: from.x + ux * step, y: from.y },
        { x: from.x, y: from.y + uy * step },
      ]
      for (const angle of SLIDE_ANGLES_RAD) {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const rx = ux * cos - uy * sin
        const ry = ux * sin + uy * cos
        candidates.push({ x: from.x + rx * step * 0.92, y: from.y + ry * step * 0.92 })
      }
      for (const candidate of candidates) {
        if (Phaser.Math.Distance.Between(from.x, from.y, candidate.x, candidate.y) < 0.15) continue
        if (this.collisionMap.canStepFrom(from, candidate, this.bodyRadius, this.actor.userId)) {
          this.setPosition(candidate)
          moved = true
          break
        }
      }
      if (!moved) {
        this.setAnimation('idle', this.actor.direction)
      }
    } else {
      this.cancelRoute()
      this.setAnimation(this.actor.seatId ? 'sit' : 'idle')
    }
  }

  destroy() {
    this.isDestroyed = true
    this.stateToken++
    this.speechToken++
    this.cancelRoute()
    this.root.destroy(true)
  }

  private directionFromVector(x: number, y: number): Direction {
    if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right'
    return y < 0 ? 'up' : 'down'
  }
}
