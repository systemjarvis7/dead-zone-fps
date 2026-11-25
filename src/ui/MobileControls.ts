import { InputManager } from '../core/InputManager';
import { Weapon } from '../entities/Weapon';

export class MobileControls {
  private container!: HTMLElement;
  private joystickZone!: HTMLElement;
  private joystickBase!: HTMLElement;
  private joystickKnob!: HTMLElement;
  private lookZone!: HTMLElement;
  private actionGroup!: HTMLElement;
  private headerGroup!: HTMLElement;
  private weaponBar!: HTMLElement;
  private portraitWarning!: HTMLElement;

  private btnFire!: HTMLElement;
  private btnAim!: HTMLElement;
  private btnJump!: HTMLElement;
  private btnCrouch!: HTMLElement;
  private btnReload!: HTMLElement;
  private btnGrenade!: HTMLElement;
  private btnMelee!: HTMLElement;
  private btnInteract!: HTMLElement;
  private btnPause!: HTMLElement;
  private btnFullscreen!: HTMLElement;
  private grenadeBadge!: HTMLElement;
  private weaponPills: HTMLElement[] = [];

  private input: InputManager;
  private weapon?: Weapon;

  // Touch tracking
  private joystickTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private fireTouchId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private lastLook = { x: 0, y: 0 };
  private lastFireLook = { x: 0, y: 0 };
  private readonly maxJoystickRadius: number = 48;

  public isVisible: boolean = false;
  private isPortraitDismissed: boolean = false;

  constructor(input: InputManager) {
    this.input = input;
    this.createDOM();
    this.setupTouchListeners();
    this.setupOrientationHandler();
    this.updateVisibility();
  }

  public setWeapon(weapon: Weapon): void {
    this.weapon = weapon;
  }

