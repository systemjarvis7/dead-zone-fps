import * as THREE from 'three';
import { EnemyType } from '../core/Types';
import { AudioManager } from '../core/AudioManager';
import { VillageEnvironment } from '../world/VillageEnvironment';

export class Enemy {
  public type: EnemyType;
  public group: THREE.Group;
  public audio: AudioManager;
  public environment: VillageEnvironment;

  // Stats
  public health: number = 100;
  public maxHealth: number = 100;
  public speed: number = 2.2;
  public damage: number = 10;
  public attackRange: number = 1.8;
  public attackCooldown: number = 1.2;
  public readonly radius: number = 0.55;

  // State
  public isDead: boolean = false;
  private attackTimer: number = 0;
  private walkCycleTimer: number = 0;
  private hurtTimer: number = 0;
  private deathTimer: number = 0;
  public shouldRemove: boolean = false;

  // Visual meshes for animation
  private headMesh!: THREE.Mesh;
  private torsoMesh!: THREE.Mesh;
  private leftArm!: THREE.Group;
  private rightArm!: THREE.Group;
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private materials: THREE.MeshStandardMaterial[] = [];
  private originalColors: number[] = [];

  // Growl timer
  private growlTimer: number = 0;

  // Knockback velocity
  private knockback = new THREE.Vector3();

  // Callbacks
  public onAttackPlayer?: (damage: number) => void;
  public onDeath?: (enemy: Enemy) => void;

  constructor(
    type: EnemyType,
    spawnPos: THREE.Vector3,
    audio: AudioManager,
    environment: VillageEnvironment
  ) {
    this.type = type;
    this.audio = audio;
    this.environment = environment;
    this.group = new THREE.Group();
    this.group.position.copy(spawnPos);

    this.configureStats();
    this.buildModel();

    // Randomize initial growl timer
    this.growlTimer = 2.0 + Math.random() * 5.0;
  }

  private configureStats(): void {
    if (this.type === EnemyType.NORMAL) {
      this.health = 100;
      this.maxHealth = 100;
      this.speed = 2.4;
      this.damage = 10;
      this.attackRange = 1.8;
      this.attackCooldown = 1.2;
    } else if (this.type === EnemyType.FAST) {
      this.health = 60;
      this.maxHealth = 60;
      this.speed = 4.8;
      this.damage = 15;
      this.attackRange = 1.6;
      this.attackCooldown = 0.9;
    } else { // BOSS
      this.health = 400;
      this.maxHealth = 400;
      this.speed = 3.0;
      this.damage = 25;
      this.attackRange = 2.5;
      this.attackCooldown = 1.6;
    }
  }

  private buildModel(): void {
    const scale = this.type === EnemyType.BOSS ? 1.7 : 1.0;

    // Skin & Clothes colors based on type
    let skinColor = 0x5a7052; // Rotten greenish-grey
    let clothesColor = 0x3d3835; // Dirt brown
    let pantsColor = 0x272c30; // Dark grey
    let eyeColor = 0xffe600; // Glowing yellow eyes

    if (this.type === EnemyType.FAST) {
      skinColor = 0x8a3832; // Bloody mutated flesh
      clothesColor = 0x221a1a;
      pantsColor = 0x1a1515;
      eyeColor = 0xff2200; // Glowing red eyes
    } else if (this.type === EnemyType.BOSS) {
      skinColor = 0x3e4a42; // Heavy armored mutate
      clothesColor = 0x1f1f24;
      pantsColor = 0x151618;
      eyeColor = 0xff0044; // Crimson glowing
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: clothesColor, roughness: 0.9 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.9 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });

