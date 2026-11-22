export class InputManager {
  // Key states
  public forward: boolean = false;
  public backward: boolean = false;
  public left: boolean = false;
  public right: boolean = false;
  public sprint: boolean = false;
  public jumpPressed: boolean = false;
  public reloadPressed: boolean = false;
  
  // Mouse states
  public isAiming: boolean = false;
  public shootJustPressed: boolean = false;
  public isShooting: boolean = false;
  public deltaX: number = 0;
  public deltaY: number = 0;

  // Settings
  public sensitivity: number = 0.0022;
  public invertY: boolean = false;

  // Pointer lock
  private domElement: HTMLElement;
  private pointerLocked: boolean = false;

  // Callbacks
  public onPauseRequested?: () => void;
  public onPointerLockChange?: (locked: boolean) => void;

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', (e: KeyboardEvent) => this.onKeyDown(e));
    window.addEventListener('keyup', (e: KeyboardEvent) => this.onKeyUp(e));

    // Mouse movement
    window.addEventListener('mousemove', (e: MouseEvent) => this.onMouseMove(e));

    // Mouse buttons
    window.addEventListener('mousedown', (e: MouseEvent) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e: MouseEvent) => this.onMouseUp(e));
    window.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

    // Pointer lock change
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
      if (this.onPointerLockChange) {
        this.onPointerLockChange(this.pointerLocked);
      }
    });
  }

  public requestPointerLock(): void {
    if (!this.pointerLocked) {
      try {
        const res = this.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch((_err) => {
            // Suppress headless or permission gesture rejection
          });
        }
      } catch (err) {
        // Suppress
      }
    }
  }

  public exitPointerLock(): void {
    if (this.pointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  public isLocked(): boolean {
    return this.pointerLocked;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;

    if (e.code === 'Escape') {
      if (this.onPauseRequested) {
        this.onPauseRequested();
      }
      return;
    }

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
      case 'Space':
        this.jumpPressed = true;
        break;
      case 'KeyR':
        this.reloadPressed = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
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

    if (e.button === 0) { // Left click
      this.shootJustPressed = true;
      this.isShooting = true;
    } else if (e.button === 2) { // Right click
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

  // Call at end of each frame to reset one-shot inputs
  public resetFrameDeltas(): void {
    this.deltaX = 0;
    this.deltaY = 0;
    this.shootJustPressed = false;
    this.jumpPressed = false;
    this.reloadPressed = false;
  }

  public resetAll(): void {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.sprint = false;
    this.jumpPressed = false;
    this.reloadPressed = false;
    this.isAiming = false;
    this.shootJustPressed = false;
    this.isShooting = false;
    this.deltaX = 0;
    this.deltaY = 0;
  }
}
