import * as THREE from 'three';
import { GameMode, EnemyType, PickupType, PlayerStats, LEVELS, LevelConfig } from '../core/Types';
import { SaveManager } from '../core/SaveManager';
import { AudioManager } from '../core/AudioManager';
import { Player } from '../entities/Player';
import { EnemyManager } from './EnemyManager';

export interface GameState {
  mode: GameMode;
  levelNumber: number;
  currentWave: number;
  levelKills: number;
  targetKills: number;
  waveTotalEnemies: number;
  waveEnemiesSpawned: number;
  waveEnemiesKilled: number;
  sessionKills: number;
  survivalTime: number;
  isPaused: boolean;
  isGameOver: boolean;
  isLevelCompleted: boolean;
  bossDefeated: boolean;
}

export class GameManager {
  public player: Player;
  public enemyManager: EnemyManager;
  public audio: AudioManager;

  public stats: PlayerStats;
  public state: GameState;

  // Callbacks
  public onStateChanged?: (state: GameState, stats: PlayerStats) => void;
  public onNotification?: (text: string, type?: 'info' | 'success' | 'warning' | 'loot') => void;
  public onLevelComplete?: (level: LevelConfig, earnedXP: number, earnedCoins: number) => void;
  public onGameOver?: (reason: string, stats: { kills: number; time: number; waveOrLevel: string; xp: number }) => void;
  public onWaveStart?: (wave: number) => void;

  constructor(player: Player, enemyManager: EnemyManager, audio: AudioManager) {
    this.player = player;
    this.enemyManager = enemyManager;
    this.audio = audio;

    this.stats = SaveManager.loadStats();

    this.state = {
      mode: GameMode.LEVEL,
      levelNumber: 1,
      currentWave: 1,
      levelKills: 0,
      targetKills: 5,
      waveTotalEnemies: 3,
      waveEnemiesSpawned: 0,
      waveEnemiesKilled: 0,
      sessionKills: 0,
      survivalTime: 0,
      isPaused: false,
      isGameOver: false,
      isLevelCompleted: false,
      bossDefeated: false
    };

    this.setupEvents();
    this.applyPlayerLevelBonuses();
  }

  private setupEvents(): void {
    // Player takes damage
    this.player.onTakeDamage = () => {
      this.notifyState();
    };

    // Player dies
    this.player.onDeath = () => {
      this.handleGameOver();
    };

    // Enemy attacks player
    this.enemyManager.onEnemyAttackPlayer = (damage) => {
      if (!this.state.isGameOver && !this.state.isLevelCompleted && !this.state.isPaused) {
        this.player.takeDamage(damage);
      }
    };

    // Enemy killed
    this.enemyManager.onEnemyKilled = (enemyType) => {
      this.handleEnemyKilled(enemyType);
    };

    // Pickup collected
    this.enemyManager.onPickupCollected = (pickupType) => {
      this.handlePickup(pickupType);
    };
  }

  public applyPlayerLevelBonuses(): void {
    // Level 1 = 100 HP, Level 2 = 110 HP, etc.
    const maxHP = 100 + (this.stats.level - 1) * 10;
    this.player.setMaxHealth(maxHP);
  }

  public startLevel(levelNum: number): void {
    const config = LEVELS.find(l => l.levelNumber === levelNum) || LEVELS[0];

    this.state.mode = GameMode.LEVEL;
    this.state.levelNumber = config.levelNumber;
    this.state.levelKills = 0;
    this.state.targetKills = config.targetKills;
    this.state.sessionKills = 0;
    this.state.survivalTime = 0;
    this.state.isPaused = false;
    this.state.isGameOver = false;
    this.state.isLevelCompleted = false;
    this.state.bossDefeated = false;

    this.enemyManager.reset();
    this.enemyManager.maxActiveEnemies = config.maxActiveEnemies;
    this.enemyManager.allowFastMutants = config.fastMutantAllowed;
    this.enemyManager.allowBoss = config.spawnBoss;
    this.enemyManager.spawnInterval = 2.0;

    // Reset player position & health
    this.player.reset(new THREE.Vector3(0, 1.7, 0));
    this.applyPlayerLevelBonuses();
    this.player.health = this.player.maxHealth;

    // Pre-spawn initial enemies
    for (let i = 0; i < Math.min(3, config.maxActiveEnemies); i++) {
      this.enemyManager.spawnEnemy(EnemyType.NORMAL, this.player.position);
    }

    this.notifyState();
    if (this.onNotification) {
      this.onNotification(`LEVEL ${config.levelNumber}: ${config.title.toUpperCase()}`, 'info');
    }
  }

