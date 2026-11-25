import * as THREE from 'three';
import { TimeOfDay, GraphicsQuality } from '../core/Types';
import { AudioManager } from '../core/AudioManager';
import { TextureGenerator } from './TextureGenerator';
import { AssetManager } from '../core/AssetManager';

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

  // Walkable Elevated Platforms & Stairs (Watchtower sniper perch)
  public walkableSurfaces: THREE.Box3[] = [];

  // Supply Depot Beacon & State
  public supplyDepotPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 2);
  public supplyCooldown: number = 0;
  public readonly supplyCooldownMax: number = 25.0;
  public supplyBeaconMesh?: THREE.Mesh;
  public supplyCrateGroup?: THREE.Group;

  // Lighting
  private dirLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private flickeringLights: { light: THREE.PointLight; baseIntensity: number; timeOffset: number }[] = [];
  private volumetricCones: THREE.Mesh[] = [];

  // Sky & Weather
  private skyDome!: THREE.Mesh;
  private sunMoonMesh!: THREE.Mesh;
  private rainParticles: THREE.Points | null = null;
  private rainPositions!: Float32Array;
  private rainCount: number = 2400;
  private dustParticles: THREE.Points | null = null;
  private windTime: number = 0;
  private foliageMeshes: THREE.Mesh[] = [];

  // Interactive Objects
  public doors: InteractiveDoor[] = [];
  public crates: InteractiveCrate[] = [];
  public generator!: InteractiveGenerator;

  // Time of Day & Weather
  public currentTimeOfDay: TimeOfDay = TimeOfDay.DAY;
  public isRaining: boolean = false;

  // Downloaded Assets & Mesh Tracking
  public downloadedModelGroup: THREE.Group = new THREE.Group();
  public groundMesh!: THREE.Mesh;
  public nsRoadMesh?: THREE.Mesh;
  public ewRoadMesh?: THREE.Mesh;
  public buildingWallMeshes: THREE.Mesh[] = [];
  public buildingRoofMeshes: THREE.Mesh[] = [];
  public buildingWoodMeshes: THREE.Mesh[] = [];
  public buildingFloorMeshes: THREE.Mesh[] = [];
  public buildingConcreteMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, audio: AudioManager, timeOfDay: TimeOfDay = TimeOfDay.DAY) {
    this.scene = scene;
    this.audio = audio;
    this.currentTimeOfDay = timeOfDay;

    this.scene.add(this.downloadedModelGroup);

    this.createAtmosphericSky();
    this.setupLightingAndFog();
    this.createGroundAndRoads();
    this.create3DGrassTufts();
    this.createRealisticBuildings();
    this.createVehicles();
    this.createUtilityPolesAndWires();
    this.createObstaclesAndClutter();
    this.createVegetationAndRocks();
    this.createSniperWatchtower();
    this.createSupplyDepot();
    this.createStreetLamps();
    this.createPerimeterWalls();
    this.createInteractiveElements();
    this.createWeatherEffects();
    this.setupSpawnPoints();

    this.applyLoadedAssets();
  }

  /**
   * Returns highest walkable platform/stair surface under the player's feet, or 0 (ground level)
   */
  public getGroundHeightAt(x: number, z: number, currentFeetY: number): number {
    let highest = 0;
    for (const surf of this.walkableSurfaces) {
      if (
        x >= surf.min.x - 0.25 &&
        x <= surf.max.x + 0.25 &&
        z >= surf.min.z - 0.25 &&
        z <= surf.max.z + 0.25
      ) {
        if (currentFeetY >= surf.max.y - 0.6) {
          if (surf.max.y > highest) {
            highest = surf.max.y;
          }
        }
      }
    }
    return highest;
  }

  public setTimeOfDay(time: TimeOfDay): void {
    this.currentTimeOfDay = time;
    this.updateSkyDomeAtmosphere(time);

    if (time === TimeOfDay.DAY) {
      // Crisp, sunny mid-day with soft blue atmospheric horizon haze
      this.scene.fog = new THREE.FogExp2(0xa6d8f5, 0.004);
      if (this.dirLight) {
        this.dirLight.color.setHex(0xfffaed);
        this.dirLight.intensity = 2.4;
        this.dirLight.position.set(40, 85, 30);
      }
      if (this.ambientLight) {
        this.ambientLight.color.setHex(0x92c2e5);
        this.ambientLight.intensity = 1.05;
      }
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xa8dcff); // Bright daylight sky
        this.hemiLight.groundColor.setHex(0x5cb333); // Vibrant green grass bounce
        this.hemiLight.intensity = 0.95;
      }
      if (this.sunMoonMesh) {
        this.sunMoonMesh.material = new THREE.MeshBasicMaterial({ color: 0xfffbee });
        this.sunMoonMesh.position.set(65, 120, 45);
        this.sunMoonMesh.scale.setScalar(1.2);
        this.sunMoonMesh.lookAt(0, 0, 0);
      }
      this.isRaining = false;
      if (this.rainParticles) this.rainParticles.visible = false;
    } else if (time === TimeOfDay.SUNSET) {
      // Golden hour sunset with warm orange and purple hues
      this.scene.fog = new THREE.FogExp2(0x381e26, 0.015);
      if (this.dirLight) {
        this.dirLight.color.setHex(0xf39c12);
        this.dirLight.intensity = 1.4;
        this.dirLight.position.set(75, 30, 50);
      }
      if (this.ambientLight) {
        this.ambientLight.color.setHex(0x482a32);
        this.ambientLight.intensity = 0.65;
      }
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x9c428a);
        this.hemiLight.groundColor.setHex(0x28201a);
        this.hemiLight.intensity = 0.55;
      }
      if (this.sunMoonMesh) {
        this.sunMoonMesh.material = new THREE.MeshBasicMaterial({ color: 0xff5511 });
        this.sunMoonMesh.position.set(90, 36, 65);
        this.sunMoonMesh.scale.setScalar(1.4);
        this.sunMoonMesh.lookAt(0, 0, 0);
      }
    } else { // NIGHT
      // Dark apocalyptic moonlight
      this.scene.fog = new THREE.FogExp2(0x0b0e14, 0.024);
      if (this.dirLight) {
        this.dirLight.color.setHex(0x384a6b);
        this.dirLight.intensity = 0.45;
        this.dirLight.position.set(30, 60, -30);
      }
      if (this.ambientLight) {
        this.ambientLight.color.setHex(0x101622);
        this.ambientLight.intensity = 0.4;
      }
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x182438);
        this.hemiLight.groundColor.setHex(0x080d0a);
        this.hemiLight.intensity = 0.4;
      }
      if (this.sunMoonMesh) {
        this.sunMoonMesh.material = new THREE.MeshBasicMaterial({ color: 0xd0e2ff });
        this.sunMoonMesh.position.set(45, 85, -45);
        this.sunMoonMesh.scale.setScalar(1.0);
        this.sunMoonMesh.lookAt(0, 0, 0);
      }
    }
  }

  /**
   * Apply downloaded 2K PBR materials and 3D models once AssetManager finishes loading
   */
  public applyLoadedAssets(): void {
    const assets = AssetManager.getInstance();
    if (!assets.isLoaded) return;

    // 1. HDRI Environment Map
    if (assets.environmentMap) {
      this.scene.environment = assets.environmentMap;
    }

    // 2. Terrain Ground preserves photorealistic vibrant green grass
    if (this.groundMesh) {
      (this.groundMesh.material as THREE.MeshStandardMaterial).envMapIntensity = 0.8;
    }

    // 3. Buildings PBR Materials
    const wallMat = assets.getMaterial('plaster', 4, 2);
    if (wallMat) {
      this.buildingWallMeshes.forEach(m => (m.material = wallMat));
    }

    const roofMat = assets.getMaterial('rust', 4, 4);
    if (roofMat) {
      this.buildingRoofMeshes.forEach(m => (m.material = roofMat));
    }

    const woodMat = assets.getMaterial('wood', 1, 3);
    if (woodMat) {
      this.buildingWoodMeshes.forEach(m => (m.material = woodMat));
      this.buildingFloorMeshes.forEach(m => (m.material = woodMat));
    }

    const concreteMat = assets.getMaterial('concrete', 2, 2);
    if (concreteMat) {
      this.buildingConcreteMeshes.forEach(m => (m.material = concreteMat));
    }

    // 4. Populate 3D Models if not yet added
    if (this.downloadedModelGroup.children.length === 0) {
      this.populateDownloadedModels(assets);
    }
  }

  /**
   * Populate downloaded 3D assets (cars, barriers, stoves, rocks, gates, poles, lamps, utility boxes, shrubs)
   */
  private populateDownloadedModels(assets: AssetManager): void {
    // A. Covered Cars (Abandoned Vehicles)
    const carConfigs = [
      { x: -9.0, z: -18.0, rotY: 0.35 },
      { x: 14.0, z: 16.0, rotY: -2.2 },
      { x: -18.0, z: 24.0, rotY: 1.15 },
      { x: 24.0, z: -22.0, rotY: -0.6 }
    ];
    for (const cfg of carConfigs) {
      const car = assets.getModelClone('car');
      if (car) {
        car.position.set(cfg.x, 0, cfg.z);
        car.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(car);

        // Low-poly shootable proxy box
        const carProxy = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.8, 4.6),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        carProxy.position.set(cfg.x, 0.9, cfg.z);
        carProxy.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(carProxy);
        this.shootableMeshes.push(carProxy);

        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cfg.x, 0.9, cfg.z),
            new THREE.Vector3(2.4, 1.8, 4.6)
          ),
          mesh: carProxy
        });
      }
    }

    // B. Concrete Road Barriers (Roadblocks & Checkpoints)
    const barrierConfigs = [
      { x: -3.8, z: -8.5, rotY: 0.1 },
      { x: 3.8, z: -8.5, rotY: -0.15 },
      { x: -8.5, z: 3.8, rotY: Math.PI / 2 + 0.1 },
      { x: 8.5, z: -3.8, rotY: Math.PI / 2 - 0.2 },
      { x: 0, z: 46.0, rotY: 0.05 },
      { x: 0, z: -46.0, rotY: -0.05 }
    ];
    for (const cfg of barrierConfigs) {
      const b = assets.getModelClone('barrier');
      if (b) {
        b.position.set(cfg.x, 0, cfg.z);
        b.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(b);

        // Low-poly shootable proxy box
        const bProxy = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 0.9, 0.8),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        bProxy.position.set(cfg.x, 0.45, cfg.z);
        bProxy.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(bProxy);
        this.shootableMeshes.push(bProxy);

        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cfg.x, 0.45, cfg.z),
            new THREE.Vector3(1.7, 0.9, 0.8)
          ),
          mesh: bProxy
        });
      }
    }

    // C. Barrel Stoves (Survivor Camps with glowing embers)
    const stoveConfigs = [
      { x: -12.0, z: 6.0, rotY: 0.4 },
      { x: 16.0, z: -12.0, rotY: -0.8 },
      { x: -5.0, z: 36.0, rotY: 1.2 },
      { x: 18.0, z: 28.0, rotY: -0.3 }
    ];
    for (const cfg of stoveConfigs) {
      const stove = assets.getModelClone('stove');
      if (stove) {
        stove.position.set(cfg.x, 0, cfg.z);
        stove.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(stove);

        // Warm stove light (no shadow pass for performance)
        const stoveLight = new THREE.PointLight(0xff6622, 1.8, 9);
        stoveLight.position.set(cfg.x, 0.7, cfg.z);
        stoveLight.castShadow = false;
        this.downloadedModelGroup.add(stoveLight);
        this.flickeringLights.push({ light: stoveLight, baseIntensity: 1.8, timeOffset: Math.random() * 10 });

        const stoveProxy = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.4, 0.9, 8),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        stoveProxy.position.set(cfg.x, 0.45, cfg.z);
        this.downloadedModelGroup.add(stoveProxy);
        this.shootableMeshes.push(stoveProxy);

        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cfg.x, 0.45, cfg.z),
            new THREE.Vector3(0.8, 0.9, 0.8)
          ),
          mesh: stoveProxy
        });
      }
    }

    // D. Coast Rocks (Natural Cliff Formations at Perimeter)
    const rockConfigs = [
      { x: -38.0, z: -48.0, rotY: 0.5, scale: 0.55 },
      { x: 38.0, z: 48.0, rotY: 2.1, scale: 0.55 }
    ];
    for (const cfg of rockConfigs) {
      const rocks = assets.getModelClone('rocks');
      if (rocks) {
        rocks.position.set(cfg.x, 0, cfg.z);
        rocks.rotation.y = cfg.rotY;
        rocks.scale.setScalar(cfg.scale);
        this.downloadedModelGroup.add(rocks);

        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cfg.x, 1.5 * cfg.scale, cfg.z),
            new THREE.Vector3(14.0 * cfg.scale, 3.0 * cfg.scale, 16.0 * cfg.scale)
          ),
          mesh: rocks
        });
      }
    }

    // E. Large Iron Gates (Perimeter Security Checkpoints)
    const gateConfigs = [
      { x: 0, z: -55.5, rotY: 0 },
      { x: 0, z: 55.5, rotY: Math.PI }
    ];
    for (const cfg of gateConfigs) {
      const gate = assets.getModelClone('gate');
      if (gate) {
        gate.position.set(cfg.x, 0, cfg.z);
        gate.rotation.y = cfg.rotY;
        gate.scale.setScalar(1.15);
        this.downloadedModelGroup.add(gate);

        const gateProxy = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 3.2, 0.4),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        gateProxy.position.set(cfg.x, 1.6, cfg.z);
        gateProxy.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(gateProxy);
        this.shootableMeshes.push(gateProxy);

        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cfg.x, 1.6, cfg.z),
            new THREE.Vector3(3.4, 3.2, 0.4)
          ),
          mesh: gateProxy
        });
      }
    }

    // F. Modular Electricity Poles (Clean utility poles)
    const poleConfigs = [
      { x: -8.5, z: -38.0 },
      { x: -8.5, z: 14.0 },
      { x: 8.5, z: -26.0 },
      { x: 8.5, z: 26.0 }
    ];
    for (const cfg of poleConfigs) {
      const pole = assets.getModelClone('pole');
      if (pole) {
        pole.position.set(cfg.x, 0, cfg.z);
        this.downloadedModelGroup.add(pole);

        const poleProxy = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.25, 10.0, 6),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        poleProxy.position.set(cfg.x, 5.0, cfg.z);
        this.downloadedModelGroup.add(poleProxy);
        this.shootableMeshes.push(poleProxy);

        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cfg.x, 5.0, cfg.z),
            new THREE.Vector3(1.2, 10.0, 1.2)
          ),
          mesh: poleProxy
        });
      }
    }

    // G. Street Lamps (3D lamp models with warm streetlight illumination)
    const lampConfigs = [
      { x: -7.5, z: -7.5, rotY: 0.8 },
      { x: 7.5, z: -7.5, rotY: -0.8 },
      { x: -7.5, z: 7.5, rotY: 2.3 },
      { x: 7.5, z: 7.5, rotY: -2.3 },
      { x: 0, z: -35.0, rotY: 0 },
      { x: 0, z: 35.0, rotY: Math.PI }
    ];
    for (const cfg of lampConfigs) {
      const lamp = assets.getModelClone('street_lamp');
      if (lamp) {
        lamp.position.set(cfg.x, 0, cfg.z);
        lamp.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(lamp);

        // Warm streetlight point light (no shadow map pass for optimal 60 FPS)
        const bulbLight = new THREE.PointLight(0xffd27d, 1.8, 18);
        bulbLight.position.set(cfg.x, 3.8, cfg.z);
        bulbLight.castShadow = false;
        this.downloadedModelGroup.add(bulbLight);

        const lampProxy = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.22, 4.0, 6),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        lampProxy.position.set(cfg.x, 2.0, cfg.z);
        this.downloadedModelGroup.add(lampProxy);
        this.shootableMeshes.push(lampProxy);

        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cfg.x, 2.0, cfg.z),
            new THREE.Vector3(0.6, 4.0, 0.6)
          ),
          mesh: lampProxy
        });
      }
    }

    // H. Utility Boxes (Ground electrical boxes)
    const boxConfigs = [
      { x: -8.8, z: -13.2, rotY: 0.2 },
      { x: 8.8, z: 26.8, rotY: -1.4 },
      { x: -14.5, z: 8.5, rotY: 0 },
      { x: 15.5, z: -18.5, rotY: Math.PI / 2 }
    ];
    for (const cfg of boxConfigs) {
      const box = assets.getModelClone('utility_box');
      if (box) {
        box.position.set(cfg.x, 0, cfg.z);
        box.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(box);

        const boxProxy = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 1.2, 0.6),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        boxProxy.position.set(cfg.x, 0.6, cfg.z);
        boxProxy.rotation.y = cfg.rotY;
        this.downloadedModelGroup.add(boxProxy);
        this.shootableMeshes.push(boxProxy);

        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cfg.x, 0.6, cfg.z),
            new THREE.Vector3(1.0, 1.2, 0.6)
          ),
          mesh: boxProxy
        });
      }
    }

    // I. Realistic 3D Trees & Foliage (Shrub 02 Model Clones)
    const shrubConfigs = [
      { x: -7.2, z: -12.0, rotY: 0.5, scale: 1.8 },
      { x: 7.2, z: -16.0, rotY: 1.8, scale: 2.2 },
      { x: -12.5, z: 18.0, rotY: 2.7, scale: 1.9 },
      { x: 12.5, z: 14.0, rotY: 3.5, scale: 2.4 },
      { x: -16.0, z: -6.0, rotY: 0.2, scale: 1.5 },
      { x: 16.0, z: 8.0, rotY: 1.2, scale: 1.6 },
      { x: -22.0, z: 15.0, rotY: 2.1, scale: 2.3 },
      { x: 20.0, z: -15.0, rotY: 4.0, scale: 2.1 },
      { x: -28.0, z: -25.0, rotY: 0.7, scale: 2.6 },
      { x: 28.0, z: 25.0, rotY: 2.4, scale: 2.5 },
      { x: -35.0, z: 10.0, rotY: 1.4, scale: 2.0 },
      { x: 35.0, z: -10.0, rotY: 3.1, scale: 2.2 },
      { x: -5.0, z: -32.0, rotY: 0.9, scale: 2.4 },
      { x: 6.0, z: 32.0, rotY: 2.2, scale: 2.3 },
      { x: -25.0, z: 32.0, rotY: 1.7, scale: 1.7 },
      { x: 25.0, z: -32.0, rotY: 4.1, scale: 2.0 },
      { x: -40.0, z: -40.0, rotY: 0.4, scale: 2.5 },
      { x: 40.0, z: 40.0, rotY: 2.9, scale: 2.7 },
      { x: -40.0, z: 40.0, rotY: 1.1, scale: 2.6 },
      { x: 40.0, z: -40.0, rotY: 3.6, scale: 2.4 }
    ];
    for (const cfg of shrubConfigs) {
      const shrub = assets.getModelClone('shrub');
      if (shrub) {
        shrub.position.set(cfg.x, 0, cfg.z);
        shrub.rotation.y = cfg.rotY;
        shrub.scale.setScalar(cfg.scale);
        this.downloadedModelGroup.add(shrub);
      }
    }
  }

  private setupLightingAndFog(): void {
    this.ambientLight = new THREE.AmbientLight(0x3e2b38, 0.65);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xf39c12, 1.35);
    this.dirLight.position.set(60, 35, 45);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 150;
    const d = 65;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0x8e44ad, 0x191c18, 0.55);
    this.scene.add(this.hemiLight);

    this.setTimeOfDay(this.currentTimeOfDay);
  }

  /**
   * Realistic Atmospheric Sky Dome & Sun/Moon Celestial Body
   */
  private createAtmosphericSky(): void {
    const skyGeo = new THREE.SphereGeometry(180, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      depthWrite: false
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Glowing Sun/Moon disc
    const sunGeo = new THREE.CircleGeometry(6.0, 24);
    this.sunMoonMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xffffee, depthWrite: false }));
    this.sunMoonMesh.position.set(65, 120, 45);
    this.sunMoonMesh.lookAt(0, 0, 0);
    this.scene.add(this.sunMoonMesh);

    this.updateSkyDomeAtmosphere(this.currentTimeOfDay);
  }

  private updateSkyDomeAtmosphere(time: TimeOfDay): void {
    if (!this.skyDome) return;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);

    if (time === TimeOfDay.DAY) {
      // Crisp sunny mid-day sky
      grad.addColorStop(0, '#1565c0');   // Deep azure zenith
      grad.addColorStop(0.35, '#1e88e5');// Vibrant clear day sky
      grad.addColorStop(0.7, '#64b5f6'); // Soft daylight blue
      grad.addColorStop(0.88, '#bbdefb');// Light horizon atmosphere
      grad.addColorStop(1.0, '#e3f2fd'); // Soft bright horizon haze
    } else if (time === TimeOfDay.SUNSET) {
      // Dramatic golden hour & sunset
      grad.addColorStop(0, '#1a102a');   // Twilight purple zenith
      grad.addColorStop(0.3, '#3c1836');  // Magenta dusk
      grad.addColorStop(0.6, '#932b2b');  // Deep crimson glow
      grad.addColorStop(0.82, '#e65100'); // Fiery orange sun horizon
      grad.addColorStop(1.0, '#ffa726');  // Golden horizon haze
    } else {
      // Midnight apocalyptic moonlit sky
      grad.addColorStop(0, '#04060a');   // Cosmic deep black
      grad.addColorStop(0.5, '#090e1a');  // Deep nocturnal navy
      grad.addColorStop(0.85, '#0e172a'); // Starlit atmospheric horizon
      grad.addColorStop(1.0, '#0b0f16');  // Fog blend
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 512);

    const skyTex = new THREE.CanvasTexture(canvas);
    (this.skyDome.material as THREE.MeshBasicMaterial).map = skyTex;
    (this.skyDome.material as THREE.MeshBasicMaterial).needsUpdate = true;
  }

  /**
   * Open Ground with Lush Green Grass PBR Textures (Zero asphalt road crossroad clutter)
   */
  private createGroundAndRoads(): void {
    const grassPBR = TextureGenerator.getGrassTextures();
    const groundGeo = new THREE.PlaneGeometry(240, 240, 48, 48);

    const groundMat = new THREE.MeshStandardMaterial({
      map: grassPBR.albedo,
      normalMap: grassPBR.normal,
      roughnessMap: grassPBR.roughness,
      roughness: 0.65,
      metalness: 0.0
    });
    grassPBR.albedo.repeat.set(36, 36);
    grassPBR.normal.repeat.set(36, 36);
    grassPBR.roughness.repeat.set(36, 36);

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'Ground';
    this.groundMesh = ground;
    this.scene.add(ground);
    this.shootableMeshes.push(ground);
  }

  /**
   * Detailed Realistic Abandoned Buildings with PBR Textures & Enterable Interiors
   */
  private createRealisticBuildings(): void {
    const brickPBR = TextureGenerator.getBrickTextures();
    const woodPBR = TextureGenerator.getWoodPlankTextures();
    const metalPBR = TextureGenerator.getRustedMetalTextures();

    const brickMat = new THREE.MeshStandardMaterial({
      map: brickPBR.albedo,
      normalMap: brickPBR.normal,
      roughnessMap: brickPBR.roughness,
      roughness: 0.85,
      metalness: 0.08
    });
    brickPBR.albedo.repeat.set(4, 2);
    brickPBR.normal.repeat.set(4, 2);

    const woodMat = new THREE.MeshStandardMaterial({
      map: woodPBR.albedo,
      normalMap: woodPBR.normal,
      roughnessMap: woodPBR.roughness,
      roughness: 0.88,
      metalness: 0.05
    });

    const roofTinMat = new THREE.MeshStandardMaterial({
      map: metalPBR.albedo,
      normalMap: metalPBR.normal,
      metalnessMap: metalPBR.metalness,
      roughnessMap: metalPBR.roughness,
      roughness: 0.7,
      metalness: 0.5
    });

    const interiorFloorMat = new THREE.MeshStandardMaterial({
      map: woodPBR.albedo,
      normalMap: woodPBR.normal,
      roughness: 0.8
    });

    // House 1: North-West Farmhouse (Enterable interior)
    this.buildDetailedHouse({
      x: -22, z: -24, width: 14, depth: 12, height: 5.8,
      wallMat: brickMat, roofMat: roofTinMat, floorMat: interiorFloorMat,
      doorSide: 'south', hasPorch: true, hasChimney: true
    });

    // House 2: North-East Cabin (Enterable interior)
    this.buildDetailedHouse({
      x: 24, z: -22, width: 12, depth: 10, height: 5.2,
      wallMat: woodMat, roofMat: roofTinMat, floorMat: interiorFloorMat,
      doorSide: 'south', hasPorch: false, hasChimney: true
    });

    // House 3: South-West Ruined Depot / Garage (Enterable)
    this.buildDetailedHouse({
      x: -25, z: 22, width: 15, depth: 13, height: 6.0,
      wallMat: brickMat, roofMat: roofTinMat, floorMat: interiorFloorMat,
      doorSide: 'north', hasPorch: false, hasChimney: false
    });

    // House 4: South-East Residence (Enterable)
    this.buildDetailedHouse({
      x: 22, z: 26, width: 13, depth: 11, height: 5.4,
      wallMat: woodMat, roofMat: roofTinMat, floorMat: interiorFloorMat,
      doorSide: 'north', hasPorch: true, hasChimney: true
    });

    // House 5: North Roadside Store
    this.buildDetailedHouse({
      x: -18, z: -48, width: 10, depth: 8, height: 4.8,
      wallMat: woodMat, roofMat: roofTinMat, floorMat: interiorFloorMat,
      doorSide: 'south', hasPorch: false, hasChimney: false
    });

    // House 6: South Roadside Outpost
    this.buildDetailedHouse({
      x: 20, z: 48, width: 9, depth: 7, height: 4.5,
      wallMat: brickMat, roofMat: roofTinMat, floorMat: interiorFloorMat,
      doorSide: 'north', hasPorch: false, hasChimney: false
    });
  }

  private buildDetailedHouse(cfg: {
    x: number; z: number; width: number; depth: number; height: number;
    wallMat: THREE.Material; roofMat: THREE.Material; floorMat: THREE.Material;
    doorSide: 'north' | 'south'; hasPorch: boolean; hasChimney: boolean;
  }): void {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);

    const thickness = 0.45;
    const doorWidth = 2.4;
    const doorHeight = 3.2;

    // Interior floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cfg.width - 0.2, cfg.depth - 0.2), cfg.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.04;
    floor.receiveShadow = true;
    group.add(floor);
    this.shootableMeshes.push(floor);
    this.buildingFloorMeshes.push(floor);

    // Left Wall
    const sideWallGeo = new THREE.BoxGeometry(thickness, cfg.height, cfg.depth);
    const leftWall = new THREE.Mesh(sideWallGeo, cfg.wallMat);
    leftWall.position.set(-cfg.width / 2 + thickness / 2, cfg.height / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    group.add(leftWall);
    this.shootableMeshes.push(leftWall);
    this.buildingWallMeshes.push(leftWall);

    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x - cfg.width / 2 + thickness / 2, cfg.height / 2, cfg.z),
        new THREE.Vector3(thickness + 0.2, cfg.height + 1, cfg.depth)
      )
    });

    // Right Wall
    const rightWall = new THREE.Mesh(sideWallGeo, cfg.wallMat);
    rightWall.position.set(cfg.width / 2 - thickness / 2, cfg.height / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    group.add(rightWall);
    this.shootableMeshes.push(rightWall);
    this.buildingWallMeshes.push(rightWall);

    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x + cfg.width / 2 - thickness / 2, cfg.height / 2, cfg.z),
        new THREE.Vector3(thickness + 0.2, cfg.height + 1, cfg.depth)
      )
    });

    // Back Wall
    const backZ = cfg.doorSide === 'south' ? -cfg.depth / 2 + thickness / 2 : cfg.depth / 2 - thickness / 2;
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(cfg.width, cfg.height, thickness), cfg.wallMat);
    backWall.position.set(0, cfg.height / 2, backZ);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);
    this.shootableMeshes.push(backWall);
    this.buildingWallMeshes.push(backWall);

    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x, cfg.height / 2, cfg.z + backZ),
        new THREE.Vector3(cfg.width, cfg.height + 1, thickness + 0.2)
      )
    });

    // Front Wall with Doorway
    const frontZ = cfg.doorSide === 'south' ? cfg.depth / 2 - thickness / 2 : -cfg.depth / 2 + thickness / 2;
    const sideSegWidth = (cfg.width - doorWidth) / 2;
    const segGeo = new THREE.BoxGeometry(sideSegWidth, cfg.height, thickness);

    const frontLeft = new THREE.Mesh(segGeo, cfg.wallMat);
    frontLeft.position.set(-cfg.width / 2 + sideSegWidth / 2, cfg.height / 2, frontZ);
    frontLeft.castShadow = true;
    frontLeft.receiveShadow = true;
    group.add(frontLeft);
    this.shootableMeshes.push(frontLeft);
    this.buildingWallMeshes.push(frontLeft);

    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x - cfg.width / 2 + sideSegWidth / 2, cfg.height / 2, cfg.z + frontZ),
        new THREE.Vector3(sideSegWidth + 0.1, cfg.height + 1, thickness + 0.2)
      )
    });

    const frontRight = new THREE.Mesh(segGeo, cfg.wallMat);
    frontRight.position.set(cfg.width / 2 - sideSegWidth / 2, cfg.height / 2, frontZ);
    frontRight.castShadow = true;
    frontRight.receiveShadow = true;
    group.add(frontRight);
    this.shootableMeshes.push(frontRight);
    this.buildingWallMeshes.push(frontRight);

    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x + cfg.width / 2 - sideSegWidth / 2, cfg.height / 2, cfg.z + frontZ),
        new THREE.Vector3(sideSegWidth + 0.1, cfg.height + 1, thickness + 0.2)
      )
    });

    // Header over door
    const header = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, cfg.height - doorHeight, thickness), cfg.wallMat);
    header.position.set(0, doorHeight + (cfg.height - doorHeight) / 2, frontZ);
    header.castShadow = true;
    group.add(header);
    this.buildingWallMeshes.push(header);

    // Broken Boarded Windows with Glass Shards
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x99bbcc,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.45
    });
    const woodBoardMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });

    [-cfg.width * 0.3, cfg.width * 0.3].forEach(wx => {
      // Glass pane
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), glassMat);
      glass.position.set(wx, cfg.height * 0.55, frontZ + 0.05);
      group.add(glass);

      // Wooden cross boards across window
      const board1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.08), woodBoardMat);
      board1.position.set(wx, cfg.height * 0.58, frontZ + 0.1);
      board1.rotation.z = 0.2;
      group.add(board1);

      const board2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.08), woodBoardMat);
      board2.position.set(wx, cfg.height * 0.52, frontZ + 0.1);
      board2.rotation.z = -0.25;
      group.add(board2);
    });

    // Roof: Pitched Overhanging Roof with Fascia Trim
    const roofGeo = new THREE.ConeGeometry(Math.max(cfg.width, cfg.depth) * 0.78, cfg.height * 0.45, 4);
    const roof = new THREE.Mesh(roofGeo, cfg.roofMat);
    roof.position.y = cfg.height + cfg.height * 0.22;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    this.shootableMeshes.push(roof);
    this.buildingRoofMeshes.push(roof);

    // Chimney with brick trim
    if (cfg.hasChimney) {
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 1.1), cfg.wallMat);
      chimney.position.set(cfg.width * 0.3, cfg.height + 1.2, 0);
      chimney.castShadow = true;
      group.add(chimney);
      this.buildingConcreteMeshes.push(chimney);
    }

    // Porch with support pillars & railing
    if (cfg.hasPorch) {
      const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.3, 3.2), cfg.floorMat);
      porchFloor.position.set(0, 0.15, frontZ + 1.6 * (cfg.doorSide === 'south' ? 1 : -1));
      porchFloor.receiveShadow = true;
      group.add(porchFloor);

      // Wooden pillars
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3d2e23, roughness: 0.85 });
      [-3.2, 3.2].forEach(px => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6), pillarMat);
        pillar.position.set(px, 1.6, frontZ + 3.0 * (cfg.doorSide === 'south' ? 1 : -1));
        pillar.castShadow = true;
        group.add(pillar);
      });
    }

    // Interior Furniture
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x3d2d20, roughness: 0.85 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 1.3), tableMat);
    table.position.set(0, 0.425, 0);
    table.castShadow = true;
    table.receiveShadow = true;
    group.add(table);
    this.shootableMeshes.push(table);

    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x, 0.5, cfg.z),
        new THREE.Vector3(2.4, 1.2, 1.5)
      )
    });

    this.scene.add(group);
  }

  /**
   * Realistic Vehicles: Military APC with Turret, Wrecked Sedans, and Pickup Trucks with Volumetric Headlight Beams
   */
  private createVehicles(): void {
    // 1. Heavy Armored Military Recon Vehicle (APC)
    this.buildMilitaryAPC({ x: -6, z: 7, rotY: 0.4 });

    // 2. Wrecked Civilian Sedan near East street
    this.buildRealisticSedan({ x: 18, z: -4, rotY: -0.65, color: 0x2e3d4d });

    // 3. Abandoned Pickup Truck on North street
    this.buildRealisticPickup({ x: 4.5, z: -28, rotY: 0.2, color: 0x5a4838 });

    // 4. Burned Civilian Car on South street
    this.buildRealisticSedan({ x: -5, z: 32, rotY: 0.85, color: 0x4a2420 });
  }

  private buildMilitaryAPC(cfg: { x: number; z: number; rotY: number }): void {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;

    const armorMat = new THREE.MeshStandardMaterial({ color: 0x384032, roughness: 0.72, metalness: 0.45 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x181a17, roughness: 0.8, metalness: 0.65 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });

    // Armored angled lower hull
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.15, 5.4), armorMat);
    chassis.position.y = 1.0;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);
    this.shootableMeshes.push(chassis);

    // Sloped upper cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 3.4), armorMat);
    cab.position.set(0, 1.95, -0.4);
    cab.castShadow = true;
    group.add(cab);
    this.shootableMeshes.push(cab);

    // Turret ring
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 10), darkMetalMat);
    turret.position.set(0, 2.6, -0.2);
    turret.castShadow = true;
    group.add(turret);

    // 4 Heavy All-Terrain Tires
    const wheelGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    [[-1.4, 0.6, 1.7], [1.4, 0.6, 1.7], [-1.4, 0.6, -1.7], [1.4, 0.6, -1.7]].forEach(p => {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(p[0], p[1], p[2]);
      w.castShadow = true;
      group.add(w);
    });

    // Volumetric Headlight Beams
    this.addVehicleHeadlights(group, 2.7, 1.1);

    this.scene.add(group);
    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x, 1.4, cfg.z),
        new THREE.Vector3(3.3, 2.9, 6.0)
      ),
      mesh: group
    });
  }

  private buildRealisticSedan(cfg: { x: number; z: number; rotY: number; color: number }): void {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.6, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2128, roughness: 0.15, metalness: 0.85, transparent: true, opacity: 0.6 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95 });

    // Chassis body
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.82, 4.5), bodyMat);
    chassis.position.y = 0.68;
    chassis.castShadow = true;
    group.add(chassis);
    this.shootableMeshes.push(chassis);

    // Aerodynamic Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.78, 2.4), glassMat);
    cabin.position.set(0, 1.45, -0.28);
    cabin.castShadow = true;
    group.add(cabin);
    this.shootableMeshes.push(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    [[-1.08, 0.42, 1.35], [1.08, 0.42, 1.35], [-1.08, 0.42, -1.35], [1.08, 0.42, -1.35]].forEach(p => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(p[0], p[1], p[2]);
      w.castShadow = true;
      group.add(w);
    });

    this.addVehicleHeadlights(group, 2.25, 0.7);

    this.scene.add(group);
    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x, 1.0, cfg.z),
        new THREE.Vector3(2.6, 2.0, 4.8)
      ),
      mesh: group
    });
  }

  private buildRealisticPickup(cfg: { x: number; z: number; rotY: number; color: number }): void {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.72, metalness: 0.28 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.55, 2.2), bodyMat);
    cab.position.set(0, 1.2, 1.4);
    cab.castShadow = true;
    group.add(cab);
    this.shootableMeshes.push(cab);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.05, 3.5), bodyMat);
    bed.position.set(0, 0.9, -1.35);
    bed.castShadow = true;
    group.add(bed);
    this.shootableMeshes.push(bed);

    this.addVehicleHeadlights(group, 2.45, 0.95);

    this.scene.add(group);
    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cfg.x, 1.15, cfg.z),
        new THREE.Vector3(2.9, 2.3, 5.8)
      ),
      mesh: group
    });
  }

  /**
   * Vehicle Headlights with Volumetric Light Cone
   */
  private addVehicleHeadlights(group: THREE.Group, frontZ: number, heightY: number): void {
    const lightGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa });
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2cc,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    [-0.7, 0.7].forEach(lx => {
      // Bulb lens
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lightGlowMat);
      lens.position.set(lx, heightY, frontZ);
      group.add(lens);

      // Volumetric beam cone
      const beamGeo = new THREE.ConeGeometry(1.6, 9.0, 12, 1, true);
      beamGeo.rotateX(-Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, coneMat);
      beam.position.set(lx, heightY, frontZ + 4.5);
      group.add(beam);
      this.volumetricCones.push(beam);
    });
  }

  /**
   * Wooden Utility Poles with Dangling Electrical Wires
   */
  private createUtilityPolesAndWires(): void {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.92 });
    const wireMat = new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 });

    const polePositions = [
      new THREE.Vector3(-8.5, 0, -42),
      new THREE.Vector3(-8.5, 0, -15),
      new THREE.Vector3(-8.5, 0, 15),
      new THREE.Vector3(-8.5, 0, 42),
      new THREE.Vector3(8.5, 0, -28),
      new THREE.Vector3(8.5, 0, 28)
    ];

    const topPoints: THREE.Vector3[] = [];

    polePositions.forEach(pos => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7.5, 8), poleMat);
      pole.position.y = 3.75;
      pole.castShadow = true;
      group.add(pole);

      // Crossbar
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), poleMat);
      crossbar.position.set(0, 7.1, 0);
      group.add(crossbar);

      this.scene.add(group);

      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(pos.x, 3.75, pos.z),
          new THREE.Vector3(0.6, 7.5, 0.6)
        ),
        mesh: group
      });

      topPoints.push(new THREE.Vector3(pos.x, 7.1, pos.z));
    });

    // Dangling Catenary Cables between poles
    for (let i = 0; i < topPoints.length - 1; i += 2) {
      const p1 = topPoints[i];
      const p2 = topPoints[i + 1];

      const curve = new THREE.QuadraticBezierCurve3(
        p1,
        new THREE.Vector3((p1.x + p2.x) / 2, Math.min(p1.y, p2.y) - 1.2, (p1.z + p2.z) / 2),
        p2
      );

      const pts = curve.getPoints(16);
      const wireGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const wire = new THREE.Line(wireGeo, wireMat);
      this.scene.add(wire);
    }
  }

  /**
   * Street Clutter: Jersey Barriers with Hazard Stripes, Dumpsters, Signs, Burning Barrels
   */
  private createObstaclesAndClutter(): void {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x6e7678, roughness: 0.88 });
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x7c493b, roughness: 0.65, metalness: 0.45 });
    const dumpsterMat = new THREE.MeshStandardMaterial({ color: 0x24422e, roughness: 0.75, metalness: 0.3 });

    // 1. Concrete Jersey Barriers with Hazard Stripes
    const rbPositions = [
      { x: -5, z: -15, rotY: 0.2 },
      { x: 3, z: 18, rotY: -0.15 },
      { x: 20, z: 5, rotY: 1.4 },
      { x: -22, z: -5, rotY: 1.6 }
    ];

    rbPositions.forEach(rb => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.15, 0.75), concreteMat);
      mesh.position.set(rb.x, 0.575, rb.z);
      mesh.rotation.y = rb.rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      // Yellow hazard stripe decal
      const stripeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xf1c40f })
      );
      stripeMesh.position.set(0, 0.1, 0.38);
      mesh.add(stripeMesh);

      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(mesh.position, new THREE.Vector3(3.8, 1.5, 1.6)),
        mesh
      });
    });

    // 2. Industrial Trash Dumpster
    const dumpster = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.5), dumpsterMat);
    dumpster.position.set(-16, 0.7, -18);
    dumpster.rotation.y = 0.3;
    dumpster.castShadow = true;
    dumpster.receiveShadow = true;
    this.scene.add(dumpster);
    this.shootableMeshes.push(dumpster);

    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(dumpster.position, new THREE.Vector3(2.6, 1.6, 1.7)),
      mesh: dumpster
    });

    // 3. Burning Barrels & Oil Drums
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

      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(mesh.position, new THREE.Vector3(1.1, 1.3, 1.1)),
        mesh
      });

      if (d.burning) {
        const fireLight = new THREE.PointLight(0xff7722, 2.2, 18);
        fireLight.position.set(d.x, 1.4, d.z);
        this.scene.add(fireLight);
        this.flickeringLights.push({ light: fireLight, baseIntensity: 2.2, timeOffset: Math.random() * 10 });

        const fireCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.38, 0.75, 8),
          new THREE.MeshBasicMaterial({ color: 0xffaa22 })
        );
        fireCone.position.set(d.x, 1.3, d.z);
        this.scene.add(fireCone);
      }
    });

    // 4. Street Signs (Stop sign & Warning sign)
    this.createStreetSign(-7.2, -8.0, 'STOP');
    this.createStreetSign(7.2, 8.0, 'DEAD_END');
  }

  private createStreetSign(x: number, z: number, type: 'STOP' | 'DEAD_END'): void {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.5, metalness: 0.8 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), postMat);
    post.position.set(x, 1.4, z);
    post.castShadow = true;
    this.scene.add(post);

    const signMat = new THREE.MeshStandardMaterial({
      color: type === 'STOP' ? 0xc0392b : 0xf39c12,
      roughness: 0.4
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.04), signMat);
    sign.position.set(x, 2.4, z);
    sign.rotation.z = Math.PI / 4;
    sign.castShadow = true;
    this.scene.add(sign);
  }

  /**
   * Realistic 3D Grass Tufts with real physical height across the green meadow
   */
  private create3DGrassTufts(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);

    const bladeCols = ['#5ca832', '#72c23e', '#488b26', '#85d64e', '#3c751e'];
    for (let i = 0; i < 18; i++) {
      const bx = Math.random() * 50 + 7;
      const by = 64;
      const h = Math.random() * 45 + 18;
      const curve = (Math.random() - 0.5) * 16;
      ctx.strokeStyle = bladeCols[Math.floor(Math.random() * bladeCols.length)];
      ctx.lineWidth = Math.random() * 2.2 + 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + curve * 0.5, by - h * 0.6, bx + curve, by - h);
      ctx.stroke();
    }

    const tuftTex = new THREE.CanvasTexture(canvas);
    const tuftMat = new THREE.MeshStandardMaterial({
      map: tuftTex,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
      roughness: 0.65,
      metalness: 0.0
    });

    const tuftGeo = new THREE.PlaneGeometry(1.1, 0.95);
    tuftGeo.translate(0, 0.475, 0);

    const count = 900;
    const instMesh = new THREE.InstancedMesh(tuftGeo, tuftMat, count);
    instMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 110;
      const z = (Math.random() - 0.5) * 110;
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      if (Math.abs(x) > 52 || Math.abs(z) > 52) continue;

      dummy.position.set(x, 0.01, z);
      dummy.rotation.y = Math.random() * Math.PI;
      const sc = Math.random() * 0.65 + 0.8;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      instMesh.setMatrixAt(idx++, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instMesh);
  }

  /**
   * Elevated Sniper Watchtower with climbable wooden stairs, platform cover, and commanding sightlines
   */
  private createSniperWatchtower(): void {
    const towerGroup = new THREE.Group();
    const towerX = -7.0;
    const towerZ = -17.0;
    const deckY = 4.2;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.85 });
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x5b3f2b, roughness: 0.8 });
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x8a7b64, roughness: 0.9 });

    // 1. Four Heavy Timber Support Pillars
    const postGeo = new THREE.CylinderGeometry(0.22, 0.26, deckY, 12);
    const postOffsets = [
      { x: -3.2, z: -3.2 }, { x: 3.2, z: -3.2 },
      { x: -3.2, z: 3.2 }, { x: 3.2, z: 3.2 }
    ];
    postOffsets.forEach(po => {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(towerX + po.x, deckY / 2, towerZ + po.z);
      post.castShadow = true;
      post.receiveShadow = true;
      towerGroup.add(post);

      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(towerX + po.x, deckY / 2, towerZ + po.z),
          new THREE.Vector3(0.6, deckY, 0.6)
        ),
        mesh: post
      });
    });

    // Cross-bracing between pillars
    const braceGeo = new THREE.BoxGeometry(0.12, 0.25, 6.4);
    const brace1 = new THREE.Mesh(braceGeo, woodMat);
    brace1.position.set(towerX - 3.2, 2.0, towerZ);
    towerGroup.add(brace1);
    const brace2 = new THREE.Mesh(braceGeo, woodMat);
    brace2.position.set(towerX + 3.2, 2.0, towerZ);
    towerGroup.add(brace2);

    // 2. Main Observation Deck Platform (6.8m x 6.8m)
    const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.28, 6.8), plankMat);
    deckMesh.position.set(towerX, deckY, towerZ);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    towerGroup.add(deckMesh);
    this.shootableMeshes.push(deckMesh);

    // Register Watchtower Deck Surface for player walking
    this.walkableSurfaces.push(
      new THREE.Box3(
        new THREE.Vector3(towerX - 3.4, deckY - 0.15, towerZ - 3.4),
        new THREE.Vector3(towerX + 3.4, deckY + 0.15, towerZ + 3.4)
      )
    );

    // 3. Chest-High Wooden Barricades & Sandbags on the deck perimeter
    const railMat = new THREE.MeshStandardMaterial({ color: 0x3d291c, roughness: 0.85 });
    const railingData = [
      { x: towerX, z: towerZ - 3.3, w: 6.8, d: 0.24 }, // Back rail
      { x: towerX - 3.3, z: towerZ, w: 0.24, d: 6.8 }, // Left rail
      { x: towerX + 3.3, z: towerZ, w: 0.24, d: 6.8 }, // Right rail
      { x: towerX - 1.8, z: towerZ + 3.3, w: 3.2, d: 0.24 } // Front rail (leaves opening for stairs entry)
    ];
    railingData.forEach(rd => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(rd.w, 1.15, rd.d), railMat);
      rail.position.set(rd.x, deckY + 0.6, rd.z);
      rail.castShadow = true;
      rail.receiveShadow = true;
      towerGroup.add(rail);

      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(rail.position, new THREE.Vector3(rd.w, 1.3, rd.d)),
        mesh: rail
      });
      this.shootableMeshes.push(rail);

      // Sandbags along the inner railing
      const sandbag = new THREE.Mesh(new THREE.BoxGeometry(rd.w * 0.9, 0.55, 0.45), sandbagMat);
      sandbag.position.set(rd.x, deckY + 0.3, rd.z + (rd.d > 0.5 ? 0 : 0.25));
      sandbag.castShadow = true;
      sandbag.receiveShadow = true;
      towerGroup.add(sandbag);
    });

    // 4. Climbable Wooden Staircase (14 steps rising from ground to deck)
    const stepCount = 14;
    const stepWidth = 1.9;
    const stepDepth = 0.42;
    const stepHeight = deckY / stepCount; // 0.3m per step
    const stairStartX = towerX + 1.8;
    const stairStartZ = towerZ + 3.3 + (stepCount - 1) * stepDepth;

    for (let i = 0; i < stepCount; i++) {
      const stepY = (i + 0.5) * stepHeight;
      const stepZ = stairStartZ - i * stepDepth;

      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth + 0.04), woodMat);
      stepMesh.position.set(stairStartX, stepY, stepZ);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      towerGroup.add(stepMesh);
      this.shootableMeshes.push(stepMesh);

      // Register step surface as walkable
      this.walkableSurfaces.push(
        new THREE.Box3(
          new THREE.Vector3(stairStartX - stepWidth / 2, stepY - stepHeight / 2, stepZ - stepDepth / 2),
          new THREE.Vector3(stairStartX + stepWidth / 2, stepY + stepHeight / 2, stepZ + stepDepth / 2)
        )
      );
    }

    // Stair Handrails
    const railLength = Math.hypot(deckY, stepCount * stepDepth);
    const railAngle = Math.atan2(deckY, stepCount * stepDepth);
    const handrailGeo = new THREE.BoxGeometry(0.08, 0.1, railLength);
    const leftRail = new THREE.Mesh(handrailGeo, woodMat);
    leftRail.position.set(stairStartX - stepWidth / 2, deckY / 2 + 0.85, (towerZ + 3.3 + stairStartZ) / 2);
    leftRail.rotation.x = railAngle;
    towerGroup.add(leftRail);

    const rightRail = new THREE.Mesh(handrailGeo, woodMat);
    rightRail.position.set(stairStartX + stepWidth / 2, deckY / 2 + 0.85, (towerZ + 3.3 + stairStartZ) / 2);
    rightRail.rotation.x = railAngle;
    towerGroup.add(rightRail);

    this.scene.add(towerGroup);
  }

  /**
   * Central Military Supply Depot: Periodically restocks all weapons and grenades with a beacon
   */
  private createSupplyDepot(): void {
    const depotGroup = new THREE.Group();
    depotGroup.position.copy(this.supplyDepotPosition);

    // 1. Military Green Supply Crate
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3b4c30, roughness: 0.7, metalness: 0.35 });
    const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.3), crateMat);
    crateMesh.position.y = 0.55;
    crateMesh.castShadow = true;
    crateMesh.receiveShadow = true;
    depotGroup.add(crateMesh);
    this.shootableMeshes.push(crateMesh);

    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(this.supplyDepotPosition.x, 0.55, this.supplyDepotPosition.z),
        new THREE.Vector3(2.0, 1.2, 1.5)
      ),
      mesh: crateMesh
    });

    // Ammo cans & grenade box props on crate
    const ammoCanMat = new THREE.MeshStandardMaterial({ color: 0x2b3b24, roughness: 0.5, metalness: 0.7 });
    const can1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.28), ammoCanMat);
    can1.position.set(0.35, 1.25, 0.15);
    can1.rotation.y = 0.35;
    depotGroup.add(can1);

    const grenadeBoxMat = new THREE.MeshStandardMaterial({ color: 0x5a4830, roughness: 0.8 });
    const gBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.38), grenadeBoxMat);
    gBox.position.set(-0.35, 1.28, -0.1);
    gBox.rotation.y = -0.2;
    depotGroup.add(gBox);

    // 2. Vertical Cyan Beacon Beam
    const beaconGeo = new THREE.CylinderGeometry(0.25, 0.45, 24, 16);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.supplyBeaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.supplyBeaconMesh.position.y = 12.0;
    depotGroup.add(this.supplyBeaconMesh);

    // Glowing base ring
    const ringGeo = new THREE.RingGeometry(1.8, 2.05, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const groundRing = new THREE.Mesh(ringGeo, ringMat);
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.y = 0.03;
    depotGroup.add(groundRing);

    this.supplyCrateGroup = depotGroup;
    this.scene.add(depotGroup);
  }

  /**
   * Realistic Vegetation: High-Detail Branching Trees, Organic Clustered Foliage & Smooth Boulders
   * (Zero low-poly dodecahedrons)
   */
  private createVegetationAndRocks(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.88 });
    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x346b1f, roughness: 0.72 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x478c28, roughness: 0.7 });
    const leafMat3 = new THREE.MeshStandardMaterial({ color: 0x275214, roughness: 0.75 });

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

      const height = 5.6 + (idx % 3) * 0.8;
      // High-poly smooth cylindrical trunk
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, height, 16), trunkMat);
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);
      this.shootableMeshes.push(trunk);

      // Natural branching limbs
      const branchGeo = new THREE.CylinderGeometry(0.12, 0.22, 2.2, 12);
      const b1 = new THREE.Mesh(branchGeo, trunkMat);
      b1.position.set(0.65, height * 0.75, 0.4);
      b1.rotation.set(0.35, 0.5, -0.65);
      b1.castShadow = true;
      tree.add(b1);

      const b2 = new THREE.Mesh(branchGeo, trunkMat);
      b2.position.set(-0.6, height * 0.8, -0.3);
      b2.rotation.set(-0.4, -0.8, 0.7);
      b2.castShadow = true;
      tree.add(b2);

      // Realistic Multi-Sphere Clustered Organic Leaf Canopy
      const folMat = idx % 3 === 0 ? leafMat1 : idx % 3 === 1 ? leafMat2 : leafMat3;
      const canopyCenterY = height + 0.6;

      const clusterOffsets = [
        { x: 0, y: 0, z: 0, r: 2.1 },
        { x: 0.8, y: 0.6, z: 0.5, r: 1.6 },
        { x: -0.7, y: 0.7, z: -0.4, r: 1.5 },
        { x: 0.3, y: 1.3, z: -0.2, r: 1.3 },
        { x: -0.4, y: 0.2, z: 0.7, r: 1.4 }
      ];

      clusterOffsets.forEach(co => {
        const leafSphere = new THREE.Mesh(new THREE.SphereGeometry(co.r, 16, 12), folMat);
        leafSphere.position.set(co.x, canopyCenterY + co.y, co.z);
        leafSphere.scale.set(1.0, 0.85, 1.0); // Slightly flattened natural canopy
        leafSphere.castShadow = true;
        leafSphere.receiveShadow = true;
        tree.add(leafSphere);
        this.foliageMeshes.push(leafSphere);
      });

      this.scene.add(tree);

      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(loc.x, height / 2, loc.z),
          new THREE.Vector3(1.2, height, 1.2)
        ),
        mesh: tree
      });
    });

    // Realistic Smooth Organic Boulders (No sharp dodecahedron cubes)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5d60, roughness: 0.92 });
    for (let r = 0; r < 24; r++) {
      const rx = (Math.random() - 0.5) * 90;
      const rz = (Math.random() - 0.5) * 90;
      if (Math.abs(rx) < 7 || Math.abs(rz) < 7) continue;

      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.random() * 0.5 + 0.35, 2), rockMat);
      rock.position.set(rx, 0.28, rz);
      rock.scale.set(1.4, 0.8, 1.15);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
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

      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(lp.x, 2.6, lp.z),
          new THREE.Vector3(0.5, 5.2, 0.5)
        ),
        mesh: group
      });

      const light = new THREE.PointLight(0xffeaa7, 1.6, 20);
      light.position.set(lp.x + 0.8, 4.9, lp.z);
      this.scene.add(light);
      this.flickeringLights.push({ light, baseIntensity: 1.6, timeOffset: idx * 1.5 });
    });
  }

  /**
   * Invisible Boundary Colliders: Prevents player & zombies from walking past the map limits,
   * while leaving the horizon visually wide open with lush green grass.
   */
  private createPerimeterWalls(): void {
    const size = 120;
    const half = size / 2;

    const wallsData = [
      { x: 0, z: -half, w: size, d: 2.0 },
      { x: 0, z: half, w: size, d: 2.0 },
      { x: -half, z: 0, w: 2.0, d: size },
      { x: half, z: 0, w: 2.0, d: size }
    ];

    wallsData.forEach(w => {
      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(w.x, 6.0, w.z),
          new THREE.Vector3(w.w, 12.0, w.d)
        )
      });
    });
  }

  private createInteractiveElements(): void {
    const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x4f3a2c, roughness: 0.8 });
    const doorHandleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.9 });

    // Interactive Doors at House Entrances
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

      const pivot = new THREE.Group();
      pivot.position.set(-1.1, 0, 0);

      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.1, 0.12), doorWoodMat);
      doorMesh.position.set(1.1, 1.55, 0);
      doorMesh.castShadow = true;
      pivot.add(doorMesh);
      this.shootableMeshes.push(doorMesh);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6), doorHandleMat);
      handle.position.set(2.0, 1.5, 0.1);
      doorMesh.add(handle);

      group.add(pivot);
      this.scene.add(group);

      const center = new THREE.Vector3(cfg.x, 1.5, cfg.z);
      const box = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(2.4, 3.2, 0.4));

      this.doors.push({ id: cfg.id, group, pivot, isOpen: false, box, center });
    });

    // Interactive Supply Crates
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
      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(1.6, 1.0, 1.1)),
        mesh: group
      });

      this.crates.push({ id: cfg.id, group, lid: lidGroup, isOpened: false, center, lootType: cfg.loot });
    });

    // Interactive Generator in Depot
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

    this.scene.add(genGroup);

    const genCenter = new THREE.Vector3(-27, 0.7, 24);
    this.colliders.push({
      box: new THREE.Box3().setFromCenterAndSize(genCenter, new THREE.Vector3(1.8, 1.6, 1.4)),
      mesh: genGroup
    });

    const fLight1 = new THREE.PointLight(0xffffff, 0, 28);
    fLight1.position.set(-22, 5.0, 22);
    this.scene.add(fLight1);

    const fLight2 = new THREE.PointLight(0xffffff, 0, 28);
    fLight2.position.set(0, 6.0, 0);
    this.scene.add(fLight2);

    this.generator = { group: genGroup, center: genCenter, isActive: false, floodlights: [fLight1, fLight2] };
  }

  /**
   * Weather Effects: Rain particles & Atmospheric Dust Motes
   */
  private createWeatherEffects(): void {
    // 1. Rain Streaks Particle System
    const rainGeo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 110;
      this.rainPositions[i * 3 + 1] = Math.random() * 35;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 110;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0x99bbdd,
      size: 0.18,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainParticles);

    // 2. Dust Motes drifting in air
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 70;
      dustPos[i * 3 + 1] = Math.random() * 8 + 0.5;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dustParticles = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xffeedd, size: 0.12, transparent: true, opacity: 0.4, depthWrite: false })
    );
    this.scene.add(this.dustParticles);
  }

  private setupSpawnPoints(): void {
    this.spawnPoints = [
      new THREE.Vector3(-46, 0, -46), new THREE.Vector3(46, 0, -46),
      new THREE.Vector3(-46, 0, 46), new THREE.Vector3(46, 0, 46),
      new THREE.Vector3(0, 0, -52), new THREE.Vector3(0, 0, 52),
      new THREE.Vector3(-52, 0, 0), new THREE.Vector3(52, 0, 0),
      new THREE.Vector3(-34, 0, -10), new THREE.Vector3(34, 0, 10),
      new THREE.Vector3(10, 0, -36), new THREE.Vector3(-10, 0, 36)
    ];

    this.pickupSpawnPoints = [
      new THREE.Vector3(-3, 0.4, -3), new THREE.Vector3(3, 0.4, 3),
      new THREE.Vector3(-12, 0.4, 18), new THREE.Vector3(14, 0.4, -18),
      new THREE.Vector3(-22, 0.4, -14), new THREE.Vector3(20, 0.4, 16),
      new THREE.Vector3(0, 0.4, -22), new THREE.Vector3(0, 0.4, 22)
    ];
  }

  public checkInteractionTarget(playerPos: THREE.Vector3): { targetType: 'door' | 'crate' | 'generator' | null; prompt: string; targetObj?: any } {
    for (const door of this.doors) {
      if (door.center.distanceTo(playerPos) < 2.5) {
        return { targetType: 'door', prompt: door.isOpen ? '[E] CLOSE DOOR' : '[E] OPEN DOOR', targetObj: door };
      }
    }
    for (const crate of this.crates) {
      if (!crate.isOpened && crate.center.distanceTo(playerPos) < 2.3) {
        return { targetType: 'crate', prompt: '[E] SEARCH SUPPLY CRATE', targetObj: crate };
      }
    }
    if (this.generator.center.distanceTo(playerPos) < 2.6) {
      return { targetType: 'generator', prompt: this.generator.isActive ? '[E] DEACTIVATE GENERATOR' : '[E] START GENERATOR', targetObj: this.generator };
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
      gen.floodlights.forEach(l => (l.intensity = gen.isActive ? 3.0 : 0));
      this.audio.playFlashlightToggle();
      return { actionDone: gen.isActive ? 'GENERATOR ONLINE: FLOODLIGHTS ACTIVE' : 'GENERATOR OFFLINE' };
    }
    return { actionDone: '' };
  }

  public update(time: number, delta: number = 0.016): void {
    // 1. Flickering Lanterns / Barrels
    for (const item of this.flickeringLights) {
      const flicker = Math.sin(time * 12 + item.timeOffset) * 0.18 + Math.sin(time * 36 + item.timeOffset * 2) * 0.09;
      item.light.intensity = Math.max(0.4, item.baseIntensity + flicker);
    }

    // 2. Wind Foliage Sway
    this.windTime += delta * 1.8;
    const sway = Math.sin(this.windTime) * 0.035;
    for (const fol of this.foliageMeshes) {
      fol.rotation.z = sway;
    }

    // 3. Rain Particles Simulation
    if (this.isRaining && this.rainParticles) {
      const posAttr = this.rainParticles.geometry.attributes.position;
      const positions = posAttr.array as Float32Array;

      for (let i = 0; i < this.rainCount; i++) {
        positions[i * 3 + 1] -= delta * 32.0; // Fall downward
        positions[i * 3] += delta * 2.0;     // Wind slant

        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 30 + Math.random() * 5;
          positions[i * 3] = (Math.random() - 0.5) * 110;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 4. Supply Depot Beacon Animation & Cooldown
    if (this.supplyBeaconMesh) {
      this.supplyBeaconMesh.rotation.y += delta * 1.6;
      const pulse = Math.sin(time * 3.5) * 0.15 + 0.35;
      (this.supplyBeaconMesh.material as THREE.MeshBasicMaterial).opacity = this.supplyCooldown > 0 ? 0.08 : pulse;
    }
    if (this.supplyCooldown > 0) {
      this.supplyCooldown = Math.max(0, this.supplyCooldown - delta);
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
