import * as THREE from 'three';
import { TimeOfDay } from '../core/Types';
import { AudioManager } from '../core/AudioManager';

export interface Collider {
  box: THREE.Box3;
  mesh?: THREE.Object3D;
}

export interface InteractiveDoor {
  id: string;
  group: THREE.Group;
  pivot: THREE.Group;
  isOpen: boolean;
  box: THREE.Box3;
  center: THREE.Vector3;
}

export interface InteractiveCrate {
  id: string;
  group: THREE.Group;
  lid: THREE.Group;
  isOpened: boolean;
  center: THREE.Vector3;
  lootType: 'ammo' | 'health' | 'grenade';
}

export interface InteractiveGenerator {
  group: THREE.Group;
  center: THREE.Vector3;
  isActive: boolean;
  floodlights: THREE.PointLight[];
}

export class VillageEnvironment {
  public scene: THREE.Scene;
  public audio: AudioManager;
  public colliders: Collider[] = [];
  public shootableMeshes: THREE.Object3D[] = [];
  public spawnPoints: THREE.Vector3[] = [];
  public pickupSpawnPoints: THREE.Vector3[] = [];

  // Lighting
  private dirLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private flickeringLights: { light: THREE.PointLight; baseIntensity: number; timeOffset: number }[] = [];

  // Interactive Objects
  public doors: InteractiveDoor[] = [];
  public crates: InteractiveCrate[] = [];
  public generator!: InteractiveGenerator;

  // Time of Day
  public currentTimeOfDay: TimeOfDay = TimeOfDay.DUSK;

  constructor(scene: THREE.Scene, audio: AudioManager, timeOfDay: TimeOfDay = TimeOfDay.DUSK) {
    this.scene = scene;
    this.audio = audio;
    this.currentTimeOfDay = timeOfDay;

    this.setupLightingAndFog();
    this.createGroundAndRoads();
    this.createHousesWithInteriors();
    this.createVehicles();
    this.createObstaclesAndClutter();
    this.createTrees();
    this.createStreetLamps();
    this.createPerimeterWalls();
    this.createInteractiveElements();
    this.setupSpawnPoints();
  }

  public setTimeOfDay(time: TimeOfDay): void {
    this.currentTimeOfDay = time;
    if (time === TimeOfDay.DAY) {
      this.scene.fog = new THREE.FogExp2(0x52606b, 0.016);
      this.dirLight.color.setHex(0xfff3e0);
      this.dirLight.intensity = 1.6;
      this.dirLight.position.set(45, 65, 30);
      this.ambientLight.color.setHex(0x5a6a78);
      this.ambientLight.intensity = 0.9;
      this.hemiLight.color.setHex(0x829ab1);
      this.hemiLight.groundColor.setHex(0x333b2e);
    } else if (time === TimeOfDay.DUSK) {
      this.scene.fog = new THREE.FogExp2(0x231d24, 0.022);
      this.dirLight.color.setHex(0xe67e22);
      this.dirLight.intensity = 1.1;
      this.dirLight.position.set(50, 35, 40);
      this.ambientLight.color.setHex(0x3a2d3b);
      this.ambientLight.intensity = 0.65;
      this.hemiLight.color.setHex(0x714b59);
      this.hemiLight.groundColor.setHex(0x1a1c17);
    } else { // NIGHT
      this.scene.fog = new THREE.FogExp2(0x0c0f12, 0.028);
      this.dirLight.color.setHex(0x334466);
      this.dirLight.intensity = 0.35;
      this.dirLight.position.set(30, 50, -20);
      this.ambientLight.color.setHex(0x111620);
      this.ambientLight.intensity = 0.35;
      this.hemiLight.color.setHex(0x1e2738);
      this.hemiLight.groundColor.setHex(0x0a0c0a);
    }
  }

