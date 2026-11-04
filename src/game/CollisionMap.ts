import Phaser from 'phaser'
import type { WorldPoint } from '../domain/types'

export type Polygon = WorldPoint[]
export type ObstaclePolygon = Polygon & { ignoreId?: string }
export type CircleBlocker = WorldPoint & { radius: number; id: string }

const pointInPolygon = (point: WorldPoint, polygon: Polygon) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    const crosses = (a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

const distanceToSegment = (p: WorldPoint, a: WorldPoint, b: WorldPoint) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Phaser.Math.Clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0
  return Phaser.Math.Distance.Between(p.x, p.y, a.x + dx * t, a.y + dy * t)
}

export class CollisionMap {
  private dynamicBlockers: CircleBlocker[] = []
  private readonly cellSize = 18

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly boundary: Polygon,
    private readonly obstacles: ObstaclePolygon[],
  ) {}

  setDynamicBlockers(blockers: CircleBlocker[]) {
    this.dynamicBlockers = blockers
  }

  minClearance(point: WorldPoint, ignoreId?: string): number {
    if (!pointInPolygon(point, this.boundary)) return -999
    let minClear = Number.POSITIVE_INFINITY
    for (let i = 0; i < this.boundary.length; i++) {
      const d = distanceToSegment(point, this.boundary[i], this.boundary[(i + 1) % this.boundary.length])
      if (d < minClear) minClear = d
    }
    for (const obstacle of this.obstacles) {
      if (obstacle.ignoreId && obstacle.ignoreId === ignoreId) continue
      let edgeDist = Number.POSITIVE_INFINITY
      for (let i = 0; i < obstacle.length; i++) {
        const d = distanceToSegment(point, obstacle[i], obstacle[(i + 1) % obstacle.length])
        if (d < edgeDist) edgeDist = d
      }
      const signed = pointInPolygon(point, obstacle) ? -edgeDist : edgeDist
      if (signed < minClear) minClear = signed
    }
    for (const blocker of this.dynamicBlockers) {
      if (blocker.id === ignoreId || blocker.radius <= 0) continue
      const d = Phaser.Math.Distance.Between(point.x, point.y, blocker.x, blocker.y) - blocker.radius
      if (d < minClear) minClear = d
    }
    return minClear
  }

  canOccupy(point: WorldPoint, radius = 9, ignoreId?: string) {
    if (!pointInPolygon(point, this.boundary)) return false
    for (let i = 0; i < this.boundary.length; i++) {
      if (distanceToSegment(point, this.boundary[i], this.boundary[(i + 1) % this.boundary.length]) < radius) return false
    }
    for (const obstacle of this.obstacles) {
      if (obstacle.ignoreId && obstacle.ignoreId === ignoreId) continue
      if (pointInPolygon(point, obstacle)) return false
      for (let i = 0; i < obstacle.length; i++) {
        const distance = distanceToSegment(point, obstacle[i], obstacle[(i + 1) % obstacle.length])
        if (distance < radius) return false
      }
    }
    for (const blocker of this.dynamicBlockers) {
      if (blocker.id === ignoreId || blocker.radius <= 0) continue
      if (Phaser.Math.Distance.Between(point.x, point.y, blocker.x, blocker.y) < radius + blocker.radius) return false
    }
    return true
  }

  canStepFrom(from: WorldPoint, to: WorldPoint, radius = 9, ignoreId?: string) {
    if (!pointInPolygon(to, this.boundary)) return false
    if (this.canOccupy(to, radius, ignoreId)) return true
    if (!this.canOccupy(from, radius, ignoreId)) {
      return this.minClearance(to, ignoreId) > this.minClearance(from, ignoreId) + 0.02
    }
    return false
  }

  findNearestWalkablePoint(origin: WorldPoint, radius = 9, ignoreId?: string, preferredCandidates: WorldPoint[] = []): WorldPoint {
    for (const candidate of preferredCandidates) {
      if (this.canOccupy(candidate, radius, ignoreId)) return candidate
    }
    if (this.canOccupy(origin, radius, ignoreId)) return origin

    for (const ring of [10, 16, 22, 28, 36, 46]) {
      let best: WorldPoint | null = null
      let bestClearance = -Infinity
      for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 * i) / 16
        const pt = { x: origin.x + Math.cos(angle) * ring, y: origin.y + Math.sin(angle) * ring }
        if (this.canOccupy(pt, radius, ignoreId)) {
          const clearance = this.minClearance(pt, ignoreId)
          if (clearance > bestClearance) {
            bestClearance = clearance
            best = pt
          }
        }
      }
      if (best) return best
    }
    return origin
  }

  findPath(start: WorldPoint, destination: WorldPoint, radius = 9, ignoreId?: string) {
    const startCell = this.nearestWalkableCell(start, radius, ignoreId)
    const goalCell = this.nearestWalkableCell(destination, radius, ignoreId)
    if (!startCell || !goalCell) return []
    const startKey = this.key(startCell.x, startCell.y)
    const goalKey = this.key(goalCell.x, goalCell.y)
    if (startKey === goalKey) {
      return this.canOccupy(destination, radius, ignoreId) && Phaser.Math.Distance.Between(start.x, start.y, destination.x, destination.y) > 3 ? [destination] : []
    }
    const open = new Map<string, { x: number; y: number; f: number }>()
    const cameFrom = new Map<string, string>()
    const gScore = new Map<string, number>([[startKey, 0]])
    const closed = new Set<string>()
    open.set(startKey, { ...startCell, f: this.heuristic(startCell, goalCell) })
    const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const
    let found = false

    while (open.size) {
      const current = [...open.entries()].reduce((best, entry) => entry[1].f < best[1].f ? entry : best)
      const [currentKey, currentNode] = current
      if (currentKey === goalKey) { found = true; break }
      open.delete(currentKey)
      closed.add(currentKey)
      for (const [dx, dy] of offsets) {
        const nx = currentNode.x + dx, ny = currentNode.y + dy
        const nextKey = this.key(nx, ny)
        if (closed.has(nextKey)) continue
        const next = this.cellCenter(nx, ny)
        if (!this.canOccupy(next, radius, ignoreId)) continue
        if (!this.hasLineOfSight(this.cellCenter(currentNode.x, currentNode.y), next, radius, ignoreId)) continue
        if (dx && dy && (!this.canOccupy(this.cellCenter(currentNode.x + dx, currentNode.y), radius, ignoreId) || !this.canOccupy(this.cellCenter(currentNode.x, currentNode.y + dy), radius, ignoreId))) continue
        const moveCost = dx && dy ? 1.4142 : 1
        const tentative = (gScore.get(currentKey) ?? Infinity) + moveCost
        if (tentative >= (gScore.get(nextKey) ?? Infinity)) continue
        cameFrom.set(nextKey, currentKey)
        gScore.set(nextKey, tentative)
        open.set(nextKey, { x: nx, y: ny, f: tentative + this.heuristic({ x: nx, y: ny }, goalCell) })
      }
    }

    if (!found) return []
    const path: WorldPoint[] = []
    let key = goalKey
    while (key !== startKey) {
      const [x, y] = key.split(',').map(Number)
      path.push(this.cellCenter(x, y))
      const parent = cameFrom.get(key)
      if (!parent) return []
      key = parent
    }
    path.reverse()
    const destinationIsReachable = this.canOccupy(destination, radius, ignoreId)
    if (destinationIsReachable && Phaser.Math.Distance.Between(path.at(-1)?.x ?? start.x, path.at(-1)?.y ?? start.y, destination.x, destination.y) > 3) path.push(destination)
    const startAnchor = this.canOccupy(start, radius, ignoreId) ? start : this.cellCenter(startCell.x, startCell.y)
    return this.simplifyPath(path, startAnchor, radius, ignoreId)
  }

  private nearestWalkableCell(point: WorldPoint, radius: number, ignoreId?: string) {
    const originX = Math.round(point.x / this.cellSize), originY = Math.round(point.y / this.cellSize)
    for (let distance = 0; distance <= 12; distance++) {
      const candidates: { x: number; y: number; d: number }[] = []
      for (let dx = -distance; dx <= distance; dx++) {
        for (let dy = -distance; dy <= distance; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue
          const x = originX + dx, y = originY + dy
          const center = this.cellCenter(x, y)
          if (this.canOccupy(center, radius, ignoreId)) candidates.push({ x, y, d: Phaser.Math.Distance.Between(point.x, point.y, center.x, center.y) })
        }
      }
      if (candidates.length) return candidates.sort((a, b) => a.d - b.d)[0]
    }
    return null
  }

  private simplifyPath(path: WorldPoint[], start: WorldPoint, radius: number, ignoreId?: string) {
    if (path.length < 3) return path
    const result: WorldPoint[] = []
    let anchor = start
    let index = 0
    while (index < path.length) {
      let furthest = index
      for (let test = index + 1; test < path.length; test++) {
        if (!this.hasLineOfSight(anchor, path[test], radius, ignoreId)) break
        furthest = test
      }
      result.push(path[furthest])
      anchor = path[furthest]
      index = furthest + 1
    }
    return result
  }

  private hasLineOfSight(start: WorldPoint, end: WorldPoint, radius: number, ignoreId?: string) {
    const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y)
    const steps = Math.ceil(distance / (this.cellSize / 2))
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      if (!this.canOccupy({ x: Phaser.Math.Linear(start.x, end.x, t), y: Phaser.Math.Linear(start.y, end.y, t) }, radius, ignoreId)) return false
    }
    return true
  }

  private heuristic(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y)
    return Math.max(dx, dy) + (1.4142 - 1) * Math.min(dx, dy)
  }

  private key(x: number, y: number) { return `${x},${y}` }
  private cellCenter(x: number, y: number): WorldPoint {
    return { x: Phaser.Math.Clamp(x * this.cellSize, 0, this.width), y: Phaser.Math.Clamp(y * this.cellSize, 0, this.height) }
  }
}
