const GameAPI = {
  aimAt(x, y, z) {
    console.log("🎯 [aimAt] Aiming at:", x.toFixed(6), y.toFixed(6), z.toFixed(6));
    // Bạn có thể thêm xử lý ngắm tự động vào đây (ví dụ: tính toán drag hoặc mô phỏng)
  },

  setCrosshairTarget(x, y, z) {
    console.log("🎯 AimLock to bone_Head:", x.toFixed(6), y.toFixed(6), z.toFixed(6));
  },

  isBoneVisible(boneName) {
    return true; // Giả lập luôn nhìn thấy
  },

  getVisibleEnemies() {
    return [
      {
        id: 1,
        bone_Head: {
          position: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 }
        }
      }
    ];
  },

  getCurrentTarget() {
    return {
      bone_Head: {
        position: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 }
      }
    };
  },

  setCameraDirection(dir) {
    console.log("📷 Camera direction set to:", dir.x.toFixed(6), dir.y.toFixed(6), dir.z.toFixed(6));
  }
};
const GamePackages = {
  GamePackage1: "com.dts.freefireth",
  GamePackage2: "com.dts.freefiremax"
};
const BoneHeadTracker = {
  boneTransform: {
    position: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 },
    rotation: { x: 0.0258174837, y: -0.08611039, z: -0.1402113, w: 0.9860321 },
    scale:    { x: 0.99999994, y: 1.00000012, z: 1.0 }
  },

  bindPose: {
    e00: -1.34559613E-13, e01: 8.881784E-14, e02: -1.0, e03: 0.487912,
    e10: -2.84512817E-06, e11: -1.0, e12: 8.881784E-14, e13: -2.842171E-14,
    e20: -1.0, e21: 2.84512817E-06, e22: -1.72951931E-13, e23: 0.0,
    e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
  },

  quaternionToMatrix: function (q) {
    const { x, y, z, w } = q;
    return [
      1 - 2*y*y - 2*z*z,   2*x*y - 2*z*w,     2*x*z + 2*y*w, 0,
      2*x*y + 2*z*w,       1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w, 0,
      2*x*z - 2*y*w,       2*y*z + 2*x*w,     1 - 2*x*x - 2*y*y, 0,
      0, 0, 0, 1
    ];
  },

  computeFinalWorldPosition: function () {
    const t = this.boneTransform;
    const bp = this.bindPose;

    const bindMatrix = [
      [bp.e00, bp.e01, bp.e02, bp.e03],
      [bp.e10, bp.e11, bp.e12, bp.e13],
      [bp.e20, bp.e21, bp.e22, bp.e23],
      [bp.e30, bp.e31, bp.e32, bp.e33]
    ];

    const rotMatrix = this.quaternionToMatrix(t.rotation);

    const finalMatrix = [
      [rotMatrix[0] * t.scale.x, rotMatrix[1] * t.scale.y, rotMatrix[2] * t.scale.z, t.position.x],
      [rotMatrix[4] * t.scale.x, rotMatrix[5] * t.scale.y, rotMatrix[6] * t.scale.z, t.position.y],
      [rotMatrix[8] * t.scale.x, rotMatrix[9] * t.scale.y, rotMatrix[10] * t.scale.z, t.position.z],
      [0, 0, 0, 1]
    ];

    const result = [];
    for (let i = 0; i < 4; i++) {
      result[i] = [];
      for (let j = 0; j < 4; j++) {
        result[i][j] = 0;
        for (let k = 0; k < 4; k++) {
          result[i][j] += bindMatrix[i][k] * finalMatrix[k][j];
        }
      }
    }

    return {
      x: result[0][3],
      y: result[1][3],
      z: result[2][3]
    };
  },

  lockToBoneHead: function () {
    const headWorldPos = this.computeFinalWorldPosition();
    GameAPI.aimAt(headWorldPos.x, headWorldPos.y, headWorldPos.z);
  },

  runLoop: function () {
    setInterval(() => {
      this.lockToBoneHead();
    }, 8);
  }
};

BoneHeadTracker.runLoop();

if (typeof GameAPI.aimAt !== "function") {
  GameAPI.aimAt = function (x, y, z) {
    console.log("🎯 [aimAt] Fallback Aiming at:", x.toFixed(6), y.toFixed(6), z.toFixed(6));
  };
}

