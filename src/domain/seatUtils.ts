export function getTableIdForSeat(seatId?: string | null): string | null {
  if (!seatId) return null
  const match = /^Seat_(\d{2})$/.exec(seatId)
  if (!match) return null
  const num = Number(match[1])
  if (num < 1 || num > 30) return null
  const tableNum = Math.ceil(num / 2)
  return `Table_${String(tableNum).padStart(2, '0')}`
}

export function getPartnerSeatId(seatId?: string | null): string | null {
  if (!seatId) return null
  const match = /^Seat_(\d{2})$/.exec(seatId)
  if (!match) return null
  const num = Number(match[1])
  if (num < 1 || num > 30) return null
  const partnerNum = num % 2 === 1 ? num + 1 : num - 1
  return `Seat_${String(partnerNum).padStart(2, '0')}`
}

export function areSeatsAtSameTable(seatA?: string | null, seatB?: string | null): boolean {
  if (!seatA || !seatB) return false
  const tableA = getTableIdForSeat(seatA)
  const tableB = getTableIdForSeat(seatB)
  return Boolean(tableA && tableA === tableB)
}