    this.materials.push(skinMat, clothesMat, pantsMat);
    this.originalColors.push(skinColor, clothesColor, pantsColor);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.55 * scale, 0.75 * scale, 0.3 * scale);
    this.torsoMesh = new THREE.Mesh(torsoGeo, clothesMat);
    this.torsoMesh.position.y = 1.15 * scale;
    this.torsoMesh.castShadow = true;
    this.group.add(this.torsoMesh);

    // Head (named 'Head' for hit detection)
    const headGeo = new THREE.BoxGeometry(0.35 * scale, 0.38 * scale, 0.35 * scale);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.name = 'Head';
    this.headMesh.position.set(0, 1.72 * scale, 0);
    this.headMesh.castShadow = true;
    this.group.add(this.headMesh);

    // Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(0.07 * scale, 0.05 * scale, 0.04 * scale);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.09 * scale, 1.75 * scale, 0.17 * scale);
    this.group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.09 * scale, 1.75 * scale, 0.17 * scale);
    this.group.add(rightEye);

    // Left Arm (pivot at shoulder)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.35 * scale, 1.45 * scale, 0);
    const armGeo = new THREE.BoxGeometry(0.18 * scale, 0.65 * scale, 0.18 * scale);
    const leftArmMesh = new THREE.Mesh(armGeo, skinMat);
    leftArmMesh.position.y = -0.3 * scale;
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);
    this.group.add(this.leftArm);

    // Right Arm (pivot at shoulder)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.35 * scale, 1.45 * scale, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
    rightArmMesh.position.y = -0.3 * scale;
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightArmMesh);
    this.group.add(this.rightArm);

    // Left Leg (pivot at hip)
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16 * scale, 0.75 * scale, 0);
    const legGeo = new THREE.BoxGeometry(0.2 * scale, 0.75 * scale, 0.22 * scale);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLegMesh.position.y = -0.36 * scale;
    leftLegMesh.castShadow = true;
    this.leftLeg.add(leftLegMesh);
    this.group.add(this.leftLeg);

    // Right Leg (pivot at hip)
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16 * scale, 0.75 * scale, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rightLegMesh.position.y = -0.36 * scale;
    rightLegMesh.castShadow = true;
    this.rightLeg.add(rightLegMesh);
    this.group.add(this.rightLeg);
  }

  public takeDamage(amount: number, isHeadshot: boolean = false): void {
    if (this.isDead) return;

    this.health -= amount;
    this.hurtTimer = 0.12;

    // Flash materials bright red
    for (const mat of this.materials) {
      mat.color.setHex(0xff1111);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      this.audio.playZombieDeath();

      if (this.onDeath) {
        this.onDeath(this);
      }
    } else {
      // Audio hurt groan
      if (Math.random() > 0.4) {
        const pitch = this.type === EnemyType.FAST ? 1.4 : this.type === EnemyType.BOSS ? 0.6 : 1.0;
        this.audio.playZombieGrowl(pitch);
      }
    }
  }

  public applyKnockback(dir: THREE.Vector3, force: number = 3.5): void {
    if (this.type === EnemyType.BOSS) force *= 0.3; // Boss resists knockback
    this.knockback.copy(dir.normalize()).multiplyScalar(force);
  }

  public update(delta: number, playerPos: THREE.Vector3, otherEnemies: Enemy[]): void {
    // 1. Handle Death State & Sink Animation
    if (this.isDead) {
      this.deathTimer += delta;

      // Collapse backwards
      if (this.deathTimer < 0.6) {
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, -Math.PI / 2, 8 * delta);
        this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, 0.2, 8 * delta);
      } else if (this.deathTimer > 2.5) {
        // Sink into ground
        this.group.position.y -= delta * 0.4;
        if (this.deathTimer > 4.5) {
          this.shouldRemove = true;
        }
      }
      return;
    }

    // 2. Hurt Color Recovery
    if (this.hurtTimer > 0) {
      this.hurtTimer -= delta;
      if (this.hurtTimer <= 0) {
        this.materials.forEach((mat, i) => {
          mat.color.setHex(this.originalColors[i]);
        });
      }
    }

    // 3. Ambient growls
    this.growlTimer -= delta;
    if (this.growlTimer <= 0) {
      const distToPlayer = this.group.position.distanceTo(playerPos);
      if (distToPlayer < 25) {
        const pitch = this.type === EnemyType.FAST ? 1.3 : this.type === EnemyType.BOSS ? 0.6 : 1.0;
        this.audio.playZombieGrowl(pitch);
      }
      this.growlTimer = 4.0 + Math.random() * 6.0;
    }

    // 4. Direction & Distance to Player
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.group.position);
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();

    // 5. Attack Logic
    if (this.attackTimer > 0) {
      this.attackTimer -= delta;
    }

    const inAttackRange = distanceToPlayer <= this.attackRange;

    if (inAttackRange && this.attackTimer <= 0) {
      // Execute attack
      this.attackTimer = this.attackCooldown;
      const pitch = this.type === EnemyType.FAST ? 1.3 : this.type === EnemyType.BOSS ? 0.7 : 1.0;
      this.audio.playZombieAttack(pitch);

      if (this.onAttackPlayer) {
        this.onAttackPlayer(this.damage);
      }
    }

    // 6. Navigation, Steering & Wall Avoidance
    if (!inAttackRange) {
      const moveDir = toPlayer.clone().normalize();

      // Steering away from obstacles (Whiskers Raycasting / Sphere Probes)
      const probeLeft = new THREE.Vector3(
        this.group.position.x - moveDir.z * 1.0 + moveDir.x * 1.5,
        1.0,
        this.group.position.z + moveDir.x * 1.0 + moveDir.z * 1.5
      );
      const probeRight = new THREE.Vector3(
        this.group.position.x + moveDir.z * 1.0 + moveDir.x * 1.5,
        1.0,
        this.group.position.z - moveDir.x * 1.0 + moveDir.z * 1.5
      );

      const colLeft = this.environment.checkSphereCollision(probeLeft, 0.4);
      const colRight = this.environment.checkSphereCollision(probeRight, 0.4);

      if (colLeft.hit && !colRight.hit) {
        moveDir.add(new THREE.Vector3(moveDir.z, 0, -moveDir.x).multiplyScalar(0.7)).normalize();
      } else if (colRight.hit && !colLeft.hit) {
        moveDir.add(new THREE.Vector3(-moveDir.z, 0, moveDir.x).multiplyScalar(0.7)).normalize();
      }

      // 7. Enemy Separation (Avoid overlapping)
      const separation = new THREE.Vector3();
      for (const other of otherEnemies) {
        if (other === this || other.isDead) continue;
        const diff = this.group.position.clone().sub(other.group.position);
        diff.y = 0;
        const dist = diff.length();
        const minDistance = this.radius + other.radius;
        if (dist < minDistance && dist > 0.01) {
          separation.add(diff.normalize().multiplyScalar((minDistance - dist) / minDistance));
        }
      }
      moveDir.add(separation.multiplyScalar(0.8)).normalize();

      // Apply movement speed
      const effectiveSpeed = this.speed;
      this.group.position.x += moveDir.x * effectiveSpeed * delta;
      this.group.position.z += moveDir.z * effectiveSpeed * delta;

      // Face movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      this.group.rotation.y = targetAngle;

      // Walk limb swing animation
      this.walkCycleTimer += delta * (this.speed * 2.2);
      const swing = Math.sin(this.walkCycleTimer) * 0.65;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;

      // Arm swing / reaching towards player
      if (this.attackTimer > this.attackCooldown - 0.4) {
        // Attack swipe pose
        this.leftArm.rotation.x = -Math.PI / 1.8;
        this.rightArm.rotation.x = -Math.PI / 1.8;
      } else {
        this.leftArm.rotation.x = -0.6 + swing * 0.4;
        this.rightArm.rotation.x = -0.6 - swing * 0.4;
      }
    } else {
      // In range: Face player directly
      const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
      this.group.rotation.y = targetAngle;

      // Attack swing pose
      if (this.attackTimer > this.attackCooldown - 0.4) {
        const attackProgress = (this.attackCooldown - this.attackTimer) / 0.4;
        const swipe = Math.sin(attackProgress * Math.PI) * 1.6;
        this.leftArm.rotation.x = -Math.PI / 3 - swipe;
        this.rightArm.rotation.x = -Math.PI / 3 - swipe;
      } else {
        this.leftArm.rotation.x = -0.7;
        this.rightArm.rotation.x = -0.7;
      }
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
    }

    // 8. Apply Knockback
    if (this.knockback.lengthSq() > 0.01) {
      this.group.position.addScaledVector(this.knockback, delta);
      this.knockback.lerp(new THREE.Vector3(0, 0, 0), 10 * delta);
    }

    // 9. Wall & Obstacle Collision (Ensure enemies do not move through walls!)
    const col = this.environment.checkSphereCollision(
      new THREE.Vector3(this.group.position.x, 1.0, this.group.position.z),
      this.radius
    );
    if (col.hit) {
      this.group.position.x += col.pushVector.x;
      this.group.position.z += col.pushVector.z;
    }

    // Map bounds clamp
    this.group.position.x = Math.max(-57, Math.min(57, this.group.position.x));
    this.group.position.z = Math.max(-57, Math.min(57, this.group.position.z));
    this.group.position.y = 0;
  }
}