  private setupLightingAndFog(): void {
    this.ambientLight = new THREE.AmbientLight(0x3a2d3b, 0.65);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xe67e22, 1.1);
    this.dirLight.position.set(50, 45, 40);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 140;
    const d = 60;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0x714b59, 0x1a1c17, 0.5);
    this.scene.add(this.hemiLight);

    this.setTimeOfDay(this.currentTimeOfDay);
  }

  private createGroundAndRoads(): void {
    // 1. High Detail Procedural Ground Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#222820';
    ctx.fillRect(0, 0, 512, 512);

    // Mud, gravel and vegetation noise
    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 5 + 1.5;
      const val = Math.floor(Math.random() * 26 + 30);
      ctx.fillStyle = `rgb(${val + 4}, ${val + 10}, ${val})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(18, 18);

    const groundGeo = new THREE.PlaneGeometry(140, 140);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.9,
      metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'Ground';
    this.scene.add(ground);
    this.shootableMeshes.push(ground);

    // 2. Main Crossroads Road
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.85, metalness: 0.15 });

    const nsRoadGeo = new THREE.PlaneGeometry(12, 130);
    const nsRoad = new THREE.Mesh(nsRoadGeo, roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.y = 0.02;
    nsRoad.receiveShadow = true;
    this.scene.add(nsRoad);
    this.shootableMeshes.push(nsRoad);

    const ewRoadGeo = new THREE.PlaneGeometry(130, 12);
    const ewRoad = new THREE.Mesh(ewRoadGeo, roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.y = 0.02;
    ewRoad.receiveShadow = true;
    this.scene.add(ewRoad);
    this.shootableMeshes.push(ewRoad);

    // 3. Sidewalk Curbs
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x48484c, roughness: 0.75 });
    const curbGeo = new THREE.BoxGeometry(0.3, 0.25, 52);

    const curbConfigs = [
      { x: -6.15, z: -32, rotY: 0 },
      { x: 6.15, z: -32, rotY: 0 },
      { x: -6.15, z: 32, rotY: 0 },
      { x: 6.15, z: 32, rotY: 0 },
      { x: -32, z: -6.15, rotY: Math.PI / 2 },
      { x: -32, z: 6.15, rotY: Math.PI / 2 },
      { x: 32, z: -6.15, rotY: Math.PI / 2 },
      { x: 32, z: 6.15, rotY: Math.PI / 2 }
    ];

    curbConfigs.forEach(cfg => {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(cfg.x, 0.125, cfg.z);
      curb.rotation.y = cfg.rotY;
      curb.castShadow = true;
      curb.receiveShadow = true;
      this.scene.add(curb);
      this.shootableMeshes.push(curb);
    });

    // Road dashed stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd69e2e });
    for (let z = -56; z <= 56; z += 6) {
      if (Math.abs(z) < 8) continue;
      const stripeGeo = new THREE.PlaneGeometry(0.35, 3.2);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.03, z);
      this.scene.add(stripe);
    }
    for (let x = -56; x <= 56; x += 6) {
      if (Math.abs(x) < 8) continue;
      const stripeGeo = new THREE.PlaneGeometry(3.2, 0.35);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.03, 0);
      this.scene.add(stripe);
    }
  }

  private createHousesWithInteriors(): void {
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x5a3e35, roughness: 0.88 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x48382c, roughness: 0.85 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x272b2e, roughness: 0.65 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x302822, roughness: 0.85 });

    // House 1: North-West Farmhouse (Enterable interior)
    this.buildEnterableHouse({
      x: -22,
      z: -24,
      width: 14,
      depth: 12,
      height: 5.8,
      wallMat: brickMat,
      roofMat: roofMat,
      floorMat: floorMat,
      doorSide: 'south'
    });

    // House 2: North-East Cabin (Enterable interior)
    this.buildEnterableHouse({
      x: 24,
      z: -22,
      width: 12,
      depth: 10,
      height: 5.2,
      wallMat: woodMat,
      roofMat: roofMat,
      floorMat: floorMat,
      doorSide: 'south'
    });

    // House 3: South-West Ruined Depot / Garage (Enterable)
    this.buildEnterableHouse({
      x: -25,
      z: 22,
      width: 15,
      depth: 13,
      height: 6.0,
      wallMat: concreteMat,
      roofMat: roofMat,
      floorMat: floorMat,
      doorSide: 'north'
    });

    // House 4: South-East Residence (Enterable)
    this.buildEnterableHouse({
      x: 22,
      z: 26,
      width: 13,
      depth: 11,
      height: 5.4,
      wallMat: brickMat,
      roofMat: roofMat,
      floorMat: floorMat,
      doorSide: 'north'
    });

    // House 5: North Roadside Outpost
    this.buildEnterableHouse({
      x: -18,
      z: -48,
      width: 10,
      depth: 8,
      height: 4.8,
      wallMat: woodMat,
      roofMat: roofMat,
      floorMat: floorMat,
      doorSide: 'south'
    });

    // House 6: South Roadside Shed
    this.buildEnterableHouse({
      x: 20,
      z: 48,
      width: 9,
      depth: 7,
      height: 4.5,
      wallMat: concreteMat,
      roofMat: roofMat,
      floorMat: floorMat,
      doorSide: 'north'
    });
  }

  private buildEnterableHouse(cfg: {
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
    wallMat: THREE.Material;
    roofMat: THREE.Material;
    floorMat: THREE.Material;
    doorSide: 'north' | 'south';
  }): void {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);

    const thickness = 0.45;
    const doorWidth = 2.4;
    const doorHeight = 3.2;

    // Interior floor
    const floorGeo = new THREE.PlaneGeometry(cfg.width - 0.2, cfg.depth - 0.2);
    const floor = new THREE.Mesh(floorGeo, cfg.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.04;
    floor.receiveShadow = true;
    group.add(floor);
    this.shootableMeshes.push(floor);

    // Left Wall
    const sideWallGeo = new THREE.BoxGeometry(thickness, cfg.height, cfg.depth);
    const leftWall = new THREE.Mesh(sideWallGeo, cfg.wallMat);
    leftWall.position.set(-cfg.width / 2 + thickness / 2, cfg.height / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    group.add(leftWall);
    this.shootableMeshes.push(leftWall);

    const leftCol = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x - cfg.width / 2 + thickness / 2, cfg.height / 2, cfg.z),
      new THREE.Vector3(thickness + 0.2, cfg.height + 1, cfg.depth)
    );
    this.colliders.push({ box: leftCol });

    // Right Wall
    const rightWall = new THREE.Mesh(sideWallGeo, cfg.wallMat);
    rightWall.position.set(cfg.width / 2 - thickness / 2, cfg.height / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    group.add(rightWall);
    this.shootableMeshes.push(rightWall);

    const rightCol = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x + cfg.width / 2 - thickness / 2, cfg.height / 2, cfg.z),
      new THREE.Vector3(thickness + 0.2, cfg.height + 1, cfg.depth)
    );
    this.colliders.push({ box: rightCol });

    // Back Wall (full)
    const backZ = cfg.doorSide === 'south' ? -cfg.depth / 2 + thickness / 2 : cfg.depth / 2 - thickness / 2;
    const backWallGeo = new THREE.BoxGeometry(cfg.width, cfg.height, thickness);
    const backWall = new THREE.Mesh(backWallGeo, cfg.wallMat);
    backWall.position.set(0, cfg.height / 2, backZ);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);
    this.shootableMeshes.push(backWall);

    const backCol = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x, cfg.height / 2, cfg.z + backZ),
      new THREE.Vector3(cfg.width, cfg.height + 1, thickness + 0.2)
    );
    this.colliders.push({ box: backCol });

    // Front Wall with Door Opening (left segment + right segment + header)
    const frontZ = cfg.doorSide === 'south' ? cfg.depth / 2 - thickness / 2 : -cfg.depth / 2 + thickness / 2;
    const sideSegWidth = (cfg.width - doorWidth) / 2;

    const segGeo = new THREE.BoxGeometry(sideSegWidth, cfg.height, thickness);
    const frontLeft = new THREE.Mesh(segGeo, cfg.wallMat);
    frontLeft.position.set(-cfg.width / 2 + sideSegWidth / 2, cfg.height / 2, frontZ);
    frontLeft.castShadow = true;
    frontLeft.receiveShadow = true;
    group.add(frontLeft);
    this.shootableMeshes.push(frontLeft);

    const flCol = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x - cfg.width / 2 + sideSegWidth / 2, cfg.height / 2, cfg.z + frontZ),
      new THREE.Vector3(sideSegWidth + 0.1, cfg.height + 1, thickness + 0.2)
    );
    this.colliders.push({ box: flCol });

    const frontRight = new THREE.Mesh(segGeo, cfg.wallMat);
    frontRight.position.set(cfg.width / 2 - sideSegWidth / 2, cfg.height / 2, frontZ);
    frontRight.castShadow = true;
    frontRight.receiveShadow = true;
    group.add(frontRight);
    this.shootableMeshes.push(frontRight);

    const frCol = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x + cfg.width / 2 - sideSegWidth / 2, cfg.height / 2, cfg.z + frontZ),
      new THREE.Vector3(sideSegWidth + 0.1, cfg.height + 1, thickness + 0.2)
    );
    this.colliders.push({ box: frCol });

    // Doorway Header
    const headerGeo = new THREE.BoxGeometry(doorWidth, cfg.height - doorHeight, thickness);
    const header = new THREE.Mesh(headerGeo, cfg.wallMat);
    header.position.set(0, doorHeight + (cfg.height - doorHeight) / 2, frontZ);
    header.castShadow = true;
    group.add(header);

    // Roof
    const roofGeo = new THREE.ConeGeometry(Math.max(cfg.width, cfg.depth) * 0.76, cfg.height * 0.45, 4);
    const roof = new THREE.Mesh(roofGeo, cfg.roofMat);
    roof.position.y = cfg.height + cfg.height * 0.22;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    this.shootableMeshes.push(roof);

    // Interior furniture / props
    const tableGeo = new THREE.BoxGeometry(2.0, 0.8, 1.2);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x3d2d20, roughness: 0.85 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, 0.4, 0);
    table.castShadow = true;
    table.receiveShadow = true;
    group.add(table);
    this.shootableMeshes.push(table);

    const tableCol = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x, 0.5, cfg.z),
      new THREE.Vector3(2.2, 1.2, 1.4)
    );
    this.colliders.push({ box: tableCol });

    this.scene.add(group);
  }

  private createVehicles(): void {
    // 1. Armored Military Transport (Humvee / APC)
    this.buildMilitaryAPC({
      x: -6,
      z: 7,
      rotY: 0.4
    });

    // 2. Wrecked Sedan near East street
    this.buildDetailedCar({
      x: 18,
      z: -4,
      rotY: -0.65,
      color: 0x3b4a59 // Faded blue-gray
    });

    // 3. Abandoned Pickup Truck on North street
    this.buildDetailedPickup({
      x: 4.5,
      z: -28,
      rotY: 0.2,
      color: 0x4a4336 // Rusted dirt tan
    });

    // 4. Damaged civilian car on South street
    this.buildDetailedCar({
      x: -5,
      z: 32,
      rotY: 0.85,
      color: 0x5a2d24 // Burned dark red
    });
  }

  private buildMilitaryAPC(cfg: { x: number; z: number; rotY: number }): void {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;

    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3a4233, roughness: 0.7, metalness: 0.4 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1b1e19, roughness: 0.8, metalness: 0.6 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });

    // Lower Armored Chassis
    const chassisGeo = new THREE.BoxGeometry(2.6, 1.1, 5.2);
    const chassis = new THREE.Mesh(chassisGeo, armorMat);
    chassis.position.y = 0.95;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);
    this.shootableMeshes.push(chassis);

    // Upper Angled Cabin
    const cabinGeo = new THREE.BoxGeometry(2.3, 0.9, 3.2);
    const cabin = new THREE.Mesh(cabinGeo, armorMat);
    cabin.position.set(0, 1.9, -0.4);
    cabin.castShadow = true;
    group.add(cabin);
    this.shootableMeshes.push(cabin);

    // Roof Turret Ring
    const turretGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 8);
    const turret = new THREE.Mesh(turretGeo, darkMetalMat);
    turret.position.set(0, 2.5, -0.2);
    turret.castShadow = true;
    group.add(turret);
    this.shootableMeshes.push(turret);

    // Heavy Military Tires
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 8);
    wheelGeo.rotateZ(Math.PI / 2);
    const wPositions = [
      [-1.35, 0.55, 1.6],
      [1.35, 0.55, 1.6],
      [-1.35, 0.55, -1.6],
      [1.35, 0.55, -1.6]
    ];

    wPositions.forEach(p => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(p[0], p[1], p[2]);
      wheel.castShadow = true;
      group.add(wheel);
    });

    this.scene.add(group);

    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x, 1.3, cfg.z),
      new THREE.Vector3(3.2, 2.8, 5.8)
    );
    this.colliders.push({ box, mesh: group });
  }

  private buildDetailedCar(cfg: { x: number; z: number; rotY: number; color: number }): void {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.65, metalness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2128, roughness: 0.2, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95 });

    const chassisGeo = new THREE.BoxGeometry(2.1, 0.8, 4.4);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.65;
    chassis.castShadow = true;
    group.add(chassis);
    this.shootableMeshes.push(chassis);

    const cabinGeo = new THREE.BoxGeometry(1.9, 0.75, 2.3);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.4, -0.3);
    cabin.castShadow = true;
    group.add(cabin);
    this.shootableMeshes.push(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
    wheelGeo.rotateZ(Math.PI / 2);
    [[-1.05, 0.4, 1.3], [1.05, 0.4, 1.3], [-1.05, 0.4, -1.3], [1.05, 0.4, -1.3]].forEach(p => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(p[0], p[1], p[2]);
      wheel.castShadow = true;
      group.add(wheel);
    });

    this.scene.add(group);
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x, 1.0, cfg.z),
      new THREE.Vector3(2.6, 2.0, 4.8)
    );
    this.colliders.push({ box, mesh: group });
  }

  private buildDetailedPickup(cfg: { x: number; z: number; rotY: number; color: number }): void {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.75, metalness: 0.25 });
    const cabGeo = new THREE.BoxGeometry(2.3, 1.5, 2.2);
    const cab = new THREE.Mesh(cabGeo, bodyMat);
    cab.position.set(0, 1.15, 1.4);
    cab.castShadow = true;
    group.add(cab);
    this.shootableMeshes.push(cab);

    const bedGeo = new THREE.BoxGeometry(2.3, 1.0, 3.4);
    const bed = new THREE.Mesh(bedGeo, bodyMat);
    bed.position.set(0, 0.85, -1.3);
    bed.castShadow = true;
    group.add(bed);
    this.shootableMeshes.push(bed);

    this.scene.add(group);
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cfg.x, 1.1, cfg.z),
      new THREE.Vector3(2.9, 2.3, 5.8)
    );
    this.colliders.push({ box, mesh: group });
  }

  private createObstaclesAndClutter(): void {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x6e7678, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3629, roughness: 0.85 });
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x7c493b, roughness: 0.65, metalness: 0.45 });
    const trashMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 });

    // 1. Concrete Roadblocks
    const rbPositions = [
      { x: -5, z: -15, rotY: 0.2 },
      { x: 3, z: 18, rotY: -0.15 },
      { x: 20, z: 5, rotY: 1.4 },
      { x: -22, z: -5, rotY: 1.6 }
    ];

    rbPositions.forEach(rb => {
      const geo = new THREE.BoxGeometry(3.6, 1.1, 0.7);
      const mesh = new THREE.Mesh(geo, concreteMat);
      mesh.position.set(rb.x, 0.55, rb.z);
      mesh.rotation.y = rb.rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      const box = new THREE.Box3().setFromCenterAndSize(mesh.position, new THREE.Vector3(3.8, 1.5, 1.6));
      this.colliders.push({ box, mesh });
    });

    // 2. Burning Barrels & Oil Drums
    const drumPositions = [
      { x: -8, z: -7, burning: true },
      { x: 9, z: 7, burning: false },
      { x: -12, z: 10, burning: false },
      { x: 11, z: -10, burning: true }
    ];

    const drumGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10);
    drumPositions.forEach(d => {
      const mesh = new THREE.Mesh(drumGeo, drumMat);
      mesh.position.set(d.x, 0.55, d.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      const box = new THREE.Box3().setFromCenterAndSize(mesh.position, new THREE.Vector3(1.1, 1.3, 1.1));
      this.colliders.push({ box, mesh });

      if (d.burning) {
        const fireLight = new THREE.PointLight(0xff7722, 2.0, 16);
        fireLight.position.set(d.x, 1.35, d.z);
        this.scene.add(fireLight);
        this.flickeringLights.push({ light: fireLight, baseIntensity: 2.0, timeOffset: Math.random() * 10 });

        const fireCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.35, 0.65, 6),
          new THREE.MeshBasicMaterial({ color: 0xffaa22 })
        );
        fireCone.position.set(d.x, 1.25, d.z);
        this.scene.add(fireCone);
      }
    });

    // 3. Garbage Bags & Debris Piles
    const trashPiles = [
      { x: -16, z: -17 }, { x: 17, z: -15 }, { x: -16, z: 17 }, { x: 17, z: 22 },
      { x: -3, z: 10 }, { x: 2, z: -11 }
    ];

    trashPiles.forEach(tp => {
      const bagGeo = new THREE.DodecahedronGeometry(0.45, 0);
      const bag = new THREE.Mesh(bagGeo, trashMat);
      bag.position.set(tp.x, 0.28, tp.z);
      bag.scale.set(1.1, 0.7, 1.0);
      bag.castShadow = true;
      this.scene.add(bag);
    });
  }

  private createTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x475338, roughness: 0.8 });
    const autumnLeafMat = new THREE.MeshStandardMaterial({ color: 0x6e4726, roughness: 0.85 });

    const treeLocations = [
      { x: -35, z: -35 }, { x: -42, z: -20 }, { x: -15, z: -38 }, { x: -38, z: -8 },
      { x: 38, z: -38 }, { x: 42, z: -15 }, { x: 18, z: -38 }, { x: 35, z: -8 },
      { x: -38, z: 38 }, { x: -44, z: 18 }, { x: -16, z: 42 }, { x: -36, z: 8 },
      { x: 38, z: 38 }, { x: 42, z: 18 }, { x: 18, z: 42 }, { x: 36, z: 8 },
      { x: -8, z: -45 }, { x: 8, z: -52 }, { x: -48, z: -7 }, { x: 50, z: 7 },
      { x: 8, z: 48 }, { x: -7, z: 54 }, { x: -52, z: 8 }, { x: 48, z: -8 }
    ];

    treeLocations.forEach((loc, idx) => {
      const tree = new THREE.Group();
      tree.position.set(loc.x, 0, loc.z);

      const height = 4.8 + (idx % 3) * 0.8;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, height, 6), trunkMat);
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      tree.add(trunk);
      this.shootableMeshes.push(trunk);

      const folMat = idx % 2 === 0 ? leafMat : autumnLeafMat;
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(2.0 + (idx % 2) * 0.4, 0), folMat);
      foliage.position.y = height + 1.1;
      foliage.castShadow = true;
      tree.add(foliage);
      this.shootableMeshes.push(foliage);

      this.scene.add(tree);

      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(loc.x, height / 2, loc.z),
        new THREE.Vector3(1.1, height, 1.1)
      );
      this.colliders.push({ box, mesh: tree });
    });
  }

  private createStreetLamps(): void {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.6, metalness: 0.65 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffeaa7 });

    const lampPositions = [
      { x: -7.5, z: -9 }, { x: 7.5, z: 9 },
      { x: -7.5, z: 25 }, { x: 7.5, z: -25 },
      { x: -28, z: -7.5 }, { x: 28, z: 7.5 }
    ];

    lampPositions.forEach((lp, idx) => {
      const group = new THREE.Group();
      group.position.set(lp.x, 0, lp.z);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.2, 6), poleMat);
      pole.position.y = 2.6;
      pole.castShadow = true;
      group.add(pole);
      this.shootableMeshes.push(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), poleMat);
      arm.position.set(0.4, 5.2, 0);
      group.add(arm);

      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), lampGlowMat);
      bulb.position.set(0.8, 5.05, 0);
      group.add(bulb);

      this.scene.add(group);

      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(lp.x, 2.6, lp.z),
        new THREE.Vector3(0.5, 5.2, 0.5)
      );
      this.colliders.push({ box, mesh: group });

      const light = new THREE.PointLight(0xffeaa7, 1.5, 18);
      light.position.set(lp.x + 0.8, 4.9, lp.z);
      this.scene.add(light);
      this.flickeringLights.push({ light, baseIntensity: 1.5, timeOffset: idx * 1.5 });
    });
  }

  private createPerimeterWalls(): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d352e, roughness: 0.9 });
    const size = 120;
    const half = size / 2;

    const wallsData = [
      { x: 0, z: -half, w: size, d: 1.0 },
      { x: 0, z: half, w: size, d: 1.0 },
      { x: -half, z: 0, w: 1.0, d: size },
      { x: half, z: 0, w: 1.0, d: size }
    ];

    wallsData.forEach(w => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, 4.2, w.d), wallMat);
      mesh.position.set(w.x, 2.1, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      const box = new THREE.Box3().setFromCenterAndSize(mesh.position, new THREE.Vector3(w.w + 0.2, 5.0, w.d + 0.2));
      this.colliders.push({ box, mesh });
    });
  }

  // Section 8: Interactive World Objects (Doors, Supply Crates, Generator)
  private createInteractiveElements(): void {
    const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x4f3a2c, roughness: 0.8 });
    const doorHandleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.9 });

    // 1. Interactive Doors at House Entrances
    const doorConfigs = [
      { id: 'door-nw', x: -22, z: -18.25, rotY: 0 },
      { id: 'door-ne', x: 24, z: -17.25, rotY: 0 },
      { id: 'door-sw', x: -25, z: 15.75, rotY: Math.PI },
      { id: 'door-se', x: 22, z: 20.75, rotY: Math.PI }
    ];

    doorConfigs.forEach(cfg => {
      const group = new THREE.Group();
      group.position.set(cfg.x, 0, cfg.z);
      group.rotation.y = cfg.rotY;

      // Pivot at door hinge (left side)
      const pivot = new THREE.Group();
      pivot.position.set(-1.1, 0, 0);

      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.1, 0.12), doorWoodMat);
      doorMesh.position.set(1.1, 1.55, 0);
      doorMesh.castShadow = true;
      pivot.add(doorMesh);
      this.shootableMeshes.push(doorMesh);

      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6), doorHandleMat);
      handle.position.set(2.0, 1.5, 0.1);
      doorMesh.add(handle);

      group.add(pivot);
      this.scene.add(group);

      const center = new THREE.Vector3(cfg.x, 1.5, cfg.z);
      const box = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(2.4, 3.2, 0.4));

      this.doors.push({
        id: cfg.id,
        group,
        pivot,
        isOpen: false,
        box,
        center
      });
    });

    // 2. Interactive Military Supply Crates
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3d4a33, roughness: 0.7, metalness: 0.3 });
    const latchMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.4, metalness: 0.7 });

    const crateConfigs = [
      { id: 'crate-1', x: -20, z: -21, loot: 'ammo' as const },
      { id: 'crate-2', x: 22, z: -20, loot: 'health' as const },
      { id: 'crate-3', x: -23, z: 20, loot: 'grenade' as const },
      { id: 'crate-4', x: 20, z: 24, loot: 'ammo' as const }
    ];

    crateConfigs.forEach(cfg => {
      const group = new THREE.Group();
      group.position.set(cfg.x, 0, cfg.z);

      const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.65, 0.9), crateMat);
      base.position.y = 0.325;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);
      this.shootableMeshes.push(base);

      // Lid pivot
      const lidGroup = new THREE.Group();
      lidGroup.position.set(0, 0.65, -0.45);

      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.12, 0.92), crateMat);
      lid.position.set(0, 0.06, 0.45);
      lid.castShadow = true;
      lidGroup.add(lid);

      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.06), latchMat);
      latch.position.set(0, 0.06, 0.92);
      lidGroup.add(latch);

      group.add(lidGroup);
      this.scene.add(group);

      const center = new THREE.Vector3(cfg.x, 0.4, cfg.z);
      const box = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(1.6, 1.0, 1.1));
      this.colliders.push({ box, mesh: group });

      this.crates.push({
        id: cfg.id,
        group,
        lid: lidGroup,
        isOpened: false,
        center,
        lootType: cfg.loot
      });
    });

    // 3. Interactive Power Generator (in South-West Depot)
    const genGroup = new THREE.Group();
    genGroup.position.set(-27, 0, 24);

    const genBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x8e44ad, roughness: 0.6, metalness: 0.4 })
    );
    genBase.position.y = 0.7;
    genBase.castShadow = true;
    genGroup.add(genBase);
    this.shootableMeshes.push(genBase);

    // Indicator light (red = off, green = on)
    const indMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    indMesh.position.set(0, 1.2, 0.62);
    genGroup.add(indMesh);

    this.scene.add(genGroup);

    const genCenter = new THREE.Vector3(-27, 0.7, 24);
    const genBox = new THREE.Box3().setFromCenterAndSize(genCenter, new THREE.Vector3(1.8, 1.6, 1.4));
    this.colliders.push({ box: genBox, mesh: genGroup });

    // Floodlights connected to generator
    const fLight1 = new THREE.PointLight(0xffffff, 0, 25);
    fLight1.position.set(-22, 5.0, 22);
    this.scene.add(fLight1);

    const fLight2 = new THREE.PointLight(0xffffff, 0, 25);
    fLight2.position.set(0, 6.0, 0);
    this.scene.add(fLight2);

    this.generator = {
      group: genGroup,
      center: genCenter,
      isActive: false,
      floodlights: [fLight1, fLight2]
    };
  }

  private setupSpawnPoints(): void {
    this.spawnPoints = [
      new THREE.Vector3(-46, 0, -46),
      new THREE.Vector3(46, 0, -46),
      new THREE.Vector3(-46, 0, 46),
      new THREE.Vector3(46, 0, 46),
      new THREE.Vector3(0, 0, -52),
      new THREE.Vector3(0, 0, 52),
      new THREE.Vector3(-52, 0, 0),
      new THREE.Vector3(52, 0, 0),
      new THREE.Vector3(-34, 0, -10),
      new THREE.Vector3(34, 0, 10),
      new THREE.Vector3(10, 0, -36),
      new THREE.Vector3(-10, 0, 36)
    ];

    this.pickupSpawnPoints = [
      new THREE.Vector3(-3, 0.4, -3),
      new THREE.Vector3(3, 0.4, 3),
      new THREE.Vector3(-12, 0.4, 18),
      new THREE.Vector3(14, 0.4, -18),
      new THREE.Vector3(-22, 0.4, -14),
      new THREE.Vector3(20, 0.4, 16),
      new THREE.Vector3(0, 0.4, -22),
      new THREE.Vector3(0, 0.4, 22)
    ];
  }

  // Interactivity Proximity Check: returns actionable prompt if close to interactive object
  public checkInteractionTarget(playerPos: THREE.Vector3): { targetType: 'door' | 'crate' | 'generator' | null; prompt: string; targetObj?: any } {
    // 1. Check Doors (within 2.4m)
    for (const door of this.doors) {
      if (door.center.distanceTo(playerPos) < 2.5) {
        return {
          targetType: 'door',
          prompt: door.isOpen ? '[E] CLOSE DOOR' : '[E] OPEN DOOR',
          targetObj: door
        };
      }
    }

    // 2. Check Crates (within 2.2m)
    for (const crate of this.crates) {
      if (!crate.isOpened && crate.center.distanceTo(playerPos) < 2.3) {
        return {
          targetType: 'crate',
          prompt: '[E] SEARCH SUPPLY CRATE',
          targetObj: crate
        };
      }
    }

    // 3. Check Generator (within 2.5m)
    if (this.generator.center.distanceTo(playerPos) < 2.6) {
      return {
        targetType: 'generator',
        prompt: this.generator.isActive ? '[E] DEACTIVATE GENERATOR' : '[E] START GENERATOR',
        targetObj: this.generator
      };
    }

    return { targetType: null, prompt: '' };
  }

  public interactWith(target: { targetType: 'door' | 'crate' | 'generator'; targetObj: any }): { actionDone: string; loot?: string } {
    if (target.targetType === 'door') {
      const door = target.targetObj as InteractiveDoor;
      door.isOpen = !door.isOpen;
      door.pivot.rotation.y = door.isOpen ? -Math.PI / 2 : 0;
      this.audio.playDoorCreak();
      return { actionDone: door.isOpen ? 'DOOR OPENED' : 'DOOR CLOSED' };
    } else if (target.targetType === 'crate') {
      const crate = target.targetObj as InteractiveCrate;
      if (!crate.isOpened) {
        crate.isOpened = true;
        crate.lid.rotation.x = -Math.PI / 1.7;
        this.audio.playInteract();
        return { actionDone: 'SUPPLY CRATE OPENED', loot: crate.lootType };
      }
    } else if (target.targetType === 'generator') {
      const gen = target.targetObj as InteractiveGenerator;
      gen.isActive = !gen.isActive;
      gen.floodlights.forEach(l => (l.intensity = gen.isActive ? 2.8 : 0));
      this.audio.playFlashlightToggle();
      return { actionDone: gen.isActive ? 'GENERATOR ONLINE: FLOODLIGHTS ACTIVE' : 'GENERATOR OFFLINE' };
    }
    return { actionDone: '' };
  }

  public update(time: number): void {
    for (const item of this.flickeringLights) {
      const flicker = Math.sin(time * 12 + item.timeOffset) * 0.16 + Math.sin(time * 36 + item.timeOffset * 2) * 0.08;
      item.light.intensity = Math.max(0.4, item.baseIntensity + flicker);
    }
  }

  public checkSphereCollision(pos: THREE.Vector3, radius: number): { hit: boolean; pushVector: THREE.Vector3 } {
    const pushVector = new THREE.Vector3();
    let hitAny = false;

    for (const collider of this.colliders) {
      const closestPoint = new THREE.Vector3(
        Math.max(collider.box.min.x, Math.min(pos.x, collider.box.max.x)),
        Math.max(collider.box.min.y, Math.min(pos.y, collider.box.max.y)),
        Math.max(collider.box.min.z, Math.min(pos.z, collider.box.max.z))
      );

      const distSq = pos.distanceToSquared(closestPoint);
      if (distSq < radius * radius && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const depth = radius - dist;
        const normal = pos.clone().sub(closestPoint).normalize();
        pushVector.addScaledVector(normal, depth);
        hitAny = true;
      }
    }

    return { hit: hitAny, pushVector };
  }
}