const AimLockWithKalman = {
  currentBone: {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    lastUpdate: Date.now()
  },

  kalman: {
    Q: 0.01,
    R: 0.1,
    P: 1,
    K: 0.5,
    x: { x: 0, y: 0, z: 0 },
    update: function (measured) {
      for (let axis of ["x", "y", "z"]) {
        this.P = this.P + this.Q;
        this.K = this.P / (this.P + this.R);
        this.x[axis] = this.x[axis] + this.K * (measured[axis] - this.x[axis]);
        this.P = (1 - this.K) * this.P;
      }
      return { ...this.x };
    }
  },

  getTargetHeadWorldPosition: function (target) {
    return BoneHeadTracker.computeFinalWorldPosition(target);
  },

  predictPosition: function () {
    const now = Date.now();
    const dt = (now - this.currentBone.lastUpdate) / 1000;
    return {
      x: this.currentBone.position.x + this.currentBone.velocity.x * dt,
      y: this.currentBone.position.y + this.currentBone.velocity.y * dt,
      z: this.currentBone.position.z + this.currentBone.velocity.z * dt
    };
  },

  updateTarget: function (newPos) {
    const now = Date.now();
    const dt = (now - this.currentBone.lastUpdate) / 1000 || 0.016;

    this.currentBone.velocity = {
      x: (newPos.x - this.currentBone.position.x) / dt,
      y: (newPos.y - this.currentBone.position.y) / dt,
      z: (newPos.z - this.currentBone.position.z) / dt
    };

    const smoothed = this.kalman.update(newPos);

    this.currentBone.position = smoothed;
    this.currentBone.lastUpdate = now;
  },

  lockToTarget: function () {
    const predicted = this.predictPosition();
    GameAPI.aimAt(predicted.x, predicted.y, predicted.z);
  },

  isTargetVisible: function () {
    return GameAPI.isBoneVisible("bone_Head");
  },

  acquireNewTarget: function () {
    const enemies = GameAPI.getVisibleEnemies();
    for (let enemy of enemies) {
      if (enemy.bone_Head) {
        return enemy;
      }
    }
    return null;
  },

  runLoop: function () {
    setInterval(() => {
      if (!this.isTargetVisible()) {
        const newTarget = this.acquireNewTarget();
        if (newTarget) {
          const pos = this.getTargetHeadWorldPosition(newTarget);
          this.updateTarget(pos);
        }
        return;
      }

      const headPos = this.getTargetHeadWorldPosition(GameAPI.getCurrentTarget());
      this.updateTarget(headPos);
      this.lockToTarget();
    }, 8);
  }
};

AimLockWithKalman.runLoop();

const DragHardLock = {
  boneTransform: {
    position: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 },
    rotation: { x: 0.0258174837, y: -0.08611039, z: -0.1402113, w: 0.9860321 },
    scale:    { x: 0.99999994, y: 1.00000012, z: 1.0 }
  },

  bindPose: {
    e00: -1.34559613E-13, e01: 8.881784E-14, e02: -1.0, e03: 0.487912,
    e10: -2.84512817E-06, e11: -1.0, e12: 8.881784E-14, e13: -2.842171E-14,
    e20: -1.0, e21: 2.84512817E-06, e22: -1.72951931E-13, e23: 0.0,
    e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
  },

  quaternionToMatrix: function (q) {
    const { x, y, z, w } = q;
    return [
      1 - 2*y*y - 2*z*z,   2*x*y - 2*z*w,     2*x*z + 2*y*w, 0,
      2*x*y + 2*z*w,       1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w, 0,
      2*x*z - 2*y*w,       2*y*z + 2*x*w,     1 - 2*x*x - 2*y*y, 0,
      0, 0, 0, 1
    ];
  },

  multiplyMatrices: function (A, B) {
    const result = Array(4).fill(null).map(() => Array(4).fill(0));
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  },

  getWorldHeadPosition: function () {
    const t = this.boneTransform;
    const bp = this.bindPose;
    const bind = [
      [bp.e00, bp.e01, bp.e02, bp.e03],
      [bp.e10, bp.e11, bp.e12, bp.e13],
      [bp.e20, bp.e21, bp.e22, bp.e23],
      [bp.e30, bp.e31, bp.e32, bp.e33]
    ];

    const rot = this.quaternionToMatrix(t.rotation);
    const model = [
      [rot[0] * t.scale.x, rot[1] * t.scale.y, rot[2] * t.scale.z, t.position.x],
      [rot[4] * t.scale.x, rot[5] * t.scale.y, rot[6] * t.scale.z, t.position.y],
      [rot[8] * t.scale.x, rot[9] * t.scale.y, rot[10] * t.scale.z, t.position.z],
      [0, 0, 0, 1]
    ];

    const worldMatrix = this.multiplyMatrices(bind, model);
    return {
      x: worldMatrix[0][3],
      y: worldMatrix[1][3],
      z: worldMatrix[2][3]
    };
  },

  dragLockFrame: function () {
    const headPos = this.getWorldHeadPosition();
    GameAPI.setCrosshairTarget(headPos.x, headPos.y, headPos.z);
  },

  runLockLoop: function () {
    setInterval(() => {
      this.dragLockFrame();
    }, 8); // ~60 FPS
  }
};

