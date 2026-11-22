import * as THREE from 'three';
import { GameManager, GameState } from '../managers/GameManager';
import { PlayerStats, LEVELS, LevelConfig, GameSettings, getXPForNextLevel, TimeOfDay, GraphicsQuality } from '../core/Types';
import { SaveManager } from '../core/SaveManager';
import { AudioManager } from '../core/AudioManager';
import { InputManager } from '../core/InputManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';

export class UIManager {
  private gameManager: GameManager;
  private audio: AudioManager;
  private input: InputManager;
  private player: Player;
  private settings: GameSettings;

  // Overlays
  private gameHud: HTMLElement;
  private mainMenuOverlay: HTMLElement;
  private levelSelectOverlay: HTMLElement;
  private pauseMenuOverlay: HTMLElement;
  private levelCompleteOverlay: HTMLElement;
  private gameOverOverlay: HTMLElement;
  private settingsModal: HTMLElement;
  private howToPlayModal: HTMLElement;
  private clickToPlayOverlay: HTMLElement;

  // HUD Elements
  private hudModeTitle: HTMLElement;
  private hudObjectiveDesc: HTMLElement;
  private hudPlayerLevel: HTMLElement;
  private hudXpText: HTMLElement;
  private hudXpBar: HTMLElement;
  private hudCoinText: HTMLElement;
  private hudKillsText: HTMLElement;
  private hudHealthValue: HTMLElement;
  private hudHealthBar: HTMLElement;
  private hudStaminaBar: HTMLElement;
  private hudStanceBadge: HTMLElement;

  private hudWeaponName: HTMLElement;
  private hudAmmoCurrent: HTMLElement;
  private hudAmmoReserve: HTMLElement;
  private hudGrenadeDisplay: HTMLElement;
  private hudFlashlightDisplay: HTMLElement;
  private hudReloadBar: HTMLElement;
  private hudReloadFill: HTMLElement;
  private hudReloadPrompt: HTMLElement;

  private hudNotifications: HTMLElement;
  private damageVignette: HTMLElement;
  private lowHealthVignette: HTMLElement;
  private damageIndicatorArc: HTMLElement;
  private crosshairContainer: HTMLElement;
  private hitmarker: HTMLElement;

  // Interaction prompt
  private interactionPromptContainer: HTMLElement;
  private interactionPromptText: HTMLElement;

  // Radar Canvas
  private radarCanvas: HTMLCanvasElement;
  private radarCtx: CanvasRenderingContext2D;

  private levelListContainer: HTMLElement;

  // Timers
  private hitmarkerTimer: number = 0;
  private damageVignetteTimer: number = 0;
  private damageArcTimer: number = 0;

  // Callbacks
  public onStartLevelRequested?: (levelNum: number) => void;
  public onStartSurvivalRequested?: () => void;
  public onRestartRequested?: () => void;
  public onReturnToMainMenuRequested?: () => void;
  public onTimeOfDayChanged?: (time: TimeOfDay) => void;
  public onGraphicsQualityChanged?: (quality: GraphicsQuality) => void;

