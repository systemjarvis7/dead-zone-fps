export enum GameMode {
  LEVEL = 'LEVEL',
  SURVIVAL = 'SURVIVAL'
}

export enum EnemyType {
  NORMAL = 'NORMAL',
  FAST = 'FAST',
  BOSS = 'BOSS'
}

export enum PickupType {
  HEALTH = 'HEALTH',
  AMMO = 'AMMO',
  COIN = 'COIN'
}

export interface PlayerStats {
  level: number;
  xp: number;
  coins: number;
  unlockedLevel: number;
  highestWave: number;
  totalKills: number;
}

export interface GameSettings {
  mouseSensitivity: number;
  masterVolume: number;
  sfxVolume: number;
  fov: number;
  invertY: boolean;
}

export interface LevelConfig {
  levelNumber: number;
  title: string;
  description: string;
  targetKills: number;
  spawnBoss: boolean;
  bossAtKills?: number;
  fastMutantAllowed: boolean;
  maxActiveEnemies: number;
  rewardXP: number;
  rewardCoins: number;
}

export const LEVELS: LevelConfig[] = [
  {
    levelNumber: 1,
    title: 'Village Outskirts',
    description: 'Eliminate 5 roaming zombies in the abandoned outskirts.',
    targetKills: 5,
    spawnBoss: false,
    fastMutantAllowed: false,
    maxActiveEnemies: 4,
    rewardXP: 100,
    rewardCoins: 30
  },
  {
    levelNumber: 2,
    title: 'The Silent Crossroad',
    description: 'Clear 10 zombies from the main road and ruined houses.',
    targetKills: 10,
    spawnBoss: false,
    fastMutantAllowed: false,
    maxActiveEnemies: 6,
    rewardXP: 150,
    rewardCoins: 50
  },
  {
    levelNumber: 3,
    title: 'Mutant Infestation',
    description: 'Survive and eradicate 15 hostiles. Fast mutants have arrived!',
    targetKills: 15,
    spawnBoss: false,
    fastMutantAllowed: true,
    maxActiveEnemies: 8,
    rewardXP: 200,
    rewardCoins: 75
  },
  {
    levelNumber: 4,
    title: 'Dead Center',
    description: 'Eliminate 20 ferocious infected in the heart of the village.',
    targetKills: 20,
    spawnBoss: false,
    fastMutantAllowed: true,
    maxActiveEnemies: 10,
    rewardXP: 300,
    rewardCoins: 100
  },
  {
    levelNumber: 5,
    title: 'The Abomination',
    description: 'Defeat 15 infected and destroy the mutated Boss titan.',
    targetKills: 15,
    spawnBoss: true,
    bossAtKills: 10,
    fastMutantAllowed: true,
    maxActiveEnemies: 10,
    rewardXP: 500,
    rewardCoins: 200
  }
];

export function getXPForNextLevel(currentLevel: number): number {
  if (currentLevel === 1) return 100;
  if (currentLevel === 2) return 250;
  if (currentLevel === 3) return 450;
  if (currentLevel === 4) return 700;
  return 700 + (currentLevel - 4) * 350;
}
