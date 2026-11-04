import Phaser from 'phaser'
import { avatarLooks, demoPlayers } from '../data/demoData'
import { areSeatsAtSameTable, getPartnerSeatId, getTableIdForSeat } from '../domain/seatUtils'
import type {
  AvatarLook,
  CafeSceneEvent,
  CafeSeat,
  Direction,
  PlayerCharacter,
  RoomPlayerState,
  SceneSnapshot,
  SeatPoint,
  SelectedPlayerInfo,
  WorldPoint,
} from '../domain/types'
import { multiplayerClient, type CharacterAction, type JoinSnapshot, type PlayerActionPayload, type PlayerMovedPayload } from '../services/multiplayer'
import { CHARACTER_ASSETS, SCENE_IMAGES, SPRITE_FRAME_H, SPRITE_FRAME_W } from './AssetManifest'
import { CafeMap } from './CafeMap'
import type { CafeMapData } from './CafeMap'
import { CharacterController } from './CharacterController'
import { CollisionMap } from './CollisionMap'
import { SeatManager } from './SeatManager'

const WALK_ZOOM = 1.15
const SEATED_ZOOM = 1.95
const SEAT_INTERACT_RADIUS = 68
const PREFERRED_START_SEATS = ['Seat_13', 'Seat_14', 'Seat_15', 'Seat_17', 'Seat_18', 'Seat_25']

function lookById(id?: string): AvatarLook {
  return avatarLooks.find((item) => item.id === id) ?? avatarLooks[0]
}

export class CafeScene extends Phaser.Scene {
  private cafeMap!: CafeMap
  private mapData!: CafeMapData
  private collisionMap!: CollisionMap
  private seatManager!: SeatManager
  private localPlayer!: CharacterController
  private remotePlayers = new Map<string, CharacterController>()
  private keys?: Record<string, Phaser.Input.Keyboard.Key>
  private seatHighlight?: Phaser.GameObjects.Ellipse
  private seatPrompt?: Phaser.GameObjects.Text
  private localUserId = multiplayerClient.userId
  private currentLook: AvatarLook = avatarLooks[0]
  private localName = 'Bạn'
  private localLevel = 'TOPIK 1'
  private pendingSeatId: string | undefined
  private resizePending = false
  private lastWidth = 0
  private lastHeight = 0
  private wasMovingLastFrame = false
  private unsubscribers: Array<() => void> = []
  private isDraggingCamera = false
  private dragStartX = 0
  private dragStartY = 0
  private lastClickTime = 0
  private baristaController: CharacterController | null = null
  private baristaWaypoints?: { counterPt: WorldPoint; homePt: WorldPoint; exitPt: WorldPoint }
  private deliveryQueue: Array<{
    targetUserId: string
    targetUsername?: string
    seatId?: string | null
    tableId?: string | null
    itemId: string
    itemHangul: string
    assetKey: string
  }> = []
  private isDelivering = false

  constructor() {
    super('CafeScene')
  }

  preload() {
    const { width, height } = this.scale
    const barBox = this.add.graphics()
    const barFill = this.add.graphics()
    const loadingText = this.add.text(width * 0.5, height * 0.5 - 24, 'K-CHILL Café · Đang chuẩn bị không gian…', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '13px',
      fontStyle: '800',
      color: '#f7ece0',
    }).setOrigin(0.5)

    barBox.fillStyle(0x2a1f1b, 0.55).fillRoundedRect(width * 0.5 - 120, height * 0.5 - 4, 240, 10, 5)
    this.load.on('progress', (value: number) => {
      barFill.clear()
      barFill.fillStyle(0xe8be82, 1).fillRoundedRect(width * 0.5 - 118, height * 0.5 - 2, Math.max(8, 236 * value), 6, 3)
    })
    this.load.once('complete', () => {
      barBox.destroy()
      barFill.destroy()
      loadingText.destroy()
    })

