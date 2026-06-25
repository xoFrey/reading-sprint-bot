const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sprints (
      id SERIAL PRIMARY KEY,
      status VARCHAR(20) DEFAULT 'idle',  -- idle, scheduled, active, ended
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      scheduled_start TIMESTAMPTZ,
      scheduled_end TIMESTAMPTZ,
      panel_message_id VARCHAR(30),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sprint_participants (
      id SERIAL PRIMARY KEY,
      sprint_id INTEGER REFERENCES sprints(id),
      user_id VARCHAR(30) NOT NULL,
      username VARCHAR(100),
      join_time TIMESTAMPTZ DEFAULT NOW(),
      leave_time TIMESTAMPTZ,
      pause_start TIMESTAMPTZ,
      total_pause_ms BIGINT DEFAULT 0,
      is_paused BOOLEAN DEFAULT FALSE,
      goal_pages INTEGER,
      goal_reached BOOLEAN DEFAULT FALSE,
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS sprint_books (
      id SERIAL PRIMARY KEY,
      participant_id INTEGER REFERENCES sprint_participants(id),
      sprint_id INTEGER REFERENCES sprints(id),
      user_id VARCHAR(30) NOT NULL,
      title VARCHAR(255),
      format VARCHAR(20) DEFAULT 'book',  -- book, audiobook, ebook
      start_page INTEGER DEFAULT 0,
      end_page INTEGER,
      total_pages INTEGER,
      finished BOOLEAN DEFAULT FALSE,
      order_num INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      user_id VARCHAR(30) PRIMARY KEY,
      username VARCHAR(100),
      total_pages_all_time BIGINT DEFAULT 0,
      last_updated TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Database initialized');
}

async function getActiveSprint() {
  const res = await pool.query(
    `SELECT * FROM sprints WHERE status IN ('active', 'scheduled') ORDER BY id DESC LIMIT 1`
  );
  return res.rows[0] || null;
}

async function getParticipant(sprintId, userId) {
  const res = await pool.query(
    `SELECT * FROM sprint_participants WHERE sprint_id = $1 AND user_id = $2 AND active = TRUE`,
    [sprintId, userId]
  );
  return res.rows[0] || null;
}

async function getParticipantBooks(participantId) {
  const res = await pool.query(
    `SELECT * FROM sprint_books WHERE participant_id = $1 ORDER BY order_num`,
    [participantId]
  );
  return res.rows;
}

async function getSprintResults(sprintId) {
  const res = await pool.query(`
    SELECT
      sp.user_id,
      sp.username,
      sp.join_time,
      sp.leave_time,
      sp.total_pause_ms,
      sp.goal_pages,
      sp.goal_reached,
      COALESCE(SUM(sb.end_page - sb.start_page), 0) AS pages_read,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'title', sb.title,
          'format', sb.format,
          'start_page', sb.start_page,
          'end_page', sb.end_page,
          'finished', sb.finished
        ) ORDER BY sb.order_num
      ) AS books
    FROM sprint_participants sp
    LEFT JOIN sprint_books sb ON sb.participant_id = sp.id
    WHERE sp.sprint_id = $1
    GROUP BY sp.id
    ORDER BY pages_read DESC
  `, [sprintId]);
  return res.rows;
}

module.exports = { pool, initDB, getActiveSprint, getParticipant, getParticipantBooks, getSprintResults };