  constructor(gameManager: GameManager, audio: AudioManager, input: InputManager, player: Player) {
    this.gameManager = gameManager;
    this.audio = audio;
    this.input = input;
    this.player = player;
    this.settings = SaveManager.loadSettings();

    // Query DOM elements
    this.gameHud = document.getElementById('game-hud')!;
    this.mainMenuOverlay = document.getElementById('main-menu-overlay')!;
    this.levelSelectOverlay = document.getElementById('level-select-overlay')!;
    this.pauseMenuOverlay = document.getElementById('pause-menu-overlay')!;
    this.levelCompleteOverlay = document.getElementById('level-complete-overlay')!;
    this.gameOverOverlay = document.getElementById('game-over-overlay')!;
    this.settingsModal = document.getElementById('settings-modal')!;
    this.howToPlayModal = document.getElementById('how-to-play-modal')!;
    this.clickToPlayOverlay = document.getElementById('click-to-play-overlay')!;

    this.hudModeTitle = document.getElementById('hud-mode-title')!;
    this.hudObjectiveDesc = document.getElementById('hud-objective-desc')!;
    this.hudPlayerLevel = document.getElementById('hud-player-level')!;
    this.hudXpText = document.getElementById('hud-xp-text')!;
    this.hudXpBar = document.getElementById('hud-xp-bar')!;
    this.hudCoinText = document.getElementById('hud-coin-text')!;
    this.hudKillsText = document.getElementById('hud-kills-text')!;

    this.hudHealthValue = document.getElementById('hud-health-value')!;
    this.hudHealthBar = document.getElementById('hud-health-bar')!;
    this.hudStaminaBar = document.getElementById('hud-stamina-bar')!;
    this.hudStanceBadge = document.getElementById('hud-stance-badge')!;

    this.hudWeaponName = document.getElementById('hud-weapon-name')!;
    this.hudAmmoCurrent = document.getElementById('hud-ammo-current')!;
    this.hudAmmoReserve = document.getElementById('hud-ammo-reserve')!;
    this.hudGrenadeDisplay = document.getElementById('hud-grenade-display')!;
    this.hudFlashlightDisplay = document.getElementById('hud-flashlight-display')!;
    this.hudReloadBar = document.getElementById('hud-reload-bar')!;
    this.hudReloadFill = document.getElementById('hud-reload-fill')!;
    this.hudReloadPrompt = document.getElementById('hud-reload-prompt')!;

    this.hudNotifications = document.getElementById('hud-notifications')!;
    this.damageVignette = document.getElementById('damage-vignette')!;
    this.lowHealthVignette = document.getElementById('low-health-vignette')!;
    this.damageIndicatorArc = document.getElementById('damage-indicator-arc')!;
    this.crosshairContainer = document.getElementById('crosshair-container')!;
    this.hitmarker = document.getElementById('hitmarker')!;

    this.interactionPromptContainer = document.getElementById('interaction-prompt-container')!;
    this.interactionPromptText = document.getElementById('interaction-prompt-text')!;

    this.radarCanvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
    this.radarCtx = this.radarCanvas.getContext('2d')!;

    this.levelListContainer = document.getElementById('level-list')!;

    this.setupListeners();
    this.applySettingsToGame();
    this.updateHUD(this.gameManager.state, this.gameManager.stats);
  }

