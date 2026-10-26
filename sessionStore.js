const session = require("express-session");

/**
 * Bounded in-process session store.
 * This avoids Express MemoryStore's unbounded growth while keeping the app
 * dependency-free for the single-container deployment. Sessions are ephemeral
 * and are intentionally discarded on process restart.
 */
class BoundedSessionStore extends session.Store {
  constructor({ maxSessions = 2000, ttlMs = 8 * 60 * 60 * 1000 } = {}) {
    super();
    this.maxSessions = maxSessions;
    this.ttlMs = ttlMs;
    this.sessions = new Map();
    this.timer = setInterval(() => this.cleanup(), Math.min(ttlMs, 10 * 60 * 1000));
    this.timer.unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [sid, entry] of this.sessions) {
      if (entry.expiresAt <= now) this.sessions.delete(sid);
    }
  }

  get(sid, cb) {
    const entry = this.sessions.get(sid);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) this.sessions.delete(sid);
      return cb(null, null);
    }
    entry.expiresAt = Date.now() + this.ttlMs;
    cb(null, entry.session);
  }

  set(sid, sess, cb) {
    this.cleanup();
    if (!this.sessions.has(sid) && this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }
    this.sessions.set(sid, { session: sess, expiresAt: Date.now() + this.ttlMs });
    cb?.(null);
  }

  destroy(sid, cb) {
    this.sessions.delete(sid);
    cb?.(null);
  }

  touch(sid, sess, cb) {
    const entry = this.sessions.get(sid);
    if (entry) {
      entry.session = sess;
      entry.expiresAt = Date.now() + this.ttlMs;
    }
    cb?.(null);
  }

  length(cb) {
    this.cleanup();
    cb(null, this.sessions.size);
  }

  clear(cb) {
    this.sessions.clear();
    cb?.(null);
  }
}

module.exports = BoundedSessionStore;
