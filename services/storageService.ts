import { User, LogEntry, UserPreferences, Emotion, InteractionContext } from '../types';

const USERS_KEY = 'skyy_users';
const LOGS_KEY = 'skyy_logs';
const PREFERENCES_KEY = 'skyy_preferences';
const EMOTIONS_KEY = 'skyy_emotions';

export const storageService = {
  // === User Management ===
  getUsers: (): User[] => {
    try {
      const users = localStorage.getItem(USERS_KEY);
      return users ? JSON.parse(users) : [];
    } catch (e) {
      console.error("Failed to load users", e);
      return [];
    }
  },

  saveUser: (user: User): void => {
    const users = storageService.getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  updateUser: (userId: string, updates: Partial<User>): void => {
    const users = storageService.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  },

  checkNameExists: (name: string): boolean => {
    const users = storageService.getUsers();
    return users.some(u => u.name.toLowerCase() === name.toLowerCase());
  },

  getUserById: (id: string): User | undefined => {
    const users = storageService.getUsers();
    return users.find(u => u.id === id);
  },

  updateUserLastSeen: (id: string) => {
    storageService.updateUser(id, {
      lastSeen: new Date().toISOString(),
      interactionCount: (storageService.getUserById(id)?.interactionCount || 0) + 1
    });
  },

  // === Logging ===
  addLog: (type: LogEntry['type'], message: string, details?: string) => {
    const logs = storageService.getLogs();
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    };
    const updatedLogs = [newLog, ...logs].slice(0, 100);
    localStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
    return newLog;
  },

  getLogs: (): LogEntry[] => {
    try {
      const logs = localStorage.getItem(LOGS_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (e) {
      return [];
    }
  },

  clearLogs: () => {
    localStorage.removeItem(LOGS_KEY);
  },

  // === User Preferences ===
  getPreferences: (userId: string): UserPreferences | null => {
    try {
      const stored = localStorage.getItem(`${PREFERENCES_KEY}_${userId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  savePreferences: (preferences: UserPreferences): void => {
    localStorage.setItem(
      `${PREFERENCES_KEY}_${preferences.userId}`,
      JSON.stringify(preferences)
    );
  },

  getOrCreatePreferences: (userId: string): UserPreferences => {
    const existing = storageService.getPreferences(userId);
    if (existing) return existing;

    const defaultPrefs: UserPreferences = {
      userId,
      voiceEnabled: false,
      conversationHistory: true,
      emotionTracking: true,
      privacyMode: false,
      lastUpdated: new Date().toISOString()
    };

    storageService.savePreferences(defaultPrefs);
    return defaultPrefs;
  },

  // === Emotion History ===
  saveEmotion: (userId: string, emotion: Emotion): void => {
    const emotions = storageService.getEmotionHistory(userId);
    emotions.push(emotion);

    // Keep last 100 emotions
    const trimmed = emotions.slice(-100);
    localStorage.setItem(`${EMOTIONS_KEY}_${userId}`, JSON.stringify(trimmed));
  },

  getEmotionHistory: (userId: string): Emotion[] => {
    try {
      const stored = localStorage.getItem(`${EMOTIONS_KEY}_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  clearEmotionHistory: (userId: string): void => {
    localStorage.removeItem(`${EMOTIONS_KEY}_${userId}`);
  },

  // === Interaction Context ===
  getInteractionContext: (userId: string): InteractionContext | null => {
    const user = storageService.getUserById(userId);
    if (!user) return null;

    const preferences = storageService.getOrCreatePreferences(userId);
    const emotionHistory = storageService.getEmotionHistory(userId);

    // Calculate average mood
    let averageMood: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (emotionHistory.length > 0) {
      const avgScore = emotionHistory.reduce((sum, e) => sum + e.sentimentScore, 0) / emotionHistory.length;
      if (avgScore > 0.2) averageMood = 'positive';
      else if (avgScore < -0.2) averageMood = 'negative';
    }

    return {
      userId,
      lastSeen: user.lastSeen || user.registeredAt,
      conversationHistory: [], // Would be populated from conversationService
      emotionHistory,
      preferences,
      totalInteractions: user.interactionCount || 0,
      averageMood
    };
  }
};
