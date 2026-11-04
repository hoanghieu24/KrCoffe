import type { AvatarLook, CafeSeat, DemoPlayer } from '../domain/types'

export const avatarLooks: AvatarLook[] = [
  { id: 'look-01', name: 'Minh', hair: '#302522', outfit: '#f3e8d4', accent: '#d6c4aa', hairStyle: 'fluffy' },
  { id: 'look-02', name: 'Hana', hair: '#302522', outfit: '#76856d', accent: '#dfc09a', hairStyle: 'ponytail' },
  { id: 'look-03', name: 'Nari', hair: '#56372d', outfit: '#d9857b', accent: '#f5d9b9', hairStyle: 'bob' },
  { id: 'look-04', name: 'Joon', hair: '#272322', outfit: '#344b68', accent: '#c8d3da', hairStyle: 'glasses' },
  { id: 'look-05', name: 'Dae', hair: '#6c4937', outfit: '#d99942', accent: '#f8ebcf', hairStyle: 'sweater' },
  { id: 'look-06', name: 'Yuna', hair: '#302522', outfit: '#65859a', accent: '#e4d9c8', hairStyle: 'overalls' },
  { id: 'look-07', name: 'Soo', hair: '#362a2a', outfit: '#a88bb5', accent: '#e7d8c5', hairStyle: 'bun' },
  { id: 'look-08', name: 'Jun', hair: '#9b5141', outfit: '#9a5140', accent: '#f1ddc5', hairStyle: 'auburn' },
  { id: 'look-barista', name: 'Soo-jin (Barista)', hair: '#2a1e1b', outfit: '#3c291f', accent: '#dfc09a', hairStyle: 'ponytail' },
]

export const demoPlayers: DemoPlayer[] = []

export const createSeats = (): CafeSeat[] => Array.from({ length: 30 }, (_, index) => {
  const id = `Seat_${String(index + 1).padStart(2, '0')}`
  const occupant = demoPlayers.find((player) => player.seatId === id)
  return { id, status: occupant ? 'occupied' : 'available', ...(occupant ? { occupantId: occupant.id, occupantName: occupant.name } : {}) }
})

export const koreanMenu = [
  { name: '아메리카노', description: 'Americano', price: '₩ 4.5' },
  { name: '카페라떼', description: 'Café latte', price: '₩ 5.0' },
  { name: '말차라떼', description: 'Matcha latte', price: '₩ 5.5' },
]
