import type {
  GameDifficulty,
  GameSpecificStats,
  MiniGameHistoryEntry,
  MiniGameId,
  MiniGameStatsSummary,
} from '../types'

const STORAGE_KEY = 'kchill_minigame_stats_v1'
const SOLO_LB_KEY = 'kchill_solo_leaderboard_v1'
const DUO_LB_KEY = 'kchill_duo_leaderboard_v1'

export type SoloLeaderboardEntry = {
  id: string
  rank?: number
  playerName: string
  playerLevel: string
  gameId: MiniGameId
  gameTitle: string
  difficulty: GameDifficulty
  score: number
  correctCount: number
  dateStr: string
}

export type DuoLeaderboardEntry = {
  id: string
  rank?: number
  p1Name: string
  p2Name: string
  gameId: MiniGameId
  gameTitle: string
  difficulty: GameDifficulty
  combinedScore: number
  p1Score: number
  p2Score: number
  p1Correct: number
  p2Correct: number
  outcomeText: string
  dateStr: string
}

const DEFAULT_SOLO_LEADERBOARD: SoloLeaderboardEntry[] = [
  { id: 'solo-1', playerName: 'HUYẾN', playerLevel: 'TOPIK II', gameId: 'quiz-battle', gameTitle: 'Korean Quiz Battle', difficulty: 'normal', score: 1140, correctCount: 10, dateStr: 'Hôm nay' },
  { id: 'solo-2', playerName: 'hiếu', playerLevel: 'TOPIK I', gameId: 'falling-words', gameTitle: 'Korean Falling Words', difficulty: 'normal', score: 860, correctCount: 22, dateStr: 'Hôm nay' },
  { id: 'solo-3', playerName: 'Minh Anh', playerLevel: 'TOPIK II', gameId: 'word-builder', gameTitle: 'Korean Word Builder', difficulty: 'hard', score: 790, correctCount: 8, dateStr: 'Hôm qua' },
  { id: 'solo-4', playerName: 'Gia Huy', playerLevel: 'TOPIK I', gameId: 'word-shooter', gameTitle: 'Korean Word Shooter', difficulty: 'normal', score: 720, correctCount: 16, dateStr: 'Hôm nay' },
  { id: 'solo-5', playerName: 'Thảo Vy', playerLevel: 'TOPIK I', gameId: 'korean-memory', gameTitle: 'Korean Memory', difficulty: 'easy', score: 680, correctCount: 12, dateStr: '2 ngày trước' },
  { id: 'solo-6', playerName: 'Đức Anh', playerLevel: 'TOPIK II', gameId: 'listening-challenge', gameTitle: 'Korean Listening Challenge', difficulty: 'normal', score: 650, correctCount: 9, dateStr: 'Hôm qua' },
]

const DEFAULT_DUO_LEADERBOARD: DuoLeaderboardEntry[] = [
  { id: 'duo-1', p1Name: 'HUYẾN', p2Name: 'hiếu', gameId: 'quiz-battle', gameTitle: 'Korean Quiz Battle', difficulty: 'normal', combinedScore: 2180, p1Score: 1140, p2Score: 1040, p1Correct: 10, p2Correct: 9, outcomeText: 'HUYẾN chiến thắng (1140đ vs 1040đ)', dateStr: 'Hôm nay' },
  { id: 'duo-2', p1Name: 'Minh Anh', p2Name: 'Gia Huy', gameId: 'word-shooter', gameTitle: 'Korean Word Shooter', difficulty: 'normal', combinedScore: 1540, p1Score: 820, p2Score: 720, p1Correct: 18, p2Correct: 16, outcomeText: 'Minh Anh dẫn đầu (820đ vs 720đ)', dateStr: 'Hôm nay' },
  { id: 'duo-3', p1Name: 'Thảo Vy', p2Name: 'Đức Anh', gameId: 'korean-memory', gameTitle: 'Korean Memory', difficulty: 'normal', combinedScore: 1390, p1Score: 710, p2Score: 680, p1Correct: 8, p2Correct: 7, outcomeText: 'Đồng đội phối hợp hoàn hảo', dateStr: 'Hôm qua' },
  { id: 'duo-4', p1Name: 'HUYẾN', p2Name: 'Minh Anh', gameId: 'word-builder', gameTitle: 'Korean Word Builder', difficulty: 'hard', combinedScore: 1260, p1Score: 650, p2Score: 610, p1Correct: 8, p2Correct: 7, outcomeText: 'Hòa điểm xuất sắc ⚔️', dateStr: '2 ngày trước' },
]

export function loadSoloLeaderboard(): SoloLeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(SOLO_LB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_SOLO_LEADERBOARD
}

export function recordSoloLeaderboard(entry: Omit<SoloLeaderboardEntry, 'id' | 'dateStr'>): SoloLeaderboardEntry[] {
  const current = loadSoloLeaderboard()
  const newEntry: SoloLeaderboardEntry = {
    ...entry,
    id: `solo-${Date.now()}`,
    dateStr: 'Vừa xong',
  }
  const merged = [newEntry, ...current.filter((e) => !(e.playerName === entry.playerName && e.gameId === entry.gameId))]
  merged.sort((a, b) => b.score - a.score)
  const sliced = merged.slice(0, 15)
  try {
    localStorage.setItem(SOLO_LB_KEY, JSON.stringify(sliced))
  } catch {}
  return sliced
}

export function loadDuoLeaderboard(): DuoLeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(DUO_LB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_DUO_LEADERBOARD
}

