import { PlayerStats, GameSettings, getXPForNextLevel } from './Types';

const STATS_KEY = 'dead_zone_stats_v1';
const SETTINGS_KEY = 'dead_zone_settings_v1';

export class SaveManager {
  private static defaultStats: PlayerStats = {
    level: 1,
    xp: 0,
    coins: 0,
    unlockedLevel: 1,
    highestWave: 1,
    totalKills: 0
  };

  private static defaultSettings: GameSettings = {
    mouseSensitivity: 0.0022,
    masterVolume: 0.8,
    sfxVolume: 0.8,
    fov: 75,
    invertY: false
  };

  public static loadStats(): PlayerStats {
    try {
      const data = localStorage.getItem(STATS_KEY);
      if (data) {
        return { ...this.defaultStats, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Failed to load stats from localStorage', e);
    }
    return { ...this.defaultStats };
  }

  public static saveStats(stats: PlayerStats): void {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to save stats to localStorage', e);
    }
  }

  public static addXP(currentStats: PlayerStats, amount: number): { leveledUp: boolean; newStats: PlayerStats } {
    let stats = { ...currentStats };
    stats.xp += amount;
    let leveledUp = false;

    while (true) {
      const threshold = getXPForNextLevel(stats.level);
      if (stats.xp >= threshold) {
        stats.level += 1;
        leveledUp = true;
      } else {
        break;
      }
    }

    this.saveStats(stats);
    return { leveledUp, newStats: stats };
  }

  public static addCoins(currentStats: PlayerStats, amount: number): PlayerStats {
    const stats = { ...currentStats, coins: currentStats.coins + amount };
    this.saveStats(stats);
    return stats;
  }

  public static recordKill(currentStats: PlayerStats): PlayerStats {
    const stats = { ...currentStats, totalKills: currentStats.totalKills + 1 };
    this.saveStats(stats);
    return stats;
  }

  public static unlockLevel(currentStats: PlayerStats, levelToUnlock: number): PlayerStats {
    if (levelToUnlock > currentStats.unlockedLevel && levelToUnlock <= 5) {
      const stats = { ...currentStats, unlockedLevel: levelToUnlock };
      this.saveStats(stats);
      return stats;
    }
    return currentStats;
  }

  public static recordWave(currentStats: PlayerStats, wave: number): PlayerStats {
    if (wave > currentStats.highestWave) {
      const stats = { ...currentStats, highestWave: wave };
      this.saveStats(stats);
      return stats;
    }
    return currentStats;
  }

  public static loadSettings(): GameSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (data) {
        return { ...this.defaultSettings, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage', e);
    }
    return { ...this.defaultSettings };
  }

  public static saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e);
    }
  }

  public static resetProgress(): PlayerStats {
    const fresh = { ...this.defaultStats };
    this.saveStats(fresh);
    return fresh;
  }
}
