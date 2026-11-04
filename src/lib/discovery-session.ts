/**
 * D'furn Lead Engine - Discovery Session State Manager
 * Handles Pause, Resume, and Cancel states across asynchronous scraping & auditing loops.
 * Strictly zero em dashes.
 */

interface SessionState {
  id: string;
  isPaused: boolean;
  isCancelled: boolean;
  pausedAt?: number;
}

// Global in-memory map of active discovery sessions
const activeSessions = new Map<string, SessionState>();

export function hasActiveRunningSession(): boolean {
  for (const session of activeSessions.values()) {
    if (!session.isCancelled) return true;
  }
  return false;
}

export function getActiveSessionId(): string | null {
  for (const session of activeSessions.values()) {
    if (!session.isCancelled) return session.id;
  }
  return null;
}

export function createSession(id: string): SessionState {
  const session: SessionState = {
    id,
    isPaused: false,
    isCancelled: false,
  };
  activeSessions.set(id, session);
  return session;
}

export function getSession(id: string): SessionState | undefined {
  return activeSessions.get(id);
}

export function pauseSession(id: string): boolean {
  const session = activeSessions.get(id);
  if (session) {
    session.isPaused = true;
    session.pausedAt = Date.now();
    return true;
  }
  return false;
}

export function resumeSession(id: string): boolean {
  const session = activeSessions.get(id);
  if (session) {
    session.isPaused = false;
    session.pausedAt = undefined;
    return true;
  }
  return false;
}

export function cancelSession(id: string): boolean {
  const session = activeSessions.get(id);
  if (session) {
    session.isCancelled = true;
    session.isPaused = false; // Unblock any pause wait loop so it exits immediately
    return true;
  }
  return false;
}

export function removeSession(id: string): void {
  activeSessions.delete(id);
}

/**
 * Checks session state inside asynchronous scraping loops.
 * If paused, asynchronously waits until resumed or cancelled.
 * Returns true if cancelled, false if active/resumed.
 */
export async function waitIfPaused(id: string): Promise<boolean> {
  const session = activeSessions.get(id);
  if (!session) return false;
  if (session.isCancelled) return true;

  while (session.isPaused && !session.isCancelled) {
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return session.isCancelled;
}
