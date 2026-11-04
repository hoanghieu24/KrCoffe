import Phaser from 'phaser'
import type { SeatPoint, WorldPoint } from '../domain/types'
import type { ObstaclePolygon, Polygon } from './CollisionMap'

export type CafeMapData = {
  seats: SeatPoint[]
  boundary: Polygon
  obstacles: ObstaclePolygon[]
  spawn: WorldPoint
}

const palette = {
  floorBase: 0xc48b61,
  floorAlt: 0xba8058,
  floorLine: 0x8f5b3e,
  wallRight: 0xf0dcc3,
  wallLeft: 0xe3caa9,
  wainscotRight: 0x8fa683,
  wainscotLeft: 0x7d9472,
  trimDark: 0x694531,
  trimLight: 0xc88c58,
}

const TABLE_PROPS: { key: string; dx: number; dy: number; size: number }[] = [
  { key: 'item-latte', dx: 4, dy: -20, size: 25 },
  { key: 'item-hangul-book', dx: -3, dy: -19, size: 27 },
  { key: 'item-boba', dx: 4, dy: -22, size: 26 },
  { key: 'item-shortcake', dx: 0, dy: -20, size: 26 },
  { key: 'decor-table-lantern', dx: 0, dy: -23, size: 28 },
  { key: 'item-open-notebook', dx: 0, dy: -19, size: 28 },
  { key: 'item-americano', dx: 4, dy: -22, size: 25 },
  { key: 'item-croissant', dx: -2, dy: -19, size: 26 },
  { key: 'item-laptop', dx: 0, dy: -22, size: 31 },
  { key: 'item-dalgona', dx: 4, dy: -22, size: 25 },
  { key: 'item-macaron', dx: 0, dy: -19, size: 26 },
  { key: 'item-flashcards', dx: -2, dy: -19, size: 26 },
  { key: 'item-matcha-latte', dx: 4, dy: -22, size: 26 },
  { key: 'item-roll-cake', dx: 0, dy: -19, size: 25 },
  { key: 'item-bingsu', dx: 0, dy: -21, size: 27 },
]

