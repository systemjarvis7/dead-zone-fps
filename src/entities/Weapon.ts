import * as THREE from 'three';
import { AudioManager } from '../core/AudioManager';
import { ParticleSystem } from './Particles';

export interface WeaponState {
  currentAmmo: number;
  reserveAmmo: number;
  maxMagazine: number;
  isReloading: boolean;
  reloadProgress: number; // 0 to 1
  isAiming: boolean;
}

export interface HitResult {
  hit: boolean;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  target?: any;
  isHeadshot?: boolean;
}

export class Weapon {
  public camera: THREE.PerspectiveCamera;
  public audio: AudioManager;
  public particles: ParticleSystem;

  // Specs
  public readonly damage: number = 25;
  public readonly headshotMultiplier: number = 2.0;
  public readonly maxMagazine: number = 12;
  public currentAmmo: number = 12;
  public reserveAmmo: number = 48;
  public readonly reloadTime: number = 2.0; // seconds

  // State
  public isReloading: boolean = false;
  private reloadTimer: number = 0;
  private fireCooldown: number = 0;
  private readonly minFireInterval: number = 0.2; // semi-auto fire limit

  // Viewmodel Group & Meshes
  public viewmodelGroup: THREE.Group;
  private pistolGroup: THREE.Group;
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private muzzleFlashTimer: number = 0;

  // Recoil & Aiming positions
  private hipPosition = new THREE.Vector3(0.24, -0.22, -0.44);
  private adsPosition = new THREE.Vector3(0.0, -0.145, -0.32);
  private currentAimPos = new THREE.Vector3();
  private recoilOffset = new THREE.Vector3();
  private recoilRotation = new THREE.Euler();

  // Weapon sway
  private swayOffset = new THREE.Vector2();

  // Raycaster for hit detection
  private raycaster = new THREE.Raycaster();

  // Callbacks
  public onShoot?: () => void;
  public onReloadStart?: () => void;
  public onReloadFinish?: () => void;
  public onHitEnemy?: (damage: number, isHeadshot: boolean, hitPoint: THREE.Vector3) => void;

