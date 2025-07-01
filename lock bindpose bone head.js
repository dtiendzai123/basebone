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

    // 1. Ma trận bindpose (4x4)
    const bindMatrix = [
      [bp.e00, bp.e01, bp.e02, bp.e03],
      [bp.e10, bp.e11, bp.e12, bp.e13],
      [bp.e20, bp.e21, bp.e22, bp.e23],
      [bp.e30, bp.e31, bp.e32, bp.e33]
    ];

    // 2. Ma trận transform (scale * rotation * position)
    const rotMatrix = this.quaternionToMatrix(t.rotation);

    const finalMatrix = [
      [rotMatrix[0] * t.scale.x, rotMatrix[1] * t.scale.y, rotMatrix[2] * t.scale.z, t.position.x],
      [rotMatrix[4] * t.scale.x, rotMatrix[5] * t.scale.y, rotMatrix[6] * t.scale.z, t.position.y],
      [rotMatrix[8] * t.scale.x, rotMatrix[9] * t.scale.y, rotMatrix[10] * t.scale.z, t.position.z],
      [0, 0, 0, 1]
    ];

    // 3. Nhân bindpose * transform để lấy world matrix
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

    // 4. Trích xuất tọa độ bone head trong thế giới
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
    }, 16); // chạy 60fps
  }
};

BoneHeadTracker.runLoop();

const AimLockWithKalman = {
  // Thông tin xương đầu hiện tại
  currentBone: {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    lastUpdate: Date.now()
  },

  // Kalman Filter đơn giản cho tracking mượt
  kalman: {
    Q: 0.01, // Noise vị trí
    R: 0.1,  // Noise đo
    P: 1,    // Sai số
    K: 0.5,  // Kalman gain
    x: { x: 0, y: 0, z: 0 }, // Giá trị dự đoán
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
    // Tính vị trí thế giới từ bindpose + transform
    return BoneHeadTracker.computeFinalWorldPosition(target);
  },

  predictPosition: function () {
    const now = Date.now();
    const dt = (now - this.currentBone.lastUpdate) / 1000; // giây
    return {
      x: this.currentBone.position.x + this.currentBone.velocity.x * dt,
      y: this.currentBone.position.y + this.currentBone.velocity.y * dt,
      z: this.currentBone.position.z + this.currentBone.velocity.z * dt
    };
  },

  updateTarget: function (newPos) {
    const now = Date.now();
    const dt = (now - this.currentBone.lastUpdate) / 1000 || 0.016;

    // Tính vận tốc
    this.currentBone.velocity = {
      x: (newPos.x - this.currentBone.position.x) / dt,
      y: (newPos.y - this.currentBone.position.y) / dt,
      z: (newPos.z - this.currentBone.position.z) / dt
    };

    // Kalman Filter
    const smoothed = this.kalman.update(newPos);

    // Cập nhật lại
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

      // Có mục tiêu
      const headPos = this.getTargetHeadWorldPosition(GameAPI.getCurrentTarget());
      this.updateTarget(headPos);
      this.lockToTarget();
    }, 16);
  }
};

AimLockWithKalman.runLoop();