DragHardLock.runLockLoop();

const StableDragLock = {
  filteredPos: { x: 0, y: 0, z: 0 },
  lastUpdate: Date.now(),

  kalman: {
    Q: 0.005, R: 0.1, P: 1, K: 0.5,
    x: { x: 0, y: 0, z: 0 },
    update(measured) {
      for (let axis of ["x", "y", "z"]) {
        this.P = this.P + this.Q;
        this.K = this.P / (this.P + this.R);
        this.x[axis] = this.x[axis] + this.K * (measured[axis] - this.x[axis]);
        this.P = (1 - this.K) * this.P;
      }
      return { ...this.x };
    }
  },

  lerp(current, target, alpha) {
    return {
      x: current.x + (target.x - current.x) * alpha,
      y: current.y + (target.y - current.y) * alpha,
      z: current.z + (target.z - current.z) * alpha
    };
  },

  getWorldHeadPosition() {
    return { x: 0.487912, y: -0.0045, z: 0 }; // giá trị test cố định
  },

  dragSmoothFrame() {
    const rawHeadPos = this.getWorldHeadPosition();
    const smoothed = this.kalman.update(rawHeadPos);
    const dt = (Date.now() - this.lastUpdate) / 1000 || 0.016;
    const alpha = Math.min(1, dt * 60);
    this.filteredPos = this.lerp(this.filteredPos, smoothed, alpha);

    console.log(
      "🎯 Smooth AimLock:",
      this.filteredPos.x.toFixed(6),
      this.filteredPos.y.toFixed(6),
      this.filteredPos.z.toFixed(6)
    );

    this.lastUpdate = Date.now();
  },

  runLoop() {
    const loop = () => {
      this.dragSmoothFrame();
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(loop);
      } else {
        setTimeout(loop, 8);
      }
    };
    loop();
  }
};

StableDragLock.runLoop();

const HardBindHeadLock = {
  kalman: {
    Q: 0.0001,
    R: 0.001,
    P: 1,
    K: 0.5,
    x: { x: 0, y: 0, z: 0 },
    update(measured) {
      for (let axis of ["x", "y", "z"]) {
        this.P += this.Q;
        this.K = this.P / (this.P + this.R);
        this.x[axis] += this.K * (measured[axis] - this.x[axis]);
        this.P *= (1 - this.K);
      }
      return { ...this.x };
    }
  },

  getWorldHeadPosition() {
    return {
      x: -0.0456970781,
      y: -0.004478302,
      z: -0.0200432576
    };
  },

  lockHeadInstant: function () {
    const raw = this.getWorldHeadPosition();
    const precise = this.kalman.update(raw);
    console.log("🎯 LOCKED bone_Head:", precise.x.toFixed(6), precise.y.toFixed(6), precise.z.toFixed(6));
  },

  run: function () {
    setInterval(() => {
      this.lockHeadInstant();
    }, 8);
  }
};

HardBindHeadLock.run();

const HardDistanceLock = {
  kalman: {
    Q: 0.0001,
    R: 0.001,
    P: 1,
    K: 0.5,
    x: { x: 0, y: 0, z: 0 },
    update(measured) {
      for (let axis of ["x", "y", "z"]) {
        this.P += this.Q;
        this.K = this.P / (this.P + this.R);
        this.x[axis] += this.K * (measured[axis] - this.x[axis]);
        this.P *= (1 - this.K);
      }
      return { ...this.x };
    }
  },

  getCameraPosition() {
    return { x: 0, y: 1.5, z: -3 };
  },

  getWorldHeadPosition() {
    return { x: 0.487912, y: -0.004478, z: 0.0 };
  },

  normalize(v) {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1e-6;
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  },

  lockHeadFrame: function () {
    const cam = this.getCameraPosition();
    const head = this.getWorldHeadPosition();

    const dir = {
      x: head.x - cam.x,
      y: head.y - cam.y,
      z: head.z - cam.z
    };

    const norm = this.normalize(dir);
    const filtered = this.kalman.update(norm);

    console.log("🎯 LOCK DIR:", filtered.x.toFixed(6), filtered.y.toFixed(6), filtered.z.toFixed(6));
  },

  run: function () {
    setInterval(() => {
      this.lockHeadFrame();
    }, 8);
  }
};

HardDistanceLock.run();