  public startSurvival(startWave: number = 1): void {
    this.state.mode = GameMode.SURVIVAL;
    this.state.currentWave = startWave;
    this.state.sessionKills = 0;
    this.state.survivalTime = 0;
    this.state.isPaused = false;
    this.state.isGameOver = false;
    this.state.isLevelCompleted = false;
    this.state.bossDefeated = false;

    this.enemyManager.reset();

    // Reset player
    this.player.reset(new THREE.Vector3(0, 1.7, 0));
    this.applyPlayerLevelBonuses();
    this.player.health = this.player.maxHealth;

    this.setupSurvivalWave(startWave);
  }

  private setupSurvivalWave(wave: number): void {
    this.state.currentWave = wave;
    // Wave 1 = 3 zombies, Wave 2 = 6, Wave 3 = 9, Wave 4 = 12, etc.
    this.state.waveTotalEnemies = 3 + (wave - 1) * 3;
    this.state.waveEnemiesSpawned = 0;
    this.state.waveEnemiesKilled = 0;

    this.enemyManager.maxActiveEnemies = Math.min(14, 5 + Math.floor(wave * 0.8));
    this.enemyManager.allowFastMutants = wave >= 3;
    this.enemyManager.allowBoss = wave % 5 === 0;
    this.enemyManager.bossSpawned = false;
    this.enemyManager.spawnInterval = Math.max(1.2, 2.4 - wave * 0.1);

    // Initial enemies
    const initialCount = Math.min(3, this.enemyManager.maxActiveEnemies);
    for (let i = 0; i < initialCount; i++) {
      let type = EnemyType.NORMAL;
      if (this.enemyManager.allowFastMutants && Math.random() < 0.35) {
        type = EnemyType.FAST;
      }
      this.enemyManager.spawnEnemy(type, this.player.position);
      this.state.waveEnemiesSpawned++;
    }

    // Boss check for wave 5, 10, etc.
    if (this.enemyManager.allowBoss) {
      this.enemyManager.spawnBoss(this.player.position);
      this.state.waveEnemiesSpawned++;
      if (this.onNotification) {
        this.onNotification(`WARNING: BOSS APPROACHING!`, 'warning');
      }
    }

    this.audio.playWaveHorn();
    if (this.onWaveStart) {
      this.onWaveStart(wave);
    }
    if (this.onNotification) {
      this.onNotification(`WAVE ${wave} COMMENCED!`, 'info');
    }
    this.notifyState();
  }

  private handleEnemyKilled(type: EnemyType): void {
    this.state.sessionKills++;
    this.stats = SaveManager.recordKill(this.stats);

    // Calculate XP and Coin reward
    let xpGain = 20;
    let coinGain = 5;

    if (type === EnemyType.FAST) {
      xpGain = 35;
      coinGain = 8;
    } else if (type === EnemyType.BOSS) {
      xpGain = 120;
      coinGain = 45;
      this.state.bossDefeated = true;
    }

    // RPG XP and Level Up check
    const xpResult = SaveManager.addXP(this.stats, xpGain);
    this.stats = xpResult.newStats;
    this.stats = SaveManager.addCoins(this.stats, coinGain);

    if (xpResult.leveledUp) {
      this.applyPlayerLevelBonuses();
      this.player.heal(999); // Full health on level up!
      this.audio.playLevelWin();
      if (this.onNotification) {
        this.onNotification(`LEVEL UP! YOU ARE NOW LEVEL ${this.stats.level}! (+10 MAX HP)`, 'success');
      }
    }

    // Handle game mode objectives
    if (this.state.mode === GameMode.LEVEL) {
      this.state.levelKills++;
      const currentConfig = LEVELS.find(l => l.levelNumber === this.state.levelNumber)!;

      // Spawn Boss for level 5 when threshold is reached
      if (currentConfig.spawnBoss && !this.enemyManager.bossSpawned && this.state.levelKills >= (currentConfig.bossAtKills || 10)) {
        this.enemyManager.spawnBoss(this.player.position);
        if (this.onNotification) {
          this.onNotification(`ALERT: THE ABOMINATION HAS SPAWNED!`, 'warning');
        }
      }

      // Check level completion
      const killsMet = this.state.levelKills >= currentConfig.targetKills;
      const bossMet = !currentConfig.spawnBoss || this.state.bossDefeated;

      if (killsMet && bossMet) {
        this.handleLevelCompleted(currentConfig);
      }
    } else {
      // Survival Mode
      this.state.waveEnemiesKilled++;

      // Check if wave is cleared
      const remainingEnemies = this.state.waveTotalEnemies - this.state.waveEnemiesKilled;
      if (remainingEnemies <= 0 && this.enemyManager.enemies.filter(e => !e.isDead).length === 0) {
        // Wave complete! Give wave bonus
        const waveBonusXP = 50 + this.state.currentWave * 20;
        const waveBonusCoins = 20 + this.state.currentWave * 5;
        this.stats = SaveManager.addXP(this.stats, waveBonusXP).newStats;
        this.stats = SaveManager.addCoins(this.stats, waveBonusCoins);

        SaveManager.recordWave(this.stats, this.state.currentWave);

        if (this.onNotification) {
          this.onNotification(`WAVE ${this.state.currentWave} CLEARED! (+${waveBonusXP} XP, +${waveBonusCoins} Coins)`, 'success');
        }

        // Brief delay before next wave
        setTimeout(() => {
          if (!this.state.isGameOver && this.state.mode === GameMode.SURVIVAL) {
            this.setupSurvivalWave(this.state.currentWave + 1);
          }
        }, 3000);
      }
    }

    this.notifyState();
  }