export class CafeMap {
  private objects: Phaser.GameObjects.GameObject[] = []
  private readonly centerX: number
  private readonly floorTop: number
  private readonly stepX: number
  private readonly stepY: number
  private readonly columns = 19
  private readonly rows = 17
  private readonly seats: SeatPoint[] = []
  private readonly tableCenters = new Map<string, WorldPoint>()
  private orderPlaquePt: WorldPoint | null = null
  private readonly obstacles: ObstaclePolygon[] = []
  private boundary: Polygon = []

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale
    this.centerX = width * 0.505
    this.floorTop = height * 0.205
    this.stepX = Math.min(width / 34.5, height / 26.5)
    this.stepY = this.stepX * 0.48
  }

  draw(): CafeMapData {
    this.drawBackdrop()
    this.drawFloor()
    this.drawWalls()
    this.drawCafeCounter()
    this.drawBooksAndMusicArea()
    this.drawStudyTable()
    this.drawPlantsAndAccents()
    this.drawTablesAndSeats()
    return {
      seats: this.seats.map((seat) => ({ ...seat })),
      boundary: this.boundary,
      obstacles: this.obstacles,
      spawn: this.iso(11.8, 15.2),
    }
  }

  destroy() {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  isoToPixel(u: number, v: number): WorldPoint {
    return this.iso(u, v)
  }

  getTableCenter(tableId: string): WorldPoint | undefined {
    return this.tableCenters.get(tableId)
  }

  /** Centre of the "tap to order drinks" standee (used for click hit-testing). */
  getOrderPlaquePoint(): WorldPoint | null {
    return this.orderPlaquePt
  }

  getBaristaWaypoints(): { counterPt: WorldPoint; homePt: WorldPoint; exitPt: WorldPoint } {
    const pos = this.iso(1.45, 5.8)
    return {
      counterPt: { x: pos.x, y: pos.y + 26 },
      // Barista stands centered in the open station between bakery case and espresso machine at perfect waist height
      homePt: { x: pos.x - 2, y: pos.y - 6 },
      exitPt: { x: pos.x + this.stepX * 2.3, y: pos.y + this.stepY * 1.8 + 12 },
    }
  }

  pixelToIso(point: WorldPoint): { u: number; v: number } {
    const a = (point.x - this.centerX) / Math.max(1, this.stepX)
    const b = (point.y - this.floorTop) / Math.max(1, this.stepY)
    return {
      u: Number(((a + b) * 0.5).toFixed(3)),
      v: Number(((b - a) * 0.5).toFixed(3)),
    }
  }

  private iso(u: number, v: number): WorldPoint {
    return { x: this.centerX + (u - v) * this.stepX, y: this.floorTop + (u + v) * this.stepY }
  }

  private graphics(depth = 0) {
    const item = this.scene.add.graphics().setDepth(depth)
    this.objects.push(item)
    return item
  }

  private sprite(key: string, x: number, y: number, displayW: number, displayH: number, depth: number, originX = 0.5, originY = 0.5) {
    if (!this.scene.textures.exists(key)) return null
    const img = this.scene.add.image(x, y, key)
      .setOrigin(originX, originY)
      .setDisplaySize(displayW, displayH)
      .setDepth(depth)
    this.objects.push(img)
    return img
  }

  private fill(g: Phaser.GameObjects.Graphics, points: WorldPoint[], tint: number, alpha = 1) {
    g.fillStyle(tint, alpha).fillPoints(points, true)
  }

  private drawBackdrop() {
    const { width, height } = this.scene.scale
    const g = this.graphics(-100)
    // Smooth velvety warm espresso diorama backdrop (oversized for smooth camera zoom/pan)
    g.fillStyle(0x231a17, 1).fillRect(-width * 2, -height * 2, width * 5, height * 5)
    // Gentle radial warm cafe light pooling around the floor diorama
    g.fillStyle(0x382720, 0.6).fillEllipse(this.centerX, height * 0.48, width * 1.5, height * 1.4)
    g.fillStyle(0x4a342b, 0.4).fillEllipse(this.centerX, height * 0.46, width * 1.1, height * 1.05)
    g.fillStyle(0x604337, 0.22).fillEllipse(this.centerX, height * 0.44, width * 0.82, height * 0.78)
  }

  private drawFloor() {
    const top = this.iso(0, 0)
    const right = this.iso(this.columns, 0)
    const bottom = this.iso(this.columns, this.rows)
    const left = this.iso(0, this.rows)
    this.boundary = [top, right, bottom, left]

    const g = this.graphics(-85)
    // Soft ambient shadow beneath the 3D wooden diorama platform
    const slabH = Math.max(13, this.stepY * 0.88)
    this.fill(g, [
      { x: left.x - 6, y: left.y + 6 },
      { x: bottom.x, y: bottom.y + slabH + 14 },
      { x: right.x + 6, y: right.y + 6 },
      bottom,
    ], 0x191210, 0.42)

    // 3D wooden platform slab thickness along front-left and front-right edges
    this.fill(g, [left, bottom, { x: bottom.x, y: bottom.y + slabH }, { x: left.x, y: left.y + slabH }], 0x6d4731)
    this.fill(g, [bottom, right, { x: right.x, y: right.y + slabH }, { x: bottom.x, y: bottom.y + slabH }], 0x593927)

    // Clean warm honey-oak base diamond
    this.fill(g, [top, right, bottom, left], palette.floorBase)

    // Subtle alternating plank warmth in 2x2 zones
    for (let u = 0; u < this.columns; u += 2) {
      for (let v = 0; v < this.rows; v += 2) {
        const u2 = Math.min(this.columns, u + 2)
        const v2 = Math.min(this.rows, v + 2)
        const tile = [this.iso(u, v), this.iso(u2, v), this.iso(u2, v2), this.iso(u, v2)]
        this.fill(g, tile, ((u + v) / 2) % 2 === 0 ? palette.floorBase : palette.floorAlt, 0.42)
      }
    }

    // Subtle plank grid lines
    g.lineStyle(1, palette.floorLine, 0.18)
    for (let u = 0; u <= this.columns; u++) {
      const a = this.iso(u, 0), b = this.iso(u, this.rows)
      g.beginPath().moveTo(a.x, a.y).lineTo(b.x, b.y).strokePath()
    }
    for (let v = 0; v <= this.rows; v++) {
      const a = this.iso(0, v), b = this.iso(this.columns, v)
      g.beginPath().moveTo(a.x, a.y).lineTo(b.x, b.y).strokePath()
    }

    // Cozy woven sage area rugs under key zones using our floor-rug PNG asset
    const rugBook = this.iso(2.4, 2.2)
    this.sprite('floor-rug', rugBook.x, rugBook.y, this.stepX * 5.2, this.stepY * 5.4, -76)?.setAlpha(0.92)

    const rugStudy = this.iso(16.6, 5.1)
    this.sprite('floor-rug', rugStudy.x, rugStudy.y, this.stepX * 5.2, this.stepY * 5.4, -76)?.setAlpha(0.92)

    const rugLounge = this.iso(16.2, 13.4)
    this.sprite('floor-rug', rugLounge.x, rugLounge.y, this.stepX * 5.0, this.stepY * 5.2, -76)?.setAlpha(0.9)

    // Soft warm window light wash across the wooden planks
    const glowG = this.graphics(-74)
    this.fill(glowG, [this.iso(4.5, 0.5), this.iso(17, 0.5), this.iso(14.5, 11.5), this.iso(5, 11.5)], 0xffe0ad, 0.065)

    // Crisp outer wooden floor border
    glowG.lineStyle(5, palette.trimDark, 0.92)
      .beginPath()
      .moveTo(top.x, top.y)
      .lineTo(right.x, right.y)
      .lineTo(bottom.x, bottom.y)
      .lineTo(left.x, left.y)
      .closePath()
      .strokePath()
  }

  private drawWalls() {
    const { height } = this.scene.scale
    const top = this.iso(0, 0)
    const right = this.iso(this.columns, 0)
    const left = this.iso(0, this.rows)
    const lift = Math.max(138, height * 0.195)
    const wainscotH = lift * 0.38

    const g = this.graphics(-34)
    // Upper cream plaster walls
    this.fill(g, [top, left, { x: left.x, y: left.y - lift }, { x: top.x, y: top.y - lift }], palette.wallLeft)
    this.fill(g, [top, right, { x: right.x, y: right.y - lift }, { x: top.x, y: top.y - lift }], palette.wallRight)

    // Cozy sage-green lower wainscoting bands matching our wall PNG assets
    this.fill(g, [top, left, { x: left.x, y: left.y - wainscotH }, { x: top.x, y: top.y - wainscotH }], palette.wainscotLeft)
    this.fill(g, [top, right, { x: right.x, y: right.y - wainscotH }, { x: top.x, y: top.y - wainscotH }], palette.wainscotRight)

    // Warm oak chair-rail, cornice & baseboard trim lines
    g.lineStyle(4, palette.trimLight, 0.95)
      .beginPath()
      .moveTo(left.x, left.y - wainscotH).lineTo(top.x, top.y - wainscotH).lineTo(right.x, right.y - wainscotH)
      .strokePath()
    g.lineStyle(7, palette.trimDark, 0.96)
      .beginPath()
      .moveTo(left.x, left.y - lift).lineTo(top.x, top.y - lift).lineTo(right.x, right.y - lift)
      .moveTo(left.x, left.y).lineTo(top.x, top.y).lineTo(right.x, right.y)
      .moveTo(top.x, top.y).lineTo(top.x, top.y - lift)
      .strokePath()

    // Left Wall Assets (Door, Korean Flag Art, Hangul Chalkboard, Floating Shelf)
    const leftWallPt = (t: number, zFrac: number) => ({
      x: Phaser.Math.Linear(top.x, left.x, t),
      y: Phaser.Math.Linear(top.y, left.y, t) - lift * zFrac,
    })

    const shelfPt = leftWallPt(0.24, 0.63)
    this.sprite('shelf-wall', shelfPt.x, shelfPt.y, this.stepX * 2.5, this.stepX * 2.5, -28)

    const chalkPt = leftWallPt(0.45, 0.62)
    this.sprite('decor-chalkboard-wall', chalkPt.x, chalkPt.y, this.stepX * 2.6, this.stepX * 2.6, -28)

    const flagPt = leftWallPt(0.67, 0.63)
    this.sprite('decor-flag-art', flagPt.x, flagPt.y, this.stepX * 2.15, this.stepX * 2.15, -28)

    const doorPt = leftWallPt(0.86, 0.02)
    this.sprite('door-entrance', doorPt.x, doorPt.y + 8, this.stepX * 3.1, this.stepX * 3.1, -27, 0.5, 0.94)

    // Right-Back Wall Assets (Clock, 3 Panoramic Rainy Windows, Hanok Art, Pendant Lamps)
    const rightWallPt = (t: number, zFrac: number) => ({
      x: Phaser.Math.Linear(top.x, right.x, t),
      y: Phaser.Math.Linear(top.y, right.y, t) - lift * zFrac,
    })

    const clockPt = rightWallPt(0.11, 0.68)
    this.sprite('decor-clock', clockPt.x, clockPt.y, this.stepX * 1.55, this.stepX * 1.55, -28)

    const winW = this.stepX * 3.95
    const winH = winW * 0.88
    for (const wt of [0.31, 0.55, 0.79]) {
      const wPt = rightWallPt(wt, 0.56)
      const winImg = this.sprite('window-rainy', wPt.x, wPt.y, winW, winH, -29)
      winImg?.setFlipX(true) // Exact 0.88 aspect ratio keeps window sill parallel to right-back wall!
    }

    const hanokPt = rightWallPt(0.94, 0.61)
    this.sprite('decor-hanok-art', hanokPt.x, hanokPt.y, this.stepX * 1.95, this.stepX * 1.78, -28)?.setFlipX(true)

    // Hanging warm dome pendant lights with soft glow
    const glowLamps = this.graphics(-24)
    for (const lt of [0.22, 0.52, 0.82]) {
      const lp = rightWallPt(lt, 0.85)
      glowLamps.fillStyle(0xffdda1, 0.12).fillCircle(lp.x, lp.y + 18, 34)
      this.sprite('decor-pendant-lamp', lp.x, lp.y + 8, this.stepX * 1.75, this.stepX * 1.75, -23)
    }
  }

  private drawCafeCounter() {
    const pos = this.iso(1.45, 5.8)
    const g = this.graphics(pos.y - 4)
    g.fillStyle(0x4a3225, 0.18).fillEllipse(pos.x, pos.y + 12, this.stepX * 5.4, this.stepY * 2.8)

    const counterW = this.stepX * 5.6
    const counterH = this.stepX * 4.4

    // Layer 1: Back appliances (bakery display case, espresso machine, back shelves)
    // Rendered at depth pos.y - 14, behind Barista (depth pos.y - 4)
    this.sprite('counter-appliances', pos.x, pos.y + 12, counterW, counterH, pos.y - 14, 0.5, 0.88)

    // Layer 2: Front wooden counter bar & ledge (rendered at depth pos.y + 22, in front of Barista's waist/legs)
    // Sized and positioned with identical registration (512x512) so there is zero gap or floating seam
    this.sprite('counter-front-bar', pos.x, pos.y + 12, counterW, counterH, pos.y + 22, 0.5, 0.88)

    // Cute wooden K-CHILL Café sign to the left of counter
    const signPos = this.iso(0.85, 8.9)
    this.sprite('decor-sign-kchill', signPos.x, signPos.y + 4, this.stepX * 2.1, this.stepX * 2.1, signPos.y + 6, 0.5, 0.9)

    // "Tap to order drinks" Korean café menu plaque
    // Mounted neatly on the counter top ledge next to the bakery display, 100% clear of all floor tables!
    const standee = { x: pos.x - this.stepX * 0.65, y: pos.y - 12 }
    this.orderPlaquePt = { x: standee.x, y: standee.y }
    this.drawOrderPlaque(standee.x, standee.y, pos.y + 25)

    // Counter complete solid collision obstacle:
    // Full polygon covers all 4 sides of the counter so NO player can walk through!
    // Staff (npc-barista) is permitted to occupy homePt and step through the pickup exit.
    const counterObstacle = Object.assign(
      [
        { x: pos.x - this.stepX * 2.5, y: pos.y + 4 },
        { x: pos.x - this.stepX * 0.9, y: pos.y + 26 },
        { x: pos.x + this.stepX * 2.4, y: pos.y - 4 },
        { x: pos.x + this.stepX * 0.8, y: pos.y - 26 },
        { x: pos.x - this.stepX * 0.8, y: pos.y - 18 },
      ],
      { ignoreId: 'npc-barista' }
    )
    this.obstacles.push(counterObstacle)
    this.obstacles.push(this.circlePolygon(signPos, 14))
  }

  private drawOrderPlaque(x: number, y: number, depth: number) {
    const dpr = Math.max(2, Math.min(3, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2))
    const w = 78
    const h = 24
    const board = this.scene.add.graphics()

    // 1. Soft contact shadow on counter surface
    board.fillStyle(0x2a1c14, 0.25).fillEllipse(0, 3, w * 0.72, 4)

    // 2. Small wooden stand base
    board.fillStyle(0x5c3b28, 1).fillRoundedRect(-w * 0.28, -2, w * 0.56, 4, 1.5)

    // 3. Chalkboard body (dark slate) with warm gold frame
    board.fillStyle(0x221a16, 1).fillRoundedRect(-w / 2, -h - 2, w, h, 5)
    board.lineStyle(1.5, 0xe2ae66, 1).strokeRoundedRect(-w / 2, -h - 2, w, h, 5)
    board.lineStyle(0.8, 0xfce4b0, 0.45).strokeRoundedRect(-w / 2 + 1.5, -h - 0.5, w - 3, h - 3, 3.5)

    // 4. Header title: ☕ GỌI ĐỒ UỐNG
    const title = this.scene.add.text(0, -h + 4, '☕ GỌI ĐỒ UỐNG', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '8.5px',
      fontStyle: '800',
      color: '#fff1d6',
    }).setOrigin(0.5).setResolution(dpr)

    // 5. Subtitle: 메뉴판 · Bấm để xem ✨
    const sub = this.scene.add.text(0, -h + 14, '메뉴판 · Bấm để xem ✨', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '6.5px',
      fontStyle: '700',
      color: '#ecc079',
    }).setOrigin(0.5).setResolution(dpr)

    const baseScale = Phaser.Math.Clamp(this.stepX / 28, 0.85, 1.1)
    const plaque = this.scene.add.container(x, y, [board, title, sub])
      .setDepth(depth)
      .setScale(baseScale)

    this.objects.push(plaque)

    // Gentle breathing pulse animation
    this.scene.tweens.add({
      targets: plaque,
      scale: baseScale * 1.04,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private drawBooksAndMusicArea() {
    const shelfPos = this.iso(2.2, 1.15)
    const shelfImg = this.sprite('bookshelf-tall', shelfPos.x, shelfPos.y + 16, this.stepX * 3.1, this.stepX * 3.4, shelfPos.y + 16, 0.5, 0.9)
    shelfImg?.setFlipX(true)
    this.obstacles.push(this.circlePolygon(shelfPos, 24))

    const lowShelfPos = this.iso(4.6, 1.15)
    this.sprite('shelf-low', lowShelfPos.x, lowShelfPos.y + 12, this.stepX * 2.5, this.stepX * 2.5, lowShelfPos.y + 12, 0.5, 0.88)
    this.obstacles.push(this.circlePolygon(lowShelfPos, 20))

    const lampPos = this.iso(0.9, 1.8)
    this.sprite('decor-floor-lamp', lampPos.x, lampPos.y + 8, this.stepX * 2.2, this.stepX * 2.5, lampPos.y + 8, 0.5, 0.92)
    this.obstacles.push(this.circlePolygon(lampPos, 14))

    const guitarPos = this.iso(3.35, 1.2)
    this.sprite('decor-guitar', guitarPos.x, guitarPos.y + 10, this.stepX * 1.8, this.stepX * 2.0, guitarPos.y + 10, 0.5, 0.92)
  }

  private drawStudyTable() {
    const center = this.iso(16.8, 5.0)
    const g = this.graphics(center.y - 2)
    g.fillStyle(0x4a3225, 0.16).fillEllipse(center.x, center.y + 12, this.stepX * 3.8, this.stepY * 2.4)

    this.sprite('table-study', center.x, center.y + 20, this.stepX * 3.7, this.stepX * 3.2, center.y + 18, 0.5, 0.85)
    this.sprite('item-laptop', center.x - 10, center.y - 12, 31, 31, center.y + 20)
    this.sprite('item-book-stack', center.x + 16, center.y - 20, 26, 26, center.y + 19)
    this.sprite('item-desk-lamp', center.x + 2, center.y - 28, 28, 28, center.y + 19)
    this.obstacles.push(this.diamondPolygon(center, 38, 21))
  }

  private drawPlantsAndAccents() {
    const plantSpots: { u: number; v: number; key: string; scale: number }[] = [
      { u: 0.9, v: 11.8, key: 'decor-monstera', scale: 2.35 },
      { u: 0.9, v: 15.3, key: 'decor-cherry-vase', scale: 2.0 },
      { u: 17.8, v: 1.5, key: 'decor-monstera', scale: 2.2 },
      { u: 17.8, v: 9.2, key: 'decor-easel', scale: 2.15 },
      { u: 17.8, v: 13.0, key: 'decor-monstera', scale: 2.25 },
    ]
    for (const item of plantSpots) {
      const p = this.iso(item.u, item.v)
      const g = this.graphics(p.y - 2)
      g.fillStyle(0x4c352a, 0.16).fillEllipse(p.x, p.y + 4, 40, 13)
      this.sprite(item.key, p.x, p.y + 8, this.stepX * item.scale, this.stepX * item.scale, p.y + 8, 0.5, 0.92)
      this.obstacles.push(this.circlePolygon(p, 14))
    }

    // Cozy lounge sofa + low tea table accent in bottom-right corner
    const sofaPos = this.iso(16.4, 13.4)
    const g = this.graphics(sofaPos.y - 2)
    g.fillStyle(0x4a3225, 0.16).fillEllipse(sofaPos.x, sofaPos.y + 10, this.stepX * 3.6, this.stepY * 2.2)
    this.sprite('sofa-sage', sofaPos.x, sofaPos.y + 18, this.stepX * 3.4, this.stepX * 3.0, sofaPos.y + 16, 0.5, 0.86)?.setFlipX(true)
    const lowTblPos = this.iso(15.2, 13.8)
    this.sprite('table-low', lowTblPos.x, lowTblPos.y + 12, this.stepX * 1.9, this.stepX * 1.75, lowTblPos.y + 12, 0.5, 0.85)
    this.sprite('item-peach-tea', lowTblPos.x + 2, lowTblPos.y - 10, 22, 22, lowTblPos.y + 13)
    this.obstacles.push(this.diamondPolygon(sofaPos, 38, 21))
  }

  private drawTablesAndSeats() {
    const rowConfigs: [number, number[]][] = [
      [11.6, [-6.0, -3.0, 0.0, 3.0, 6.0]],
      [17.2, [-7.6, -3.8, 0.0, 3.8, 7.6]],
      [22.6, [-6.0, -3.0, 0.0, 3.0, 6.0]],
    ]
    let seatNumber = 1
    const seatDx = this.stepX * 1.14
    const seatDy = this.stepY * 0.38
    const chairSize = Math.max(40, this.stepX * 1.48)
    const tableW = Math.max(60, this.stepX * 2.34)
    const tableH = Math.max(56, this.stepX * 2.18)
    const propScale = Math.min(1.06, Math.max(0.75, this.stepX / 32.0))

    for (let row = 0; row < rowConfigs.length; row++) {
      const [sum, columnOffsets] = rowConfigs[row]
      for (let col = 0; col < columnOffsets.length; col++) {
        const tableIndex = row * 5 + col
        const diff = columnOffsets[col]
        const center = this.iso((sum + diff) / 2, (sum - diff) / 2)
        const tableId = `Table_${String(tableIndex + 1).padStart(2, '0')}`
        this.tableCenters.set(tableId, { x: center.x, y: center.y })

        // Soft contact shadow under table & chairs
        const shadowG = this.graphics(center.y - 8)
        shadowG.fillStyle(0x4c3428, 0.15).fillEllipse(center.x, center.y + 12, tableW * 1.05, tableH * 0.36)

        const leftSeat = { x: center.x - seatDx, y: center.y + seatDy }
        const rightSeat = { x: center.x + seatDx, y: center.y + seatDy }
        const chairKey = row === 1 ? 'chair-terracotta' : 'chair-sage'

        // Chairs sit behind seated player depth (seat.y - 2 vs player seat.y + 2)
        shadowG.fillStyle(0x4c3428, 0.12).fillEllipse(leftSeat.x, leftSeat.y + 5, chairSize * 0.68, chairSize * 0.24)
        shadowG.fillStyle(0x4c3428, 0.12).fillEllipse(rightSeat.x, rightSeat.y + 5, chairSize * 0.68, chairSize * 0.24)
        this.sprite(chairKey, leftSeat.x, leftSeat.y + 8, chairSize, chairSize, leftSeat.y - 2, 0.5, 0.88)
        this.sprite(chairKey, rightSeat.x, rightSeat.y + 8, chairSize, chairSize, rightSeat.y - 2, 0.5, 0.88)?.setFlipX(true)

        // Table renders over seated knees (center.y + 14 > seat.y + 2 = center.y + 8)
        const tableKey = row === 1
          ? (col % 2 === 0 ? 'table-cream' : 'table-square')
          : (col % 2 === 0 ? 'table-round' : 'table-square')
        const tblImg = this.sprite(tableKey, center.x, center.y + 18, tableW, tableH, center.y + 14, 0.5, 0.88)
        if (tableKey === 'table-cream') tblImg?.setTint(0xf5e5d0) // Warm latte-oat harmony

        // Single clean, curated tabletop item per table
        const prop = TABLE_PROPS[tableIndex % TABLE_PROPS.length]
        this.sprite(
          prop.key,
          center.x + prop.dx * propScale,
          center.y + prop.dy * propScale,
          prop.size * propScale,
          prop.size * propScale,
          center.y + 15,
        )

        this.obstacles.push(this.diamondPolygon(center, this.stepX * 0.56, this.stepY * 0.60))
        this.seats.push({ id: `Seat_${String(seatNumber++).padStart(2, '0')}`, ...leftSeat, direction: 'right', tableId })
        this.seats.push({ id: `Seat_${String(seatNumber++).padStart(2, '0')}`, ...rightSeat, direction: 'left', tableId })
      }
    }
  }

  private circlePolygon(center: WorldPoint, radius: number): Polygon {
    return Array.from({ length: 12 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 12
      return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
    })
  }

  private diamondPolygon(center: WorldPoint, halfWidth: number, halfHeight: number): Polygon {
    return [
      { x: center.x, y: center.y - halfHeight },
      { x: center.x + halfWidth, y: center.y },
      { x: center.x, y: center.y + halfHeight },
      { x: center.x - halfWidth, y: center.y },
    ]
  }
}
