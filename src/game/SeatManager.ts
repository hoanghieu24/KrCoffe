import { demoPlayers } from '../data/demoData'
import type { CafeSeat, DemoPlayer, SeatPoint } from '../domain/types'

export class SeatManager {
  private readonly seats = new Map<string, CafeSeat>()
  private readonly points = new Map<string, SeatPoint>()
  private readonly reservations = new Map<string, string>()

  constructor(points: SeatPoint[], visitors: DemoPlayer[] = demoPlayers) {
    const visitorForSeat = new Map(visitors.map((visitor) => [visitor.seatId, visitor]))
    for (let index = 1; index <= 30; index++) {
      const id = `Seat_${String(index).padStart(2, '0')}`
      const visitor = visitorForSeat.get(id)
      this.seats.set(id, { id, status: visitor ? 'occupied' : 'available', ...(visitor ? { occupantId: visitor.id, occupantName: visitor.name } : {}) })
    }
    this.setPoints(points)
  }

  setPoints(points: SeatPoint[]) {
    this.points.clear()
    for (const point of points) this.points.set(point.id, point)
  }

  syncFromServer(serverSeats: CafeSeat[]) {
    this.reservations.clear()
    for (const seat of serverSeats) {
      this.seats.set(seat.id, { ...seat })
    }
  }

  getAll() { return [...this.seats.values()].map((seat) => ({ ...seat })) }
  getSeat(id: string) { return this.seats.get(id) }
  getPoint(id: string) { return this.points.get(id) }
  getReservation(id: string) { return this.reservations.get(id) }
  isAvailable(id: string) { return this.seats.get(id)?.status === 'available' && !this.reservations.has(id) }

  reserve(id: string, userId: string) {
    if (!this.isAvailable(id)) return false
    this.reservations.set(id, userId)
    return true
  }

  occupy(id: string, userId: string, username: string) {
    const current = this.seats.get(id)
    if (!current) return false
    if (current.status === 'occupied' && current.occupantId !== userId) return false
    const reservedBy = this.reservations.get(id)
    if (reservedBy && reservedBy !== userId) return false
    this.reservations.delete(id)
    this.seats.set(id, { id, status: 'occupied', occupantId: userId, occupantName: username })
    return true
  }

  forceOccupy(id: string, userId: string, username: string) {
    this.reservations.delete(id)
    this.seats.set(id, { id, status: 'occupied', occupantId: userId, occupantName: username })
  }

  release(id: string, userId: string) {
    const seat = this.seats.get(id)
    if (seat?.occupantId === userId) {
      this.seats.set(id, { id, status: 'available' })
      return true
    }
    if (this.reservations.get(id) === userId) {
      this.reservations.delete(id)
      return true
    }
    return false
  }

  releaseAll(userId: string) {
    for (const seat of this.seats.values()) if (seat.occupantId === userId) this.seats.set(seat.id, { id: seat.id, status: 'available' })
    for (const [id, owner] of this.reservations) if (owner === userId) this.reservations.delete(id)
  }
}