  private setupListeners(): void {
    // 1. Main Menu Buttons
    document.getElementById('btn-main-new-game')?.addEventListener('click', () => {
      this.hideAllMenus();
      if (this.onStartLevelRequested) this.onStartLevelRequested(1);
    });

    document.getElementById('btn-main-continue')?.addEventListener('click', () => {
      const stats = SaveManager.loadStats();
      this.hideAllMenus();
      if (this.onStartLevelRequested) this.onStartLevelRequested(stats.unlockedLevel);
    });

    document.getElementById('btn-main-modes')?.addEventListener('click', () => {
      this.showLevelSelect();
    });

    document.getElementById('btn-main-controls')?.addEventListener('click', () => {
      this.howToPlayModal.classList.add('active');
    });

    document.getElementById('btn-how-to-play-back')?.addEventListener('click', () => {
      this.howToPlayModal.classList.remove('active');
    });

    document.getElementById('btn-main-settings')?.addEventListener('click', () => {
      this.showSettings();
    });

    document.getElementById('btn-main-reset')?.addEventListener('click', () => {
      if (confirm('Reset all progress, levels, XP and coins?')) {
        SaveManager.resetProgress();
        this.gameManager.stats = SaveManager.loadStats();
        this.gameManager.applyPlayerLevelBonuses();
        this.updateHUD(this.gameManager.state, this.gameManager.stats);
        this.showToast('PROGRESS RESET TO DEFAULT', 'warning');
      }
    });

    // 2. Level Select Buttons
    document.getElementById('btn-level-select-back')?.addEventListener('click', () => {
      this.levelSelectOverlay.classList.remove('active');
      this.mainMenuOverlay.classList.add('active');
    });

    document.getElementById('btn-start-survival-direct')?.addEventListener('click', () => {
      this.hideAllMenus();
      if (this.onStartSurvivalRequested) this.onStartSurvivalRequested();
    });

    // 3. Pause Menu Buttons
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      this.pauseMenuOverlay.classList.remove('active');
      this.gameManager.setPaused(false);
      this.input.requestPointerLock();
    });

    document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
      this.pauseMenuOverlay.classList.remove('active');
      if (this.onRestartRequested) this.onRestartRequested();
    });

    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      this.showSettings();
    });

    document.getElementById('btn-pause-main-menu')?.addEventListener('click', () => {
      this.pauseMenuOverlay.classList.remove('active');
      if (this.onReturnToMainMenuRequested) this.onReturnToMainMenuRequested();
    });

    // 4. Level Completed Buttons
    document.getElementById('btn-victory-continue')?.addEventListener('click', () => {
      this.levelCompleteOverlay.classList.remove('active');
      const nextLevel = Math.min(5, this.gameManager.state.levelNumber + 1);
      if (this.onStartLevelRequested) this.onStartLevelRequested(nextLevel);
    });

    document.getElementById('btn-victory-main-menu')?.addEventListener('click', () => {
      this.levelCompleteOverlay.classList.remove('active');
      if (this.onReturnToMainMenuRequested) this.onReturnToMainMenuRequested();
    });

    // 5. Game Over Buttons
    document.getElementById('btn-game-over-retry')?.addEventListener('click', () => {
      this.gameOverOverlay.classList.remove('active');
      if (this.onRestartRequested) this.onRestartRequested();
    });

    document.getElementById('btn-game-over-main-menu')?.addEventListener('click', () => {
      this.gameOverOverlay.classList.remove('active');
      if (this.onReturnToMainMenuRequested) this.onReturnToMainMenuRequested();
    });

    // 6. Settings Inputs
    const sensInput = document.getElementById('setting-sensitivity') as HTMLInputElement;
    const masterVolInput = document.getElementById('setting-master-volume') as HTMLInputElement;
    const sfxVolInput = document.getElementById('setting-sfx-volume') as HTMLInputElement;
    const ambientVolInput = document.getElementById('setting-ambient-volume') as HTMLInputElement;
    const fovInput = document.getElementById('setting-fov') as HTMLInputElement;
    const timeSelect = document.getElementById('setting-time-of-day') as HTMLSelectElement;
    const graphicsSelect = document.getElementById('setting-graphics') as HTMLSelectElement;
    const invertYInput = document.getElementById('setting-invert-y') as HTMLInputElement;

    sensInput?.addEventListener('input', () => {
      document.getElementById('val-sensitivity')!.innerText = (parseFloat(sensInput.value) / 10).toFixed(1);
    });
    masterVolInput?.addEventListener('input', () => {
      document.getElementById('val-master-volume')!.innerText = `${masterVolInput.value}%`;
    });
    sfxVolInput?.addEventListener('input', () => {
      document.getElementById('val-sfx-volume')!.innerText = `${sfxVolInput.value}%`;
    });
    ambientVolInput?.addEventListener('input', () => {
      document.getElementById('val-ambient-volume')!.innerText = `${ambientVolInput.value}%`;
    });
    fovInput?.addEventListener('input', () => {
      document.getElementById('val-fov')!.innerText = `${fovInput.value}°`;
    });

    document.getElementById('btn-settings-save')?.addEventListener('click', () => {
      this.settings.mouseSensitivity = parseFloat(sensInput.value) / 10000;
      this.settings.masterVolume = parseInt(masterVolInput.value) / 100;
      this.settings.sfxVolume = parseInt(sfxVolInput.value) / 100;
      this.settings.ambientVolume = parseInt(ambientVolInput.value) / 100;
      this.settings.fov = parseInt(fovInput.value);
      this.settings.timeOfDay = timeSelect.value as TimeOfDay;
      this.settings.graphicsQuality = graphicsSelect.value as GraphicsQuality;
      this.settings.invertY = invertYInput.checked;

      SaveManager.saveSettings(this.settings);
      this.applySettingsToGame();
      this.settingsModal.classList.remove('active');

      if (this.onTimeOfDayChanged) this.onTimeOfDayChanged(this.settings.timeOfDay);
      if (this.onGraphicsQualityChanged) this.onGraphicsQualityChanged(this.settings.graphicsQuality);
    });

    // 7. Click to Play overlay
    this.clickToPlayOverlay.addEventListener('click', () => {
      this.clickToPlayOverlay.classList.remove('active');
      this.input.requestPointerLock();
    });

    // 8. Pointer lock changes
    this.input.onPointerLockChange = (locked) => {
      if (!locked) {
        if (
          !this.mainMenuOverlay.classList.contains('active') &&
          !this.pauseMenuOverlay.classList.contains('active') &&
          !this.gameOverOverlay.classList.contains('active') &&
          !this.levelCompleteOverlay.classList.contains('active') &&
          !this.levelSelectOverlay.classList.contains('active') &&
          !this.settingsModal.classList.contains('active') &&
          !this.howToPlayModal.classList.contains('active')
        ) {
          this.clickToPlayOverlay.classList.add('active');
        }
      } else {
        this.clickToPlayOverlay.classList.remove('active');
      }
    };

    // 9. Pause requested (ESC)
    this.input.onPauseRequested = () => {
      if (
        this.mainMenuOverlay.classList.contains('active') ||
        this.gameOverOverlay.classList.contains('active') ||
        this.levelCompleteOverlay.classList.contains('active')
      ) {
        return;
      }
      if (this.settingsModal.classList.contains('active')) {
        this.settingsModal.classList.remove('active');
        return;
      }
      if (this.howToPlayModal.classList.contains('active')) {
        this.howToPlayModal.classList.remove('active');
        return;
      }

      const isPaused = this.gameManager.togglePause();
      if (isPaused) {
        this.pauseMenuOverlay.classList.add('active');
        this.input.exitPointerLock();
      } else {
        this.pauseMenuOverlay.classList.remove('active');
        this.input.requestPointerLock();
      }
    };

    // 10. Player interaction prompt listener
    this.player.onInteractionPrompt = (prompt) => {
      if (prompt) {
        this.interactionPromptText.innerText = prompt;
        this.interactionPromptContainer.classList.add('show');
      } else {
        this.interactionPromptContainer.classList.remove('show');
      }
    };
  }

  public applySettingsToGame(): void {
    this.input.sensitivity = this.settings.mouseSensitivity;
    this.input.invertY = this.settings.invertY;
    this.audio.setVolumes(this.settings.masterVolume, this.settings.sfxVolume, this.settings.ambientVolume);
    this.player.setBaseFOV(this.settings.fov);
  }

  public showMainMenu(): void {
    this.hideAllMenus();
    this.mainMenuOverlay.classList.add('active');
    this.gameHud.style.display = 'none';
    this.input.exitPointerLock();
  }

  public showInGameHUD(): void {
    this.hideAllMenus();
    this.gameHud.style.display = 'flex';
  }

  public showLevelSelect(): void {
    this.hideAllMenus();
    this.levelSelectOverlay.classList.add('active');
    this.populateLevelList();
  }

  private populateLevelList(): void {
    this.levelListContainer.innerHTML = '';
    const stats = SaveManager.loadStats();

    LEVELS.forEach(lvl => {
      const isUnlocked = lvl.levelNumber <= stats.unlockedLevel;
      const card = document.createElement('div');
      card.className = `level-card-item ${isUnlocked ? '' : 'locked'}`;
      card.innerHTML = `
        <div class="level-card-info">
          <div class="level-card-name">LEVEL ${lvl.levelNumber}: ${lvl.title}</div>
          <div class="level-card-desc">${lvl.description}</div>
        </div>
        <div style="font-family: var(--font-display); font-size: 20px; color: ${isUnlocked ? '#2ecc71' : '#7f8c8d'}">
          ${isUnlocked ? '▶ PLAY' : '🔒 LOCKED'}
        </div>
      `;
      if (isUnlocked) {
        card.addEventListener('click', () => {
          this.hideAllMenus();
          if (this.onStartLevelRequested) this.onStartLevelRequested(lvl.levelNumber);
        });
      }
      this.levelListContainer.appendChild(card);
    });
  }

  public showSettings(): void {
    const sensInput = document.getElementById('setting-sensitivity') as HTMLInputElement;
    const masterVolInput = document.getElementById('setting-master-volume') as HTMLInputElement;
    const sfxVolInput = document.getElementById('setting-sfx-volume') as HTMLInputElement;
    const ambientVolInput = document.getElementById('setting-ambient-volume') as HTMLInputElement;
    const fovInput = document.getElementById('setting-fov') as HTMLInputElement;
    const timeSelect = document.getElementById('setting-time-of-day') as HTMLSelectElement;
    const graphicsSelect = document.getElementById('setting-graphics') as HTMLSelectElement;
    const invertYInput = document.getElementById('setting-invert-y') as HTMLInputElement;

    if (sensInput) sensInput.value = Math.round(this.settings.mouseSensitivity * 10000).toString();
    if (masterVolInput) masterVolInput.value = Math.round(this.settings.masterVolume * 100).toString();
    if (sfxVolInput) sfxVolInput.value = Math.round(this.settings.sfxVolume * 100).toString();
    if (ambientVolInput) ambientVolInput.value = Math.round((this.settings.ambientVolume ?? 0.6) * 100).toString();
    if (fovInput) fovInput.value = this.settings.fov.toString();
    if (timeSelect) timeSelect.value = this.settings.timeOfDay;
    if (graphicsSelect) graphicsSelect.value = this.settings.graphicsQuality;
    if (invertYInput) invertYInput.checked = this.settings.invertY;

    this.settingsModal.classList.add('active');
  }

  public showLevelComplete(config: LevelConfig, earnedXP: number, earnedCoins: number): void {
    this.hideAllMenus();
    this.input.exitPointerLock();

    document.getElementById('victory-subtitle')!.innerText = `${config.title.toUpperCase()} SECURED`;
    document.getElementById('victory-kills')!.innerText = this.gameManager.state.levelKills.toString();

    const mins = Math.floor(this.gameManager.state.survivalTime / 60);
    const secs = Math.floor(this.gameManager.state.survivalTime % 60);
    document.getElementById('victory-time')!.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    document.getElementById('victory-xp')!.innerText = `+${earnedXP} XP`;
    document.getElementById('victory-coins')!.innerText = `+${earnedCoins} 🪙`;

    const continueBtn = document.getElementById('btn-victory-continue') as HTMLButtonElement;
    if (config.levelNumber >= 5) {
      continueBtn.innerText = 'PLAY AGAIN';
    } else {
      continueBtn.innerText = `NEXT: LEVEL ${config.levelNumber + 1}`;
    }

    this.levelCompleteOverlay.classList.add('active');
  }

  public showGameOver(reason: string, stats: { kills: number; time: number; waveOrLevel: string; xp: number }): void {
    this.hideAllMenus();
    this.input.exitPointerLock();

    document.getElementById('game-over-subtitle')!.innerText = reason;
    document.getElementById('game-over-kills')!.innerText = stats.kills.toString();

    const mins = Math.floor(stats.time / 60);
    const secs = Math.floor(stats.time % 60);
    document.getElementById('game-over-time')!.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    document.getElementById('game-over-level-wave')!.innerText = stats.waveOrLevel.toUpperCase();
    document.getElementById('game-over-xp')!.innerText = `${stats.xp} XP`;

    this.gameOverOverlay.classList.add('active');
  }

  public hideAllMenus(): void {
    this.mainMenuOverlay.classList.remove('active');
    this.levelSelectOverlay.classList.remove('active');
    this.pauseMenuOverlay.classList.remove('active');
    this.levelCompleteOverlay.classList.remove('active');
    this.gameOverOverlay.classList.remove('active');
    this.settingsModal.classList.remove('active');
    this.howToPlayModal.classList.remove('active');
    this.clickToPlayOverlay.classList.remove('active');
  }

  public triggerHitmarker(isHeadshot: boolean = false): void {
    this.hitmarker.classList.remove('headshot');
    if (isHeadshot) {
      this.hitmarker.classList.add('headshot');
    }
    this.hitmarker.classList.add('show');
    this.hitmarkerTimer = 0.12;
  }

  public triggerDamageVignette(attackerPos?: THREE.Vector3): void {
    this.damageVignette.classList.add('hit');
    this.damageVignetteTimer = 0.18;

    if (attackerPos) {
      // Calculate angle from player to attacker relative to camera yaw
      const dx = attackerPos.x - this.player.position.x;
      const dz = attackerPos.z - this.player.position.z;
      const angleToAttacker = Math.atan2(dx, dz);
      const relativeAngle = angleToAttacker - this.player.yaw;

      this.damageIndicatorArc.style.transform = `translate(-50%, -50%) rotate(${relativeAngle}rad)`;
      this.damageIndicatorArc.classList.add('show');
      this.damageArcTimer = 0.45;
    }
  }

  public showToast(text: string, type: 'info' | 'success' | 'warning' | 'loot' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerText = text;
    this.hudNotifications.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 3000);
  }

  // Draw Real-Time Radar / Minimap
  private renderRadar(enemies: Enemy[]): void {
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const center = w / 2;
    const maxRange = 36; // meters shown on radar

    ctx.clearRect(0, 0, w, h);

    // Radar background grid & scan sweep
    ctx.fillStyle = '#0f1418';
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.fill();

    // Range rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, center * 0.4, 0, Math.PI * 2);
    ctx.arc(center, center, center * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // Player position & facing arrow (at center, pointing up)
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(center, center, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Facing needle
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center, center - 10);
    ctx.stroke();

    // Draw Enemies relative to player position and yaw
    const cosY = Math.cos(this.player.yaw);
    const sinY = Math.sin(this.player.yaw);

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.group.position.x - this.player.position.x;
      const dz = enemy.group.position.z - this.player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < maxRange) {
        // Rotate into player local coordinates
        const localX = dx * cosY - dz * sinY;
        const localZ = dx * sinY + dz * cosY;

        const screenX = center + (localX / maxRange) * (center - 6);
        const screenY = center - (localZ / maxRange) * (center - 6);

        // Blip
        ctx.fillStyle = enemy.type === 'BOSS' ? '#e74c3c' : (enemy.type === 'FAST' ? '#ff7675' : '#d63031');
        ctx.beginPath();
        ctx.arc(screenX, screenY, enemy.type === 'BOSS' ? 4.5 : 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  public updateHUD(state: GameState, stats: PlayerStats): void {
    // 1. Objectives
    if (state.mode === 'LEVEL') {
      this.hudModeTitle.innerText = `LEVEL ${state.levelNumber}`;
      const currentConfig = LEVELS.find(l => l.levelNumber === state.levelNumber);
      if (currentConfig?.spawnBoss) {
        const bossStatus = state.bossDefeated ? 'BOSS DEFEATED!' : (this.gameManager.enemyManager.bossSpawned ? 'DEFEAT BOSS!' : 'APPROACHING...');
        this.hudObjectiveDesc.innerText = `KILLS: ${state.levelKills} / ${state.targetKills} | ${bossStatus}`;
      } else {
        this.hudObjectiveDesc.innerText = `KILLS: ${state.levelKills} / ${state.targetKills}`;
      }
    } else {
      this.hudModeTitle.innerText = `WAVE ${state.currentWave}`;
      const remaining = Math.max(0, state.waveTotalEnemies - state.waveEnemiesKilled);
      const mins = Math.floor(state.survivalTime / 60);
      const secs = Math.floor(state.survivalTime % 60);
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      this.hudObjectiveDesc.innerText = `REMAINING: ${remaining} | TIME: ${timeStr}`;
    }

    // 2. RPG Panel
    this.hudPlayerLevel.innerText = `LVL ${stats.level}`;
    const nextLevelXP = getXPForNextLevel(stats.level);
    this.hudXpText.innerText = `${stats.xp} / ${nextLevelXP}`;
    const xpPercent = Math.min(100, Math.max(0, (stats.xp / nextLevelXP) * 100));
    this.hudXpBar.style.width = `${xpPercent}%`;
    this.hudCoinText.innerText = stats.coins.toString();
    this.hudKillsText.innerText = stats.totalKills.toString();

    // 3. Vitality & Stamina
    const hp = Math.max(0, Math.ceil(this.player.health));
    const maxHp = this.player.maxHealth;
    this.hudHealthValue.innerText = `${hp} / ${maxHp}`;
    const hpRatio = hp / maxHp;
    this.hudHealthBar.style.width = `${Math.max(0, Math.min(100, hpRatio * 100))}%`;

    if (hpRatio < 0.3) {
      this.hudHealthBar.classList.add('low');
      this.lowHealthVignette.classList.add('active');
    } else {
      this.hudHealthBar.classList.remove('low');
      this.lowHealthVignette.classList.remove('active');
    }

    // Stamina & Stance Badge
    const staminaRatio = (this.player.stamina / this.player.maxStamina) * 100;
    this.hudStaminaBar.style.width = `${staminaRatio}%`;

    if (this.player.isCrouching) {
      this.hudStanceBadge.innerText = 'CROUCH';
      this.hudStanceBadge.style.color = '#3498db';
    } else if (this.input.sprint && this.player.stamina > 5) {
      this.hudStanceBadge.innerText = 'SPRINT';
      this.hudStanceBadge.style.color = '#e67e22';
    } else {
      this.hudStanceBadge.innerText = 'STAND';
      this.hudStanceBadge.style.color = '#f1c40f';
    }

    // 4. Weapon Panel
    const weaponState = this.player.weapon.getState(this.input.isAiming);
    this.hudWeaponName.innerText = weaponState.activeWeaponIndex === 1 ? '9MM TACTICAL PISTOL' : 'TACTICAL COMBAT KNIFE';
    this.hudAmmoCurrent.innerText = weaponState.activeWeaponIndex === 1 ? weaponState.currentAmmo.toString() : '∞';
    this.hudAmmoReserve.innerText = weaponState.activeWeaponIndex === 1 ? weaponState.reserveAmmo.toString() : 'MELEE';

    this.hudGrenadeDisplay.innerText = `💣 x${weaponState.grenades}`;
    this.hudFlashlightDisplay.innerText = this.player.isFlashlightOn ? '🔦 ON' : '🔦 OFF';
    this.hudFlashlightDisplay.className = `tactical-item ${this.player.isFlashlightOn ? 'active' : ''}`;

    if (weaponState.activeWeaponIndex === 1 && weaponState.currentAmmo <= 3) {
      this.hudAmmoCurrent.classList.add('low');
      this.hudReloadPrompt.classList.add('show');
    } else {
      this.hudAmmoCurrent.classList.remove('low');
      this.hudReloadPrompt.classList.remove('show');
    }

    if (weaponState.isReloading) {
      this.hudReloadBar.classList.add('active');
      this.hudReloadFill.style.width = `${Math.min(100, weaponState.reloadProgress * 100)}%`;
      this.hudReloadPrompt.innerText = 'RELOADING...';
      this.hudReloadPrompt.classList.add('show');
    } else {
      this.hudReloadBar.classList.remove('active');
      this.hudReloadPrompt.innerText = '[R] RELOAD';
    }

    // 5. Crosshair dynamics
    if (this.input.isAiming) {
      this.crosshairContainer.classList.add('aiming');
    } else {
      this.crosshairContainer.classList.remove('aiming');
    }

    const isMoving = this.input.forward || this.input.backward || this.input.left || this.input.right;
    if (isMoving || this.input.sprint) {
      this.crosshairContainer.classList.add('spread');
    } else {
      this.crosshairContainer.classList.remove('spread');
    }
  }

  public update(delta: number, enemies: Enemy[]): void {
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= delta;
      if (this.hitmarkerTimer <= 0) this.hitmarker.classList.remove('show');
    }

    if (this.damageVignetteTimer > 0) {
      this.damageVignetteTimer -= delta;
      if (this.damageVignetteTimer <= 0) this.damageVignette.classList.remove('hit');
    }

    if (this.damageArcTimer > 0) {
      this.damageArcTimer -= delta;
      if (this.damageArcTimer <= 0) this.damageIndicatorArc.classList.remove('show');
    }

    this.renderRadar(enemies);
    this.updateHUD(this.gameManager.state, this.gameManager.stats);
  }
}