export function recordDuoLeaderboard(entry: Omit<DuoLeaderboardEntry, 'id' | 'dateStr'>): DuoLeaderboardEntry[] {
  const current = loadDuoLeaderboard()
  const newEntry: DuoLeaderboardEntry = {
    ...entry,
    id: `duo-${Date.now()}`,
    dateStr: 'Vừa xong',
  }
  const merged = [newEntry, ...current]
  merged.sort((a, b) => b.combinedScore - a.combinedScore)
  const sliced = merged.slice(0, 15)
  try {
    localStorage.setItem(DUO_LB_KEY, JSON.stringify(sliced))
  } catch {}
  return sliced
}

export type MiniGameAchievementDef = {
  code: string
  title: string
  description: string
  icon: string
}

export const MINIGAME_ACHIEVEMENTS: MiniGameAchievementDef[] = [
  { code: 'mg-first-play', title: 'Khởi Đầu Sôi Nổi', description: 'Hoàn thành lượt chơi đầu tiên trong Mini-Game Center.', icon: '🎮' },
  { code: 'mg-5-plays', title: 'Khách Quen Phòng Game', description: 'Hoàn thành 5 lượt chơi mini-game tiếng Hàn.', icon: '🌟' },
  { code: 'mg-25-correct', title: 'Phản Xạ Nhanh Nhạy', description: 'Trả lời chính xác tổng cộng 25 từ vựng.', icon: '⚡' },
  { code: 'mg-memory-master', title: 'Siêu Trí Nhớ Hangul', description: 'Hoàn thành một ván Korean Memory.', icon: '🃏' },
  { code: 'mg-high-500', title: 'Bứt Phá 500 Điểm', description: 'Đạt từ 500 điểm trở lên trong một ván bất kỳ.', icon: '🏆' },
  { code: 'mg-all-rounder', title: 'Đa Tài Tiếng Hàn', description: 'Trải nghiệm ít nhất 4 trò chơi khác nhau trong trung tâm.', icon: '👑' },
]

function emptyGameStats(): Record<MiniGameId, GameSpecificStats> {
  return {
    'falling-words': { highScore: 0, plays: 0, totalCorrect: 0, lastScore: 0 },
    'word-shooter': { highScore: 0, plays: 0, totalCorrect: 0, lastScore: 0 },
    'korean-memory': { highScore: 0, plays: 0, totalCorrect: 0, lastScore: 0 },
    'quiz-battle': { highScore: 0, plays: 0, totalCorrect: 0, lastScore: 0 },
    'word-builder': { highScore: 0, plays: 0, totalCorrect: 0, lastScore: 0 },
    'listening-challenge': { highScore: 0, plays: 0, totalCorrect: 0, lastScore: 0 },
  }
}

export function loadMiniGameStats(): MiniGameStatsSummary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MiniGameStatsSummary>
      return {
        byGame: { ...emptyGameStats(), ...(parsed.byGame ?? {}) },
        totalPlays: parsed.totalPlays ?? 0,
        totalCorrect: parsed.totalCorrect ?? 0,
        personalAchievements: Array.isArray(parsed.personalAchievements) ? parsed.personalAchievements : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    byGame: emptyGameStats(),
    totalPlays: 0,
    totalCorrect: 0,
    personalAchievements: [],
    history: [],
  }
}

export function recordMiniGameFinish(params: {
  gameId: MiniGameId
  gameTitle: string
  mode: 'solo' | 'multiplayer'
  difficulty: GameDifficulty
  score: number
  correctCount: number
  totalQuestions?: number
  won?: boolean
}): { nextStats: MiniGameStatsSummary; newlyUnlocked: MiniGameAchievementDef[] } {
  const prev = loadMiniGameStats()
  const curGame = prev.byGame[params.gameId] ?? { highScore: 0, plays: 0, totalCorrect: 0, lastScore: 0 }

  const updatedGame: GameSpecificStats = {
    highScore: Math.max(curGame.highScore, Math.round(params.score)),
    plays: curGame.plays + 1,
    totalCorrect: curGame.totalCorrect + Math.max(0, params.correctCount),
    lastScore: Math.round(params.score),
  }

  const byGame: Record<MiniGameId, GameSpecificStats> = {
    ...prev.byGame,
    [params.gameId]: updatedGame,
  }

  const totalPlays = prev.totalPlays + 1
  const totalCorrect = prev.totalCorrect + Math.max(0, params.correctCount)

  const entry: MiniGameHistoryEntry = {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    gameId: params.gameId,
    gameTitle: params.gameTitle,
    mode: params.mode,
    difficulty: params.difficulty,
    score: Math.round(params.score),
    correctCount: Math.max(0, params.correctCount),
    totalQuestions: params.totalQuestions,
    won: params.won,
    playedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  }

  const achSet = new Set(prev.personalAchievements)
  const newlyUnlocked: MiniGameAchievementDef[] = []
  const tryUnlock = (code: string) => {
    if (achSet.has(code)) return
    const def = MINIGAME_ACHIEVEMENTS.find((a) => a.code === code)
    if (!def) return
    achSet.add(code)
    newlyUnlocked.push(def)
  }

  if (totalPlays >= 1) tryUnlock('mg-first-play')
  if (totalPlays >= 5) tryUnlock('mg-5-plays')
  if (totalCorrect >= 25) tryUnlock('mg-25-correct')
  if (params.gameId === 'korean-memory') tryUnlock('mg-memory-master')
  if (params.score >= 500) tryUnlock('mg-high-500')

  const distinctPlayed = Object.values(byGame).filter((g) => g.plays > 0).length
  if (distinctPlayed >= 4) tryUnlock('mg-all-rounder')

  const nextStats: MiniGameStatsSummary = {
    byGame,
    totalPlays,
    totalCorrect,
    personalAchievements: [...achSet],
    history: [entry, ...prev.history].slice(0, 25),
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStats))
  } catch {
    // Ignore storage write errors
  }

  return { nextStats, newlyUnlocked }
}
