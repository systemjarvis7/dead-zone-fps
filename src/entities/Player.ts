import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { AudioManager } from '../core/AudioManager';
import { VillageEnvironment } from '../world/VillageEnvironment';
import { Weapon } from './Weapon';

export class Player {
  public camera: THREE.PerspectiveCamera;
  public input: InputManager;
  public audio: AudioManager;
  public environment: VillageEnvironment;
  public weapon: Weapon;

  // Position & Physics
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.7, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public isGrounded: boolean = true;
  public readonly playerRadius: number = 0.55;

  // Eye Heights
  public readonly standingEyeHeight: number = 1.7;
  public readonly crouchingEyeHeight: number = 1.05;
  public currentEyeHeight: number = 1.7;
  public isCrouching: boolean = false;

  // Stamina
  public stamina: number = 100;
  public readonly maxStamina: number = 100;

  // Speeds
  public walkSpeed: number = 5.2;
  public sprintSpeed: number = 8.5;
  public crouchSpeed: number = 2.6;
  public jumpForce: number = 8.2;
  public gravity: number = 22.0;

  // Camera angles
  public pitch: number = 0;
  public yaw: number = 0;
  private cameraRoll: number = 0;

  // Health & Armor
  public health: number = 100;
  public maxHealth: number = 100;
  public armor: number = 0;
  public isDead: boolean = false;
  private invulnerabilityTimer: number = 0;

  // Flashlight
  public flashlight!: THREE.SpotLight;
  public flashlightTarget!: THREE.Object3D;
  public isFlashlightOn: boolean = false;

  // Head bobbing & Camera kinetics
  private bobTimer: number = 0;
  private footstepTimer: number = 0;
  private landingDip: number = 0;
  private baseFOV: number = 75;
  private adsFOV: number = 58;

  // Screen shake trauma
  public trauma: number = 0;

