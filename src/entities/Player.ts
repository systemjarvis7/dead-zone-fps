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
  public readonly eyeHeight: number = 1.7;

  // Speeds
  public walkSpeed: number = 5.2;
  public sprintSpeed: number = 8.5;
  public jumpForce: number = 8.2;
  public gravity: number = 22.0;

  // Camera angles
  public pitch: number = 0; // vertical look
  public yaw: number = 0;   // horizontal look

  // Health
  public health: number = 100;
  public maxHealth: number = 100;
  public isDead: boolean = false;
  private invulnerabilityTimer: number = 0;

  // Head bobbing & FOV
  private bobTimer: number = 0;
  private baseFOV: number = 75;
  private adsFOV: number = 58;

  // Screen shake
  public trauma: number = 0;

  // Callbacks
  public onTakeDamage?: (currentHealth: number, maxHealth: number) => void;
  public onDeath?: () => void;

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

  public takeDamage(amount: number): void {
    if (this.isDead || this.invulnerabilityTimer > 0) return;

    this.health -= amount;
    this.invulnerabilityTimer = 0.25; // brief iframe
    this.trauma = Math.min(1.0, this.trauma + 0.5);

    this.audio.playPlayerHurt();

    if (this.onTakeDamage) {
      this.onTakeDamage(this.health, this.maxHealth);
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
    this.isDead = false;
    this.invulnerabilityTimer = 0;
    this.trauma = 0;
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
    // Clamp pitch between -85 and +85 degrees
    const maxPitch = (Math.PI / 2) * 0.94;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // 2. Movement Direction relative to camera yaw
    const forwardVec = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.input.forward) moveDir.add(forwardVec);
    if (this.input.backward) moveDir.sub(forwardVec);
    if (this.input.right) moveDir.add(rightVec);
    if (this.input.left) moveDir.sub(rightVec);

    const isMoving = moveDir.lengthSq() > 0.001;
    if (isMoving) {
      moveDir.normalize();
    }

    // 3. Sprinting & Speed
    // Cannot sprint while aiming or moving backward
    const canSprint = this.input.sprint && !this.input.isAiming && this.input.forward;
    const targetSpeed = canSprint ? this.sprintSpeed : this.walkSpeed;

    // Smooth horizontal acceleration
    const targetVelocityX = isMoving ? moveDir.x * targetSpeed : 0;
    const targetVelocityZ = isMoving ? moveDir.z * targetSpeed : 0;

    const accel = this.isGrounded ? 15 : 4;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelocityX, accel * delta);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelocityZ, accel * delta);

    // 4. Jumping & Gravity
    if (this.isGrounded && this.input.jumpPressed) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * delta;
    }

    // 5. Update Position
    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;
    this.position.y += this.velocity.y * delta;

    // Ground check
    if (this.position.y <= this.eyeHeight) {
      this.position.y = this.eyeHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // 6. Wall & Obstacle Collision Check
    const colResult = this.environment.checkSphereCollision(
      new THREE.Vector3(this.position.x, 1.0, this.position.z),
      this.playerRadius
    );
    if (colResult.hit) {
      this.position.x += colResult.pushVector.x;
      this.position.z += colResult.pushVector.z;
    }

    // Map Boundaries Clamp (-58 to 58)
    this.position.x = Math.max(-57, Math.min(57, this.position.x));
    this.position.z = Math.max(-57, Math.min(57, this.position.z));

    // 7. Head Bobbing
    let bobOffset = 0;
    if (this.isGrounded && isMoving && !this.input.isAiming) {
      const bobFreq = canSprint ? 14 : 9;
      this.bobTimer += delta * bobFreq;
      bobOffset = Math.sin(this.bobTimer) * (canSprint ? 0.055 : 0.03);
    } else {
      this.bobTimer = 0;
    }

    // 8. Screen Trauma (Decay)
    let shakePitch = 0;
    let shakeYaw = 0;
    let shakeRoll = 0;
    if (this.trauma > 0) {
      const shakeAmt = this.trauma * this.trauma;
      const shakeFreq = performance.now() * 0.03;
      shakePitch = Math.sin(shakeFreq) * 0.035 * shakeAmt;
      shakeYaw = Math.cos(shakeFreq * 1.3) * 0.035 * shakeAmt;
      shakeRoll = Math.sin(shakeFreq * 0.8) * 0.02 * shakeAmt;
      this.trauma = Math.max(0, this.trauma - delta * 1.5);
    }

    // 9. Apply Camera Transform
    this.camera.position.set(this.position.x, this.position.y + bobOffset, this.position.z);
    this.camera.rotation.set(
      this.pitch + shakePitch,
      this.yaw + shakeYaw,
      shakeRoll,
      'YXZ'
    );

    // 10. Dynamic FOV (Aim Down Sights Zoom)
    const targetFOV = this.input.isAiming ? this.adsFOV : this.baseFOV;
    if (Math.abs(this.camera.fov - targetFOV) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 14 * delta);
      this.camera.updateProjectionMatrix();
    }

    // 11. Handle Reload Input
    if (this.input.reloadPressed) {
      this.weapon.reload();
    }

    // 12. Weapon Viewmodel Update
    this.weapon.update(delta, this.input.isAiming, this.input.deltaX, this.input.deltaY);
  }
}
