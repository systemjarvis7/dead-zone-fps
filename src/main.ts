import * as THREE from 'three';
import { AudioManager } from './core/AudioManager';
import { InputManager } from './core/InputManager';
import { SaveManager } from './core/SaveManager';
import { ParticleSystem } from './entities/Particles';
import { VillageEnvironment } from './world/VillageEnvironment';
import { Weapon } from './entities/Weapon';
import { Player } from './entities/Player';
import { EnemyManager } from './managers/EnemyManager';
import { GameManager } from './managers/GameManager';
import { UIManager } from './ui/UIManager';
import { TimeOfDay, GraphicsQuality } from './core/Types';

class GameApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;

  private audio: AudioManager;
  private input: InputManager;
  private particles: ParticleSystem;
  private environment: VillageEnvironment;
  private weapon: Weapon;
  private player: Player;
  private enemyManager: EnemyManager;
  private gameManager: GameManager;
  private uiManager: UIManager;

  private isInGame: boolean = false;
  private menuOrbitAngle: number = 0;

  constructor() {
    const container = document.getElementById('game-canvas-container')!;

    // 1. Scene & Renderer setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 220);
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    // 2. Systems initialization
    this.audio = new AudioManager();
    const settings = SaveManager.loadSettings();
    this.audio.init(settings);

    this.input = new InputManager(this.renderer.domElement);
    this.particles = new ParticleSystem(this.scene);
    this.environment = new VillageEnvironment(this.scene, this.audio, settings.timeOfDay || TimeOfDay.DUSK);
    this.weapon = new Weapon(this.camera, this.audio, this.particles);
    this.player = new Player(this.camera, this.input, this.audio, this.environment, this.weapon);
    this.enemyManager = new EnemyManager(this.scene, this.audio, this.environment);
    this.gameManager = new GameManager(this.player, this.enemyManager, this.audio);
    this.uiManager = new UIManager(this.gameManager, this.audio, this.input, this.player);

    // 3. Connect callbacks
    this.setupInteractions();

    // 4. Window Resize Listener
    window.addEventListener('resize', () => this.onWindowResize());

    // 5. Initial Menu Camera Pose
    this.setupMenuCamera();

    // 6. Start Render Loop
    this.animate();
  }

  private setupInteractions(): void {
    // Weapon hit callback -> hitmarker in UI
    this.weapon.onHitEnemy = (_dmg, isHeadshot) => {
      this.uiManager.triggerHitmarker(isHeadshot);
    };

    // Player damage callback -> screen damage vignette with directional arc
    this.player.onTakeDamage = (_curr, _max, attackerPos) => {
      this.uiManager.triggerDamageVignette(attackerPos);
    };

    // Game Manager notifications -> toast
    this.gameManager.onNotification = (text, type) => {
      this.uiManager.showToast(text, type);
    };

    // Level Complete -> UI dialog
    this.gameManager.onLevelComplete = (config, xp, coins) => {
      this.uiManager.showLevelComplete(config, xp, coins);
    };

    // Game Over -> UI dialog
    this.gameManager.onGameOver = (reason, stats) => {
      this.uiManager.showGameOver(reason, stats);
    };

    // Time of Day and Graphics Quality changes from Settings
    this.uiManager.onTimeOfDayChanged = (time) => {
      this.environment.setTimeOfDay(time);
    };

    this.uiManager.onGraphicsQualityChanged = (quality) => {
      if (quality === GraphicsQuality.LOW) {
        this.renderer.setPixelRatio(1.0);
        this.renderer.shadowMap.enabled = false;
      } else if (quality === GraphicsQuality.MEDIUM) {
        this.renderer.setPixelRatio(1.0);
        this.renderer.shadowMap.enabled = true;
      } else {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
      }
    };

    // UI requests start level
    this.uiManager.onStartLevelRequested = (levelNum) => {
      this.isInGame = true;
      this.uiManager.showInGameHUD();
      this.gameManager.startLevel(levelNum);
      this.input.requestPointerLock();
    };

    // UI requests start survival
    this.uiManager.onStartSurvivalRequested = () => {
      this.isInGame = true;
      this.uiManager.showInGameHUD();
      this.gameManager.startSurvival(1);
      this.input.requestPointerLock();
    };

    // UI requests restart
    this.uiManager.onRestartRequested = () => {
      this.isInGame = true;
      this.uiManager.showInGameHUD();
      if (this.gameManager.state.mode === 'LEVEL') {
        this.gameManager.startLevel(this.gameManager.state.levelNumber);
      } else {
        this.gameManager.startSurvival(1);
      }
      this.input.requestPointerLock();
    };

    // UI requests return to main menu
    this.uiManager.onReturnToMainMenuRequested = () => {
      this.isInGame = false;
      this.enemyManager.reset();
      this.uiManager.showMainMenu();
      this.setupMenuCamera();
    };
  }

  private setupMenuCamera(): void {
    this.camera.position.set(-15, 8, 22);
    this.camera.lookAt(0, 2, 0);
    this.weapon.viewmodelGroup.visible = false;
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    this.environment.update(elapsedTime);

    if (this.isInGame) {
      this.weapon.viewmodelGroup.visible = true;

      const shootables = this.environment.shootableMeshes;
      const enemyTargets = this.enemyManager.getShootableEnemyObjects();

      // Combat Input Checks (Shooting & Melee Strike)
      if (
        this.input.isLocked() &&
        !this.gameManager.state.isPaused &&
        !this.gameManager.state.isGameOver &&
        !this.gameManager.state.isLevelCompleted
      ) {
        if (this.input.shootJustPressed) {
          this.weapon.shoot(shootables, enemyTargets);
        }
        if (this.input.meleePressed) {
          this.weapon.performMelee(enemyTargets);
        }
      }

      // Update Player, Camera, Weapon
      this.player.update(delta);
      this.weapon.update(delta, this.input.isAiming, this.input.deltaX, this.input.deltaY, enemyTargets);

      // Update Particles
      this.particles.update(delta);

      // Update Game Manager (Spawning, Objectives, Wave Progress)
      this.gameManager.update(delta);

      // Update UI HUD & Radar
      this.uiManager.update(delta, this.enemyManager.enemies);

      // Reset one-shot input deltas
      this.input.resetFrameDeltas();
    } else {
      // Main Menu: Cinematic orbiting camera
      this.weapon.viewmodelGroup.visible = false;
      this.menuOrbitAngle += delta * 0.08;
      const radius = 28;
      this.camera.position.x = Math.sin(this.menuOrbitAngle) * radius;
      this.camera.position.z = Math.cos(this.menuOrbitAngle) * radius;
      this.camera.position.y = 7 + Math.sin(this.menuOrbitAngle * 0.5) * 2;
      this.camera.lookAt(0, 1.5, 0);
    }

    this.renderer.render(this.scene, this.camera);
  };
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