    for (const [key, url] of Object.entries(SCENE_IMAGES)) {
      if (!this.textures.exists(key)) {
        this.load.image(key, url)
      }
    }
    for (const entry of Object.values(CHARACTER_ASSETS)) {
      if (!this.textures.exists(entry.sheetKey)) {
        this.load.spritesheet(entry.sheetKey, entry.sheetUrl, {
          frameWidth: SPRITE_FRAME_W,
          frameHeight: SPRITE_FRAME_H,
        })
      }
    }
  }

  create() {
    this.lastWidth = this.scale.width
    this.lastHeight = this.scale.height
    this.cameras.main.setScroll(0, 0)
    this.cameras.main.setZoom(WALK_ZOOM)
    this.input.keyboard?.disableGlobalCapture()
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,E,UP,DOWN,LEFT,RIGHT', false) as Record<string, Phaser.Input.Keyboard.Key>
    this.input.keyboard?.clearCaptures()
    this.cafeMap = new CafeMap(this)
    this.mapData = this.cafeMap.draw()
    this.collisionMap = new CollisionMap(this.scale.width, this.scale.height, this.mapData.boundary, this.mapData.obstacles)
    this.seatManager = new SeatManager(this.mapData.seats)
    this.createSeatPrompt()
    this.createCharacters()

    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)
    this.input.on('wheel', this.onWheel, this)
    this.game.events.on('camera-zoom-in', this.onCameraZoomIn, this)
    this.game.events.on('camera-zoom-out', this.onCameraZoomOut, this)
    this.game.events.on('camera-recenter', this.recenterCamera, this)
    this.game.events.on('avatar-change', this.onAvatarChange, this)
    this.game.events.on('stand-command', this.stand, this)
    this.game.events.on('sit-seat-command', this.onSitSeatCommand, this)
    this.game.events.on('action-command', this.onActionCommand, this)
    this.game.events.on('wave-command', this.onWaveCommand, this)
    this.game.events.on('talk-command', this.onTalkCommand, this)
    this.game.events.on('order-item-command', this.onOrderItemCommand, this)
    this.scale.on('resize', this.onResize, this)

    this.bindMultiplayer()
    this.emitSnapshot()
    this.game.events.emit('scene-ready')
  }

  private bindMultiplayer() {
    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = [
      multiplayerClient.on('snapshot', (snap) => this.applyServerSnapshot(snap)),
      multiplayerClient.on('playersChanged', (players) => this.syncRemotePlayers(players)),
      multiplayerClient.on('seatsChanged', (seats) => this.applyServerSeats(seats)),
      multiplayerClient.on('playerMoved', (payload) => this.applyRemoteMove(payload)),
      multiplayerClient.on('playerAction', (payload) => this.applyPlayerAction(payload)),
      multiplayerClient.on('chatMessage', (msg) => {
        const mySeat = this.localPlayer?.actor.seatId ?? null
        const myTable = getTableIdForSeat(mySeat)
        if (msg.userId !== this.localUserId && (!myTable || msg.tableId !== myTable)) {
          return
        }
        const ctrl = msg.userId === this.localUserId ? this.localPlayer : this.remotePlayers.get(msg.userId)
        ctrl?.showSpeechBubble(msg.text)
        if (msg.userId !== this.localUserId) {
          ctrl?.nodHead()
        }
      }),
      multiplayerClient.on('baristaDelivery', (payload) => {
        this.queueBaristaDelivery(payload)
      }),
    ]

    const existing = multiplayerClient.getLatestSnapshot()
    if (existing) {
      this.applyServerSnapshot(existing)
    }
  }

  private applyServerSnapshot(snap: JoinSnapshot) {
    if (!this.localPlayer || !this.seatManager || !this.cafeMap) return
    this.localUserId = snap.me.userId
    this.localPlayer.actor.userId = snap.me.userId
    this.localName = snap.me.username
    this.localLevel = snap.me.level
    this.currentLook = lookById(snap.me.avatarId)
    this.localPlayer.setName(this.localName)
    this.localPlayer.setAvatar(this.currentLook)
    this.localPlayer.actor.level = this.localLevel
    this.localPlayer.setVoiceIndicator(Boolean(snap.me.inVoiceCall), Boolean(snap.me.voiceMuted))
    this.localPlayer.setGameIndicator(Boolean(snap.me.inGame))

    this.seatManager.syncFromServer(snap.seats)

    if (snap.me.seatId) {
      const seatPt = this.seatManager.getPoint(snap.me.seatId)
      if (seatPt) {
        this.localPlayer.cancelRoute()
        this.localPlayer.actor.seatId = snap.me.seatId
        this.localPlayer.setPosition(seatPt)
        this.localPlayer.setAnimation('sit', seatPt.direction)
        this.focusCameraOnSeat(seatPt, true, snap.me.seatId)
      }
    } else {
      const worldPt = this.cafeMap.isoToPixel(snap.me.u, snap.me.v)
      const safePt = this.collisionMap.findNearestWalkablePoint(worldPt, this.localPlayer.bodyRadius, this.localUserId)
      this.localPlayer.actor.seatId = null
      this.localPlayer.setPosition(safePt)
      this.localPlayer.setAnimation('idle', snap.me.direction)
      this.resetCameraToWalk(false)
    }

    this.syncRemotePlayers(snap.players)
    this.updateDynamicBlockers()
    this.emitSnapshot()
  }

  private applyServerSeats(seats: CafeSeat[]) {
    if (!this.seatManager) return
    this.seatManager.syncFromServer(seats)
    // Keep any local pending walk reservation only if seat is still free
    if (this.pendingSeatId) {
      const s = this.seatManager.getSeat(this.pendingSeatId)
      if (s && s.status === 'occupied' && s.occupantId !== this.localUserId) {
        this.pendingSeatId = undefined
        this.localPlayer?.cancelRoute()
        this.emit({ type: 'message', text: 'Ghế bạn đang đi tới vừa có người ngồi mất rồi!' })
      }
    }
    this.emitSnapshot()
  }

  private syncRemotePlayers(players: RoomPlayerState[]) {
    if (!this.cafeMap || !this.collisionMap || !this.seatManager) return
    const activeRemoteIds = new Set<string>()

    for (const state of players) {
      if (state.userId === 'npc-barista') {
        continue
      }
      if (state.userId === this.localUserId) {
        this.localPlayer?.setVoiceIndicator(Boolean(state.inVoiceCall), Boolean(state.voiceMuted))
        this.localPlayer?.setGameIndicator(Boolean(state.inGame))
        continue
      }
      activeRemoteIds.add(state.userId)

      const look = lookById(state.avatarId)
      const seatPt = state.seatId ? this.seatManager.getPoint(state.seatId) : undefined
      const worldPos = seatPt ? { x: seatPt.x, y: seatPt.y } : this.cafeMap.isoToPixel(state.u, state.v)
      const dir = seatPt ? seatPt.direction : state.direction
      const anim = state.seatId ? 'sit' : state.animation

      const existing = this.remotePlayers.get(state.userId)
      if (existing) {
        existing.setName(state.username)
        existing.setAvatar(look)
        existing.actor.level = state.level
        existing.actor.isNpc = state.isNpc
        existing.setVoiceIndicator(Boolean(state.inVoiceCall), Boolean(state.voiceMuted))
        existing.setGameIndicator(Boolean(state.inGame))
        existing.setRemoteState(worldPos, dir, anim, state.seatId, Boolean(state.seatId))
      } else {
        const actor: PlayerCharacter = {
          userId: state.userId,
          username: state.username,
          avatar: look,
          position: worldPos,
          direction: dir,
          animation: anim,
          seatId: state.seatId,
          onlineStatus: state.onlineStatus,
          level: state.level,
          isNpc: state.isNpc,
          inVoiceCall: state.inVoiceCall,
          voiceMuted: state.voiceMuted,
          inGame: state.inGame,
        }
        const controller = new CharacterController(this, actor, this.collisionMap, {
          showBubble: state.mood === 'chatting',
          mood: state.mood,
        })
        this.remotePlayers.set(state.userId, controller)
      }
    }

    for (const [id, ctrl] of this.remotePlayers.entries()) {
      if (!activeRemoteIds.has(id)) {
        ctrl.destroy()
        this.remotePlayers.delete(id)
      }
    }

    this.updateDynamicBlockers()
  }

  private applyRemoteMove(payload: PlayerMovedPayload) {
    if (payload.userId === this.localUserId || !this.cafeMap) return
    const ctrl = this.remotePlayers.get(payload.userId)
    if (!ctrl) return
    const worldPos = this.cafeMap.isoToPixel(payload.u, payload.v)
    ctrl.setRemoteState(worldPos, payload.direction, payload.animation, payload.seatId, false)
  }

  private applyPlayerAction(payload: PlayerActionPayload) {
    const actorCtrl = payload.fromId === this.localUserId
      ? this.localPlayer
      : this.remotePlayers.get(payload.fromId)
    actorCtrl?.animateFor(payload.action, 1300)
  }

  private createSeatPrompt() {
    this.seatHighlight?.destroy()
    this.seatPrompt?.destroy()

    this.seatHighlight = this.add.ellipse(0, 0, 44, 16, 0xf5ca7b, 0.22)
      .setStrokeStyle(2, 0xffe29e, 0.95)
      .setVisible(false)

    this.seatPrompt = this.add.text(0, 0, 'E · Ngồi', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '10.5px',
      fontStyle: '800',
      color: '#fff8ec',
      backgroundColor: 'rgba(56, 40, 34, 0.93)',
      padding: { x: 8, y: 3.5 },
      stroke: '#35241d',
      strokeThickness: 1.5,
      shadow: { color: '#241813', blur: 5, fill: true, offsetY: 2 },
    }).setOrigin(0.5).setDepth(9500).setResolution(Math.max(2, Math.min(3, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2))).setVisible(false)
  }

  private pickInitialAvailableSeat(): string | null {
    for (const id of PREFERRED_START_SEATS) {
      if (this.seatManager.isAvailable(id) && this.seatManager.getPoint(id)) return id
    }
    const fallback = this.mapData.seats.find((seat) => this.seatManager.isAvailable(seat.id))
    return fallback?.id ?? null
  }

  private createCharacters(savedLocal?: { position: WorldPoint; direction: Direction; seatId: string | null; animation: PlayerCharacter['animation'] }) {
    this.remotePlayers.clear()
    const serverPlayers = multiplayerClient.getPlayers()

    if (serverPlayers.length > 0) {
      this.syncRemotePlayers(serverPlayers)
    } else {
      for (const visitor of demoPlayers) {
        const point = this.seatManager.getPoint(visitor.seatId)
        if (!point) continue
        const actor: PlayerCharacter = {
          userId: visitor.id,
          username: visitor.name,
          avatar: visitor.avatar,
          position: { x: point.x, y: point.y },
          direction: point.direction,
          animation: 'sit',
          seatId: visitor.seatId,
          onlineStatus: 'online',
          level: visitor.level,
          isNpc: true,
        }
        const controller = new CharacterController(this, actor, this.collisionMap, {
          showBubble: visitor.mood === 'chatting',
          mood: visitor.mood,
        })
        this.remotePlayers.set(visitor.id, controller)
      }
    }

    let start = savedLocal
    if (!start) {
      const autoSeatId = this.pickInitialAvailableSeat()
      const autoPoint = autoSeatId ? this.seatManager.getPoint(autoSeatId) : undefined
      if (autoSeatId && autoPoint && this.seatManager.occupy(autoSeatId, this.localUserId, this.localName)) {
        start = {
          position: { x: autoPoint.x, y: autoPoint.y },
          direction: autoPoint.direction,
          seatId: autoSeatId,
          animation: 'sit',
        }
      } else {
        start = {
          position: this.mapData.spawn,
          direction: 'down',
          seatId: null,
          animation: 'idle',
        }
      }
    } else if (start.seatId) {
      const seat = this.seatManager.getPoint(start.seatId)
      if (seat) start.position = { x: seat.x, y: seat.y }
    }

    const actor: PlayerCharacter = {
      userId: this.localUserId,
      username: this.localName,
      avatar: this.currentLook,
      position: start.position,
      direction: start.seatId ? this.seatManager.getPoint(start.seatId)?.direction ?? start.direction : start.direction,
      animation: start.seatId ? 'sit' : start.animation === 'walk' ? 'idle' : start.animation,
      seatId: start.seatId,
      onlineStatus: 'online',
      level: this.localLevel,
    }
    this.localPlayer = new CharacterController(this, actor, this.collisionMap, { isLocal: true })
    this.updateDynamicBlockers()
    this.setupBarista()

    if (actor.seatId) {
      const seatPt = this.seatManager.getPoint(actor.seatId)
      if (seatPt) this.focusCameraOnSeat(seatPt, !savedLocal, actor.seatId)
    } else {
      this.resetCameraToWalk(false)
    }
  }

  private focusCameraOnSeat(point: WorldPoint, animate = true, seatId?: string) {
    const cam = this.cameras.main
    const activeSeatId = seatId ?? this.localPlayer?.actor?.seatId
    const partnerSeatId = activeSeatId ? getPartnerSeatId(activeSeatId) : null
    const partnerPoint = partnerSeatId ? this.seatManager?.getPoint(partnerSeatId) : null

    let targetX = point.x
    let targetY = point.y - 14

    if (partnerPoint) {
      // Center right on the table midpoint between both seated characters
      targetX = (point.x + partnerPoint.x) * 0.5
      targetY = (point.y + partnerPoint.y) * 0.5 - 14
    }

    if (animate) {
      cam.pan(targetX, targetY, 700, 'Cubic.easeInOut', true)
      cam.zoomTo(SEATED_ZOOM, 700, 'Cubic.easeInOut', true)
    } else {
      cam.setZoom(SEATED_ZOOM)
      cam.centerOn(targetX, targetY)
    }
  }

  private resetCameraToWalk(animate = true) {
    const cam = this.cameras.main
    const { width, height } = this.scale
    const targetX = width * 0.5
    const targetY = height * 0.5
    if (animate) {
      cam.pan(targetX, targetY, 500, 'Cubic.easeInOut', true)
      cam.zoomTo(WALK_ZOOM, 500, 'Cubic.easeInOut', true)
    } else {
      cam.setZoom(WALK_ZOOM)
      cam.centerOn(targetX, targetY)
    }
  }

  private worldToScreen(wx: number, wy: number): WorldPoint {
    const cam = this.cameras.main
    return {
      x: (wx - cam.worldView.x) * cam.zoom,
      y: (wy - cam.worldView.y) * cam.zoom,
    }
  }

  private isUiBlockingInput(): boolean {
    if (typeof document === 'undefined') return false
    if (document.querySelector('.modal-backdrop') || document.querySelector('.game-arena-backdrop')) return true
    const el = document.activeElement as HTMLElement | null
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
  }

  private findNearestAvailableSeat(maxDist = SEAT_INTERACT_RADIUS): SeatPoint | undefined {
    if (!this.localPlayer || !this.mapData) return undefined
    const pos = this.localPlayer.position
    let best: SeatPoint | undefined
    let bestDist = maxDist
    for (const seat of this.mapData.seats) {
      const isFree = this.seatManager.isAvailable(seat.id) || this.seatManager.getReservation(seat.id) === this.localUserId
      if (!isFree) continue
      const d = Phaser.Math.Distance.Between(pos.x, pos.y, seat.x, seat.y)
      if (d <= bestDist) {
        bestDist = d
        best = seat
      }
    }
    return best
  }

  private ejectFromSeat(seatPt: SeatPoint, keyIntent?: { x: number; y: number }) {
    const sideSign = seatPt.direction === 'right' ? -1 : 1
    const preferred: WorldPoint[] = []

    if (keyIntent && (keyIntent.x !== 0 || keyIntent.y !== 0)) {
      const len = Math.hypot(keyIntent.x, keyIntent.y) || 1
      const ux = keyIntent.x / len
      const uy = keyIntent.y / len
      preferred.push(
        { x: seatPt.x + ux * 16, y: seatPt.y + uy * 16 },
        { x: seatPt.x + ux * 24, y: seatPt.y + uy * 24 },
      )
    }

    preferred.push(
      { x: seatPt.x + sideSign * 6, y: seatPt.y + 16 },
      { x: seatPt.x, y: seatPt.y + 18 },
      { x: seatPt.x + sideSign * 14, y: seatPt.y + 14 },
      { x: seatPt.x + sideSign * 6, y: seatPt.y - 18 },
      { x: seatPt.x, y: seatPt.y - 20 },
      { x: seatPt.x + sideSign * 18, y: seatPt.y },
    )

    this.updateDynamicBlockers()
    const cleanPos = this.collisionMap.findNearestWalkablePoint(
      seatPt,
      this.localPlayer.bodyRadius,
      this.localUserId,
      preferred,
    )
    this.localPlayer.setPosition(cleanPos)
  }

  private async sitIntoSeatImmediate(seatId: string) {
    const point = this.seatManager.getPoint(seatId)
    if (!point) return false
    if (this.pendingSeatId && this.pendingSeatId !== seatId) {
      this.seatManager.release(this.pendingSeatId, this.localUserId)
    }
    this.pendingSeatId = undefined

    const res = await multiplayerClient.requestSit(seatId)
    if (!res.ok) {
      this.seatManager.release(seatId, this.localUserId)
      this.emit({ type: 'message', text: res.reason || 'Ghế này vừa có người chọn mất rồi!' })
      return false
    }

    this.releaseCurrentSeat(false, false, false)
    this.localPlayer.cancelRoute()
    this.seatManager.forceOccupy(seatId, this.localUserId, this.localName)

    this.localPlayer.actor.seatId = seatId
    this.localPlayer.setPosition(point)
    this.localPlayer.setAnimation('sit', point.direction)
    this.focusCameraOnSeat(point, true, seatId)
    this.updateDynamicBlockers()
    this.updateSeatPrompt(0)

    const tableId = getTableIdForSeat(seatId)
    const partnerSeatId = getPartnerSeatId(seatId)
    const partnerSeat = partnerSeatId ? this.seatManager.getSeat(partnerSeatId) : undefined
    const partnerHint = partnerSeat?.status === 'occupied' && partnerSeat.occupantName
      ? ` Bạn đang ngồi cùng bàn (${tableId}) với ${partnerSeat.occupantName} — click vào bạn ấy để tương tác nhé! ✨`
      : ` (${tableId}). Chúc bạn một buổi học thật chill! ✨`

    this.emit({ type: 'message', text: `Bạn đã ngồi tại ${seatId}${partnerHint}`, kind: 'success' })
    this.emitSnapshot()
    return true
  }

  private handleInteractKey() {
    if (!this.localPlayer) return
    if (this.localPlayer.actor.seatId) {
      this.stand()
      return
    }
    const nearest = this.findNearestAvailableSeat(SEAT_INTERACT_RADIUS)
    if (!nearest) {
      this.emit({ type: 'message', text: 'Hãy lại gần một chiếc ghế trống (hiện “E · Ngồi”) rồi nhấn phím E nhé!' })
      return
    }
    const dist = Phaser.Math.Distance.Between(this.localPlayer.position.x, this.localPlayer.position.y, nearest.x, nearest.y)
    if (dist <= 58) {
      void this.sitIntoSeatImmediate(nearest.id)
    } else {
      this.moveToSeat(nearest.id)
    }
  }

  private updateSeatPrompt(time: number) {
    if (!this.seatHighlight || !this.seatPrompt || !this.localPlayer) return
    if (this.localPlayer.actor.seatId) {
      this.seatHighlight.setVisible(false)
      this.seatPrompt.setVisible(false)
      return
    }
    const nearest = this.findNearestAvailableSeat(SEAT_INTERACT_RADIUS)
    if (!nearest) {
      this.seatHighlight.setVisible(false)
      this.seatPrompt.setVisible(false)
      return
    }
    const bob = Math.sin(time * 0.0055) * 2.5
    this.seatHighlight.setPosition(nearest.x, nearest.y + 4).setDepth(nearest.y - 3).setVisible(true)
    this.seatPrompt.setPosition(nearest.x, nearest.y - 36 + bob).setVisible(true)
  }

  private onAvatarChange = (look: AvatarLook, name: string, level = 'TOPIK 1') => {
    this.currentLook = look
    this.localName = name?.trim() || 'Bạn'
    this.localLevel = level
    this.localPlayer?.setAvatar(look)
    this.localPlayer?.setName(this.localName)
    if (this.localPlayer) this.localPlayer.actor.level = level

    const actor = this.localPlayer?.actor
    if (actor) {
      const seat = actor.seatId ? this.seatManager.getSeat(actor.seatId) : undefined
      if (seat?.occupantId === this.localUserId) seat.occupantName = this.localName
    }
    multiplayerClient.updateProfile(this.localName, look.id, level)
    this.emitSnapshot()
  }

  private buildSelectedPlayerInfo(targetPerson: CharacterController): SelectedPlayerInfo {
    const screenPt = this.worldToScreen(targetPerson.position.x, targetPerson.position.y - 28)
    const isSelf = targetPerson.actor.userId === this.localUserId
    const mySeatId = this.localPlayer.actor.seatId
    const theirSeatId = targetPerson.actor.seatId
    const tableId = getTableIdForSeat(theirSeatId)
    const partnerSeatId = getPartnerSeatId(theirSeatId)
    const partnerSeatAvailable = Boolean(partnerSeatId && this.seatManager.isAvailable(partnerSeatId))

    return {
      id: isSelf ? 'self' : targetPerson.actor.userId,
      name: targetPerson.actor.username,
      avatarId: targetPerson.actor.avatar.id,
      level: targetPerson.actor.level ?? 'TOPIK 1',
      seatId: theirSeatId,
      tableId,
      sameTable: isSelf ? true : areSeatsAtSameTable(mySeatId, theirSeatId),
      partnerSeatId,
      partnerSeatAvailable,
      isNpc: targetPerson.actor.isNpc,
      inVoiceCall: targetPerson.actor.inVoiceCall,
      inGame: targetPerson.actor.inGame,
      x: screenPt.x,
      y: screenPt.y,
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (typeof document !== 'undefined' && (document.querySelector('.modal-backdrop') || document.querySelector('.game-arena-backdrop'))) return

    this.dragStartX = pointer.x
    this.dragStartY = pointer.y
    this.isDraggingCamera = false

    // Double-click to recenter camera on player or seat
    const now = Date.now()
    if (now - this.lastClickTime < 300) {
      this.recenterCamera()
      this.lastClickTime = 0
      return
    }
    this.lastClickTime = now
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!pointer.isDown) return
    const dist = Phaser.Math.Distance.Between(this.dragStartX, this.dragStartY, pointer.x, pointer.y)
    if (dist > 7) {
      this.isDraggingCamera = true
      const dx = (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom
      const dy = (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom
      this.cameras.main.scrollX -= dx
      this.cameras.main.scrollY -= dy
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (pointer.button !== 0 || !this.localPlayer) return
    if (this.isDraggingCamera) {
      this.isDraggingCamera = false
      return
    }
    const dist = Phaser.Math.Distance.Between(this.dragStartX, this.dragStartY, pointer.x, pointer.y)
    if (dist > 7) return

    this.handleWorldClick(pointer)
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) {
    const curZoom = this.cameras.main.zoom
    const step = deltaY > 0 ? -0.12 : 0.12
    const nextZoom = Phaser.Math.Clamp(curZoom + step, 0.85, 2.5)
    this.cameras.main.zoomTo(nextZoom, 130, 'Linear', true)
  }

  private onCameraZoomIn = () => {
    this.cameras.main.zoomTo(Math.min(2.5, this.cameras.main.zoom + 0.25), 220, 'Cubic.easeOut', true)
  }

  private onCameraZoomOut = () => {
    this.cameras.main.zoomTo(Math.max(0.85, this.cameras.main.zoom - 0.25), 220, 'Cubic.easeOut', true)
  }

  private recenterCamera = () => {
    if (this.localPlayer?.actor.seatId) {
      const seatPt = this.seatManager.getPoint(this.localPlayer.actor.seatId)
      if (seatPt) {
        this.focusCameraOnSeat(seatPt, true, this.localPlayer.actor.seatId)
        return
      }
    }
    const targetX = this.localPlayer?.position.x ?? this.scale.width * 0.5
    const targetY = this.localPlayer?.position.y ?? this.scale.height * 0.5
    this.cameras.main.pan(targetX, targetY, 450, 'Cubic.easeOut', true)
    this.cameras.main.zoomTo(WALK_ZOOM, 450, 'Cubic.easeOut', true)
  }

  private handleWorldClick(pointer: Phaser.Input.Pointer) {
    if (typeof document !== 'undefined' && (document.querySelector('.modal-backdrop') || document.querySelector('.game-arena-backdrop'))) return

    const point = { x: pointer.worldX, y: pointer.worldY }
    const visitors = [...this.remotePlayers.values()]
    const targetPerson = [...visitors, this.localPlayer].reverse().find((person) => person.hitTest(point))
    if (targetPerson) {
      this.emit({ type: 'select-player', player: this.buildSelectedPlayerInfo(targetPerson) })
      return
    }

    // Clickable Barista Counter & Menu Board to open Korean Drink Menu!
    const counterPt = this.cafeMap.isoToPixel(1.45, 5.8)
    const easelPt = this.cafeMap.isoToPixel(17.8, 9.2)
    const plaquePt = this.cafeMap.getOrderPlaquePoint()
    if (
      (this.baristaController && this.baristaController.hitTest(point)) ||
      Phaser.Math.Distance.Between(point.x, point.y, counterPt.x, counterPt.y) < 76 ||
      (plaquePt && Phaser.Math.Distance.Between(point.x, point.y, plaquePt.x, plaquePt.y) < 46) ||
      Phaser.Math.Distance.Between(point.x, point.y, easelPt.x, easelPt.y) < 42
    ) {
      this.baristaController?.nodHead()
      this.baristaController?.showSpeechBubble('어서오세요! K-CHILL 카페입니다~ ☕')
      this.emit({ type: 'open-cafe-menu' })
      return
    }

    const seatPoint = this.mapData.seats.find((seat) => Phaser.Math.Distance.Between(point.x, point.y, seat.x, seat.y - 4) < 28)
    if (seatPoint) {
      const seat = this.seatManager.getSeat(seatPoint.id)
      if (!seat) return
      if (seat.status === 'occupied') {
        if (seat.occupantId === this.localUserId) {
          this.emit({ type: 'message', text: `Bạn đang ngồi tại ${seat.id}. Nhấn phím E hoặc “Đứng dậy” để đi dạo nhé.` })
          return
        }
        const visitor = seat.occupantId ? this.remotePlayers.get(seat.occupantId) : undefined
        if (visitor) {
          this.emit({ type: 'select-player', player: this.buildSelectedPlayerInfo(visitor) })
        } else {
          this.emit({ type: 'message', text: 'Ghế này đã có người ngồi rồi nhé.' })
        }
        return
      }
      this.moveToSeat(seatPoint.id)
      return
    }

    const destination = this.collisionMap.canOccupy(point, this.localPlayer.bodyRadius, this.localUserId)
      ? point
      : this.collisionMap.findNearestWalkablePoint(point, this.localPlayer.bodyRadius, this.localUserId)

    if (Phaser.Math.Distance.Between(point.x, point.y, destination.x, destination.y) > 36) {
      this.emit({ type: 'message', text: 'Chỗ này đang vướng bàn hoặc vật trang trí. Hãy chọn lối đi nhé!' })
      return
    }

    this.releaseCurrentSeat(true, true, true)
    this.localPlayer.moveTo(destination, {
      arrive: () => {
        const iso = this.cafeMap.pixelToIso(this.localPlayer.position)
        multiplayerClient.sendMove(iso.u, iso.v, this.localPlayer.actor.direction, 'idle', true)
        this.emitSnapshot()
      },
      cancel: () => undefined,
    })
  }

  private onSitSeatCommand = (seatId?: string) => {
    if (!seatId) return
    this.moveToSeat(seatId)
  }

  private moveToSeat(seatId: string) {
    const point = this.seatManager.getPoint(seatId)
    if (!point || !this.seatManager.reserve(seatId, this.localUserId)) {
      this.emit({ type: 'message', text: 'Ghế này vừa có người chọn mất rồi. Chọn ghế trống khác nhé.' })
      return
    }

    const dist = Phaser.Math.Distance.Between(this.localPlayer.position.x, this.localPlayer.position.y, point.x, point.y)
    if (dist <= 44) {
      void this.sitIntoSeatImmediate(seatId)
      return
    }

    this.releaseCurrentSeat(false, true, true)
    this.pendingSeatId = seatId

    // Walk to a clean aisle approach point right next to the chair, then sit smoothly into the chair!
    const approachTarget = this.collisionMap.findNearestWalkablePoint(
      point,
      this.localPlayer.bodyRadius,
      this.localUserId,
      [
        { x: point.x + (point.direction === 'right' ? -8 : 8), y: point.y + 14 },
        { x: point.x, y: point.y + 16 },
        { x: point.x, y: point.y - 16 },
      ],
    )

    const started = this.localPlayer.moveTo(approachTarget, {
      arrive: () => {
        this.pendingSeatId = undefined
        void this.sitIntoSeatImmediate(seatId)
      },
      cancel: () => {
        this.seatManager.release(seatId, this.localUserId)
        if (this.pendingSeatId === seatId) this.pendingSeatId = undefined
        this.emitSnapshot()
      },
    })
    if (!started) {
      void this.sitIntoSeatImmediate(seatId)
    }
    this.emitSnapshot()
  }

  private releaseCurrentSeat(resetCamera = true, stepOut = true, notifyServer = true, keyIntent?: { x: number; y: number }) {
    const seatId = this.localPlayer.actor.seatId
    if (!seatId) return
    const seatPt = this.seatManager.getPoint(seatId)
    this.seatManager.release(seatId, this.localUserId)
    this.localPlayer.actor.seatId = null
    if (stepOut && seatPt) {
      this.ejectFromSeat(seatPt, keyIntent)
    }
    this.localPlayer.setAnimation('idle', 'down')
    if (resetCamera) this.resetCameraToWalk(true)
    if (notifyServer && this.cafeMap) {
      const iso = this.cafeMap.pixelToIso(this.localPlayer.position)
      multiplayerClient.notifyStand(iso.u, iso.v)
    }
    this.updateDynamicBlockers()
    this.emitSnapshot()
  }

  private stand = () => {
    if (!this.localPlayer.actor.seatId) return
    this.localPlayer.cancelRoute()
    this.releaseCurrentSeat(true, true, true)
    this.emit({ type: 'message', text: 'Bạn đã đứng dậy thoải mái. Nhấn WASD để đi dạo hoặc phím E gần ghế để ngồi nhé!' })
  }

  private onActionCommand = (action: CharacterAction, userId?: string) => {
    const target = !userId || userId === 'self' ? this.localPlayer : this.remotePlayers.get(userId)
    target?.animateFor(action, 1400)
  }

  private onWaveCommand = (userId?: string) => {
    const target = !userId || userId === 'self' ? this.localPlayer : this.remotePlayers.get(userId)
    target?.animateFor('wave', 1300)
  }

  private onTalkCommand = (text?: string) => {
    this.localPlayer.animateFor('talk', 1200)
    if (text) this.localPlayer.showSpeechBubble(text)
  }

  private onOrderItemCommand = (assetKey: string, phraseKo?: string) => {
    if (phraseKo) this.localPlayer.showSpeechBubble(phraseKo)
    if (!multiplayerClient.isConnected) {
      const mySeat = this.localPlayer?.actor.seatId
      const myTable = getTableIdForSeat(mySeat)
      this.queueBaristaDelivery({
        targetUserId: this.localUserId,
        seatId: mySeat,
        tableId: myTable,
        itemId: '',
        itemHangul: phraseKo?.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim() || '메뉴',
        assetKey,
      })
    }
  }

  private setupBarista() {
    if (!this.cafeMap) return
    this.baristaController?.destroy()
    this.baristaWaypoints = this.cafeMap.getBaristaWaypoints()
    const baristaLook = avatarLooks.find((l) => l.id === 'look-barista') ?? avatarLooks[1]
    const actor: PlayerCharacter = {
      userId: 'npc-barista',
      username: 'Soo-jin (Barista ☕)',
      avatar: baristaLook,
      position: { ...this.baristaWaypoints.homePt },
      direction: 'right',
      animation: 'idle',
      seatId: null,
      onlineStatus: 'online',
      level: '바리스타',
      isNpc: true,
    }
    this.baristaController = new CharacterController(this, actor, this.collisionMap, {
      showBubble: false,
    })
  }

  private queueBaristaDelivery(order: {
    targetUserId: string
    targetUsername?: string
    seatId?: string | null
    tableId?: string | null
    itemId: string
    itemHangul: string
    assetKey: string
  }) {
    if (!this.baristaController) return
    this.deliveryQueue.push(order)
    if (!this.isDelivering) {
      this.processNextDelivery()
    }
  }

  private processNextDelivery() {
    if (this.deliveryQueue.length === 0) {
      this.isDelivering = false
      return
    }
    const order = this.deliveryQueue.shift()!
    this.executeBaristaDelivery(order)
  }

  private executeBaristaDelivery(order: {
    targetUserId: string
    targetUsername?: string
    seatId?: string | null
    tableId?: string | null
    itemId: string
    itemHangul: string
    assetKey: string
  }) {
    if (!this.baristaController || !this.baristaWaypoints) {
      this.isDelivering = false
      return
    }
    this.isDelivering = true

    const wp = this.baristaWaypoints
    const isMe = order.targetUserId === this.localUserId
    const targetCtrl = isMe ? this.localPlayer : this.remotePlayers.get(order.targetUserId)

    // Find destination table front or target player position
    let targetPos: WorldPoint | undefined
    if (order.tableId) {
      targetPos = this.cafeMap.getTableCenter(order.tableId)
    } else if (order.seatId) {
      const seatPt = this.seatManager.getPoint(order.seatId)
      if (seatPt) {
        const tblId = getTableIdForSeat(order.seatId)
        targetPos = tblId ? this.cafeMap.getTableCenter(tblId) : seatPt
      }
    }
    if (!targetPos && targetCtrl) {
      targetPos = targetCtrl.position
    }
    if (!targetPos) {
      this.isDelivering = false
      this.processNextDelivery()
      return
    }

    const candidateSpots: WorldPoint[] = [
      { x: targetPos.x, y: targetPos.y + 24 },
      { x: targetPos.x - 22, y: targetPos.y + 20 },
      { x: targetPos.x + 22, y: targetPos.y + 20 },
      { x: targetPos.x, y: targetPos.y + 16 },
    ]
    const deliverySpot = this.collisionMap.findNearestWalkablePoint(
      { x: targetPos.x, y: targetPos.y + 22 },
      9,
      'npc-barista',
      candidateSpots,
    )

    // Step 1: Barista acknowledges order behind counter with polite nod
    this.baristaController.setAnimation('idle', 'right')
    this.baristaController.nodHead()
    this.baristaController.showSpeechBubble(`네! ${order.itemHangul} 준비할게요~ ☕`)

    // Step 2: After preparing drink (800ms), walks out to customer table
    this.time.delayedCall(800, () => {
      if (!this.baristaController || !this.baristaWaypoints) {
        this.isDelivering = false
        return
      }
      this.baristaController.showOrderItem(order.assetKey)

      const returnToCounter = () => {
        if (!this.baristaController || !this.baristaWaypoints) {
          this.isDelivering = false
          this.processNextDelivery()
          return
        }
        this.baristaController.moveTo(wp.exitPt, {
          arrive: () => {
            this.baristaController?.moveTo(wp.homePt, {
              arrive: () => {
                this.baristaController?.setAnimation('idle', 'right')
                this.isDelivering = false
                this.processNextDelivery()
              },
              cancel: () => {
                this.baristaController?.setPosition(wp.homePt)
                this.baristaController?.setAnimation('idle', 'right')
                this.isDelivering = false
                this.processNextDelivery()
              },
            })
          },
          cancel: () => {
            this.baristaController?.setPosition(wp.homePt)
            this.baristaController?.setAnimation('idle', 'right')
            this.isDelivering = false
            this.processNextDelivery()
          },
        })
      }

      const serveAtTable = () => {
        if (!this.baristaController) {
          targetCtrl?.showOrderItem(order.assetKey)
          this.isDelivering = false
          this.processNextDelivery()
          return
        }
        const serveDir: Direction =
          (targetCtrl?.position.x ?? 0) < this.baristaController.position.x ? 'left' : 'right'
        this.baristaController.setAnimation('idle', serveDir)
        this.baristaController.animateFor('wave')
        this.baristaController.showSpeechBubble(`주문하신 ${order.itemHangul} 나왔습니다! 맛있게 드세요~ 🍰`)

        // Customer receives the drink & nods
        targetCtrl?.showOrderItem(order.assetKey)
        targetCtrl?.nodHead()

        // Step 4: After 2600ms, Barista returns to counter
        this.time.delayedCall(2600, () => {
          returnToCounter()
        })
      }

      // Move from home to walkway exit, then directly to customer table
      this.baristaController.moveTo(wp.exitPt, {
        arrive: () => {
          this.baristaController?.moveTo(deliverySpot, {
            arrive: () => {
              serveAtTable()
            },
            cancel: () => {
              serveAtTable()
            },
          })
        },
        cancel: () => {
          // Fallback if exitPt was close or blocked: move straight to deliverySpot
          this.baristaController?.moveTo(deliverySpot, {
            arrive: () => {
              serveAtTable()
            },
            cancel: () => {
              serveAtTable()
            },
          })
        },
      })
    })
  }

  private onResize() {
    if (this.resizePending || !this.localPlayer || !this.seatManager) return
    const oldWidth = this.lastWidth || this.scale.width
    const oldHeight = this.lastHeight || this.scale.height
    this.lastWidth = this.scale.width
    this.lastHeight = this.scale.height
    this.resizePending = true
    this.time.delayedCall(50, () => {
      this.resizePending = false
      this.rebuildForResize(oldWidth, oldHeight)
    })
  }

  private rebuildForResize(previousWidth: number, previousHeight: number) {
    const oldWidth = Math.max(1, previousWidth)
    const oldHeight = Math.max(1, previousHeight)
    const actor = this.localPlayer.actor
    const saved = {
      position: actor.seatId
        ? { ...actor.position }
        : { x: (actor.position.x / oldWidth) * this.scale.width, y: (actor.position.y / oldHeight) * this.scale.height },
      direction: actor.direction,
      seatId: actor.seatId,
      animation: actor.animation,
    }
    if (this.pendingSeatId) this.seatManager.release(this.pendingSeatId, this.localUserId)
    this.pendingSeatId = undefined
    this.localPlayer.destroy()
    for (const player of this.remotePlayers.values()) player.destroy()
    this.baristaController?.destroy()
    this.baristaController = null
    this.isDelivering = false
    this.cafeMap.destroy()
    this.cafeMap = new CafeMap(this)
    this.mapData = this.cafeMap.draw()
    this.collisionMap = new CollisionMap(this.scale.width, this.scale.height, this.mapData.boundary, this.mapData.obstacles)
    this.lastWidth = this.scale.width
    this.lastHeight = this.scale.height
    this.seatManager.setPoints(this.mapData.seats)
    this.createSeatPrompt()
    this.createCharacters(saved)
    this.emitSnapshot()
  }

  private updateDynamicBlockers() {
    const players = [...this.remotePlayers.values(), ...(this.localPlayer ? [this.localPlayer] : [])]
    this.collisionMap?.setDynamicBlockers(
      players.map((person) => ({
        id: person.actor.userId,
        ...person.position,
        // Seated players are tucked onto chairs and never block aisles!
        radius: person.actor.seatId || person.actor.animation === 'sit' ? 0 : 7.5,
      })),
    )
  }

  update(time: number, delta: number) {
    if (!this.localPlayer || !this.keys) return
    const blocked = this.isUiBlockingInput()
    if (this.input.keyboard) {
      if (blocked && this.input.keyboard.enabled) {
        this.input.keyboard.resetKeys()
      }
      this.input.keyboard.enabled = !blocked
    }

    if (!blocked && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.handleInteractKey()
    }

    const x = blocked ? 0 : Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown)
    const y = blocked ? 0 : Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown)

    if ((x || y) && this.localPlayer.actor.seatId) {
      this.releaseCurrentSeat(true, true, true, { x, y })
    }

    this.updateDynamicBlockers()
    for (const player of this.remotePlayers.values()) player.update(delta)
    this.baristaController?.update(delta)

    const prevX = this.localPlayer.position.x
    const prevY = this.localPlayer.position.y
    this.localPlayer.update(delta, { x, y })

    const isSeated = Boolean(this.localPlayer.actor.seatId)
    const movedNow = !isSeated && Math.hypot(this.localPlayer.position.x - prevX, this.localPlayer.position.y - prevY) > 0.05
    if (movedNow) {
      const iso = this.cafeMap.pixelToIso(this.localPlayer.position)
      multiplayerClient.sendMove(iso.u, iso.v, this.localPlayer.actor.direction, 'walk')
    } else if (this.wasMovingLastFrame && !isSeated) {
      const iso = this.cafeMap.pixelToIso(this.localPlayer.position)
      multiplayerClient.sendMove(iso.u, iso.v, this.localPlayer.actor.direction, 'idle', true)
    }
    this.wasMovingLastFrame = movedNow

    if (!this.localPlayer.actor.seatId) this.updateDynamicBlockers()
    this.updateSeatPrompt(time)
  }

  private emit(event: CafeSceneEvent) {
    this.game.events.emit('cafe-event', event)
  }

  private emitSnapshot() {
    if (!this.game || !this.seatManager || !this.localPlayer) return
    const actor = this.localPlayer.actor
    const snapshot: SceneSnapshot = {
      seats: this.seatManager.getAll(),
      seated: Boolean(actor.seatId),
      seatedId: actor.seatId ?? undefined,
      tableId: getTableIdForSeat(actor.seatId),
      playerX: actor.position.x / Math.max(1, this.scale.width),
      playerY: actor.position.y / Math.max(1, this.scale.height),
      avatarId: this.currentLook.id,
    }
    this.emit({ type: 'snapshot', snapshot })
  }

  shutdown() {
    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = []
    this.input.off('pointerdown', this.onPointerDown, this)
    this.input.off('pointermove', this.onPointerMove, this)
    this.input.off('pointerup', this.onPointerUp, this)
    this.input.off('wheel', this.onWheel, this)
    this.game.events.off('camera-zoom-in', this.onCameraZoomIn, this)
    this.game.events.off('camera-zoom-out', this.onCameraZoomOut, this)
    this.game.events.off('camera-recenter', this.recenterCamera, this)
    this.scale.off('resize', this.onResize, this)
    this.game.events.off('avatar-change', this.onAvatarChange, this)
    this.game.events.off('stand-command', this.stand, this)
    this.game.events.off('sit-seat-command', this.onSitSeatCommand, this)
    this.game.events.off('action-command', this.onActionCommand, this)
    this.game.events.off('wave-command', this.onWaveCommand, this)
    this.game.events.off('talk-command', this.onTalkCommand, this)
    this.game.events.off('order-item-command', this.onOrderItemCommand, this)
    this.seatHighlight?.destroy()
    this.seatPrompt?.destroy()
    this.localPlayer?.destroy()
    this.baristaController?.destroy()
    for (const player of this.remotePlayers.values()) player.destroy()
    this.cafeMap?.destroy()
  }
}
