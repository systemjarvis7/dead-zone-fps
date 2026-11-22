import * as THREE from 'three';
import { AudioManager } from '../core/AudioManager';
import { ParticleSystem } from './Particles';

export interface WeaponState {
  currentAmmo: number;
  reserveAmmo: number;
  maxMagazine: number;
  isReloading: boolean;
  reloadProgress: number;
  isAiming: boolean;
  activeWeaponIndex: number; // 1: Pistol, 2: Knife
  grenades: number;
}

export interface GrenadeProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  exploded: boolean;
}

export interface ShellCasing {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
}

export class Weapon {
  public camera: THREE.PerspectiveCamera;
  public audio: AudioManager;
  public particles: ParticleSystem;

  // Specs - Pistol
  public readonly damage: number = 25;
  public readonly headshotMultiplier: number = 2.0;
  public readonly maxMagazine: number = 12;
  public currentAmmo: number = 12;
  public reserveAmmo: number = 48;
  public readonly reloadTime: number = 2.0;

  // Grenades & Melee
  public grenades: number = 3;
  public activeWeaponIndex: number = 1; // 1: Pistol, 2: Combat Knife
  private meleeCooldown: number = 0;
  private isMeleeAttacking: boolean = false;
  private meleeTimer: number = 0;

  // State
  public isReloading: boolean = false;
  private reloadTimer: number = 0;
  private fireCooldown: number = 0;
  private readonly minFireInterval: number = 0.2;

  // Viewmodel Group & Meshes
  public viewmodelGroup: THREE.Group;
  private pistolGroup: THREE.Group;
  private slideMesh!: THREE.Mesh;
  private knifeGroup: THREE.Group;

  // Visual Effects
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private muzzleFlashTimer: number = 0;

  // Positions
  private hipPosition = new THREE.Vector3(0.24, -0.22, -0.44);
  private adsPosition = new THREE.Vector3(0.0, -0.145, -0.32);
  private currentAimPos = new THREE.Vector3();
  private recoilOffset = new THREE.Vector3();
  private recoilRotation = new THREE.Euler();
  private slideOffset: number = 0;
  private swayOffset = new THREE.Vector2();

  // Active Projectiles & Physics Shells
  public activeGrenades: GrenadeProjectile[] = [];
  public activeShells: ShellCasing[] = [];

  // Raycaster
  private raycaster = new THREE.Raycaster();

  // Callbacks
  public onShoot?: () => void;
  public onReloadStart?: () => void;
  public onReloadFinish?: () => void;
  public onHitEnemy?: (damage: number, isHeadshot: boolean, hitPoint: THREE.Vector3) => void;
  public onGrenadeExplode?: (pos: THREE.Vector3, radius: number, damage: number) => void;