  private createDOM(): void {
    this.container = document.createElement('div');
    this.container.id = 'mobile-controls-root';
    this.container.className = 'mobile-controls-root';
    this.container.style.display = 'none';

    // 1. Left Thumbstick Touch Zone & Virtual Joystick
    this.joystickZone = document.createElement('div');
    this.joystickZone.id = 'mobile-joystick-zone';
    this.joystickZone.className = 'mobile-touch-zone mobile-joystick-zone';

    this.joystickBase = document.createElement('div');
    this.joystickBase.id = 'mobile-joystick-base';
    this.joystickBase.className = 'mobile-joystick-base';

    this.joystickKnob = document.createElement('div');
    this.joystickKnob.id = 'mobile-joystick-knob';
    this.joystickKnob.className = 'mobile-joystick-knob';

    this.joystickBase.appendChild(this.joystickKnob);
    this.joystickZone.appendChild(this.joystickBase);
    this.container.appendChild(this.joystickZone);

    // 2. Right Look & Aim Touch Zone
    this.lookZone = document.createElement('div');
    this.lookZone.id = 'mobile-look-zone';
    this.lookZone.className = 'mobile-touch-zone mobile-look-zone';
    this.container.appendChild(this.lookZone);

    // 3. Ergonomic Right-Hand Action Buttons Group
    this.actionGroup = document.createElement('div');
    this.actionGroup.className = 'mobile-action-group';

    // FIRE Button (Primary big action button)
    this.btnFire = document.createElement('button');
    this.btnFire.className = 'mobile-btn mobile-btn-fire';
    this.btnFire.setAttribute('aria-label', 'Fire Weapon');
    this.btnFire.innerHTML = `
      <svg viewBox="0 0 48 48" class="mobile-btn-icon">
        <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="8 4"/>
        <circle cx="24" cy="24" r="6" fill="currentColor"/>
        <line x1="24" y1="2" x2="24" y2="12" stroke="currentColor" stroke-width="3"/>
        <line x1="24" y1="36" x2="24" y2="46" stroke="currentColor" stroke-width="3"/>
        <line x1="2" y1="24" x2="12" y2="24" stroke="currentColor" stroke-width="3"/>
        <line x1="36" y1="24" x2="46" y2="24" stroke="currentColor" stroke-width="3"/>
      </svg>
    `;

    // AIM / SCOPE Button
    this.btnAim = document.createElement('button');
    this.btnAim.className = 'mobile-btn mobile-btn-aim';
    this.btnAim.setAttribute('aria-label', 'Aim Down Sights');
    this.btnAim.innerHTML = `
      <svg viewBox="0 0 36 36" class="mobile-btn-icon">
        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="18" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="18" cy="18" r="2.5" fill="currentColor"/>
        <line x1="18" y1="4" x2="18" y2="32" stroke="currentColor" stroke-width="1.5"/>
        <line x1="4" y1="18" x2="32" y2="18" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span class="mobile-btn-label">AIM</span>
    `;

    // JUMP Button
    this.btnJump = document.createElement('button');
    this.btnJump.className = 'mobile-btn mobile-btn-jump';
    this.btnJump.setAttribute('aria-label', 'Jump');
    this.btnJump.innerHTML = `
      <svg viewBox="0 0 36 36" class="mobile-btn-icon">
        <path d="M18 6 L8 18 L15 18 L15 30 L21 30 L21 18 L28 18 Z" fill="currentColor"/>
      </svg>
      <span class="mobile-btn-label">JUMP</span>
    `;

    // CROUCH Button
    this.btnCrouch = document.createElement('button');
    this.btnCrouch.className = 'mobile-btn mobile-btn-crouch';
    this.btnCrouch.setAttribute('aria-label', 'Toggle Crouch');
    this.btnCrouch.innerHTML = `
      <svg viewBox="0 0 36 36" class="mobile-btn-icon">
        <circle cx="18" cy="9" r="4.5" fill="currentColor"/>
        <path d="M11 18 C11 15 25 15 25 18 L25 24 L21 24 L21 30 L15 30 L15 24 L11 24 Z" fill="currentColor"/>
      </svg>
      <span class="mobile-btn-label">CROUCH</span>
    `;

    // RELOAD Button
    this.btnReload = document.createElement('button');
    this.btnReload.className = 'mobile-btn mobile-btn-reload';
    this.btnReload.setAttribute('aria-label', 'Reload Weapon');
    this.btnReload.innerHTML = `
      <svg viewBox="0 0 36 36" class="mobile-btn-icon">
        <path d="M18 5 A13 13 0 1 0 31 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <polyline points="28,5 31,18 20,16" fill="currentColor"/>
      </svg>
      <span class="mobile-btn-label">RELOAD</span>
    `;

    // GRENADE Button
    this.btnGrenade = document.createElement('button');
    this.btnGrenade.className = 'mobile-btn mobile-btn-grenade';
    this.btnGrenade.setAttribute('aria-label', 'Throw Grenade');
    this.btnGrenade.innerHTML = `
      <svg viewBox="0 0 36 36" class="mobile-btn-icon">
        <ellipse cx="18" cy="22" rx="9" ry="11" fill="currentColor"/>
        <rect x="15.5" y="6" width="5" height="5" fill="currentColor"/>
        <path d="M18 6 C13 3 13 1 18 1" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
      <span class="mobile-btn-label">GRENADE</span>
    `;
    this.grenadeBadge = document.createElement('span');
    this.grenadeBadge.className = 'mobile-badge';
    this.grenadeBadge.innerText = '3';
    this.btnGrenade.appendChild(this.grenadeBadge);

    // MELEE Knife Button
    this.btnMelee = document.createElement('button');
    this.btnMelee.className = 'mobile-btn mobile-btn-melee';
    this.btnMelee.setAttribute('aria-label', 'Melee Strike');
    this.btnMelee.innerHTML = `
      <svg viewBox="0 0 36 36" class="mobile-btn-icon">
        <path d="M28 8 L30 10 L16 24 L12 28 L8 24 L12 20 Z" fill="currentColor"/>
        <line x1="8" y1="24" x2="4" y2="28" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <span class="mobile-btn-label">MELEE</span>
    `;

    // Contextual INTERACT / DEPOT Button
    this.btnInteract = document.createElement('button');
    this.btnInteract.className = 'mobile-btn mobile-btn-interact';
    this.btnInteract.setAttribute('aria-label', 'Interact / Resupply');
    this.btnInteract.innerHTML = `
      <svg viewBox="0 0 36 36" class="mobile-btn-icon">
        <path d="M18 5 L28 12 L28 24 L18 31 L8 24 L8 12 Z" fill="none" stroke="currentColor" stroke-width="2.5"/>
        <polyline points="13,18 17,22 23,15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <span class="mobile-btn-label" id="mobile-interact-label">USE [E]</span>
    `;

    this.actionGroup.appendChild(this.btnFire);
    this.actionGroup.appendChild(this.btnAim);
    this.actionGroup.appendChild(this.btnJump);
    this.actionGroup.appendChild(this.btnCrouch);
    this.actionGroup.appendChild(this.btnReload);
    this.actionGroup.appendChild(this.btnInteract);
    this.container.appendChild(this.actionGroup);

    // 4. Top Header Controls: Pause & Fullscreen
    this.headerGroup = document.createElement('div');
    this.headerGroup.className = 'mobile-header-group';

    this.btnFullscreen = document.createElement('button');
    this.btnFullscreen.className = 'mobile-header-btn';
    this.btnFullscreen.setAttribute('aria-label', 'Toggle Fullscreen');
    this.btnFullscreen.innerHTML = `
      <svg viewBox="0 0 24 24" class="mobile-header-icon">
        <path d="M4 9 L4 4 L9 4 M20 9 L20 4 L15 4 M4 15 L4 20 L9 20 M20 15 L20 20 L15 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `;

    this.btnPause = document.createElement('button');
    this.btnPause.className = 'mobile-header-btn';
    this.btnPause.setAttribute('aria-label', 'Pause Game');
    this.btnPause.innerHTML = `
      <svg viewBox="0 0 24 24" class="mobile-header-icon">
        <rect x="5" y="4" width="4" height="16" fill="currentColor" rx="1"/>
        <rect x="15" y="4" width="4" height="16" fill="currentColor" rx="1"/>
      </svg>
    `;

    this.headerGroup.appendChild(this.btnFullscreen);
    this.headerGroup.appendChild(this.btnPause);
    this.container.appendChild(this.headerGroup);

    // 5. Unified Weapon & Tactical Equipment Bar (Bottom Center, PUBG Mobile style)
    // Gun selection (Pistol, M4A1, AWM) -> Melee Knife -> Hand Grenade
    this.weaponBar = document.createElement('div');
    this.weaponBar.className = 'mobile-weapon-bar';
    this.weaponBar.innerHTML = `
      <div class="mobile-weapon-pill active" data-weapon="1">
        <span class="wp-num">1</span>
        <span class="wp-name">PISTOL</span>
        <span class="wp-ammo" id="m-ammo-1">12/48</span>
      </div>
      <div class="mobile-weapon-pill" data-weapon="2">
        <span class="wp-num">2</span>
        <span class="wp-name">M4A1</span>
        <span class="wp-ammo" id="m-ammo-2">30/120</span>
      </div>
      <div class="mobile-weapon-pill" data-weapon="3">
        <span class="wp-num">3</span>
        <span class="wp-name">AWM</span>
        <span class="wp-ammo" id="m-ammo-3">5/20</span>
      </div>
      <div class="mobile-weapon-divider"></div>
    `;
    this.weaponPills = Array.from(this.weaponBar.querySelectorAll('.mobile-weapon-pill'));

    // Append Melee and Grenade buttons directly to the right of gun selection
    this.weaponBar.appendChild(this.btnMelee);
    this.weaponBar.appendChild(this.btnGrenade);
    this.container.appendChild(this.weaponBar);

    // 6. Portrait Orientation Warning Overlay
    this.portraitWarning = document.createElement('div');
    this.portraitWarning.id = 'mobile-portrait-warning';
    this.portraitWarning.className = 'mobile-portrait-warning';
    this.portraitWarning.innerHTML = `
      <div class="portrait-card">
        <div class="phone-rotate-icon">
          <svg viewBox="0 0 64 64" class="rotate-svg">
            <rect x="18" y="8" width="28" height="48" rx="6" fill="none" stroke="#00ff88" stroke-width="3"/>
            <circle cx="32" cy="50" r="2.5" fill="#00ff88"/>
            <path d="M12 28 C12 18 20 12 30 12" fill="none" stroke="#39ff14" stroke-width="3" stroke-dasharray="4 3"/>
            <polyline points="26,8 32,12 26,16" fill="#39ff14"/>
          </svg>
        </div>
        <h3 class="portrait-title">ROTATE DEVICE</h3>
        <p class="portrait-desc">Landscape mode is recommended for tactical survival combat & radar sightlines.</p>
        <button id="btn-portrait-continue" class="portrait-dismiss-btn">PLAY ANYWAY</button>
      </div>
    `;
    document.body.appendChild(this.portraitWarning);

    document.getElementById('btn-portrait-continue')?.addEventListener('click', () => {
      this.isPortraitDismissed = true;
      this.portraitWarning.classList.remove('active');
    });

    document.body.appendChild(this.container);
  }

