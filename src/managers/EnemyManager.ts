import * as THREE from 'three';
import { Enemy } from '../entities/Enemy';
import { Pickup } from '../entities/Pickup';
import { EnemyType, PickupType } from '../core/Types';
import { AudioManager } from '../core/AudioManager';
import { VillageEnvironment } from '../world/VillageEnvironment';
import { ParticleSystem } from '../entities/Particles';

export class EnemyManager {
  public scene: THREE.Scene;
  public audio: AudioManager;
  public environment: VillageEnvironment;
  public particles?: ParticleSystem;

  public enemies: Enemy[] = [];
  public pickups: Pickup[] = [];

  // Spawning controls
  private spawnTimer: number = 0;
  public spawnInterval: number = 2.2;
  public maxActiveEnemies: number = 8;
  public allowFastMutants: boolean = false;
  public allowBoss: boolean = false;
  public bossSpawned: boolean = false;

  private pickupTimer: number = 0;

  // Callbacks
  public onEnemyKilled?: (enemyType: EnemyType) => void;
  public onEnemyAttackPlayer?: (damage: number, attackerPos: THREE.Vector3) => void;
  public onPickupCollected?: (type: PickupType) => void;

  constructor(scene: THREE.Scene, audio: AudioManager, environment: VillageEnvironment, particles?: ParticleSystem) {
    this.scene = scene;
    this.audio = audio;
    this.environment = environment;
    this.particles = particles;
  }

  public reset(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.group);
    }
    this.enemies = [];

    for (const pickup of this.pickups) {
      pickup.destroy(this.scene);
    }
    this.pickups = [];

    this.spawnTimer = 0;
    this.pickupTimer = 0;
    this.bossSpawned = false;
  }

  public spawnEnemy(type: EnemyType, playerPos: THREE.Vector3): Enemy {
    let bestPoint = this.environment.spawnPoints[0];
    let maxDist = 0;

    const candidates = this.environment.spawnPoints.filter(pt => pt.distanceTo(playerPos) > 18);
    if (candidates.length > 0) {
      bestPoint = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      for (const pt of this.environment.spawnPoints) {
        const d = pt.distanceTo(playerPos);
        if (d > maxDist) {
          maxDist = d;
          bestPoint = pt;
        }
      }
    }

    const spawnPos = bestPoint.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      0,
      (Math.random() - 0.5) * 4
    ));

    const enemy = new Enemy(type, spawnPos, this.audio, this.environment);

    enemy.onAttackPlayer = (dmg, attackerPos) => {
      if (this.onEnemyAttackPlayer) {
        this.onEnemyAttackPlayer(dmg, attackerPos);
      }
    };

    enemy.onDeath = (killedEnemy) => {
      // Dramatic blood explosion burst and expanding pool decal on the grass
      if (this.particles) {
        this.particles.spawnBloodExplosion(
          killedEnemy.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)),
          killedEnemy.type === EnemyType.BOSS ? 60 : 38
        );
        this.particles.spawnBloodPool(killedEnemy.group.position.clone());
      }

      if (this.onEnemyKilled) {
        this.onEnemyKilled(killedEnemy.type);
      }

      // 38% chance to drop loot
      if (Math.random() < 0.38) {
        this.spawnRandomPickup(killedEnemy.group.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
      }
    };

    this.scene.add(enemy.group);
    this.enemies.push(enemy);
    return enemy;
  }

  public spawnBoss(playerPos: THREE.Vector3): void {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    this.spawnEnemy(EnemyType.BOSS, playerPos);
    this.audio.playWaveHorn();
  }

  public spawnRandomPickup(pos: THREE.Vector3): Pickup {
    const rand = Math.random();
    let type = PickupType.COIN;
    if (rand < 0.32) {
      type = PickupType.HEALTH;
    } else if (rand < 0.65) {
      type = PickupType.AMMO;
    } else {
      type = PickupType.COIN;
    }

    const pickup = new Pickup(type, pos, this.scene);
    this.pickups.push(pickup);
    return pickup;
  }

  public spawnSurvivalPickup(): void {
    if (this.environment.pickupSpawnPoints.length === 0) return;
    const pt = this.environment.pickupSpawnPoints[
      Math.floor(Math.random() * this.environment.pickupSpawnPoints.length)
    ];
    this.spawnRandomPickup(pt.clone());
  }

  public onGunshotFired(soundPos: THREE.Vector3, hearingRadius: number = 55): void {
    for (const enemy of this.enemies) {
      if (!enemy.isDead) {
        const dist = enemy.group.position.distanceTo(soundPos);
        if (dist <= hearingRadius) {
          enemy.alertToSound(soundPos);
        }
      }
    }
  }

  public getShootableEnemyObjects(): { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[] {
    const list: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[] = [];
    for (const enemy of this.enemies) {
      if (!enemy.isDead) {
        list.push({
          mesh: enemy.group,
          takeDamage: (dmg, isHead) => enemy.takeDamage(dmg, isHead)
        });
      }
    }
    return list;
  }

  public update(delta: number, playerPos: THREE.Vector3, isSpawningEnabled: boolean, isPlayerCrouched: boolean = false): void {
    if (isSpawningEnabled && this.enemies.filter(e => !e.isDead).length < this.maxActiveEnemies) {
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;

        let type = EnemyType.NORMAL;
        if (this.allowFastMutants && Math.random() < 0.4) {
          type = EnemyType.FAST;
        }

        this.spawnEnemy(type, playerPos);
      }
    }

    this.pickupTimer += delta;
    if (this.pickupTimer >= 22) {
      this.pickupTimer = 0;
      if (this.pickups.length < 6) {
        this.spawnSurvivalPickup();
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(delta, playerPos, this.enemies, isPlayerCrouched);

      if (enemy.shouldRemove) {
        this.scene.remove(enemy.group);
        this.enemies.splice(i, 1);
      }
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.update(delta);

      if (pickup.checkPlayerCollision(playerPos)) {
        this.audio.playPickup(pickup.type);
        if (this.onPickupCollected) {
          this.onPickupCollected(pickup.type);
        }
        pickup.destroy(this.scene);
        this.pickups.splice(i, 1);
      }
    }
  }
}