  constructor(camera: THREE.PerspectiveCamera, audio: AudioManager, particles: ParticleSystem) {
    this.camera = camera;
    this.audio = audio;
    this.particles = particles;

    this.viewmodelGroup = new THREE.Group();
    this.pistolGroup = new THREE.Group();
    this.knifeGroup = new THREE.Group();

    this.viewmodelGroup.add(this.pistolGroup);
    this.viewmodelGroup.add(this.knifeGroup);
    this.camera.add(this.viewmodelGroup);

    this.currentAimPos.copy(this.hipPosition);
    this.pistolGroup.position.copy(this.hipPosition);

    this.buildPistolModel();
    this.buildKnifeModel();
    this.setWeapon(1);

    // Muzzle flash mesh & light
    const flashGeo = new THREE.ConeGeometry(0.08, 0.25, 6);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.05, -0.32);
    this.muzzleFlashMesh.visible = false;
    this.pistolGroup.add(this.muzzleFlashMesh);

    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 9);
    this.muzzleLight.position.set(0, 0.05, -0.35);
    this.pistolGroup.add(this.muzzleLight);
  }

  private buildPistolModel(): void {
    const gunmetalMat = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.35, metalness: 0.85 });
    const polymerMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85, metalness: 0.1 });
    const sightGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });

    // 1. Lower Receiver & Textured Grip
    const gripGeo = new THREE.BoxGeometry(0.038, 0.13, 0.055);
    const grip = new THREE.Mesh(gripGeo, polymerMat);
    grip.position.set(0, -0.065, 0.015);
    grip.rotation.x = 0.2;
    this.pistolGroup.add(grip);

    // Trigger Guard & Trigger
    const guardGeo = new THREE.BoxGeometry(0.02, 0.045, 0.05);
    const guard = new THREE.Mesh(guardGeo, polymerMat);
    guard.position.set(0, -0.03, -0.025);
    this.pistolGroup.add(guard);

    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.012), gunmetalMat);
    trigger.position.set(0, -0.025, -0.022);
    this.pistolGroup.add(trigger);

    // 2. Animated Slide (blowback on fire)
    const slideGeo = new THREE.BoxGeometry(0.042, 0.048, 0.24);
    this.slideMesh = new THREE.Mesh(slideGeo, gunmetalMat);
    this.slideMesh.position.set(0, 0.024, -0.08);
    this.pistolGroup.add(this.slideMesh);

    // Ejection Port Indent
    const ejectPort = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.02, 0.045),
      new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.9 })
    );
    ejectPort.position.set(0.018, 0.012, 0.015);
    this.slideMesh.add(ejectPort);

    // 3. Barrel Tip
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8), gunmetalMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.025, -0.21);
    this.pistolGroup.add(barrel);

    // 4. Tritium 3-Dot Night Sights
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), gunmetalMat);
    frontSight.position.set(0, 0.052, -0.19);
    this.slideMesh.add(frontSight);

    const dotGeo = new THREE.SphereGeometry(0.003, 6, 6);
    const frontDot = new THREE.Mesh(dotGeo, sightGlowMat);
    frontDot.position.set(0, 0.053, -0.184);
    this.slideMesh.add(frontDot);

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.01), gunmetalMat);
    rearSight.position.set(0, 0.052, 0.03);
    this.slideMesh.add(rearSight);

    const rearDotLeft = new THREE.Mesh(dotGeo, sightGlowMat);
    rearDotLeft.position.set(-0.012, 0.053, 0.026);
    this.slideMesh.add(rearDotLeft);

    const rearDotRight = new THREE.Mesh(dotGeo, sightGlowMat);
    rearDotRight.position.set(0.012, 0.053, 0.026);
    this.slideMesh.add(rearDotRight);
  }

  private buildKnifeModel(): void {
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdde2e6, roughness: 0.2, metalness: 0.95 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.85 });

    // Handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.035), handleMat);
    handle.position.set(0, -0.06, 0);
    this.knifeGroup.add(handle);

    // Crossguard
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.04), bladeMat);
    guard.position.set(0, 0.005, 0);
    this.knifeGroup.add(guard);

    // Tanto Blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.18, 0.045), bladeMat);
    blade.position.set(0, 0.1, 0.005);
    this.knifeGroup.add(blade);

    this.knifeGroup.position.set(0.2, -0.22, -0.38);
    this.knifeGroup.rotation.set(0.4, 0.2, -0.2);
    this.knifeGroup.visible = false;
  }

  public setWeapon(index: number): void {
    if (this.isReloading || this.isMeleeAttacking) return;
    this.activeWeaponIndex = index;
    this.pistolGroup.visible = index === 1;
    this.knifeGroup.visible = index === 2;
    this.audio.playWeaponSwitch();
  }

  // Shoot Pistol
  public shoot(shootables: THREE.Object3D[], enemyObjects: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[]): boolean {
    if (this.activeWeaponIndex !== 1) {
      return this.performMelee(enemyObjects);
    }

    if (this.isReloading || this.isMeleeAttacking) return false;

    if (this.currentAmmo <= 0) {
      this.audio.playEmptyClick();
      if (this.reserveAmmo > 0) {
        this.reload();
      }
      return false;
    }

    if (this.fireCooldown > 0) return false;

    this.currentAmmo--;
    this.fireCooldown = this.minFireInterval;

    this.audio.playGunshot();

    // Slide Blowback & Recoil Kick
    this.slideOffset = 0.04;
    this.recoilOffset.z = 0.07;
    this.recoilOffset.y = 0.02;
    this.recoilRotation.x = 0.18;
    this.recoilRotation.y = (Math.random() - 0.5) * 0.03;

    // Muzzle Flash
    this.muzzleFlashTimer = 0.06;
    this.muzzleFlashMesh.visible = true;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    this.muzzleLight.intensity = 2.6;

    // Shell Ejection
    this.ejectShellCasing();

    if (this.onShoot) {
      this.onShoot();
    }

    // Raycast from Camera Center
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const enemyMeshes: THREE.Object3D[] = [];
    const meshMap = new Map<THREE.Object3D, { obj: typeof enemyObjects[0]; isHead: boolean }>();

    for (const enemy of enemyObjects) {
      enemy.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          enemyMeshes.push(child);
          const isHead = child.name === 'Head' || child.name === 'head';
          meshMap.set(child, { obj: enemy, isHead });
        }
      });
    }

    const allTargets = [...enemyMeshes, ...shootables];
    const intersects = this.raycaster.intersectObjects(allTargets, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const entry = meshMap.get(hit.object);

      if (entry) {
        const isHeadshot = entry.isHead;
        const totalDmg = isHeadshot ? this.damage * this.headshotMultiplier : this.damage;
        entry.obj.takeDamage(totalDmg, isHeadshot);

        this.audio.playFleshImpact();
        this.audio.playHitmarker(isHeadshot);

        const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        this.particles.spawnBlood(hit.point, normal, isHeadshot ? 22 : 12);

        if (this.onHitEnemy) {
          this.onHitEnemy(totalDmg, isHeadshot, hit.point);
        }
      } else {
        this.audio.playWallHit();
        const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        this.particles.spawnSparks(hit.point, normal, 10);
      }
    }

    return true;
  }

  private ejectShellCasing(): void {
    const shellGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.02, 6);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const shell = new THREE.Mesh(shellGeo, shellMat);

    // Spawn at world ejection port
    const spawnPos = new THREE.Vector3(0.05, -0.02, -0.2);
    spawnPos.applyMatrix4(this.camera.matrixWorld);
    shell.position.copy(spawnPos);

    // Velocity to right and slightly up/back
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    const vel = right.multiplyScalar(2.2 + Math.random() * 0.5)
      .add(up.multiplyScalar(1.5 + Math.random() * 0.4))
      .add(forward.multiplyScalar(-0.4));

    this.camera.parent?.add(shell);

    this.activeShells.push({
      mesh: shell,
      velocity: vel,
      rotVelocity: new THREE.Vector3(Math.random() * 15, Math.random() * 15, Math.random() * 15),
      life: 0
    });

    this.audio.playShellCasing();
  }

  // Melee Attack (V)
  public performMelee(enemyObjects: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[]): boolean {
    if (this.isMeleeAttacking || this.meleeCooldown > 0) return false;

    this.isMeleeAttacking = true;
    this.meleeTimer = 0.35;
    this.meleeCooldown = 0.65;

    this.audio.playMeleeSwing();

    // Check hit arc (2.2m forward)
    const playerPos = this.camera.position;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    for (const enemy of enemyObjects) {
      const toEnemy = enemy.mesh.position.clone().sub(playerPos);
      const dist = toEnemy.length();
      if (dist < 2.3) {
        const dot = forward.dot(toEnemy.normalize());
        if (dot > 0.4) {
          enemy.takeDamage(45, false);
          this.audio.playMeleeImpact();
          this.particles.spawnBlood(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), forward.negate(), 15);
          if (this.onHitEnemy) {
            this.onHitEnemy(45, false, enemy.mesh.position);
          }
          break;
        }
      }
    }

    return true;
  }

  // Throw Grenade (G)
  public throwGrenade(): boolean {
    if (this.grenades <= 0 || this.isReloading) return false;

    this.grenades--;
    this.audio.playInteract();

    const grenadeGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x3b4a2f, roughness: 0.6, metalness: 0.5 });
    const grenade = new THREE.Mesh(grenadeGeo, grenadeMat);

    const spawnPos = this.camera.position.clone().add(
      new THREE.Vector3(0, -0.1, -0.4).applyQuaternion(this.camera.quaternion)
    );
    grenade.position.copy(spawnPos);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    const vel = forward.multiplyScalar(16.0).add(up.multiplyScalar(4.5));

    this.camera.parent?.add(grenade);

    this.activeGrenades.push({
      mesh: grenade,
      velocity: vel,
      life: 0,
      maxLife: 2.5,
      exploded: false
    });

    return true;
  }

  public reload(): boolean {
    if (this.isReloading || this.activeWeaponIndex !== 1) return false;
    if (this.currentAmmo === this.maxMagazine || this.reserveAmmo <= 0) return false;

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

  public addGrenades(amount: number): void {
    this.grenades = Math.min(6, this.grenades + amount);
  }

  public reset(current = 12, reserve = 48): void {
    this.currentAmmo = current;
    this.reserveAmmo = reserve;
    this.grenades = 3;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.muzzleFlashTimer = 0;
    this.muzzleFlashMesh.visible = false;
    this.muzzleLight.intensity = 0;
    this.activeWeaponIndex = 1;
    this.pistolGroup.visible = true;
    this.knifeGroup.visible = false;
  }

  public getState(isAiming: boolean): WeaponState {
    return {
      currentAmmo: this.currentAmmo,
      reserveAmmo: this.reserveAmmo,
      maxMagazine: this.maxMagazine,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? this.reloadTimer / this.reloadTime : 0,
      isAiming,
      activeWeaponIndex: this.activeWeaponIndex,
      grenades: this.grenades
    };
  }

  public update(delta: number, isAiming: boolean, mouseDeltaX: number, mouseDeltaY: number, enemies: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[]): void {
    // Fire & melee cooldowns
    if (this.fireCooldown > 0) this.fireCooldown -= delta;
    if (this.meleeCooldown > 0) this.meleeCooldown -= delta;

    // Melee attack animation
    if (this.isMeleeAttacking) {
      this.meleeTimer -= delta;
      this.knifeGroup.visible = true;
      this.pistolGroup.visible = false;
      const progress = 1 - this.meleeTimer / 0.35;
      const swing = Math.sin(progress * Math.PI);
      this.knifeGroup.position.set(0.1 - swing * 0.25, -0.2 + swing * 0.1, -0.4 - swing * 0.15);
      this.knifeGroup.rotation.set(0.4 + swing * 1.2, 0.2 - swing * 0.8, -0.2);

      if (this.meleeTimer <= 0) {
        this.isMeleeAttacking = false;
        this.knifeGroup.visible = this.activeWeaponIndex === 2;
        this.pistolGroup.visible = this.activeWeaponIndex === 1;
      }
    }

    // Slide Blowback spring recovery
    if (this.slideOffset > 0) {
      this.slideOffset = Math.max(0, this.slideOffset - delta * 0.3);
      this.slideMesh.position.z = -0.08 + this.slideOffset;
    }

    // Muzzle Flash
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }

    // Reload animation
    if (this.isReloading) {
      this.reloadTimer += delta;
      const progress = this.reloadTimer / this.reloadTime;
      this.recoilOffset.y = -Math.sin(progress * Math.PI) * 0.18;
      this.recoilRotation.z = Math.sin(progress * Math.PI) * 0.25;

      if (this.reloadTimer >= this.reloadTime) {
        const needed = this.maxMagazine - this.currentAmmo;
        const available = Math.min(needed, this.reserveAmmo);
        this.currentAmmo += available;
        this.reserveAmmo -= available;
        this.isReloading = false;
        this.reloadTimer = 0;
        if (this.onReloadFinish) this.onReloadFinish();
      }
    }

    // ADS lerp
    const targetPos = isAiming && !this.isReloading && this.activeWeaponIndex === 1 ? this.adsPosition : this.hipPosition;
    this.currentAimPos.lerp(targetPos, 14 * delta);

    // Sway
    this.swayOffset.x = THREE.MathUtils.lerp(this.swayOffset.x, -mouseDeltaX * 0.008, 10 * delta);
    this.swayOffset.y = THREE.MathUtils.lerp(this.swayOffset.y, -mouseDeltaY * 0.008, 10 * delta);

    // Spring recovery for recoil
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), 12 * delta);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, 14 * delta);
    this.recoilRotation.y = THREE.MathUtils.lerp(this.recoilRotation.y, 0, 14 * delta);

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

    // Update Shell Casings physics
    for (let i = this.activeShells.length - 1; i >= 0; i--) {
      const s = this.activeShells[i];
      s.life += delta;
      s.velocity.y -= 14.0 * delta;
      s.mesh.position.addScaledVector(s.velocity, delta);
      s.mesh.rotation.x += s.rotVelocity.x * delta;
      s.mesh.rotation.y += s.rotVelocity.y * delta;

      if (s.mesh.position.y < 0.02) {
        s.mesh.position.y = 0.02;
        s.velocity.set(0, 0, 0);
      }
      if (s.life > 3.0) {
        this.camera.parent?.remove(s.mesh);
        this.activeShells.splice(i, 1);
      }
    }

    // Update Grenades physics
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.life += delta;
      g.velocity.y -= 16.0 * delta;
      g.mesh.position.addScaledVector(g.velocity, delta);

      if (g.mesh.position.y < 0.1) {
        g.mesh.position.y = 0.1;
        g.velocity.y *= -0.4;
        g.velocity.x *= 0.6;
        g.velocity.z *= 0.6;
      }

      if (g.life >= g.maxLife && !g.exploded) {
        g.exploded = true;
        this.audio.playGrenadeExplosion();
        this.particles.spawnSparks(g.mesh.position, new THREE.Vector3(0, 1, 0), 30);
        this.particles.spawnBlood(g.mesh.position, new THREE.Vector3(0, 1, 0), 15);

        // Area of Effect damage (up to 150 damage within 7m)
        const gPos = g.mesh.position;
        for (const e of enemies) {
          const dist = e.mesh.position.distanceTo(gPos);
          if (dist < 7.5) {
            const falloff = 1 - dist / 7.5;
            const dmg = Math.round(150 * falloff);
            e.takeDamage(dmg, false);
          }
        }

        if (this.onGrenadeExplode) {
          this.onGrenadeExplode(gPos, 7.5, 150);
        }

        this.camera.parent?.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }
  }
}