  private setupTouchListeners(): void {
    // 1. Virtual Joystick Touch Zone
    this.joystickZone.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      if (this.joystickTouchId !== null) return;
      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;

      // Position the joystick base under the player's thumb within left screen zone
      const rect = this.joystickZone.getBoundingClientRect();
      const clientX = Math.max(rect.left + 50, Math.min(rect.right - 50, touch.clientX));
      const clientY = Math.max(rect.top + 50, Math.min(rect.bottom - 50, touch.clientY));

      this.joystickCenter = { x: clientX, y: clientY };
      this.joystickBase.style.left = `${clientX - rect.left}px`;
      this.joystickBase.style.top = `${clientY - rect.top}px`;
      this.joystickBase.classList.add('active');
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    }, { passive: false });

    const handleJoystickMove = (touch: Touch) => {
      const dx = touch.clientX - this.joystickCenter.x;
      const dy = touch.clientY - this.joystickCenter.y;
      const dist = Math.hypot(dx, dy);

      const clampedDist = Math.min(dist, this.maxJoystickRadius);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      this.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

      const normX = clampedDist > 6 ? knobX / this.maxJoystickRadius : 0;
      const normY = clampedDist > 6 ? knobY / this.maxJoystickRadius : 0;

      // Update InputManager analog & boolean movement
      this.input.moveVector = { x: normX, y: -normY };
      this.input.forward = normY < -0.25;
      this.input.backward = normY > 0.25;
      this.input.left = normX < -0.25;
      this.input.right = normX > 0.25;
      this.input.sprint = normY < -0.72; // Auto sprint when pushing all the way forward
    };

    const handleJoystickEnd = () => {
      this.joystickTouchId = null;
      this.joystickBase.classList.remove('active');
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
      this.input.moveVector = { x: 0, y: 0 };
      this.input.forward = false;
      this.input.backward = false;
      this.input.left = false;
      this.input.right = false;
      this.input.sprint = false;
    };

    this.joystickZone.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      if (this.joystickTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystickTouchId) {
          handleJoystickMove(e.changedTouches[i]);
          break;
        }
      }
    }, { passive: false });

    this.joystickZone.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystickTouchId) {
          handleJoystickEnd();
          break;
        }
      }
    }, { passive: false });

    this.joystickZone.addEventListener('touchcancel', () => handleJoystickEnd());

    // 2. Right Look & Camera Touch Zone
    this.lookZone.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      if (this.lookTouchId !== null) return;
      const touch = e.changedTouches[0];
      this.lookTouchId = touch.identifier;
      this.lastLook = { x: touch.clientX, y: touch.clientY };
    }, { passive: false });

    this.lookZone.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      if (this.lookTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.lookTouchId) {
          const dx = touch.clientX - this.lastLook.x;
          const dy = touch.clientY - this.lastLook.y;
          this.lastLook = { x: touch.clientX, y: touch.clientY };

          const sens = (this.input.touchSensitivity || 0.0035) * (this.input.isAiming ? 0.45 : 1.0);
          this.input.deltaX += dx * sens;
          this.input.deltaY += (this.input.invertY ? -dy : dy) * sens;
          break;
        }
      }
    }, { passive: false });

    const handleLookEnd = () => {
      this.lookTouchId = null;
    };

    this.lookZone.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.lookTouchId) {
          handleLookEnd();
          break;
        }
      }
    }, { passive: false });
    this.lookZone.addEventListener('touchcancel', () => handleLookEnd());

    // 3. Action Buttons Listeners
    // FIRE button supports both tap/hold fire AND thumb drag aiming
    this.btnFire.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.changedTouches[0];
      this.fireTouchId = touch.identifier;
      this.lastFireLook = { x: touch.clientX, y: touch.clientY };

      this.input.shootJustPressed = true;
      this.input.isShooting = true;
      this.btnFire.classList.add('active');
    }, { passive: false });

    this.btnFire.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.fireTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.fireTouchId) {
          const dx = touch.clientX - this.lastFireLook.x;
          const dy = touch.clientY - this.lastFireLook.y;
          this.lastFireLook = { x: touch.clientX, y: touch.clientY };

          // Allow subtle aiming while dragging on the fire button
          const sens = (this.input.touchSensitivity || 0.0035) * 0.75;
          this.input.deltaX += dx * sens;
          this.input.deltaY += (this.input.invertY ? -dy : dy) * sens;
          break;
        }
      }
    }, { passive: false });

    const handleFireEnd = () => {
      this.fireTouchId = null;
      this.input.isShooting = false;
      this.btnFire.classList.remove('active');
    };

    this.btnFire.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleFireEnd();
    }, { passive: false });
    this.btnFire.addEventListener('touchcancel', () => handleFireEnd());

    // AIM / SCOPE toggle
    this.btnAim.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.isAiming = !this.input.isAiming;
      this.btnAim.classList.toggle('active', this.input.isAiming);
    }, { passive: false });

    // JUMP button
    this.btnJump.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.jumpPressed = true;
      this.btnJump.classList.add('active');
    }, { passive: false });
    this.btnJump.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      this.btnJump.classList.remove('active');
    }, { passive: false });

    // CROUCH toggle
    this.btnCrouch.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.crouch = !this.input.crouch;
      this.btnCrouch.classList.toggle('active', this.input.crouch);
    }, { passive: false });

    // RELOAD button
    this.btnReload.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.reloadPressed = true;
      this.btnReload.classList.add('active');
    }, { passive: false });
    this.btnReload.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      this.btnReload.classList.remove('active');
    }, { passive: false });

    // GRENADE button (Press & hold = trajectory arc, release = throw)
    this.btnGrenade.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.grenadePressed = true;
      this.input.grenadeHolding = true;
      this.btnGrenade.classList.add('active');
    }, { passive: false });
    this.btnGrenade.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.grenadeHolding = false;
      this.input.grenadeJustReleased = true;
      this.btnGrenade.classList.remove('active');
    }, { passive: false });

    // MELEE Knife strike
    this.btnMelee.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.meleePressed = true;
      this.btnMelee.classList.add('active');
    }, { passive: false });
    this.btnMelee.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      this.btnMelee.classList.remove('active');
    }, { passive: false });

    // Contextual INTERACT / DEPOT button
    this.btnInteract.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.interactPressed = true;
      this.btnInteract.classList.add('active');
    }, { passive: false });
    this.btnInteract.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      this.btnInteract.classList.remove('active');
    }, { passive: false });

    // PAUSE button
    this.btnPause.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.input.onPauseRequested) {
        this.input.onPauseRequested();
      }
    }, { passive: false });

    // FULLSCREEN toggle
    this.btnFullscreen.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleFullscreen();
    }, { passive: false });

    // Weapon switcher pills
    this.weaponPills.forEach((pill) => {
      pill.addEventListener('touchstart', (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const weaponIndex = parseInt(pill.getAttribute('data-weapon') || '1', 10);
        if (weaponIndex === 1) this.input.weapon1Pressed = true;
        else if (weaponIndex === 2) this.input.weapon2Pressed = true;
        else if (weaponIndex === 3) this.input.weapon3Pressed = true;
        this.setActiveWeaponPill(weaponIndex);
      }, { passive: false });
    });
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  private setupOrientationHandler(): void {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobileDevice = this.input.isMobile || this.input.touchControlsEnabled;

      if (isPortrait && isMobileDevice && !this.isPortraitDismissed) {
        this.portraitWarning.classList.add('active');
      } else {
        this.portraitWarning.classList.remove('active');
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
      setTimeout(checkOrientation, 200);
    });
    checkOrientation();
  }

  public setActiveWeaponPill(weaponIndex: number): void {
    this.weaponPills.forEach((pill) => {
      const idx = parseInt(pill.getAttribute('data-weapon') || '1', 10);
      pill.classList.toggle('active', idx === weaponIndex);
    });
  }

  public update(activeWeaponIndex: number, grenadeCount: number, isNearInteractable: boolean = false): void {
    if (!this.isVisible) return;

    this.setActiveWeaponPill(activeWeaponIndex);
    this.grenadeBadge.innerText = Math.max(0, grenadeCount).toString();

    // Live weapon ammo display in selector pills
    if (this.weapon) {
      const pAmmo = document.getElementById('m-ammo-1');
      if (pAmmo) pAmmo.innerText = `${this.weapon.pistolCurrentAmmo}/${this.weapon.pistolReserveAmmo}`;
      const rAmmo = document.getElementById('m-ammo-2');
      if (rAmmo) rAmmo.innerText = `${this.weapon.rifleCurrentAmmo}/${this.weapon.rifleReserveAmmo}`;
      const sAmmo = document.getElementById('m-ammo-3');
      if (sAmmo) sAmmo.innerText = `${this.weapon.sniperCurrentAmmo}/${this.weapon.sniperReserveAmmo}`;
    }

    // Toggle interact button pulsing when near depot / crates
    if (isNearInteractable) {
      this.btnInteract.classList.add('visible');
    } else {
      this.btnInteract.classList.remove('visible');
    }

    // Synchronize Aim button state if weapon ADS changed
    this.btnAim.classList.toggle('active', this.input.isAiming);
    this.btnCrouch.classList.toggle('active', this.input.crouch);
  }

  public show(): void {
    this.isVisible = true;
    this.updateVisibility();
  }

  public hide(): void {
    this.isVisible = false;
    this.updateVisibility();
  }

  public setTouchEnabled(enabled: boolean): void {
    this.input.touchControlsEnabled = enabled;
    this.updateVisibility();
  }

  private updateVisibility(): void {
    const shouldShow = this.isVisible && (this.input.isMobile || this.input.touchControlsEnabled);
    this.container.style.display = shouldShow ? 'block' : 'none';
  }
}
