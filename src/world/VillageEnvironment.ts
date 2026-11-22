import * as THREE from 'three';

export interface Collider {
  box: THREE.Box3;
  mesh?: THREE.Object3D;
}

export class VillageEnvironment {
  public scene: THREE.Scene;
  public colliders: Collider[] = [];
  public shootableMeshes: THREE.Object3D[] = [];
  public spawnPoints: THREE.Vector3[] = [];
  public pickupSpawnPoints: THREE.Vector3[] = [];

  // Flickering lights for atmosphere
  private flickeringLights: { light: THREE.PointLight; baseIntensity: number; timeOffset: number }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupLightingAndFog();
    this.createGroundAndRoads();
    this.createHouses();
    this.createVehicles();
    this.createObstaclesAndBarricades();
    this.createTrees();
    this.createStreetLamps();
    this.createPerimeterWalls();
    this.setupSpawnPoints();
  }

  private setupLightingAndFog(): void {
    // Post-apocalyptic atmospheric fog
    this.scene.fog = new THREE.FogExp2(0x1a211e, 0.022);

    // Ambient light - cool muted tones
    const ambientLight = new THREE.AmbientLight(0x424f57, 0.9);
    this.scene.add(ambientLight);

    // Directional light - Pale hazy sun/moon
    const dirLight = new THREE.DirectionalLight(0xdde3ea, 1.3);
    dirLight.position.set(40, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 140;
    const d = 55;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Hemispheric light for subtle ground bounce
    const hemiLight = new THREE.HemisphereLight(0x687884, 0x222620, 0.6);
    this.scene.add(hemiLight);
  }

  private createGroundAndRoads(): void {
    // 1. Procedural Terrain Texture (Dirt, Mud, Gravel)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base dirt color
    ctx.fillStyle = '#2d3329';
    ctx.fillRect(0, 0, 512, 512);

    // Noise patches
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 6 + 2;
      const shade = Math.floor(Math.random() * 30 + 35);
      ctx.fillStyle = `rgb(${shade + 5}, ${shade + 10}, ${shade})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const groundTexture = new THREE.CanvasTexture(canvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(16, 16);

    const groundGeo = new THREE.PlaneGeometry(140, 140);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.9,
      metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'Ground';
    this.scene.add(ground);
    this.shootableMeshes.push(ground);

    // 2. Roads - Crossroads Layout (North-South & East-West)
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x242426,
      roughness: 0.85,
      metalness: 0.1
    });

    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4e,
      roughness: 0.7
    });

    // North-South Road
    const nsRoadGeo = new THREE.PlaneGeometry(12, 130);
    const nsRoad = new THREE.Mesh(nsRoadGeo, roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.y = 0.02;
    nsRoad.receiveShadow = true;
    this.scene.add(nsRoad);
    this.shootableMeshes.push(nsRoad);

    // East-West Road
    const ewRoadGeo = new THREE.PlaneGeometry(130, 12);
    const ewRoad = new THREE.Mesh(ewRoadGeo, roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.y = 0.02;
    ewRoad.receiveShadow = true;
    this.scene.add(ewRoad);
    this.shootableMeshes.push(ewRoad);

    // Road markings (yellow dashed lines)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd69e2e });
    for (let z = -55; z <= 55; z += 6) {
      if (Math.abs(z) < 8) continue; // Skip intersection
      const lineGeo = new THREE.PlaneGeometry(0.35, 3.2);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.03, z);
      this.scene.add(line);
    }

    for (let x = -55; x <= 55; x += 6) {
      if (Math.abs(x) < 8) continue;
      const lineGeo = new THREE.PlaneGeometry(3.2, 0.35);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.03, 0);
      this.scene.add(line);
    }
  }

  private createHouses(): void {
    // Materials
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3c31, roughness: 0.85 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x5c4238, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.7 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x636e72, roughness: 0.8 });

    // House 1: North-West Large House
    this.buildHouse({
      x: -22,
      z: -24,
      width: 14,
      depth: 12,
      height: 6.5,
      roofType: 'pitched',
      wallMat: brickMat,
      roofMat: roofMat,
      hasPorch: true
    });

    // House 2: North-East Cabin
    this.buildHouse({
      x: 24,
      z: -22,
      width: 12,
      depth: 10,
      height: 5.5,
      roofType: 'pitched',
      wallMat: woodMat,
      roofMat: roofMat,
      hasPorch: false
    });

    // House 3: South-West Ruined Garage / Depot
    this.buildHouse({
      x: -25,
      z: 22,
      width: 15,
      depth: 14,
      height: 6.0,
      roofType: 'flat',
      wallMat: concreteMat,
      roofMat: roofMat,
      hasPorch: false
    });

    // House 4: South-East Abandoned Residence
    this.buildHouse({
      x: 22,
      z: 26,
      width: 13,
      depth: 11,
      height: 5.8,
      roofType: 'pitched',
      wallMat: brickMat,
      roofMat: roofMat,
      hasPorch: true
    });

    // House 5: North Roadside Outpost / Store
    this.buildHouse({
      x: -18,
      z: -48,
      width: 10,
      depth: 8,
      height: 4.8,
      roofType: 'flat',
      wallMat: woodMat,
      roofMat: roofMat,
      hasPorch: false
    });

    // House 6: South Roadside Shed
    this.buildHouse({
      x: 20,
      z: 48,
      width: 9,
      depth: 7,
      height: 4.5,
      roofType: 'pitched',
      wallMat: concreteMat,
      roofMat: roofMat,
      hasPorch: false
    });
  }

  private buildHouse(config: {
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
    roofType: 'pitched' | 'flat';
    wallMat: THREE.Material;
    roofMat: THREE.Material;
    hasPorch: boolean;
  }): void {
    const group = new THREE.Group();
    group.position.set(config.x, 0, config.z);

    // Main House Body (Walls)
    const wallGeo = new THREE.BoxGeometry(config.width, config.height, config.depth);
    const walls = new THREE.Mesh(wallGeo, config.wallMat);
    walls.position.y = config.height / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);
    this.shootableMeshes.push(walls);

    // Doorway indent / dark entrance
    const doorGeo = new THREE.BoxGeometry(2.0, 3.2, 0.4);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.6, config.depth / 2 + 0.1);
    group.add(door);

    // Boarded Windows
    const winGeo = new THREE.BoxGeometry(1.6, 1.8, 0.2);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    const win1 = new THREE.Mesh(winGeo, winMat);
    win1.position.set(-config.width / 3, config.height * 0.55, config.depth / 2 + 0.1);
    group.add(win1);

    const win2 = new THREE.Mesh(winGeo, winMat);
    win2.position.set(config.width / 3, config.height * 0.55, config.depth / 2 + 0.1);
    group.add(win2);

    // Roof
    if (config.roofType === 'pitched') {
      const roofGeo = new THREE.ConeGeometry(
        Math.max(config.width, config.depth) * 0.75,
        config.height * 0.5,
        4
      );
      const roof = new THREE.Mesh(roofGeo, config.roofMat);
      roof.position.y = config.height + config.height * 0.25;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
      this.shootableMeshes.push(roof);
    } else {
      const roofGeo = new THREE.BoxGeometry(config.width + 0.8, 0.6, config.depth + 0.8);
      const roof = new THREE.Mesh(roofGeo, config.roofMat);
      roof.position.y = config.height + 0.3;
      roof.castShadow = true;
      group.add(roof);
      this.shootableMeshes.push(roof);
    }

    // Porch
    if (config.hasPorch) {
      const porchGeo = new THREE.BoxGeometry(6.0, 0.4, 3.0);
      const porchMat = new THREE.MeshStandardMaterial({ color: 0x3e322a });
      const porch = new THREE.Mesh(porchGeo, porchMat);
      porch.position.set(0, 0.2, config.depth / 2 + 1.5);
      porch.receiveShadow = true;
      group.add(porch);
      this.shootableMeshes.push(porch);
    }

    this.scene.add(group);

    // House Collider (AABB box)
    const box = new THREE.Box3();
    box.setFromCenterAndSize(
      new THREE.Vector3(config.x, config.height / 2, config.z),
      new THREE.Vector3(config.width + 0.4, config.height + 1, config.depth + 0.4)
    );
    this.colliders.push({ box, mesh: group });
  }

  private createVehicles(): void {
    // Car 1: Near crossroads, rotated
    this.buildCar({
      x: -7,
      z: 5,
      rotY: 0.35,
      color: 0x5a2d28 // Rusted dark red
    });

    // Car 2: Abandoned police car / sedan near East street
    this.buildCar({
      x: 18,
      z: -4,
      rotY: -0.6,
      color: 0x2c3e50 // Faded navy
    });

    // Car 3: Truck on North street
    this.buildTruck({
      x: 4.5,
      z: -28,
      rotY: 0.15,
      color: 0x485460 // Olive drab
    });

    // Car 4: Damaged car on South street
    this.buildCar({
      x: -4.5,
      z: 32,
      rotY: 0.8,
      color: 0x715839 // Dirty bronze
    });
  }

  private buildCar(config: { x: number; z: number; rotY: number; color: number }): void {
    const group = new THREE.Group();
    group.position.set(config.x, 0, config.z);
    group.rotation.y = config.rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.75, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.2, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });

    // Lower Chassis
    const chassisGeo = new THREE.BoxGeometry(2.1, 0.8, 4.4);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.65;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);
    this.shootableMeshes.push(chassis);

    // Cabin / Roof
    const cabinGeo = new THREE.BoxGeometry(1.9, 0.75, 2.3);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.4, -0.3);
    cabin.castShadow = true;
    group.add(cabin);
    this.shootableMeshes.push(cabin);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPos = [
      [-1.05, 0.4, 1.3],
      [1.05, 0.4, 1.3],
      [-1.05, 0.4, -1.3],
      [1.05, 0.4, -1.3]
    ];

    wheelPos.forEach(p => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(p[0], p[1], p[2]);
      wheel.castShadow = true;
      group.add(wheel);
    });

    this.scene.add(group);

    // Collider
    const box = new THREE.Box3();
    box.setFromCenterAndSize(
      new THREE.Vector3(config.x, 1.0, config.z),
      new THREE.Vector3(2.6, 2.0, 4.8)
    );
    this.colliders.push({ box, mesh: group });
  }

  private buildTruck(config: { x: number; z: number; rotY: number; color: number }): void {
    const group = new THREE.Group();
    group.position.set(config.x, 0, config.z);
    group.rotation.y = config.rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.8, metalness: 0.25 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });

    // Truck Cab
    const cabGeo = new THREE.BoxGeometry(2.4, 1.8, 2.2);
    const cab = new THREE.Mesh(cabGeo, bodyMat);
    cab.position.set(0, 1.2, 1.6);
    cab.castShadow = true;
    group.add(cab);
    this.shootableMeshes.push(cab);

    // Cargo Bed
    const bedGeo = new THREE.BoxGeometry(2.3, 1.1, 3.8);
    const bed = new THREE.Mesh(bedGeo, bodyMat);
    bed.position.set(0, 0.9, -1.3);
    bed.castShadow = true;
    group.add(bed);
    this.shootableMeshes.push(bed);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 8);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPos = [
      [-1.25, 0.5, 1.6],
      [1.25, 0.5, 1.6],
      [-1.25, 0.5, -0.6],
      [1.25, 0.5, -0.6],
      [-1.25, 0.5, -2.2],
      [1.25, 0.5, -2.2]
    ];

    wheelPos.forEach(p => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(p[0], p[1], p[2]);
      wheel.castShadow = true;
      group.add(wheel);
    });

    this.scene.add(group);

    // Collider
    const box = new THREE.Box3();
    box.setFromCenterAndSize(
      new THREE.Vector3(config.x, 1.2, config.z),
      new THREE.Vector3(3.0, 2.4, 6.2)
    );
    this.colliders.push({ box, mesh: group });
  }

  private createObstaclesAndBarricades(): void {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 });
    const rustMetalMat = new THREE.MeshStandardMaterial({ color: 0x8d5b4c, roughness: 0.7, metalness: 0.4 });

    // 1. Concrete Roadblocks
    const roadblockPos = [
      { x: -5, z: -15, rotY: 0.2 },
      { x: 3, z: 18, rotY: -0.15 },
      { x: 20, z: 5, rotY: 1.4 },
      { x: -22, z: -5, rotY: 1.6 }
    ];

    roadblockPos.forEach(rb => {
      const geo = new THREE.BoxGeometry(3.5, 1.1, 0.7);
      const mesh = new THREE.Mesh(geo, concreteMat);
      mesh.position.set(rb.x, 0.55, rb.z);
      mesh.rotation.y = rb.rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(mesh.position, new THREE.Vector3(3.8, 1.5, 1.6));
      this.colliders.push({ box, mesh });
    });

    // 2. Wooden Crates
    const crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const crateLocations = [
      { x: -14, z: -18 },
      { x: -13, z: -18.5 },
      { x: -13.5, z: -18, y: 1.2 }, // Stacked
      { x: 16, z: -16 },
      { x: 16, z: 20 },
      { x: -18, z: 15 },
      { x: -18, z: 16.2 }
    ];

    crateLocations.forEach(c => {
      const mesh = new THREE.Mesh(crateGeo, woodMat);
      mesh.position.set(c.x, (c.y || 0) + 0.6, c.z);
      mesh.rotation.y = Math.random() * 0.4;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      if (!c.y) {
        const box = new THREE.Box3();
        box.setFromCenterAndSize(new THREE.Vector3(c.x, 0.9, c.z), new THREE.Vector3(1.5, 2.0, 1.5));
        this.colliders.push({ box, mesh });
      }
    });

    // 3. Rusty Drums / Burning Barrels
    const drumGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10);
    const drumPos = [
      { x: -8, z: -7, burning: true },
      { x: 9, z: 7, burning: false },
      { x: -12, z: 10, burning: false },
      { x: 11, z: -10, burning: true }
    ];

    drumPos.forEach(d => {
      const mesh = new THREE.Mesh(drumGeo, rustMetalMat);
      mesh.position.set(d.x, 0.55, d.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(mesh.position, new THREE.Vector3(1.1, 1.3, 1.1));
      this.colliders.push({ box, mesh });

      if (d.burning) {
        // Fire Point Light
        const fireLight = new THREE.PointLight(0xff7722, 1.8, 14);
        fireLight.position.set(d.x, 1.3, d.z);
        this.scene.add(fireLight);

        this.flickeringLights.push({
          light: fireLight,
          baseIntensity: 1.8,
          timeOffset: Math.random() * 10
        });

        // Glowing fire mesh inside barrel
        const fireMeshGeo = new THREE.ConeGeometry(0.35, 0.6, 6);
        const fireMeshMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
        const fireMesh = new THREE.Mesh(fireMeshGeo, fireMeshMat);
        fireMesh.position.set(d.x, 1.2, d.z);
        this.scene.add(fireMesh);
      }
    });
  }

  private createTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x475338, roughness: 0.8 });
    const autumnLeafMat = new THREE.MeshStandardMaterial({ color: 0x6e4726, roughness: 0.85 });

    // Distinct tree coordinates spread across the village
    const treeLocations = [
      // NW quadrant
      { x: -35, z: -35 }, { x: -42, z: -20 }, { x: -15, z: -38 }, { x: -38, z: -8 },
      // NE quadrant
      { x: 38, z: -38 }, { x: 42, z: -15 }, { x: 18, z: -38 }, { x: 35, z: -8 },
      // SW quadrant
      { x: -38, z: 38 }, { x: -44, z: 18 }, { x: -16, z: 42 }, { x: -36, z: 8 },
      // SE quadrant
      { x: 38, z: 38 }, { x: 42, z: 18 }, { x: 18, z: 42 }, { x: 36, z: 8 },
      // Roadside greenery
      { x: -8, z: -45 }, { x: 8, z: -52 }, { x: -48, z: -7 }, { x: 50, z: 7 },
      { x: 8, z: 48 }, { x: -7, z: 54 }, { x: -52, z: 8 }, { x: 48, z: -8 }
    ];

    treeLocations.forEach((loc, idx) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(loc.x, 0, loc.z);

      const height = 4.5 + (idx % 3) * 0.8;
      const trunkGeo = new THREE.CylinderGeometry(0.25, 0.45, height, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      treeGroup.add(trunk);
      this.shootableMeshes.push(trunk);

      // Low poly faceted foliage
      const foliageMat = idx % 2 === 0 ? leafMat : autumnLeafMat;
      const foliageGeo = new THREE.DodecahedronGeometry(1.8 + (idx % 2) * 0.4, 0);
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = height + 0.9;
      foliage.castShadow = true;
      treeGroup.add(foliage);
      this.shootableMeshes.push(foliage);

      this.scene.add(treeGroup);

      // Trunk collider
      const box = new THREE.Box3();
      box.setFromCenterAndSize(
        new THREE.Vector3(loc.x, height / 2, loc.z),
        new THREE.Vector3(1.0, height, 1.0)
      );
      this.colliders.push({ box, mesh: treeGroup });
    });
  }

  private createStreetLamps(): void {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.6, metalness: 0.6 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffeaa7 });

    const lampPositions = [
      { x: -7.5, z: -9 },
      { x: 7.5, z: 9 },
      { x: -7.5, z: 25 },
      { x: 7.5, z: -25 },
      { x: -28, z: -7.5 },
      { x: 28, z: 7.5 }
    ];

    lampPositions.forEach((lp, idx) => {
      const group = new THREE.Group();
      group.position.set(lp.x, 0, lp.z);

      // Vertical Pole
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.0, 6);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2.5;
      pole.castShadow = true;
      group.add(pole);
      this.shootableMeshes.push(pole);

      // Top Arm
      const armGeo = new THREE.BoxGeometry(1.0, 0.1, 0.1);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(0.4, 5.0, 0);
      group.add(arm);

      // Bulb fixture
      const bulbGeo = new THREE.BoxGeometry(0.3, 0.2, 0.3);
      const bulb = new THREE.Mesh(bulbGeo, lampGlowMat);
      bulb.position.set(0.8, 4.85, 0);
      group.add(bulb);

      this.scene.add(group);

      // Collider
      const box = new THREE.Box3();
      box.setFromCenterAndSize(
        new THREE.Vector3(lp.x, 2.5, lp.z),
        new THREE.Vector3(0.5, 5.0, 0.5)
      );
      this.colliders.push({ box, mesh: group });

      // Point Light with subtle flicker
      const light = new THREE.PointLight(0xffeaa7, 1.4, 16);
      light.position.set(lp.x + 0.8, 4.7, lp.z);
      this.scene.add(light);

      this.flickeringLights.push({
        light,
        baseIntensity: 1.4,
        timeOffset: idx * 1.5
      });
    });
  }

  private createPerimeterWalls(): void {
    // Outer village boundaries (120m x 120m perimeter)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d352e, roughness: 0.9 });
    const wallThickness = 1.0;
    const wallHeight = 4.0;
    const size = 120;
    const half = size / 2;

    const wallsData = [
      // North Wall
      { x: 0, z: -half, w: size, d: wallThickness },
      // South Wall
      { x: 0, z: half, w: size, d: wallThickness },
      // West Wall
      { x: -half, z: 0, w: wallThickness, d: size },
      // East Wall
      { x: half, z: 0, w: wallThickness, d: size }
    ];

    wallsData.forEach(w => {
      const geo = new THREE.BoxGeometry(w.w, wallHeight, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, wallHeight / 2, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(
        mesh.position,
        new THREE.Vector3(w.w + 0.2, wallHeight + 1, w.d + 0.2)
      );
      this.colliders.push({ box, mesh });
    });
  }

  private setupSpawnPoints(): void {
    // Enemy spawn points located outside village buildings & roads
    this.spawnPoints = [
      new THREE.Vector3(-45, 0, -45),
      new THREE.Vector3(45, 0, -45),
      new THREE.Vector3(-45, 0, 45),
      new THREE.Vector3(45, 0, 45),
      new THREE.Vector3(0, 0, -52),
      new THREE.Vector3(0, 0, 52),
      new THREE.Vector3(-52, 0, 0),
      new THREE.Vector3(52, 0, 0),
      new THREE.Vector3(-32, 0, -8),
      new THREE.Vector3(32, 0, 8),
      new THREE.Vector3(8, 0, -35),
      new THREE.Vector3(-8, 0, 35)
    ];

    // Pickup spawn locations across crossroads and porch areas
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

  public update(time: number): void {
    // Flickering lights effect
    for (const item of this.flickeringLights) {
      const flicker = Math.sin(time * 12 + item.timeOffset) * 0.15 +
                      Math.sin(time * 35 + item.timeOffset * 2) * 0.08;
      item.light.intensity = Math.max(0.4, item.baseIntensity + flicker);
    }
  }

  // Check collision for player or enemy against world obstacles
  public checkSphereCollision(pos: THREE.Vector3, radius: number): { hit: boolean; pushVector: THREE.Vector3 } {
    const pushVector = new THREE.Vector3();
    let hitAny = false;

    for (const collider of this.colliders) {
      // Find closest point on AABB to sphere center
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
