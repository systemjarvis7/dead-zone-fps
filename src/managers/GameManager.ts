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
  headshots: number;
  grenadeKills: number;
  shotsFired: number;
  shotsHit: number;
  damageDealt: number;
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
  public onLevelComplete?: (
    level: LevelConfig,
    earnedXP: number,
    earnedCoins: number,
    detailedStats: {
      kills: number;
      headshots: number;
      accuracy: number;
      damage: number;
      time: number;
      grenades: number;
    }
  ) => void;
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
      bossDefeated: false,
      headshots: 0,
      grenadeKills: 0,
      shotsFired: 0,
      shotsHit: 0,
      damageDealt: 0
    };

    this.setupEvents();
    this.applyPlayerLevelBonuses();
  }

  private setupEvents(): void {
    this.player.onTakeDamage = () => {
      this.notifyState();
    };

    this.player.onDeath = () => {
      this.handleGameOver();
    };

    this.player.weapon.onShoot = () => {
      this.state.shotsFired++;
    };

    this.player.weapon.onHitEnemy = (damage, isHeadshot) => {
      this.state.shotsHit++;
      this.state.damageDealt += damage;
      if (isHeadshot) {
        this.state.headshots++;
      }
    };

    this.player.weapon.onGrenadeExplode = () => {
      // Grenade explosion event
    };

    this.enemyManager.onEnemyAttackPlayer = (damage, attackerPos) => {
      if (!this.state.isGameOver && !this.state.isLevelCompleted && !this.state.isPaused) {
        this.player.takeDamage(damage, attackerPos);
      }
    };

    this.enemyManager.onEnemyKilled = (enemyType) => {
      this.handleEnemyKilled(enemyType);
    };

    this.enemyManager.onPickupCollected = (pickupType) => {
      this.handlePickup(pickupType);
    };
  }

  public applyPlayerLevelBonuses(): void {
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
    this.state.headshots = 0;
    this.state.grenadeKills = 0;
    this.state.shotsFired = 0;
    this.state.shotsHit = 0;
    this.state.damageDealt = 0;

    this.enemyManager.reset();
    this.enemyManager.maxActiveEnemies = config.maxActiveEnemies;
    this.enemyManager.allowFastMutants = config.fastMutantAllowed;
    this.enemyManager.allowBoss = config.spawnBoss;
    this.enemyManager.spawnInterval = 2.0;

    this.player.reset(new THREE.Vector3(0, 1.7, 0));
    this.applyPlayerLevelBonuses();
    this.player.health = this.player.maxHealth;

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
    this.state.headshots = 0;
    this.state.grenadeKills = 0;
    this.state.shotsFired = 0;
    this.state.shotsHit = 0;
    this.state.damageDealt = 0;

    this.enemyManager.reset();

    this.player.reset(new THREE.Vector3(0, 1.7, 0));
    this.applyPlayerLevelBonuses();
    this.player.health = this.player.maxHealth;

    this.setupSurvivalWave(startWave);
  }

  private setupSurvivalWave(wave: number): void {
    this.state.currentWave = wave;
    // Hardcore Scaling: 8 hostiles on Wave 1 (+5 per wave)
    this.state.waveTotalEnemies = 8 + (wave - 1) * 5;
    this.state.waveEnemiesSpawned = 0;
    this.state.waveEnemiesKilled = 0;

    this.enemyManager.maxActiveEnemies = Math.min(16, 8 + Math.floor(wave * 1.4));
    this.enemyManager.allowFastMutants = true; // Fast runner mutants active from wave 1!
    this.enemyManager.allowBoss = wave % 3 === 0; // Boss arrives on wave 3, 6, 9...
    this.enemyManager.bossSpawned = false;
    this.enemyManager.spawnInterval = Math.max(0.85, 1.4 - wave * 0.08); // Rapid spawn pace

    // Immediate spawn burst of 5-6 hostiles
    const initialCount = Math.min(6, this.enemyManager.maxActiveEnemies);
    for (let i = 0; i < initialCount; i++) {
      let type = EnemyType.NORMAL;
      if (Math.random() < 0.35) {
        type = EnemyType.FAST;
      }
      this.enemyManager.spawnEnemy(type, this.player.position);
      this.state.waveEnemiesSpawned++;
    }

    if (this.enemyManager.allowBoss) {
      this.enemyManager.spawnBoss(this.player.position);
      this.state.waveEnemiesSpawned++;
      if (this.onNotification) {
        this.onNotification(`WARNING: BOSS MUTANT DETECTED!`, 'warning');
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

    const xpResult = SaveManager.addXP(this.stats, xpGain);
    this.stats = xpResult.newStats;
    this.stats = SaveManager.addCoins(this.stats, coinGain);

    if (xpResult.leveledUp) {
      this.applyPlayerLevelBonuses();
      this.player.heal(999);
      this.audio.playLevelWin();
      if (this.onNotification) {
        this.onNotification(`LEVEL UP! YOU ARE NOW LEVEL ${this.stats.level}! (+10 MAX HP)`, 'success');
      }
    }

    if (this.state.mode === GameMode.LEVEL) {
      this.state.levelKills++;
      const currentConfig = LEVELS.find(l => l.levelNumber === this.state.levelNumber)!;

      if (currentConfig.spawnBoss && !this.enemyManager.bossSpawned && this.state.levelKills >= (currentConfig.bossAtKills || 10)) {
        this.enemyManager.spawnBoss(this.player.position);
        if (this.onNotification) {
          this.onNotification(`ALERT: THE ABOMINATION HAS SPAWNED!`, 'warning');
        }
      }

      const killsMet = this.state.levelKills >= currentConfig.targetKills;
      const bossMet = !currentConfig.spawnBoss || this.state.bossDefeated;

      if (killsMet && bossMet) {
        this.handleLevelCompleted(currentConfig);
      }
    } else {
      this.state.waveEnemiesKilled++;
      const remainingEnemies = this.state.waveTotalEnemies - this.state.waveEnemiesKilled;
      if (remainingEnemies <= 0 && this.enemyManager.enemies.filter(e => !e.isDead).length === 0) {
        const waveBonusXP = 50 + this.state.currentWave * 20;
        const waveBonusCoins = 20 + this.state.currentWave * 5;
        this.stats = SaveManager.addXP(this.stats, waveBonusXP).newStats;
        this.stats = SaveManager.addCoins(this.stats, waveBonusCoins);

        SaveManager.recordWave(this.stats, this.state.currentWave);

        if (this.onNotification) {
          this.onNotification(`WAVE ${this.state.currentWave} CLEARED! (+${waveBonusXP} XP, +${waveBonusCoins} Coins)`, 'success');
        }

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
      this.player.heal(30);
      if (this.onNotification) {
        this.onNotification(`+30 HEALTH (${Math.ceil(this.player.health)}/${this.player.maxHealth})`, 'loot');
      }
    } else if (type === PickupType.AMMO) {
      this.player.weapon.addAmmo(24);
      if (this.onNotification) {
        this.onNotification(`+24 PISTOL AMMO`, 'loot');
      }
    } else if (type === PickupType.GRENADE) {
      this.player.weapon.addGrenades(2);
      if (this.onNotification) {
        this.onNotification(`+2 GRENADES`, 'loot');
      }
    } else if (type === PickupType.ARMOR) {
      this.player.addArmor(40);
      if (this.onNotification) {
        this.onNotification(`+40 BODY ARMOR`, 'loot');
      }
    } else {
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

    this.enemyManager.maxActiveEnemies = 0;
    this.audio.playLevelWin();

    const xpResult = SaveManager.addXP(this.stats, config.rewardXP);
    this.stats = xpResult.newStats;
    this.stats = SaveManager.addCoins(this.stats, config.rewardCoins);

    if (config.levelNumber < 5) {
      this.stats = SaveManager.unlockLevel(this.stats, config.levelNumber + 1);
    }

    const accuracy = this.state.shotsFired > 0
      ? Math.round((this.state.shotsHit / this.state.shotsFired) * 100)
      : 100;

    if (this.onLevelComplete) {
      this.onLevelComplete(config, config.rewardXP, config.rewardCoins, {
        kills: this.state.levelKills,
        headshots: this.state.headshots,
        accuracy,
        damage: this.state.damageDealt,
        time: Math.floor(this.state.survivalTime),
        grenades: this.state.grenadeKills
      });
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

    let canSpawn = false;
    if (this.state.mode === GameMode.LEVEL) {
      const config = LEVELS.find(l => l.levelNumber === this.state.levelNumber)!;
      canSpawn = this.state.levelKills + this.enemyManager.enemies.filter(e => !e.isDead).length < config.targetKills;
    } else {
      canSpawn = this.state.waveEnemiesSpawned < this.state.waveTotalEnemies;
    }

    this.enemyManager.update(delta, this.player.position, canSpawn, this.player.isCrouching);
  }

  private notifyState(): void {
    if (this.onStateChanged) {
      this.onStateChanged(this.state, this.stats);
    }
  }
}
