export class InputManager {
  // Movement states
  public forward: boolean = false;
  public backward: boolean = false;
  public left: boolean = false;
  public right: boolean = false;
  public sprint: boolean = false;
  public crouch: boolean = false;
  public jumpPressed: boolean = false;
  public reloadPressed: boolean = false;

  // Actions
  public interactPressed: boolean = false;
  public flashlightPressed: boolean = false;
  public meleePressed: boolean = false;
  public grenadePressed: boolean = false;
  public quickActionPressed: boolean = false;
  public weapon1Pressed: boolean = false;
  public weapon2Pressed: boolean = false;
  public weapon3Pressed: boolean = false;
  public weaponCycleNext: boolean = false;
  public weaponCyclePrev: boolean = false;
  public grenadeHolding: boolean = false;
  public grenadeJustReleased: boolean = false;
  public tabPressed: boolean = false;

  // Mouse states
  public isAiming: boolean = false;
  public shootJustPressed: boolean = false;
  public isShooting: boolean = false;
  public deltaX: number = 0;
  public deltaY: number = 0;

  // Settings
  public sensitivity: number = 0.0022;
  public invertY: boolean = false;

  // Mobile Touch States & Detection
  public isMobile: boolean = false;
  public touchControlsEnabled: boolean = false;
  public moveVector: { x: number; y: number } = { x: 0, y: 0 };
  public touchSensitivity: number = 0.0035;

  // Pointer lock
  private domElement: HTMLElement;
  private pointerLocked: boolean = false;

  // Callbacks
  public onPauseRequested?: () => void;
  public onPointerLockChange?: (locked: boolean) => void;

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.isMobile = this.detectMobile();
    this.touchControlsEnabled = this.isMobile;
    this.setupListeners();
  }

  public detectMobile(): boolean {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const userAgent = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return (hasTouch && isMobileUA) || (hasTouch && isCoarse);
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => this.onKeyDown(e));
    window.addEventListener('keyup', (e: KeyboardEvent) => this.onKeyUp(e));
    window.addEventListener('mousemove', (e: MouseEvent) => this.onMouseMove(e));
    window.addEventListener('mousedown', (e: MouseEvent) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e: MouseEvent) => this.onMouseUp(e));
    window.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
    window.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.pointerLocked) return;
      if (e.deltaY < 0) {
        this.weaponCyclePrev = true;
      } else if (e.deltaY > 0) {
        this.weaponCycleNext = true;
      }
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
      if (this.onPointerLockChange) {
        this.onPointerLockChange(this.pointerLocked);
      }
    });
  }

  public requestPointerLock(): void {
    if (this.isMobile && this.touchControlsEnabled) {
      this.pointerLocked = true;
      if (this.onPointerLockChange) {
        this.onPointerLockChange(true);
      }
      return;
    }

    if (!this.pointerLocked) {
      try {
        const res = this.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (err) {
        // Suppress
      }
    }
  }

  public exitPointerLock(): void {
    if (this.isMobile && this.touchControlsEnabled) {
      this.pointerLocked = false;
      if (this.onPointerLockChange) {
        this.onPointerLockChange(false);
      }
      return;
    }

    if (this.pointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  public isLocked(): boolean {
    return (this.isMobile && this.touchControlsEnabled) || this.pointerLocked;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Escape') {
      if (this.onPauseRequested) {
        this.onPauseRequested();
      }
      return;
    }

    if (e.repeat) return;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.sprint = true;
        break;
      case 'ControlLeft':
      case 'ControlRight':
      case 'KeyC':
        this.crouch = !this.crouch; // Toggle crouch or hold
        break;
      case 'Space':
        this.jumpPressed = true;
        break;
      case 'KeyR':
        this.reloadPressed = true;
        break;
      case 'KeyE':
        this.interactPressed = true;
        break;
      case 'KeyF':
        this.flashlightPressed = true;
        break;
      case 'KeyV':
        this.meleePressed = true;
        break;
      case 'KeyG':
        this.grenadePressed = true;
        this.grenadeHolding = true;
        break;
      case 'KeyQ':
        this.quickActionPressed = true;
        break;
      case 'Digit1':
        this.weapon1Pressed = true;
        break;
      case 'Digit2':
        this.weapon2Pressed = true;
        break;
      case 'Digit3':
        this.weapon3Pressed = true;
        break;
      case 'Tab':
        e.preventDefault();
        this.tabPressed = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyG':
        if (this.grenadeHolding) {
          this.grenadeJustReleased = true;
          this.grenadeHolding = false;
        }
        break;
      case 'KeyW':
      case 'ArrowUp':
        this.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.sprint = false;
        break;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.pointerLocked) return;

    const sensMultiplier = this.isAiming ? 0.6 : 1.0;
    this.deltaX += e.movementX * this.sensitivity * sensMultiplier;
    this.deltaY += (this.invertY ? -e.movementY : e.movementY) * this.sensitivity * sensMultiplier;
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.pointerLocked) return;

    if (e.button === 0) {
      this.shootJustPressed = true;
      this.isShooting = true;
    } else if (e.button === 2) {
      this.isAiming = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.isShooting = false;
    } else if (e.button === 2) {
      this.isAiming = false;
    }
  }

  public resetFrameDeltas(): void {
    this.deltaX = 0;
    this.deltaY = 0;
    this.shootJustPressed = false;
    this.jumpPressed = false;
    this.reloadPressed = false;
    this.interactPressed = false;
    this.flashlightPressed = false;
    this.meleePressed = false;
    this.grenadePressed = false;
    this.grenadeJustReleased = false;
    this.quickActionPressed = false;
    this.weapon1Pressed = false;
    this.weapon2Pressed = false;
    this.weapon3Pressed = false;
    this.weaponCycleNext = false;
    this.weaponCyclePrev = false;
    this.tabPressed = false;
  }

  public resetAll(): void {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.sprint = false;
    this.crouch = false;
    this.resetFrameDeltas();
    this.moveVector = { x: 0, y: 0 };
    this.isAiming = false;
    this.isShooting = false;
  }
}
