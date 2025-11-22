import { User, LogEntry } from '../types';

const USERS_KEY = 'skyy_users';
const LOGS_KEY = 'skyy_logs';

export const storageService = {
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

  checkNameExists: (name: string): boolean => {
    const users = storageService.getUsers();
    return users.some(u => u.name.toLowerCase() === name.toLowerCase());
  },

  getUserById: (id: string): User | undefined => {
    const users = storageService.getUsers();
    return users.find(u => u.id === id);
  },

  updateUserLastSeen: (id: string) => {
    // In a real DB we would update a timestamp field
    console.log(`Updating last seen for user ${id}`);
  },

  addLog: (type: LogEntry['type'], message: string, details?: string) => {
    const logs = storageService.getLogs();
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    };
    // Keep last 100 logs
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
  }
};