  // Callbacks
  public onTakeDamage?: (currentHealth: number, maxHealth: number, attackerPos?: THREE.Vector3) => void;
  public onDeath?: () => void;
  public onInteractionPrompt?: (prompt: string) => void;
  public hasInteractionPrompt: boolean = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    input: InputManager,
    audio: AudioManager,
    environment: VillageEnvironment,
    weapon: Weapon
  ) {
    this.camera = camera;
    this.input = input;
    this.audio = audio;
    this.environment = environment;
    this.weapon = weapon;

    this.baseFOV = camera.fov;
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';

    this.setupFlashlight();
  }

  private setupFlashlight(): void {
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -10);
    this.camera.add(this.flashlightTarget);

    // High-output tactical flashlight
    this.flashlight = new THREE.SpotLight(0xffffff, 0, 60, Math.PI / 4.5, 0.35, 1.1);
    this.flashlight.position.set(0.2, -0.15, 0.1);
    this.flashlight.target = this.flashlightTarget;
    this.flashlight.castShadow = false;
    this.camera.add(this.flashlight);
  }

  public toggleFlashlight(): void {
    this.isFlashlightOn = !this.isFlashlightOn;
    this.flashlight.intensity = this.isFlashlightOn ? 4.8 : 0;
    this.audio.playFlashlightToggle();
  }

  public setBaseFOV(fov: number): void {
    this.baseFOV = fov;
    this.adsFOV = fov - 17;
  }

  public setMaxHealth(maxHp: number): void {
    this.maxHealth = maxHp;
    this.health = Math.min(this.health, maxHp);
  }

  public heal(amount: number): number {
    if (this.isDead) return 0;
    const old = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - old;
  }

  public addArmor(amount: number): void {
    this.armor = Math.min(100, this.armor + amount);
  }

  public takeDamage(amount: number, attackerPos?: THREE.Vector3): void {
    if (this.isDead || this.invulnerabilityTimer > 0) return;

    // Armor absorption (absorbs 50% damage)
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.5);
      this.armor -= absorbed;
      amount -= absorbed;
    }

    this.health -= amount;
    this.invulnerabilityTimer = 0.25;
    this.trauma = Math.min(1.0, this.trauma + 0.55);

    this.audio.playPlayerHurt();

    if (this.onTakeDamage) {
      this.onTakeDamage(this.health, this.maxHealth, attackerPos);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      if (this.onDeath) {
        this.onDeath();
      }
    }
  }

  public reset(spawnPos = new THREE.Vector3(0, 1.7, 0)): void {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.pitch = 0;
    this.yaw = 0;
    this.health = this.maxHealth;
    this.armor = 0;
    this.stamina = 100;
    this.isDead = false;
    this.isCrouching = false;
    this.currentEyeHeight = this.standingEyeHeight;
    this.invulnerabilityTimer = 0;
    this.trauma = 0;
    this.landingDip = 0;
    this.weapon.reset();
  }

  public update(delta: number): void {
    if (this.isDead) return;

    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer -= delta;
    }

    // 1. Mouse Look (Yaw & Pitch)
    this.yaw -= this.input.deltaX;
    this.pitch -= this.input.deltaY;
    const maxPitch = (Math.PI / 2) * 0.94;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // 2. Crouch State & Smooth Eye Height Lerp
    this.isCrouching = this.input.crouch;
    const targetHeight = this.isCrouching ? this.crouchingEyeHeight : this.standingEyeHeight;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetHeight, 12 * delta);

    // 3. Movement Direction
    const forwardVec = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3(0, 0, 0);
    const hasAnalog = this.input.moveVector && (Math.abs(this.input.moveVector.x) > 0.04 || Math.abs(this.input.moveVector.y) > 0.04);

    if (hasAnalog) {
      moveDir.addScaledVector(forwardVec, this.input.moveVector.y);
      moveDir.addScaledVector(rightVec, this.input.moveVector.x);
    } else {
      if (this.input.forward) moveDir.add(forwardVec);
      if (this.input.backward) moveDir.sub(forwardVec);
      if (this.input.right) moveDir.add(rightVec);
      if (this.input.left) moveDir.sub(rightVec);
    }

    const isMoving = moveDir.lengthSq() > 0.001;
    if (isMoving) {
      moveDir.normalize();
    }

    // 4. Sprint & Stamina Mechanics (supports keyboard shift and mobile joystick push-forward)
    const isMovingForward = this.input.forward || (hasAnalog && this.input.moveVector.y > 0.35);
    const wantsToSprint = (this.input.sprint || (hasAnalog && this.input.moveVector.y > 0.75)) &&
      !this.input.isAiming && isMovingForward && !this.isCrouching;
    let isSprinting = false;

    if (wantsToSprint && this.stamina > 5) {
      isSprinting = true;
      this.stamina = Math.max(0, this.stamina - delta * 25);
    } else {
      // Regenerate stamina
      this.stamina = Math.min(this.maxStamina, this.stamina + delta * 20);
    }

    // Speed calculation
    let targetSpeed = this.walkSpeed;
    if (this.isCrouching) {
      targetSpeed = this.crouchSpeed;
    } else if (isSprinting) {
      targetSpeed = this.sprintSpeed;
    }

    const targetVelocityX = isMoving ? moveDir.x * targetSpeed : 0;
    const targetVelocityZ = isMoving ? moveDir.z * targetSpeed : 0;
    const accel = this.isGrounded ? 15 : 4;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelocityX, accel * delta);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelocityZ, accel * delta);

    // 5. Jump & Gravity
    if (this.isGrounded && this.input.jumpPressed && !this.isCrouching) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.audio.playJump();
    }

    const wasInAir = !this.isGrounded;
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * delta;
    }

    // 6. Update Position
    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;
    this.position.y += this.velocity.y * delta;

    // Ground check & Stairs step-up (supporting elevated platforms & watchtower stairs)
    const feetY = this.position.y - this.currentEyeHeight;
    const groundLevel = this.environment.getGroundHeightAt(this.position.x, this.position.z, feetY);
    let targetFloorY = groundLevel + this.currentEyeHeight;

    if (isMoving) {
      const stepCheck = this.environment.getGroundHeightAt(this.position.x, this.position.z, feetY + 0.38);
      if (stepCheck > groundLevel && stepCheck - groundLevel <= 0.45) {
        targetFloorY = stepCheck + this.currentEyeHeight;
      }
    }

    if (this.position.y <= targetFloorY + 0.08) {
      this.position.y = targetFloorY;
      this.velocity.y = 0;
      this.isGrounded = true;

      if (wasInAir) {
        this.landingDip = 0.12; // Camera dips on landing
        this.audio.playLanding();
      }
    } else {
      if (this.position.y > targetFloorY + 0.15) {
        this.isGrounded = false;
      }
    }

    if (this.landingDip > 0) {
      this.landingDip = Math.max(0, this.landingDip - delta * 0.8);
    }

    // 7. Wall Collision Check at Player Mid-Height
    const midY = this.position.y - this.currentEyeHeight * 0.5;
    const colResult = this.environment.checkSphereCollision(
      new THREE.Vector3(this.position.x, midY, this.position.z),
      this.playerRadius
    );
    if (colResult.hit) {
      this.position.x += colResult.pushVector.x;
      this.position.z += colResult.pushVector.z;
    }

    // Map Boundaries Clamp
    this.position.x = Math.max(-57, Math.min(57, this.position.x));
    this.position.z = Math.max(-57, Math.min(57, this.position.z));

    // 8. Footstep Audio Timing
    if (this.isGrounded && isMoving) {
      this.footstepTimer += delta;
      const stepInterval = isSprinting ? 0.3 : 0.48;
      if (this.footstepTimer >= stepInterval) {
        this.footstepTimer = 0;
        this.audio.playFootstep(isSprinting);
      }
    } else {
      this.footstepTimer = 0;
    }

    // 9. Camera Bobbing & Kinetic Roll
    let bobVertical = 0;
    let bobHorizontal = 0;
    if (this.isGrounded && isMoving && !this.input.isAiming) {
      const bobFreq = isSprinting ? 14 : 9;
      this.bobTimer += delta * bobFreq;
      bobVertical = Math.sin(this.bobTimer) * (isSprinting ? 0.055 : 0.03);
      bobHorizontal = Math.cos(this.bobTimer * 0.5) * (isSprinting ? 0.035 : 0.018);
    } else {
      this.bobTimer = 0;
    }

    // Strafe roll (camera leans slightly when strafing left/right)
    let targetRoll = 0;
    if (this.input.left) targetRoll = 0.025;
    if (this.input.right) targetRoll = -0.025;
    this.cameraRoll = THREE.MathUtils.lerp(this.cameraRoll, targetRoll, 10 * delta);

    // 10. Screen Trauma Shake
    let shakePitch = 0, shakeYaw = 0, shakeRoll = 0;
    if (this.trauma > 0) {
      const amt = this.trauma * this.trauma;
      const freq = performance.now() * 0.03;
      shakePitch = Math.sin(freq) * 0.04 * amt;
      shakeYaw = Math.cos(freq * 1.3) * 0.04 * amt;
      shakeRoll = Math.sin(freq * 0.8) * 0.025 * amt;
      this.trauma = Math.max(0, this.trauma - delta * 1.5);
    }

    // 11. Apply Camera Transform
    this.camera.position.set(
      this.position.x + bobHorizontal,
      this.position.y - this.landingDip + bobVertical,
      this.position.z
    );
    this.camera.rotation.set(
      this.pitch + shakePitch,
      this.yaw + shakeYaw,
      this.cameraRoll + shakeRoll,
      'YXZ'
    );

    // 12. Dynamic ADS FOV (Sniper scope 4x zoom)
    let targetFOV = this.baseFOV;
    if (this.input.isAiming) {
      if (this.weapon.activeWeaponIndex === 3) {
        targetFOV = 20; // 4x Sniper Scope Zoom
      } else {
        targetFOV = this.adsFOV;
      }
    }
    if (Math.abs(this.camera.fov - targetFOV) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 16 * delta);
      this.camera.updateProjectionMatrix();
    }

    // 13. Action Inputs
    if (this.input.flashlightPressed) {
      this.toggleFlashlight();
    }
    if (this.input.reloadPressed) {
      this.weapon.reload();
    }
    if (this.input.weapon1Pressed) {
      this.weapon.setWeapon(1);
    }
    if (this.input.weapon2Pressed) {
      this.weapon.setWeapon(2);
    }
    if (this.input.weapon3Pressed) {
      this.weapon.setWeapon(3);
    }
    if (this.input.weaponCycleNext) {
      this.weapon.cycleWeapon(true);
    }
    if (this.input.weaponCyclePrev) {
      this.weapon.cycleWeapon(false);
    }

    // Grenade Pre-throw Trajectory Arc & Throw
    if (this.input.grenadeHolding) {
      this.weapon.updateGrenadeTrajectory(true, this.environment);
    } else if (this.input.grenadeJustReleased) {
      this.weapon.throwGrenade();
      this.weapon.updateGrenadeTrajectory(false, this.environment);
    } else {
      this.weapon.updateGrenadeTrajectory(false, this.environment);
    }

    // 14. World Interaction Prompt Check (Door / Crate / Generator / Supply Depot)
    let promptText = '';
    const depotPos = this.environment.supplyDepotPosition;
    const distToDepot = Math.hypot(this.position.x - depotPos.x, this.position.z - depotPos.z);

    if (distToDepot < 2.8) {
      if (this.environment.supplyCooldown <= 0) {
        promptText = '[E] RESUPPLY WEAPONS & GRENADES';
        if (this.input.interactPressed) {
          this.weapon.resupplyAll();
          this.environment.supplyCooldown = this.environment.supplyCooldownMax;
          this.audio.playPickup(2 as any);
        }
      } else {
        const cd = Math.ceil(this.environment.supplyCooldown);
        promptText = `SUPPLY DEPOT CHARGING (${cd}s)`;
      }
    } else {
      const interaction = this.environment.checkInteractionTarget(this.position);
      promptText = interaction.prompt;

      if (this.input.interactPressed && interaction.targetType) {
        const res = this.environment.interactWith({
          targetType: interaction.targetType,
          targetObj: interaction.targetObj
        });

        if (res.loot) {
          if (res.loot === 'ammo') {
            this.weapon.addAmmo(30);
            this.audio.playPickup(2 as any);
          } else if (res.loot === 'health') {
            this.heal(40);
            this.audio.playPickup(1 as any);
          } else if (res.loot === 'grenade') {
            this.weapon.addGrenades(2);
            this.audio.playPickup(4 as any);
          }
        }
      }
    }

    this.hasInteractionPrompt = Boolean(promptText);
    if (this.onInteractionPrompt) {
      this.onInteractionPrompt(promptText);
    }
  }
}
