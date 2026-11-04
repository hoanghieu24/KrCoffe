-- K-CHILL CAFÉ – 카페에서 만나요
-- Relational Database Schema (MySQL 8.0+)

CREATE DATABASE IF NOT EXISTS kchill_cafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kchill_cafe;

CREATE TABLE IF NOT EXISTS avatars (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  hair_color VARCHAR(16) NOT NULL,
  outfit_color VARCHAR(16) NOT NULL,
  accent_color VARCHAR(16) NOT NULL,
  hair_style VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(48) NOT NULL,
  email VARCHAR(191) UNIQUE NULL,
  password_hash VARCHAR(255) NULL,
  is_guest BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  avatar_id VARCHAR(32) NOT NULL DEFAULT 'look-01',
  topik_level VARCHAR(24) NOT NULL DEFAULT 'TOPIK 1',
  xp INT NOT NULL DEFAULT 0,
  level_num INT NOT NULL DEFAULT 1,
  streak_days INT NOT NULL DEFAULT 1,
  bio VARCHAR(255) DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_profile_avatar FOREIGN KEY (avatar_id) REFERENCES avatars(id)
);

CREATE TABLE IF NOT EXISTS cafe_rooms (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  max_players INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cafe_seats (
  id VARCHAR(16) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  table_id VARCHAR(16) NOT NULL,
  direction ENUM('up', 'down', 'left', 'right') NOT NULL,
  status ENUM('available', 'occupied') NOT NULL DEFAULT 'available',
  occupant_user_id VARCHAR(64) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, id),
  INDEX idx_seats_table (room_id, table_id),
  CONSTRAINT fk_seat_room FOREIGN KEY (room_id) REFERENCES cafe_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_seat_occupant FOREIGN KEY (occupant_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  socket_id VARCHAR(64) NOT NULL,
  seat_id VARCHAR(16) NULL,
  pos_u DECIMAL(6,3) NOT NULL DEFAULT 11.800,
  pos_v DECIMAL(6,3) NOT NULL DEFAULT 15.200,
  online_status ENUM('online', 'away', 'offline') NOT NULL DEFAULT 'online',
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP NULL,
  INDEX idx_sessions_room_status (room_id, online_status),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_room FOREIGN KEY (room_id) REFERENCES cafe_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friendships (
  requester_id VARCHAR(64) NOT NULL,
  addressee_id VARCHAR(64) NOT NULL,
  status ENUM('pending', 'accepted', 'blocked') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (requester_id, addressee_id),
  CONSTRAINT fk_friend_req FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_friend_addr FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  table_id VARCHAR(16) NOT NULL,
  host_user_id VARCHAR(64) NOT NULL,
  guest_user_id VARCHAR(64) NOT NULL,
  status ENUM('active', 'ended') NOT NULL DEFAULT 'active',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  CONSTRAINT fk_voice_room FOREIGN KEY (room_id) REFERENCES cafe_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_invitations (
  id VARCHAR(64) PRIMARY KEY,
  sender_id VARCHAR(64) NOT NULL,
  receiver_id VARCHAR(64) NOT NULL,
  table_id VARCHAR(16) NOT NULL,
  status ENUM('pending', 'accepted', 'declined', 'expired') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_voice_inv_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_voice_inv_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  sender_name VARCHAR(48) NOT NULL,
  scope ENUM('room', 'table', 'direct') NOT NULL DEFAULT 'room',
  table_id VARCHAR(16) NULL,
  content VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_room_time (room_id, created_at),
  CONSTRAINT fk_chat_room FOREIGN KEY (room_id) REFERENCES cafe_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(32) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  max_players INT NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS game_rooms (
  id VARCHAR(64) PRIMARY KEY,
  game_id VARCHAR(32) NOT NULL,
  cafe_room_id VARCHAR(64) NOT NULL,
  table_id VARCHAR(16) NOT NULL,
  status ENUM('waiting', 'playing', 'finished') NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_groom_game FOREIGN KEY (game_id) REFERENCES games(id),
  CONSTRAINT fk_groom_cafe FOREIGN KEY (cafe_room_id) REFERENCES cafe_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_results (
  id VARCHAR(64) PRIMARY KEY,
  game_room_id VARCHAR(64) NOT NULL,
  winner_user_id VARCHAR(64) NULL,
  score_json JSON NOT NULL,
  xp_awarded INT NOT NULL DEFAULT 15,
  finished_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gresult_room FOREIGN KEY (game_room_id) REFERENCES game_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS korean_vocabulary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hangul VARCHAR(64) NOT NULL,
  romanization VARCHAR(64) NOT NULL,
  meaning_vi VARCHAR(191) NOT NULL,
  example_ko VARCHAR(255) NULL,
  topik_level VARCHAR(24) NOT NULL DEFAULT 'TOPIK 1',
  category VARCHAR(48) NOT NULL DEFAULT 'cafe'
);

CREATE TABLE IF NOT EXISTS user_vocabulary_progress (
  user_id VARCHAR(64) NOT NULL,
  vocab_id INT NOT NULL,
  mastery_level TINYINT NOT NULL DEFAULT 1,
  last_reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, vocab_id),
  CONSTRAINT fk_uvp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uvp_vocab FOREIGN KEY (vocab_id) REFERENCES korean_vocabulary(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id VARCHAR(32) PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  artist VARCHAR(120) NOT NULL,
  stream_url VARCHAR(255) NOT NULL,
  duration_sec INT NOT NULL DEFAULT 180,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS music_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  track_title VARCHAR(120) NOT NULL,
  artist_name VARCHAR(120) NULL,
  votes INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msug_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id VARCHAR(64) NOT NULL,
  achievement_code VARCHAR(48) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, achievement_code),
  CONSTRAINT fk_uach_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT IGNORE INTO avatars (id, name, hair_color, outfit_color, accent_color, hair_style) VALUES
  ('look-01', 'Minh', '#302522', '#f3e8d4', '#d6c4aa', 'fluffy'),
  ('look-02', 'Hana', '#302522', '#76856d', '#dfc09a', 'ponytail'),
  ('look-03', 'Nari', '#56372d', '#d9857b', '#f5d9b9', 'bob'),
  ('look-04', 'Joon', '#272322', '#344b68', '#c8d3da', 'glasses'),
  ('look-05', 'Dae', '#6c4937', '#d99942', '#f8ebcf', 'sweater'),
  ('look-06', 'Yuna', '#302522', '#65859a', '#e4d9c8', 'overalls'),
  ('look-07', 'Soo', '#362a2a', '#a88bb5', '#e7d8c5', 'bun'),
  ('look-08', 'Jun', '#9b5141', '#9a5140', '#f1ddc5', 'auburn');

INSERT IGNORE INTO cafe_rooms (id, name, max_players) VALUES ('kchill-main', 'K-CHILL Café – Phòng chính', 30);
