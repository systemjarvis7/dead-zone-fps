import * as THREE from 'three';
import { PickupType } from '../core/Types';

export class Pickup {
  public type: PickupType;
  public group: THREE.Group;
  public position: THREE.Vector3;
  public isCollected: boolean = false;
  private readonly collectionRadius: number = 1.7;
  private bobTimer: number = 0;
  private baseHeight: number = 0.55;

  constructor(type: PickupType, pos: THREE.Vector3, scene: THREE.Scene) {
    this.type = type;
    this.position = pos.clone();
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.baseHeight = pos.y;

    this.buildModel();
    scene.add(this.group);
  }

  private buildModel(): void {
    if (this.type === PickupType.HEALTH) {
      // White box with bold red cross
      const boxGeo = new THREE.BoxGeometry(0.55, 0.4, 0.28);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.castShadow = true;
      this.group.add(box);

      // Red cross
      const crossMat = new THREE.MeshBasicMaterial({ color: 0xdd1111 });
      const hCrossGeo = new THREE.BoxGeometry(0.32, 0.1, 0.3);
      const hCross = new THREE.Mesh(hCrossGeo, crossMat);
      this.group.add(hCross);

      const vCrossGeo = new THREE.BoxGeometry(0.1, 0.28, 0.3);
      const vCross = new THREE.Mesh(vCrossGeo, crossMat);
      this.group.add(vCross);
    } else if (this.type === PickupType.AMMO) {
      // Olive-drab military ammo can
      const canGeo = new THREE.BoxGeometry(0.5, 0.42, 0.3);
      const canMat = new THREE.MeshStandardMaterial({ color: 0x3b4a2f, roughness: 0.6, metalness: 0.3 });
      const can = new THREE.Mesh(canGeo, canMat);
      can.castShadow = true;
      this.group.add(can);

      // Yellow top stripe
      const stripeGeo = new THREE.BoxGeometry(0.52, 0.08, 0.32);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe5b700 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 0.12;
      this.group.add(stripe);

      // Two gold bullets on top
      const bulletGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6);
      const bulletMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.9 });
      const b1 = new THREE.Mesh(bulletGeo, bulletMat);
      b1.position.set(-0.1, 0.28, 0);
      this.group.add(b1);

      const b2 = new THREE.Mesh(bulletGeo, bulletMat);
      b2.position.set(0.1, 0.28, 0);
      this.group.add(b2);
    } else { // COIN
      // Shiny faceted gold coin
      const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12);
      coinGeo.rotateX(Math.PI / 2);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x443300
      });
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.castShadow = true;
      this.group.add(coin);
    }
  }

  public checkPlayerCollision(playerPos: THREE.Vector3): boolean {
    if (this.isCollected) return false;
    const distSq = this.group.position.distanceToSquared(playerPos);
    return distSq < this.collectionRadius * this.collectionRadius;
  }

  public update(delta: number): void {
    if (this.isCollected) return;

    // Smooth rotation
    this.group.rotation.y += delta * 2.2;

    // Smooth sinusoidal floating bob
    this.bobTimer += delta * 3.5;
    this.group.position.y = this.baseHeight + Math.sin(this.bobTimer) * 0.12;
  }

  public destroy(scene: THREE.Scene): void {
    this.isCollected = true;
    scene.remove(this.group);
  }
}