  constructor(camera: THREE.PerspectiveCamera, audio: AudioManager, particles: ParticleSystem) {
    this.camera = camera;
    this.audio = audio;
    this.particles = particles;

    this.viewmodelGroup = new THREE.Group();
    this.pistolGroup = new THREE.Group();
    this.viewmodelGroup.add(this.pistolGroup);
    this.camera.add(this.viewmodelGroup);

    this.currentAimPos.copy(this.hipPosition);
    this.pistolGroup.position.copy(this.hipPosition);

    // Build the procedural pistol model
    this.buildPistolModel();

    // Muzzle flash mesh & light
    const flashGeo = new THREE.ConeGeometry(0.08, 0.25, 6);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.9
    });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.05, -0.32);
    this.muzzleFlashMesh.visible = false;
    this.pistolGroup.add(this.muzzleFlashMesh);

    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 8);
    this.muzzleLight.position.set(0, 0.05, -0.35);
    this.pistolGroup.add(this.muzzleLight);
  }

  private buildPistolModel(): void {
    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      roughness: 0.35,
      metalness: 0.85
    });

    const polymerMat = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.85,
      metalness: 0.1
    });

    const sightGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66
    });

    // 1. Lower Frame & Grip
    const gripGeo = new THREE.BoxGeometry(0.038, 0.13, 0.055);
    const grip = new THREE.Mesh(gripGeo, polymerMat);
    grip.position.set(0, -0.065, 0.015);
    grip.rotation.x = 0.2;
    this.pistolGroup.add(grip);

    // Trigger Guard
    const guardGeo = new THREE.BoxGeometry(0.02, 0.045, 0.05);
    const guard = new THREE.Mesh(guardGeo, polymerMat);
    guard.position.set(0, -0.03, -0.025);
    this.pistolGroup.add(guard);

    // 2. Slide
    const slideGeo = new THREE.BoxGeometry(0.042, 0.048, 0.24);
    const slide = new THREE.Mesh(slideGeo, gunmetalMat);
    slide.position.set(0, 0.024, -0.08);
    this.pistolGroup.add(slide);

    // 3. Barrel Tip
    const barrelGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, gunmetalMat);
    barrel.position.set(0, 0.025, -0.21);
    this.pistolGroup.add(barrel);

    // 4. Front Sight (with green tritium dot)
    const frontSightGeo = new THREE.BoxGeometry(0.008, 0.012, 0.012);
    const frontSight = new THREE.Mesh(frontSightGeo, gunmetalMat);
    frontSight.position.set(0, 0.052, -0.19);
    this.pistolGroup.add(frontSight);

    const frontDotGeo = new THREE.SphereGeometry(0.003, 6, 6);
    const frontDot = new THREE.Mesh(frontDotGeo, sightGlowMat);
    frontDot.position.set(0, 0.053, -0.184);
    this.pistolGroup.add(frontDot);

    // 5. Rear Sights (two green dots on sides)
    const rearSightGeo = new THREE.BoxGeometry(0.036, 0.012, 0.01);
    const rearSight = new THREE.Mesh(rearSightGeo, gunmetalMat);
    rearSight.position.set(0, 0.052, 0.03);
    this.pistolGroup.add(rearSight);

    const rearDotLeft = new THREE.Mesh(frontDotGeo, sightGlowMat);
    rearDotLeft.position.set(-0.012, 0.053, 0.026);
    this.pistolGroup.add(rearDotLeft);

    const rearDotRight = new THREE.Mesh(frontDotGeo, sightGlowMat);
    rearDotRight.position.set(0.012, 0.053, 0.026);
    this.pistolGroup.add(rearDotRight);
  }

  public shoot(shootables: THREE.Object3D[], enemyObjects: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[]): boolean {
    if (this.isReloading) return false;

    if (this.currentAmmo <= 0) {
      this.audio.playEmptyClick();
      // Auto reload if out of ammo and reserve exists
      if (this.reserveAmmo > 0) {
        this.reload();
      }
      return false;
    }

    if (this.fireCooldown > 0) return false;

    // Deduct bullet
    this.currentAmmo--;
    this.fireCooldown = this.minFireInterval;

    // Sound
    this.audio.playGunshot();

    // Muzzle flash effect
    this.muzzleFlashTimer = 0.06;
    this.muzzleFlashMesh.visible = true;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    this.muzzleLight.intensity = 2.5;

    // Viewmodel Recoil Kick
    this.recoilOffset.z = 0.07;
    this.recoilOffset.y = 0.02;
    this.recoilRotation.x = 0.18;
    this.recoilRotation.y = (Math.random() - 0.5) * 0.03;

    if (this.onShoot) {
      this.onShoot();
    }

    // Raycast Hit Detection from Camera Center
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    // Collect all candidate target meshes
    const enemyMeshes: THREE.Object3D[] = [];
    const meshToEnemyMap = new Map<THREE.Object3D, { obj: typeof enemyObjects[0]; isHead: boolean }>();

    for (const enemy of enemyObjects) {
      enemy.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          enemyMeshes.push(child);
          const isHead = child.name === 'Head' || child.name === 'head';
          meshToEnemyMap.set(child, { obj: enemy, isHead });
        }
      });
    }

    const allTargets = [...enemyMeshes, ...shootables];
    const intersects = this.raycaster.intersectObjects(allTargets, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const enemyEntry = meshToEnemyMap.get(hit.object);

      if (enemyEntry) {
        // Hit enemy!
        const isHeadshot = enemyEntry.isHead;
        const totalDmg = isHeadshot ? this.damage * this.headshotMultiplier : this.damage;

        enemyEntry.obj.takeDamage(totalDmg, isHeadshot);

        // Sound & hitmarker
        this.audio.playFleshImpact();
        this.audio.playHitmarker(isHeadshot);

        // Blood particles
        const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        this.particles.spawnBlood(hit.point, normal, isHeadshot ? 20 : 12);

        if (this.onHitEnemy) {
          this.onHitEnemy(totalDmg, isHeadshot, hit.point);
        }
      } else {
        // Hit wall / ground / environment
        this.audio.playWallHit();
        const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        this.particles.spawnSparks(hit.point, normal, 10);
      }
    }

    return true;
  }

  public reload(): boolean {
    if (this.isReloading) return false;
    if (this.currentAmmo === this.maxMagazine) return false;
    if (this.reserveAmmo <= 0) return false;

    this.isReloading = true;
    this.reloadTimer = 0;
    this.audio.playReload();

    if (this.onReloadStart) {
      this.onReloadStart();
    }
    return true;
  }

  public addAmmo(amount: number): void {
    this.reserveAmmo += amount;
  }

  public reset(current = 12, reserve = 48): void {
    this.currentAmmo = current;
    this.reserveAmmo = reserve;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.muzzleFlashTimer = 0;
    this.muzzleFlashMesh.visible = false;
    this.muzzleLight.intensity = 0;
  }

  public getState(isAiming: boolean): WeaponState {
    return {
      currentAmmo: this.currentAmmo,
      reserveAmmo: this.reserveAmmo,
      maxMagazine: this.maxMagazine,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? this.reloadTimer / this.reloadTime : 0,
      isAiming
    };
  }

  public update(delta: number, isAiming: boolean, mouseDeltaX: number, mouseDeltaY: number): void {
    // Fire cooldown
    if (this.fireCooldown > 0) {
      this.fireCooldown -= delta;
    }

    // Muzzle flash timer
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }

    // Reload logic
    if (this.isReloading) {
      this.reloadTimer += delta;

      // Reload animation: dip down and return
      const progress = this.reloadTimer / this.reloadTime;
      if (progress < 0.5) {
        this.recoilOffset.y = -Math.sin(progress * Math.PI) * 0.18;
        this.recoilRotation.z = Math.sin(progress * Math.PI) * 0.25;
      } else {
        this.recoilOffset.y = -Math.sin(progress * Math.PI) * 0.18;
        this.recoilRotation.z = Math.sin(progress * Math.PI) * 0.25;
      }

      if (this.reloadTimer >= this.reloadTime) {
        const needed = this.maxMagazine - this.currentAmmo;
        const available = Math.min(needed, this.reserveAmmo);
        this.currentAmmo += available;
        this.reserveAmmo -= available;
        this.isReloading = false;
        this.reloadTimer = 0;

        if (this.onReloadFinish) {
          this.onReloadFinish();
        }
      }
    }

    // ADS vs Hip-fire position target
    const targetPos = isAiming && !this.isReloading ? this.adsPosition : this.hipPosition;
    this.currentAimPos.lerp(targetPos, 14 * delta);

    // Weapon sway based on mouse look
    const swayTargetX = -mouseDeltaX * 0.008;
    const swayTargetY = -mouseDeltaY * 0.008;
    this.swayOffset.x = THREE.MathUtils.lerp(this.swayOffset.x, swayTargetX, 10 * delta);
    this.swayOffset.y = THREE.MathUtils.lerp(this.swayOffset.y, swayTargetY, 10 * delta);

    // Spring recovery for recoil
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), 12 * delta);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, 14 * delta);
    this.recoilRotation.y = THREE.MathUtils.lerp(this.recoilRotation.y, 0, 14 * delta);

    // Apply combined transform
    this.pistolGroup.position.set(
      this.currentAimPos.x + this.swayOffset.x + this.recoilOffset.x,
      this.currentAimPos.y + this.swayOffset.y + this.recoilOffset.y,
      this.currentAimPos.z + this.recoilOffset.z
    );

    this.pistolGroup.rotation.set(
      this.recoilRotation.x,
      this.recoilRotation.y + this.swayOffset.x * 0.8,
      this.recoilRotation.z
    );
  }
}