  private handlePickup(type: PickupType): void {
    if (type === PickupType.HEALTH) {
      const healed = this.player.heal(30);
      if (this.onNotification) {
        this.onNotification(`+30 HEALTH (${this.player.health}/${this.player.maxHealth})`, 'loot');
      }
    } else if (type === PickupType.AMMO) {
      this.player.weapon.addAmmo(24);
      if (this.onNotification) {
        this.onNotification(`+24 PISTOL AMMO`, 'loot');
      }
    } else { // COIN
      this.stats = SaveManager.addCoins(this.stats, 10);
      if (this.onNotification) {
        this.onNotification(`+10 COINS`, 'loot');
      }
    }
    this.notifyState();
  }

  private handleLevelCompleted(config: LevelConfig): void {
    if (this.state.isLevelCompleted) return;
    this.state.isLevelCompleted = true;

    // Stop spawning
    this.enemyManager.maxActiveEnemies = 0;

    // Victory sound
    this.audio.playLevelWin();

    // Award mission rewards
    const xpResult = SaveManager.addXP(this.stats, config.rewardXP);
    this.stats = xpResult.newStats;
    this.stats = SaveManager.addCoins(this.stats, config.rewardCoins);

    // Unlock next level
    if (config.levelNumber < 5) {
      this.stats = SaveManager.unlockLevel(this.stats, config.levelNumber + 1);
    }

    if (this.onLevelComplete) {
      this.onLevelComplete(config, config.rewardXP, config.rewardCoins);
    }
    this.notifyState();
  }

  private handleGameOver(): void {
    if (this.state.isGameOver) return;
    this.state.isGameOver = true;

    this.audio.playGameOver();

    const waveOrLevel = this.state.mode === GameMode.LEVEL
      ? `Level ${this.state.levelNumber}`
      : `Wave ${this.state.currentWave}`;

    if (this.state.mode === GameMode.SURVIVAL) {
      this.stats = SaveManager.recordWave(this.stats, this.state.currentWave);
    }

    if (this.onGameOver) {
      this.onGameOver('KILLED IN ACTION', {
        kills: this.state.sessionKills,
        time: Math.floor(this.state.survivalTime),
        waveOrLevel,
        xp: this.stats.xp
      });
    }
    this.notifyState();
  }

  public togglePause(): boolean {
    if (this.state.isGameOver || this.state.isLevelCompleted) return false;
    this.state.isPaused = !this.state.isPaused;
    this.notifyState();
    return this.state.isPaused;
  }

  public setPaused(paused: boolean): void {
    if (this.state.isGameOver || this.state.isLevelCompleted) return;
    this.state.isPaused = paused;
    this.notifyState();
  }

  public update(delta: number): void {
    if (this.state.isPaused || this.state.isGameOver || this.state.isLevelCompleted) {
      return;
    }

    this.state.survivalTime += delta;

    // Survival mode: continuous spawning until wave quota met
    let canSpawn = false;
    if (this.state.mode === GameMode.LEVEL) {
      const config = LEVELS.find(l => l.levelNumber === this.state.levelNumber)!;
      canSpawn = this.state.levelKills + this.enemyManager.enemies.filter(e => !e.isDead).length < config.targetKills;
    } else {
      canSpawn = this.state.waveEnemiesSpawned < this.state.waveTotalEnemies;
    }

    this.enemyManager.update(delta, this.player.position, canSpawn);

    // If survival enemy spawned, count it
    if (this.state.mode === GameMode.SURVIVAL && canSpawn) {
      // counted via spawner callback
    }
  }

  private notifyState(): void {
    if (this.onStateChanged) {
      this.onStateChanged(this.state, this.stats);
    }
  }
}