(function () {
  const Vector3 = function (x, y, z) {
    return {
      x, y, z,
      subtract(v) {
        return Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
      },
      magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
      },
      normalize() {
        const mag = this.magnitude();
        return mag === 0 ? Vector3(0, 0, 0) : Vector3(this.x / mag, this.y / mag, this.z / mag);
      },
      addScaled(v, scale) {
        return Vector3(this.x + v.x * scale, this.y + v.y * scale, this.z + v.z * scale);
      }
    };
  };

  const BindposeMatrix = [
    [-1.34559613e-13, 8.881784e-14, -1.0, 0.487912],
    [-2.84512817e-6, -1.0, 8.881784e-14, -2.842171e-14],
    [-1.0, 2.84512817e-6, -1.72951931e-13, 0.0],
    [0.0, 0.0, 0.0, 1.0]
  ];

  const transformBindpose = function (matrix, localPos) {
    const x = matrix[0][0] * localPos.x + matrix[0][1] * localPos.y + matrix[0][2] * localPos.z + matrix[0][3];
    const y = matrix[1][0] * localPos.x + matrix[1][1] * localPos.y + matrix[1][2] * localPos.z + matrix[1][3];
    const z = matrix[2][0] * localPos.x + matrix[2][1] * localPos.y + matrix[2][2] * localPos.z + matrix[2][3];
    return Vector3(x, y, z);
  };

const AimLockEngine = {
  aimSensitivity: 999.0,
  dynamicSensitivity: true,

  cameraPos: Vector3(0.0, 1.6, -1.0),
  aimDir: Vector3(0.0, 0.0, 1.0),

  lockRegion: {
    deltaX: 0.15,
    deltaY: 0.15,
    deltaZ: 0.15
  },

  update: function (boneHeadLocalPos) {
    const worldPos = transformBindpose(BindposeMatrix, boneHeadLocalPos);
    const offset = worldPos.subtract(this.cameraPos);

    if (
      Math.abs(offset.x) > this.lockRegion.deltaX ||
      Math.abs(offset.y) > this.lockRegion.deltaY ||
      Math.abs(offset.z) > this.lockRegion.deltaZ
    ) {
      return; // Ngoài vùng đầu, không xử lý
    }

    const direction = offset.normalize();

    if (this.dynamicSensitivity) {
      this.adjustSensitivity(worldPos); // tự động điều chỉnh nhạy
    }

    this.aimDir = this.aimDir.addScaled(direction, this.aimSensitivity).normalize();

    if (typeof GameAPI !== "undefined" && GameAPI.setCameraDirection) {
      GameAPI.setCameraDirection(this.aimDir);
    }
  },

  // ✅ Auto-tune aim sensitivity theo khoảng cách và vận tốc enemy
  adjustSensitivity: function (targetPos) {
    const offset = targetPos.subtract(this.cameraPos);
    const distance = offset.magnitude();

    // Ước lượng vận tốc enemy (nếu có)
    let velocity = 0;
    if (typeof GameAPI.getCurrentTarget === "function") {
      const current = GameAPI.getCurrentTarget();
      if (current?.velocity) {
        const v = current.velocity;
        velocity = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      }
    }

    // Tính hệ số sensitivity
    const minDist = 0.01, maxDist = 9999.0;
    const minSens = 0.5, maxSens = 9999.0;
    const speedWeight = 1.0;

    let distRatio = (distance - minDist) / (maxDist - minDist);
    distRatio = Math.max(0, Math.min(1, distRatio));

    let velocityRatio = Math.min(1.0, velocity / 10.0);

    const ratio = (1 - distRatio) * 0.7 + velocityRatio * 0.3 * speedWeight;
    const sensitivity = minSens + (maxSens - minSens) * ratio;

    this.aimSensitivity = parseFloat(sensitivity.toFixed(4));
  },

  debugLog: function () {
    console.log(`[AIM] Dir = (${this.aimDir.x.toFixed(3)}, ${this.aimDir.y.toFixed(3)}, ${this.aimDir.z.toFixed(3)}) | Sens = ${this.aimSensitivity.toFixed(2)}`);
  }
};

  function startRealtimeTracking() {
    const tick = () => {
      const boneHeadLocalPos = Vector3(-0.0456970781, -0.004478302, -0.0200432576);
      AimLockEngine.update(boneHeadLocalPos);
      AimLockEngine.debugLog();
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(tick);
      } else {
        setTimeout(tick, 16);
      }
    };

    tick();
  }

  if (typeof globalThis !== "undefined") {
    globalThis.AimLockEngine = AimLockEngine;
  }

  startRealtimeTracking();
})();
  
