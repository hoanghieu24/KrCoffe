import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import {
  ACHIEVEMENTS_CATALOG,
  DEFAULT_MUSIC_TRACKS,
  type MusicTrackDef,
  type TopikLevel,
} from '../src/data/koreanVocabulary.ts'
import type {
  ChatMessagePayload,
  GameKind,
  GamePlayerProgress,
  PlayerLearningProfile,
} from '../src/domain/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })

interface StatementLike {
  run(...args: any[]): any
  get(...args: any[]): any
  all(...args: any[]): any[]
}

interface DatabaseLike {
  exec(sql: string): void
  prepare(sql: string): StatementLike
}

function createFallbackDb(storeDir: string): DatabaseLike {
  const jsonPath = path.join(storeDir, 'kchill-store.json')
  let state = {
    players: {} as Record<string, any>,
    chat_messages: [] as any[],
    voice_invitations: {} as Record<string, any>,
    voice_sessions: {} as Record<string, any>,
    learning_profiles: {} as Record<string, any>,
    game_results: [] as any[],
    music_queue: [] as any[],
    user_feedback: [] as any[],
  }

  if (fs.existsSync(jsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      state = { ...state, ...parsed }
    } catch {
      // Ignore corrupted JSON and start fresh
    }
  }

  let saveTimer: any = null
  const scheduleSave = () => {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      try {
        fs.writeFileSync(jsonPath, JSON.stringify(state, null, 2), 'utf8')
      } catch {}
    }, 2000)
  }

  return {
    exec: () => {},
    prepare: (sql: string): StatementLike => {
      const s = sql.trim().toLowerCase()
      if (s.startsWith('insert into players')) {
        return {
          run: (user_id: string, username: string, avatar_id: string, topik_level: string, updated_at: string) => {
            state.players[user_id] = { user_id, username, avatar_id, topik_level, updated_at }
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.startsWith('insert into chat_messages')) {
        return {
          run: (id: string, user_id: string, username: string, avatar_id: string, text: string, scope: string, table_id: string | null, time_label: string, created_at: number) => {
            state.chat_messages.push({ id, user_id, username, avatar_id, text, scope, table_id, time_label, created_at })
            if (state.chat_messages.length > 200) state.chat_messages.shift()
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.includes('from chat_messages')) {
        return {
          run: () => {},
          get: () => undefined,
          all: () => {
            return state.chat_messages
              .filter((m: any) => m.scope === 'room')
              .slice(-25)
              .reverse()
          },
        }
      }
      if (s.startsWith('insert or replace into voice_invitations')) {
        return {
          run: (id: string, sender_id: string, receiver_id: string, table_id: string, status: string, created_at: number) => {
            state.voice_invitations[id] = { id, sender_id, receiver_id, table_id, status, created_at }
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.startsWith('update voice_invitations')) {
        return {
          run: (status: string, id: string) => {
            if (state.voice_invitations[id]) {
              state.voice_invitations[id].status = status
              scheduleSave()
            }
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.startsWith('insert into voice_sessions')) {
        return {
          run: (id: string, table_id: string, host_user_id: string, guest_user_id: string, started_at: number) => {
            state.voice_sessions[id] = { id, table_id, host_user_id, guest_user_id, status: 'active', started_at, ended_at: null }
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.startsWith('update voice_sessions')) {
        return {
          run: (ended_at: number, id: string) => {
            if (state.voice_sessions[id]) {
              state.voice_sessions[id].status = 'ended'
              state.voice_sessions[id].ended_at = ended_at
              scheduleSave()
            }
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.includes('from learning_profiles')) {
        return {
          run: () => {},
          get: (userId: string) => state.learning_profiles[userId],
          all: () => Object.values(state.learning_profiles),
        }
      }
      if (s.startsWith('insert into learning_profiles')) {
        return {
          run: (user_id: string, topik_level: string, xp: number, level_num: number, games_played: number, games_won: number, study_minutes: number, learned_ids_json: string, achievements_json: string, updated_at: number) => {
            state.learning_profiles[user_id] = {
              user_id, topik_level, xp, level_num, games_played, games_won, study_minutes, learned_ids_json, achievements_json, updated_at,
            }
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.startsWith('insert or replace into game_results')) {
        return {
          run: (id: string, game_kind: string, topik_level: string, mode: string, winner_user_id: string | null, players_json: string, created_at: number) => {
            state.game_results.push({ id, game_kind, topik_level, mode, winner_user_id, players_json, created_at })
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.includes('from music_queue')) {
        return {
          run: () => {},
          get: () => undefined,
          all: () => [...state.music_queue].sort((a: any, b: any) => (b.votes - a.votes) || (a.created_at - b.created_at)),
        }
      }
      if (s.startsWith('delete from music_queue')) {
        return {
          run: () => {
            state.music_queue = []
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.startsWith('insert into music_queue')) {
        return {
          run: (id: string, title: string, artist: string, mood: string, bpm: number, style: string, duration_sec: number, suggested_by: string, votes: number, audio_url: string | null, created_at: number) => {
            state.music_queue.push({ id, title, artist, mood, bpm, style, duration_sec, suggested_by, votes, audio_url, created_at })
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.startsWith('insert into user_feedback')) {
        return {
          run: (id: string, user_id: string, username: string, content: string, created_at: number) => {
            state.user_feedback.unshift({ id, user_id, username, content, created_at })
            if (state.user_feedback.length > 200) state.user_feedback.pop()
            scheduleSave()
          },
          get: () => undefined,
          all: () => [],
        }
      }
      if (s.includes('from user_feedback')) {
        return {
          run: () => {},
          get: () => undefined,
          all: (limit: number = 50) => state.user_feedback.slice(0, Number(limit) || 50),
        }
      }
      return { run: () => {}, get: () => undefined, all: () => [] }
    },
  }
}

let db: DatabaseLike

const require = createRequire(import.meta.url)
try {
  const sqlite = require('node:sqlite')
  const dbPath = path.join(dataDir, 'kchill.sqlite')
  db = new sqlite.DatabaseSync(dbPath)
  console.log('[K-CHILL Storage] Native node:sqlite connected successfully at', dbPath)
} catch (err: any) {
  console.warn('[K-CHILL Storage] Native node:sqlite unavailable (' + err?.message + '); using resilient JSON/in-memory store.')
  db = createFallbackDb(dataDir)
}

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS players (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_id TEXT NOT NULL DEFAULT 'look-01',
    topik_level TEXT NOT NULL DEFAULT 'TOPIK 1',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar_id TEXT NOT NULL,
    text TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'room',
    table_id TEXT,
    time_label TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voice_invitations (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voice_sessions (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    host_user_id TEXT NOT NULL,
    guest_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS learning_profiles (
    user_id TEXT PRIMARY KEY,
    topik_level TEXT NOT NULL DEFAULT 'TOPIK 1',
    xp INTEGER NOT NULL DEFAULT 0,
    level_num INTEGER NOT NULL DEFAULT 1,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    study_minutes INTEGER NOT NULL DEFAULT 0,
    learned_ids_json TEXT NOT NULL DEFAULT '[]',
    achievements_json TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_results (
    id TEXT PRIMARY KEY,
    game_kind TEXT NOT NULL,
    topik_level TEXT NOT NULL,
    mode TEXT NOT NULL,
    winner_user_id TEXT,
    players_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS music_queue (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    mood TEXT NOT NULL,
    bpm INTEGER NOT NULL,
    style TEXT NOT NULL,
    duration_sec INTEGER NOT NULL,
    suggested_by TEXT NOT NULL,
    votes INTEGER NOT NULL DEFAULT 1,
    audio_url TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`)

try {
  db.exec(`ALTER TABLE music_queue ADD COLUMN audio_url TEXT;`)
} catch {}

const VALID_TOPIK: TopikLevel[] = ['TOPIK 1', 'TOPIK 2', 'TOPIK 3', 'TOPIK 4', 'TOPIK 5', 'TOPIK 6']

export function normalizeTopikLevel(raw?: string): TopikLevel {
  if (raw && (VALID_TOPIK as string[]).includes(raw)) {
    return raw as TopikLevel
  }
  return 'TOPIK 1'
}

export function computeLevelNum(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / 100) + 1)
}

const upsertPlayerStmt = db.prepare(`
  INSERT INTO players (user_id, username, avatar_id, topik_level, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    username = excluded.username,
    avatar_id = excluded.avatar_id,
    topik_level = excluded.topik_level,
    updated_at = excluded.updated_at
`)

const insertMessageStmt = db.prepare(`
  INSERT INTO chat_messages (id, user_id, username, avatar_id, text, scope, table_id, time_label, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const recentMessagesStmt = db.prepare(`
  SELECT id, user_id, username, avatar_id, text, scope, table_id, time_label
  FROM chat_messages
  WHERE scope = 'room'
  ORDER BY created_at DESC
  LIMIT 25
`)

const insertVoiceInviteStmt = db.prepare(`
  INSERT OR REPLACE INTO voice_invitations (id, sender_id, receiver_id, table_id, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const updateVoiceInviteStmt = db.prepare(`
  UPDATE voice_invitations SET status = ? WHERE id = ?
`)

const insertVoiceSessionStmt = db.prepare(`
  INSERT INTO voice_sessions (id, table_id, host_user_id, guest_user_id, status, started_at, ended_at)
  VALUES (?, ?, ?, ?, 'active', ?, NULL)
`)

const endVoiceSessionStmt = db.prepare(`
  UPDATE voice_sessions SET status = 'ended', ended_at = ? WHERE id = ?
`)

const selectLearningStmt = db.prepare(`
  SELECT user_id, topik_level, xp, level_num, games_played, games_won, study_minutes, learned_ids_json, achievements_json
  FROM learning_profiles
  WHERE user_id = ?
`)

const upsertLearningStmt = db.prepare(`
  INSERT INTO learning_profiles (
    user_id, topik_level, xp, level_num, games_played, games_won, study_minutes, learned_ids_json, achievements_json, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    topik_level = excluded.topik_level,
    xp = excluded.xp,
    level_num = excluded.level_num,
    games_played = excluded.games_played,
    games_won = excluded.games_won,
    study_minutes = excluded.study_minutes,
    learned_ids_json = excluded.learned_ids_json,
    achievements_json = excluded.achievements_json,
    updated_at = excluded.updated_at
`)

const insertGameResultStmt = db.prepare(`
  INSERT OR REPLACE INTO game_results (id, game_kind, topik_level, mode, winner_user_id, players_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const selectMusicQueueStmt = db.prepare(`
  SELECT id, title, artist, mood, bpm, style, duration_sec, suggested_by, votes, audio_url
  FROM music_queue
  ORDER BY votes DESC, created_at ASC
`)

const clearMusicQueueStmt = db.prepare(`DELETE FROM music_queue`)
const insertMusicTrackStmt = db.prepare(`
  INSERT INTO music_queue (id, title, artist, mood, bpm, style, duration_sec, suggested_by, votes, audio_url, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

export function savePlayerProfile(userId: string, username: string, avatarId: string, level: string) {
  try {
    upsertPlayerStmt.run(userId, username, avatarId, level, new Date().toISOString())
  } catch {
    // Non-fatal persistence fallback
  }
}

export function saveChatMessage(msg: ChatMessagePayload) {
  try {
    insertMessageStmt.run(
      msg.id,
      msg.userId,
      msg.username,
      msg.avatarId,
      msg.text,
      msg.scope,
      msg.tableId ?? null,
      msg.time,
      Date.now(),
    )
  } catch {
    // Non-fatal persistence fallback
  }
}

export function saveVoiceInvitation(id: string, senderId: string, receiverId: string, tableId: string, status = 'pending') {
  try {
    insertVoiceInviteStmt.run(id, senderId, receiverId, tableId, status, Date.now())
  } catch {
    // Non-fatal persistence fallback
  }
}

export function updateVoiceInvitationStatus(id: string, status: 'accepted' | 'declined' | 'cancelled' | 'expired') {
  try {
    updateVoiceInviteStmt.run(status, id)
  } catch {
    // Non-fatal persistence fallback
  }
}

export function startVoiceSessionRecord(id: string, tableId: string, hostId: string, guestId: string, startedAt: number) {
  try {
    insertVoiceSessionStmt.run(id, tableId, hostId, guestId, startedAt)
  } catch {
    // Non-fatal persistence fallback
  }
}

export function endVoiceSessionRecord(id: string) {
  try {
    endVoiceSessionStmt.run(Date.now(), id)
  } catch {
    // Non-fatal persistence fallback
  }
}

function safeParseJsonArray<T>(raw: string | undefined): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function getOrCreateLearningProfile(userId: string, topikLevelRaw?: string): PlayerLearningProfile {
  try {
    const row = selectLearningStmt.get(userId) as
      | {
          user_id: string
          topik_level: string
          xp: number
          level_num: number
          games_played: number
          games_won: number
          study_minutes: number
          learned_ids_json: string
          achievements_json: string
        }
      | undefined

    if (row) {
      const nextTopik = topikLevelRaw ? normalizeTopikLevel(topikLevelRaw) : normalizeTopikLevel(row.topik_level)
      const profile: PlayerLearningProfile = {
        userId: row.user_id,
        topikLevel: nextTopik,
        xp: row.xp,
        levelNum: computeLevelNum(row.xp),
        wordsLearnedIds: safeParseJsonArray<number>(row.learned_ids_json),
        gamesPlayed: row.games_played,
        gamesWon: row.games_won,
        studyMinutes: row.study_minutes,
        achievements: safeParseJsonArray<string>(row.achievements_json),
      }
      if (nextTopik !== row.topik_level) {
        persistLearningProfile(profile)
      }
      return profile
    }
  } catch {
    // Fallback to fresh profile
  }

  const initial: PlayerLearningProfile = {
    userId,
    topikLevel: normalizeTopikLevel(topikLevelRaw),
    xp: 0,
    levelNum: 1,
    wordsLearnedIds: [],
    gamesPlayed: 0,
    gamesWon: 0,
    studyMinutes: 0,
    achievements: [],
  }
  persistLearningProfile(initial)
  return initial
}

export function persistLearningProfile(profile: PlayerLearningProfile) {
  try {
    upsertLearningStmt.run(
      profile.userId,
      profile.topikLevel,
      profile.xp,
      computeLevelNum(profile.xp),
      profile.gamesPlayed,
      profile.gamesWon,
      profile.studyMinutes,
      JSON.stringify(profile.wordsLearnedIds),
      JSON.stringify(profile.achievements),
      Date.now(),
    )
  } catch {
    // Non-fatal persistence fallback
  }
}

export type LearningMutationInput = {
  deltaXp?: number
  topikLevel?: string
  addLearnedWordId?: number
  removeLearnedWordId?: number
  incrementGamesPlayed?: boolean
  incrementGamesWon?: boolean
  addStudyMinutes?: number
  unlockAchievementCodes?: string[]
}

export function mutateLearningProfile(
  userId: string,
  patch: LearningMutationInput,
): { profile: PlayerLearningProfile; unlockedCodes: string[] } {
  const current = getOrCreateLearningProfile(userId, patch.topikLevel)
  const learnedSet = new Set<number>(current.wordsLearnedIds)
  const achSet = new Set<string>(current.achievements)
  const unlockedCodes: string[] = []

  let xp = current.xp + (patch.deltaXp ?? 0)
  let gamesPlayed = current.gamesPlayed + (patch.incrementGamesPlayed ? 1 : 0)
  let gamesWon = current.gamesWon + (patch.incrementGamesWon ? 1 : 0)
  let studyMinutes = current.studyMinutes + (patch.addStudyMinutes ?? 0)

  if (typeof patch.addLearnedWordId === 'number' && !learnedSet.has(patch.addLearnedWordId)) {
    learnedSet.add(patch.addLearnedWordId)
    xp += 10
  }
  if (typeof patch.removeLearnedWordId === 'number' && learnedSet.has(patch.removeLearnedWordId)) {
    learnedSet.delete(patch.removeLearnedWordId)
  }

  const tryUnlock = (code: string) => {
    if (achSet.has(code)) return
    const def = ACHIEVEMENTS_CATALOG.find((a) => a.code === code)
    if (!def) return
    achSet.add(code)
    xp += def.xpReward
    unlockedCodes.push(code)
  }

  if (patch.unlockAchievementCodes) {
    for (const c of patch.unlockAchievementCodes) tryUnlock(c)
  }
  if (learnedSet.size >= 5) tryUnlock('vocab-5')
  if (learnedSet.size >= 15) tryUnlock('vocab-15')
  if (gamesPlayed >= 1) tryUnlock('game-first')
  if (gamesWon >= 1) tryUnlock('game-winner')

  const updated: PlayerLearningProfile = {
    userId,
    topikLevel: patch.topikLevel ? normalizeTopikLevel(patch.topikLevel) : current.topikLevel,
    xp: Math.max(0, xp),
    levelNum: computeLevelNum(xp),
    wordsLearnedIds: [...learnedSet],
    gamesPlayed,
    gamesWon,
    studyMinutes,
    achievements: [...achSet],
  }

  persistLearningProfile(updated)
  return { profile: updated, unlockedCodes }
}

export function saveGameResultRecord(params: {
  id: string
  gameKind: GameKind
  topikLevel: TopikLevel
  mode: string
  winnerUserId: string | null
  players: GamePlayerProgress[]
}) {
  try {
    insertGameResultStmt.run(
      params.id,
      params.gameKind,
      params.topikLevel,
      params.mode,
      params.winnerUserId,
      JSON.stringify(params.players),
      Date.now(),
    )
  } catch {
    // Non-fatal persistence fallback
  }
}

export function loadPersistedMusicQueue(): MusicTrackDef[] {
  try {
    const rows = selectMusicQueueStmt.all() as Array<{
      id: string
      title: string
      artist: string
      mood: string
      bpm: number
      style: MusicTrackDef['style']
      duration_sec: number
      suggested_by: string
      votes: number
      audio_url?: string | null
    }>
    if (rows.length > 0) {
      return rows.map((r) => {
        const defaultMatch = DEFAULT_MUSIC_TRACKS.find((d) => d.id === r.id)
        return {
          id: r.id,
          title: r.title,
          artist: r.artist,
          mood: r.mood,
          bpm: r.bpm,
          style: r.style,
          durationSec: defaultMatch?.durationSec || r.duration_sec,
          suggestedBy: r.suggested_by,
          votes: r.votes,
          audioUrl: r.audio_url || defaultMatch?.audioUrl || undefined,
        }
      })
    }
  } catch {
    // Ignore and return defaults
  }
  return DEFAULT_MUSIC_TRACKS.slice(1).map((t) => ({ ...t }))
}

export function saveMusicQueueState(queue: MusicTrackDef[]) {
  try {
    clearMusicQueueStmt.run()
    let idx = 0
    const base = Date.now()
    for (const track of queue) {
      insertMusicTrackStmt.run(
        track.id,
        track.title,
        track.artist,
        track.mood,
        track.bpm,
        track.style,
        track.durationSec,
        track.suggestedBy ?? 'K-CHILL',
        track.votes ?? 1,
        track.audioUrl ?? null,
        base + idx++,
      )
    }
  } catch {
    // Non-fatal persistence fallback
  }
}

export function loadRecentRoomMessages(): ChatMessagePayload[] {
  try {
    const rows = recentMessagesStmt.all() as Array<{
      id: string
      user_id: string
      username: string
      avatar_id: string
      text: string
      scope: 'room' | 'table'
      table_id: string | null
      time_label: string
    }>
    const mapped = rows.reverse().map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      avatarId: r.avatar_id,
      text: r.text,
      scope: r.scope,
      tableId: r.table_id,
      time: r.time_label,
    }))
    if (mapped.length > 0) return mapped
  } catch {
    // Ignore and return default welcome
  }
  return [
    {
      id: 'welcome-1',
      userId: 'system',
      username: 'K-CHILL',
      avatarId: 'look-01',
      text: '안녕하세요! Chào mừng bạn đến K-CHILL Café — ngồi cùng bàn để trò chuyện riêng & đấu game tiếng Hàn nhé 🌿',
      scope: 'room',
      tableId: null,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]
}

const insertFeedbackStmt = db.prepare(`
  INSERT INTO user_feedback (id, user_id, username, content, created_at)
  VALUES (?, ?, ?, ?, ?)
`)

const selectFeedbackStmt = db.prepare(`
  SELECT id, user_id, username, content, created_at
  FROM user_feedback
  ORDER BY created_at DESC
  LIMIT ?
`)

export function saveFeedback(userId: string, username: string, content: string) {
  const item = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    username,
    content,
    createdAt: Date.now(),
  }
  try {
    insertFeedbackStmt.run(item.id, item.userId, item.username, item.content, item.createdAt)
  } catch (e) {
    console.error('Failed to save feedback:', e)
  }
  return item
}

export function loadRecentFeedback(limit = 50) {
  try {
    const rows = selectFeedbackStmt.all(limit) as Array<{
      id: string
      user_id: string
      username: string
      content: string
      created_at: number
    }>
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      content: r.content,
      createdAt: r.created_at,
    }))
  } catch {
    return []
  }
}

