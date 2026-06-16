import React, { useEffect, useRef, useState } from "react";
import { Engine, Bodies, Composite, Body, Events } from "matter-js";
import { Flag, Trophy } from "lucide-react";

// Game Speed Scale Configurations
const SPEED_SCALES = [1, 1.5, 2, 3];

interface GameProps {
  participants: string[];
  isStarted: boolean;
  onFinished: (rankings: string[]) => void;
  onReset: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ObstacleConfig {
  x: number;
  y: number;
  r: number;
}

interface MarbleInstance {
  body: Body;
  name: string;
  color: string;
  trail: { x: number; y: number }[];
}

export const DeathRace: React.FC<GameProps> = ({
  participants,
  isStarted,
  onFinished,
  onReset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const requestRef = useRef<number | null>(null);

  // Track parameters (Vertical length 4800px, width scales dynamically)
  const trackHeight = 4800;
  const [trackWidth, setTrackWidth] = useState<number>(800);
  const finishLineY = 300;

  // React state for HUD
  const [leader, setLeader] = useState<string>("-");
  const [speedScale, setSpeedScale] = useState<number>(SPEED_SCALES[0]);
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [isManualCamera, setIsManualCamera] = useState<boolean>(false); // Track manual override
  const [prevIsStarted, setPrevIsStarted] = useState<boolean>(isStarted);
  const [crossedCount, setCrossedCount] = useState<number>(0);

  // Countdown & Start Control States
  const [shuffledParticipants, setShuffledParticipants] = useState<string[]>(
    [],
  );
  const [raceStarted, setRaceStarted] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<string | number | null>(null);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);

  const raceStartedRef = useRef<boolean>(false);
  const speedScaleRef = useRef<number>(SPEED_SCALES[0]);

  // Sync state during render when game starts/stops
  if (isStarted !== prevIsStarted) {
    setPrevIsStarted(isStarted);
    if (isStarted) {
      setGameEnded(false);
      setIsManualCamera(false);
      setCrossedCount(0);
      setShuffledParticipants([...participants]);
      setRaceStarted(false);
      setCountdown(null);
      setIsCountdownActive(false);
      setSpeedScale(SPEED_SCALES[0]);
    } else {
      setShuffledParticipants([]);
      setRaceStarted(false);
      setCountdown(null);
      setIsCountdownActive(false);
      setSpeedScale(SPEED_SCALES[0]);
    }
  }

  useEffect(() => {
    raceStartedRef.current = raceStarted;
  }, [raceStarted]);

  useEffect(() => {
    speedScaleRef.current = speedScale;
  }, [speedScale]);

  // References for drawing loop & physics
  const particlesRef = useRef<Particle[]>([]);
  const marblesRef = useRef<MarbleInstance[]>([]);
  const cameraYRef = useRef<number>(0);
  const cameraShakeRef = useRef<number>(0); // Screen shake intensity
  const activeShockwavesRef = useRef<Shockwave[]>([]); // Dynamic expanding shockwaves

  // List tracking the crossing order of marbles by body ID
  const crossedListRef = useRef<number[]>([]);
  const isManualCameraRef = useRef<boolean>(false); // Ref for loop access

  // Color generator
  const getMarbleColor = (index: number) => {
    const hues = [15, 35, 140, 200, 270, 320, 45, 90, 180, 220, 290];
    const hue = hues[index % hues.length];
    return `hsl(${hue}, 85%, 60%)`;
  };

  // Trigger collision particles
  const spawnParticles = (
    x: number,
    y: number,
    color: string,
    count: number,
    speedMultiplier = 1,
  ) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 2.5) * speedMultiplier;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 3,
        alpha: 1,
        life: 0,
        maxLife: 20 + Math.random() * 30,
      });
    }
    particlesRef.current.push(...newParticles);
  };

  useEffect(() => {
    // 1. Initialize Matter.js Engine
    const engine = Engine.create({
      gravity: { x: 0, y: 0 },
    });
    engineRef.current = engine;

    const scaleX = trackWidth / 500; // 500 is reference width

    const transformPos = (x_orig: number, y_orig: number) => {
      return {
        x: y_orig * scaleX,
        y: trackHeight - x_orig,
      };
    };

    // Helper coordinate checks for Slow Mud Zones (transformed to vertical)
    const isInsideSlowZone = (pos: { x: number; y: number }) => {
      const zones = [
        { xMin: 0, xMax: 150 * scaleX, yMin: 3790, yMax: 4010 }, // Mud 1
        { xMin: 175 * scaleX, xMax: 325 * scaleX, yMin: 3040, yMax: 3260 }, // Mud 2
        { xMin: 350 * scaleX, xMax: 500 * scaleX, yMin: 2290, yMax: 2510 }, // Mud 3
        { xMin: 150 * scaleX, xMax: 350 * scaleX, yMin: 1080, yMax: 1320 }, // Mud 4
      ];
      return zones.some(
        (zone) =>
          pos.x >= zone.xMin &&
          pos.x <= zone.xMax &&
          pos.y >= zone.yMin &&
          pos.y <= zone.yMax,
      );
    };

    // Outer boundary configurations
    const boundaries = [
      // Left Wall
      Bodies.rectangle(-10, trackHeight / 2, 20, trackHeight, {
        isStatic: true,
        label: "wall",
        restitution: 0.8,
        friction: 0,
        frictionStatic: 0,
      }),
      // Right Wall
      Bodies.rectangle(trackWidth + 10, trackHeight / 2, 20, trackHeight, {
        isStatic: true,
        label: "wall",
        restitution: 0.8,
        friction: 0,
        frictionStatic: 0,
      }),
      // Bottom Wall
      Bodies.rectangle(trackWidth / 2, trackHeight + 10, trackWidth, 20, {
        isStatic: true,
        label: "wall",
        friction: 0,
        frictionStatic: 0,
      }),
      // Top Barrier
      Bodies.rectangle(trackWidth / 2, -50, trackWidth, 20, {
        isStatic: true,
        label: "wall",
        friction: 0,
        frictionStatic: 0,
      }),
    ];
    Composite.add(engine.world, boundaries);

    // Maze Static Obstacles (Inner Walls - Slanted!)
    const mazeWallsData = [
      { x: 1500, y: 110, w: 24, h: 160, angle: -Math.PI / 4 },
      { x: 1800, y: 500 - 110, w: 24, h: 160, angle: Math.PI / 4 },
      { x: 2950, y: 250, w: 24, h: 180, angle: Math.PI / 4 },
      { x: 4000, y: 120, w: 24, h: 160, angle: -Math.PI / 4 },
      { x: 4000, y: 500 - 120, w: 24, h: 160, angle: Math.PI / 4 },
    ];

    const staticMazeWalls = mazeWallsData.map((w) => {
      const pos = transformPos(w.x, w.y);
      const new_w = w.h * scaleX; // length along horizontal
      const new_h = w.w; // thickness along vertical
      const body = Bodies.rectangle(pos.x, pos.y, new_w, new_h, {
        isStatic: true,
        label: "wall",
        restitution: 0.95,
        friction: 0,
        frictionStatic: 0,
        angle: w.angle + Math.PI / 2,
      });
      body.plugin = { isMazeWall: true, w: new_w, h: new_h };
      return body;
    });
    Composite.add(engine.world, staticMazeWalls);

    // Bouncy Static Obstacles (Bumpers)
    const obstaclesData: ObstacleConfig[] = [
      { x: 450, y: 150, r: 25 },
      { x: 450, y: 350, r: 25 },
      { x: 750, y: 250, r: 35 },

      // Sector 2 Maze Bumpers
      { x: 1350, y: 150, r: 24 },
      { x: 1350, y: 350, r: 24 },
      { x: 1650, y: 100, r: 22 },
      { x: 1650, y: 250, r: 25 },
      { x: 1650, y: 400, r: 22 },
      { x: 1950, y: 150, r: 24 },
      { x: 1950, y: 350, r: 24 },

      // Sector 3 Bumpers
      { x: 2550, y: 250, r: 30 },
      { x: 2800, y: 180, r: 20 },
      { x: 2800, y: 320, r: 20 },
      { x: 3100, y: 100, r: 25 },
      { x: 3100, y: 400, r: 25 },
      { x: 3800, y: 150, r: 28 },
      { x: 3800, y: 350, r: 28 },
      { x: 4150, y: 250, r: 30 },
    ];

    const staticObstacles = obstaclesData.map((data) => {
      const pos = transformPos(data.x, data.y);
      return Bodies.circle(pos.x, pos.y, data.r, {
        isStatic: true,
        label: "obstacle",
        restitution: 1.35,
        friction: 0,
      });
    });
    Composite.add(engine.world, staticObstacles);

    // Booster Sensors (Green arrows)
    const boostersData = [
      { x: 600, y: 250, w: 60, h: 200 },
      { x: 1350, y: 250, w: 60, h: 120 },
      { x: 2000, y: 100, w: 60, h: 140 },
      { x: 2000, y: 400, w: 60, h: 140 },
      { x: 3100, y: 250, w: 65, h: 160 },
      { x: 3900, y: 250, w: 60, h: 140 },
      { x: 4250, y: 150, w: 60, h: 150 },
      { x: 4250, y: 350, w: 60, h: 150 },
    ];

    const staticBoosters = boostersData.map((data) => {
      const pos = transformPos(data.x, data.y);
      const new_w = data.h * scaleX; // new width along horizontal
      const new_h = data.w; // new height along vertical
      return Bodies.rectangle(pos.x, pos.y, new_w, new_h, {
        isStatic: true,
        isSensor: true,
        label: "booster",
      });
    });
    Composite.add(engine.world, staticBoosters);

    // Create Spinning Windmills (Cross Compound Bodies)
    const createWindmill = (x: number, y: number, length = 160) => {
      const part1 = Bodies.rectangle(x, y, 16, length, {
        label: "windmill_blade",
      });
      const part2 = Bodies.rectangle(x, y, length, 16, {
        angle: Math.PI / 2,
        label: "windmill_blade",
      });
      return Body.create({
        parts: [part1, part2],
        isStatic: true,
        label: "windmill",
        restitution: 1.25,
        friction: 0,
      });
    };

    const windmill1 = createWindmill(250 * scaleX, 4800 - 1100, 160 * scaleX);
    const windmill2 = createWindmill(250 * scaleX, 4800 - 2300, 160 * scaleX);
    const windmill3 = createWindmill(120 * scaleX, 4800 - 3400, 140 * scaleX);
    const windmill4 = createWindmill(380 * scaleX, 4800 - 3400, 140 * scaleX);
    const windmills = [windmill1, windmill2, windmill3, windmill4];
    Composite.add(engine.world, windmills);

    // Create Marbles/Cars if game started
    if (isStarted && shuffledParticipants.length > 0) {
      crossedListRef.current = [];
      isManualCameraRef.current = false;

      const startY = 4700;

      const marbles = shuffledParticipants.map((name, index) => {
        const spreadX =
          shuffledParticipants.length > 1
            ? 50 +
              (index * (trackWidth - 100)) / (shuffledParticipants.length - 1)
            : trackWidth / 2;

        const body = Bodies.circle(spreadX, startY, 14, {
          restitution: 0.85,
          frictionAir: 0.04,
          friction: 0,
          frictionStatic: 0,
          label: "marble",
          density: 0.0015,
        });

        body.plugin = {
          name,
          stunTime: 0,
          stuckFrames: 0,
          lastProgressY: startY,
          progressFrames: 0,
          breakoutTime: 0,
        };
        return {
          body,
          name,
          color: getMarbleColor(index),
          trail: [],
        };
      });

      marblesRef.current = marbles;
      Composite.add(
        engine.world,
        marbles.map((m) => m.body),
      );
    }

    // Baseline updates and custom forces loop
    Events.on(engine, "beforeUpdate", () => {
      // Update windmill rotations
      windmills.forEach((wm, idx) => {
        const rotationDirection = idx % 2 === 0 ? 1 : -1;
        const rotationSpeed = 0.035 * rotationDirection;
        Body.setAngle(wm, wm.angle + rotationSpeed);
        Body.setAngularVelocity(wm, rotationSpeed);
      });

      if (!raceStartedRef.current) {
        // Stop all marbles
        marblesRef.current.forEach((m) => {
          Body.setVelocity(m.body, { x: 0, y: 0 });
          Body.setAngularVelocity(m.body, 0);
        });
        return;
      }

      if (!isStarted) return;

      // Find leading Y and lagging Y bounds for Rubberbanding
      let minLeaderY = 4700;
      let maxLaggingY = -Infinity;

      marblesRef.current.forEach((m) => {
        if (m.body.position.y < minLeaderY) minLeaderY = m.body.position.y;
        if (m.body.position.y > maxLaggingY) maxLaggingY = m.body.position.y;
      });

      marblesRef.current.forEach((m) => {
        const currentPos = m.body.position;
        const currentSpeed = m.body.speed;

        // Apply micro-stun velocity reduction
        if (m.body.plugin && m.body.plugin.stunTime > 0) {
          m.body.plugin.stunTime--;
          Body.setVelocity(m.body, {
            x: m.body.velocity.x * 0.88,
            y: m.body.velocity.y * 0.88,
          });
        }

        let steerX = 0;
        let bypassNormalForces = false;
        let breakoutForceX = 0;
        let breakoutForceY = 0;

        if (m.body.plugin && m.body.plugin.breakoutTime > 0) {
          m.body.plugin.breakoutTime--;
          bypassNormalForces = true;
          breakoutForceX = currentPos.x < trackWidth / 2 ? 0.0022 : -0.0022;
          breakoutForceY = -0.0018;

          // Occasionally spawn breakout/escape particles
          if (m.body.plugin.breakoutTime % 5 === 0) {
            spawnParticles(currentPos.x, currentPos.y, "#06b6d4", 2, 0.8);
          }
        }

        if (!bypassNormalForces) {
          // 1. Static Obstacles (Bumpers) Avoidance Steering
          const scanRange = 85;
          staticObstacles.forEach((obs) => {
            const dy = currentPos.y - obs.position.y; // positive if obstacle is ahead (above)
            if (dy > 0 && dy < scanRange) {
              const dx = obs.position.x - currentPos.x;
              const dist = Math.sqrt(dx * dx + dy * dy);

              const r = obs.circleRadius || 24;
              const safetyDist = r + 28;
              if (dist < safetyDist && dist > 0) {
                const avoidDir = dx >= 0 ? -1 : 1;
                const forceMagnitude = 0.00045 * (1 - dist / safetyDist);
                steerX += avoidDir * forceMagnitude;
              }
            }
          });

          // 2. Windmills Avoidance Steering
          windmills.forEach((wm) => {
            const dy = currentPos.y - wm.position.y;
            if (dy > 0 && dy < scanRange + 20) {
              const dx = wm.position.x - currentPos.x;
              const dist = Math.sqrt(dx * dx + dy * dy);

              const safetyDist = 95;
              if (dist < safetyDist && dist > 0) {
                const avoidDir = dx >= 0 ? -1 : 1;
                const forceMagnitude = 0.0004 * (1 - dist / safetyDist);
                steerX += avoidDir * forceMagnitude;
              }
            }
          });

          // 3. Side Boundary Avoidance Steering (Left/Right Walls)
          const leftDist = currentPos.x - 14;
          if (leftDist < 20) {
            const pushRight = 0.0012 * (1 - Math.max(0, leftDist) / 20);
            steerX += pushRight;
          }
          const rightDist = trackWidth - 14 - currentPos.x;
          if (rightDist < 20) {
            const pushLeft = 0.0012 * (1 - Math.max(0, rightDist) / 20);
            steerX -= pushLeft;
          }
        }

        // Progress-based Stuck Detection: trigger breakout if no Y-progress for 100 frames (~1.6s)
        const isFinished = crossedListRef.current.includes(m.body.id);
        if (!isFinished && m.body.plugin) {
          const lastProgressY =
            m.body.plugin.lastProgressY !== undefined
              ? m.body.plugin.lastProgressY
              : currentPos.y;

          if (currentPos.y < lastProgressY - 5) {
            m.body.plugin.lastProgressY = currentPos.y;
            m.body.plugin.progressFrames = 0;
          } else {
            m.body.plugin.progressFrames =
              (m.body.plugin.progressFrames || 0) + 1;
          }

          if (m.body.plugin.progressFrames > 100) {
            m.body.plugin.progressFrames = 0;
            m.body.plugin.lastProgressY = currentPos.y;
            m.body.plugin.breakoutTime = 40;

            const escapeForceY = -0.005;
            const escapeForceX = currentPos.x < trackWidth / 2 ? 0.006 : -0.006;

            Body.applyForce(m.body, m.body.position, {
              x: escapeForceX,
              y: escapeForceY,
            });

            Body.setVelocity(m.body, {
              x: escapeForceX > 0 ? 4.5 : -4.5,
              y: -5.0,
            });

            // Spawn escape particles
            spawnParticles(currentPos.x, currentPos.y, "#38bdf8", 8, 1.2);
          }
        }

        // Random Character Shockwave Blast check
        if (Math.random() < 0.002) {
          const sourceX = currentPos.x;
          const sourceY = currentPos.y;
          const blastRange = 220;

          activeShockwavesRef.current.push({
            x: sourceX,
            y: sourceY,
            radius: 0,
            maxRadius: blastRange,
            color: m.color,
            life: 0,
            maxLife: 24,
          });

          marblesRef.current.forEach((other) => {
            if (other.body === m.body) return;
            const dx = other.body.position.x - sourceX;
            const dy = other.body.position.y - sourceY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < blastRange && dist > 0) {
              const nx = dx / dist;
              const ny = dy / dist;
              const pushForce = 0.012 * (1 - dist / blastRange);

              Body.applyForce(other.body, other.body.position, {
                x: nx * pushForce,
                y: ny * pushForce,
              });

              spawnParticles(
                other.body.position.x,
                other.body.position.y,
                other.color,
                4,
                1.2,
              );
            }
          });

          cameraShakeRef.current = Math.max(cameraShakeRef.current, 7.5);
        }

        // Check slow mud zones (gravel)
        const insideSlow = isInsideSlowZone(currentPos);

        if (insideSlow) {
          m.body.frictionAir = 0.14;
          if (m.body.velocity.y < -2.0) {
            Body.setVelocity(m.body, {
              x: m.body.velocity.x,
              y: m.body.velocity.y * 0.9,
            });
          }
        } else {
          m.body.frictionAir = 0.04;
        }

        // Rubberbanding Catch-up forces
        const baseForce = 0.00025;
        let forceY = baseForce;

        const gapDistance = currentPos.y - minLeaderY;
        if (gapDistance > 0) {
          const catchUpFactor = 1 + Math.min(3.5, gapDistance / 240);
          forceY *= catchUpFactor;
        }

        // Last-place rage aura bonus force
        const isLagger =
          currentPos.y >= maxLaggingY && marblesRef.current.length > 1;
        if (isLagger) {
          forceY *= 1.4;
        }

        if (bypassNormalForces) {
          Body.applyForce(m.body, m.body.position, {
            x: breakoutForceX,
            y: breakoutForceY,
          });
        } else {
          // Wobble noise
          const randomForceX = (Math.random() - 0.5) * 0.00012;
          const randomForceY = (Math.random() - 0.7) * 0.00008; // biased upwards

          Body.applyForce(m.body, m.body.position, {
            x: steerX + randomForceX,
            y: -forceY + randomForceY,
          });
        }

        // Leader speed limit drag
        const isLeader =
          currentPos.y <= minLeaderY && marblesRef.current.length > 1;
        const speedLimit = isLeader && minLeaderY < 4500 ? 11.5 : 16;

        if (currentSpeed > speedLimit) {
          Body.setVelocity(m.body, {
            x: (m.body.velocity.x / currentSpeed) * speedLimit,
            y: (m.body.velocity.y / currentSpeed) * speedLimit,
          });
        }
      });
    });

    // Handle collision trigger (boosters)
    Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;

        if (bodyA.label === "marble" && bodyB.label === "marble") {
          const dx = bodyB.position.x - bodyA.position.x;
          const dy = bodyB.position.y - bodyA.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;

          const rvx = bodyB.velocity.x - bodyA.velocity.x;
          const rvy = bodyB.velocity.y - bodyA.velocity.y;
          const relVelocityAlongNormal = rvx * nx + rvy * ny;

          if (relVelocityAlongNormal < 0) {
            const elasticity = 0.88;
            const impulseScalar =
              (-(1 + elasticity) * relVelocityAlongNormal) / 2;

            const impulseX = impulseScalar * nx;
            const impulseY = impulseScalar * ny;

            const knockbackMultiplier = 1.35;
            Body.setVelocity(bodyA, {
              x: bodyA.velocity.x - impulseX * knockbackMultiplier,
              y: bodyA.velocity.y - impulseY * knockbackMultiplier,
            });
            Body.setVelocity(bodyB, {
              x: bodyB.velocity.x + impulseX * knockbackMultiplier,
              y: bodyB.velocity.y + impulseY * knockbackMultiplier,
            });

            const impactMagnitude = Math.abs(relVelocityAlongNormal);
            const mObjA = marblesRef.current.find((m) => m.body === bodyA);
            const mObjB = marblesRef.current.find((m) => m.body === bodyB);
            const colorA = mObjA ? mObjA.color : "#ffffff";
            const colorB = mObjB ? mObjB.color : "#ffffff";

            const impactX = (bodyA.position.x + bodyB.position.x) / 2;
            const impactY = (bodyA.position.y + bodyB.position.y) / 2;

            if (impactMagnitude > 7.0) {
              cameraShakeRef.current = Math.max(cameraShakeRef.current, 10);
              spawnParticles(impactX, impactY, colorA, 14, 2.2);
              spawnParticles(impactX, impactY, colorB, 14, 2.2);

              if (bodyA.plugin) bodyA.plugin.stunTime = 16;
              if (bodyB.plugin) bodyB.plugin.stunTime = 16;
            } else if (impactMagnitude > 3.0) {
              cameraShakeRef.current = Math.max(cameraShakeRef.current, 4.5);
              spawnParticles(impactX, impactY, colorA, 8, 1.4);
              spawnParticles(impactX, impactY, colorB, 8, 1.4);
            }
          }
        } else {
          let marbleBody: Body | null = null;
          let otherBody: Body | null = null;

          if (bodyA.label === "marble") {
            marbleBody = bodyA;
            otherBody = bodyB;
          } else if (bodyB.label === "marble") {
            marbleBody = bodyB;
            otherBody = bodyA;
          }

          if (marbleBody && otherBody) {
            const marbleObj = marblesRef.current.find(
              (m) => m.body === marbleBody,
            );
            const color = marbleObj ? marbleObj.color : "#ffffff";

            if (otherBody.label === "booster") {
              Body.setVelocity(marbleBody, {
                x: marbleBody.velocity.x * 0.5,
                y: Math.min(marbleBody.velocity.y - 12, -22),
              });
              spawnParticles(
                marbleBody.position.x,
                marbleBody.position.y,
                color,
                12,
                1.8,
              );
            } else if (otherBody.label === "windmill") {
              cameraShakeRef.current = Math.max(cameraShakeRef.current, 7);
              spawnParticles(
                marbleBody.position.x,
                marbleBody.position.y,
                "#f59e0b",
                18,
                2.0,
              );
            } else if (otherBody.label === "obstacle") {
              spawnParticles(
                marbleBody.position.x,
                marbleBody.position.y,
                "#f97316",
                6,
                1.2,
              );
            }
          }
        }
      });
    });

    return () => {
      Engine.clear(engine);
    };
  }, [isStarted, shuffledParticipants, trackWidth]);

  // Drawing, Drag-to-Scroll binding, & Physics updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const updateTrackWidth = () => {
      const w = canvas.clientWidth || canvas.offsetWidth || 800;
      setTrackWidth((prev) => (prev !== w ? w : prev));
    };

    // Update width on initial mount
    updateTrackWidth();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;

      // Update width only if game has not started or has ended
      if (!isStarted || gameEnded) {
        updateTrackWidth();
      }
    };
    window.addEventListener("resize", handleResize);

    // Mouse/Touch Drag event handlers for Manual Camera Control
    let isDragging = false;
    let dragStartYVal = 0;
    let dragStartCamYVal = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragStartYVal = e.clientY;
      dragStartCamYVal = cameraYRef.current;
      isManualCameraRef.current = true;
      setIsManualCamera(true);
      canvas.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dy = e.clientY - dragStartYVal;
      cameraYRef.current = Math.max(
        0,
        Math.min(trackHeight - height, dragStartCamYVal - dy),
      );
    };

    const onMouseUpOrLeave = () => {
      if (!isDragging) return;
      isDragging = false;
      canvas.style.cursor = "grab";
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      isDragging = true;
      dragStartYVal = e.touches[0].clientY;
      dragStartCamYVal = cameraYRef.current;
      isManualCameraRef.current = true;
      setIsManualCamera(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      const dy = e.touches[0].clientY - dragStartYVal;
      cameraYRef.current = Math.max(
        0,
        Math.min(trackHeight - height, dragStartCamYVal - dy),
      );
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUpOrLeave);
    canvas.addEventListener("mouseleave", onMouseUpOrLeave);

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    // Default pointer grab style
    canvas.style.cursor = "grab";

    const update = () => {
      const engine = engineRef.current;
      if (!engine) return;

      engine.timing.timeScale = speedScaleRef.current;
      Engine.update(engine, 16.666);

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      // Handle viewport camera shift
      let leadingName = "-";
      let lastPlaceObj: MarbleInstance | null = null;

      if (isStarted && marblesRef.current.length > 0) {
        let minSubY = Infinity;
        let maxLagY = -Infinity;

        marblesRef.current.forEach((m) => {
          if (m.body.position.y < minSubY) {
            minSubY = m.body.position.y;
            leadingName = m.name;
          }
          if (m.body.position.y > maxLagY) {
            maxLagY = m.body.position.y;
            lastPlaceObj = m;
          }
        });

        setLeader(leadingName);

        // Only update camera if manual override is NOT active
        if (!isManualCameraRef.current) {
          const targetCamY = Math.max(
            0,
            Math.min(trackHeight - height, minSubY - height / 3),
          );
          cameraYRef.current += (targetCamY - cameraYRef.current) * 0.1;
        }
      } else {
        if (!isStarted) {
          cameraYRef.current = trackHeight - height; // Start camera at the bottom!
          isManualCameraRef.current = false;
        }
      }

      // Decay screen shake
      cameraShakeRef.current *= 0.9;
      if (cameraShakeRef.current < 0.1) cameraShakeRef.current = 0;

      const shakeX =
        cameraShakeRef.current > 0
          ? (Math.random() - 0.5) * cameraShakeRef.current
          : 0;
      const shakeY =
        cameraShakeRef.current > 0
          ? (Math.random() - 0.5) * cameraShakeRef.current
          : 0;

      ctx.save();
      // Apply Camera Viewport Translation + Shake Offsets
      ctx.translate(shakeX, -cameraYRef.current + shakeY);

      // 1. Draw Asphalt Track Background
      ctx.fillStyle = "#1e293b"; // Asphalt
      ctx.fillRect(15, 0, trackWidth - 30, trackHeight);

      // 1.5 Draw Checkered Border Kerbs (Red & White borders)
      const kerbHeight = 30;
      for (let y = 0; y < trackHeight; y += kerbHeight) {
        const isRed = Math.floor(y / kerbHeight) % 2 === 0;
        ctx.fillStyle = isRed ? "#ef4444" : "#ffffff";
        ctx.fillRect(0, y, 15, kerbHeight);
        ctx.fillRect(trackWidth - 15, y, 15, kerbHeight);
      }

      // White boundary lines
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(15, trackHeight);
      ctx.moveTo(trackWidth - 15, 0);
      ctx.lineTo(trackWidth - 15, trackHeight);
      ctx.stroke();

      // Dashed lane divider lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 30]);
      ctx.beginPath();
      ctx.moveTo(trackWidth / 2, 0);
      ctx.lineTo(trackWidth / 2, trackHeight);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // 1.7 Starting grid box drawings
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1.5;
      const numStartLines = Math.max(3, participants.length);
      for (let i = 0; i < numStartLines; i++) {
        const gridY = 4730 - i * 65;
        ctx.beginPath();
        ctx.moveTo(35, gridY);
        ctx.lineTo(trackWidth - 35, gridY);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(15, 4745, trackWidth - 30, 8); // starting line
      ctx.font = "bold 28px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.textAlign = "center";
      ctx.fillText("S T A R T", trackWidth / 2, 4650);

      // 2. Draw Checkpoints/Track Markers
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      for (let y = trackHeight - 400; y > finishLineY; y -= 400) {
        ctx.beginPath();
        ctx.moveTo(15, y);
        ctx.lineTo(trackWidth - 15, y);
        ctx.stroke();
        const distFromStart = trackHeight - 100 - y;
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillText(`${distFromStart}M`, 25, y - 6);
      }

      // 2.5 Draw Mud Zones (Gravel detour / slow swamp)
      const drawSlowZone = (x: number, y: number, w: number, h: number) => {
        ctx.save();
        const pulse = Math.sin(Date.now() / 150) * 0.15 + 0.35;
        ctx.fillStyle = `rgba(217, 119, 6, ${0.15 * pulse})`;
        ctx.strokeStyle = `rgba(217, 119, 6, ${0.45 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);

        ctx.strokeStyle = "rgba(217, 119, 6, 0.16)";
        ctx.lineWidth = 6;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.clip();
        for (let offset = -w; offset < w; offset += 30) {
          ctx.moveTo(x - w / 2 + offset, y - h / 2);
          ctx.lineTo(x - w / 2 + offset + h, y + h / 2);
        }
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = `rgba(217, 119, 6, ${0.8 * pulse})`;
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⚠️ GRAVEL: SLOW", x, y + 4);
        ctx.restore();
      };

      const scaleX = trackWidth / 500;
      drawSlowZone(75 * scaleX, 4800 - 900, 150 * scaleX, 220);
      drawSlowZone(250 * scaleX, 4800 - 1650, 150 * scaleX, 220);
      drawSlowZone(425 * scaleX, 4800 - 2400, 150 * scaleX, 220);
      drawSlowZone(250 * scaleX, 4800 - 3600, 200 * scaleX, 240);

      // 2.7 Update and Draw Active Shockwaves
      activeShockwavesRef.current.forEach((sw) => {
        sw.life++;
        sw.radius = sw.maxRadius * (sw.life / sw.maxLife);
        const alpha = 1 - sw.life / sw.maxLife;

        ctx.save();
        ctx.strokeStyle = sw.color
          .replace(")", `, ${alpha * 0.8})`)
          .replace("hsl", "hsla");
        ctx.lineWidth = 3.5 * (1 - sw.life / sw.maxLife) + 0.5;

        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = sw.color
          .replace(")", `, ${alpha * 0.08})`)
          .replace("hsl", "hsla");
        ctx.fill();
        ctx.restore();
      });

      activeShockwavesRef.current = activeShockwavesRef.current.filter(
        (sw) => sw.life < sw.maxLife,
      );

      // 3. Draw Booster Pads (glowing arrows pointing UP)
      const boosterGlow = Math.sin(Date.now() / 100) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(16, 185, 129, ${0.1 * boosterGlow})`;
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.4 * boosterGlow})`;
      ctx.lineWidth = 2;

      const boosters = engine.world.bodies.filter(
        (b: Body) => b.label === "booster",
      );
      boosters.forEach((booster: Body) => {
        const { min, max } = booster.bounds;
        const w = max.x - min.x;
        const h = max.y - min.y;

        ctx.fillRect(min.x, min.y, w, h);
        ctx.strokeRect(min.x, min.y, w, h);

        ctx.save();
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.6 * boosterGlow})`;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const chevronSpacing = 35;
        const chevronOffset = (Date.now() / 15) % chevronSpacing;

        // Draw chevrons pointing UP (negative y)
        for (let cy = max.y - chevronOffset; cy > min.y; cy -= chevronSpacing) {
          ctx.beginPath();
          ctx.moveTo(booster.position.x - 10, cy + 6);
          ctx.lineTo(booster.position.x, cy - 6);
          ctx.lineTo(booster.position.x + 10, cy + 6);
          ctx.stroke();
        }
        ctx.restore();
      });

      // 3.5 Draw Spinning Windmills
      const windmills = engine.world.bodies.filter(
        (b: Body) => b.label === "windmill",
      );
      windmills.forEach((wm: Body) => {
        ctx.save();
        ctx.translate(wm.position.x, wm.position.y);
        ctx.rotate(wm.angle);

        let length = 160;
        if (wm.parts && wm.parts.length > 1) {
          const part = wm.parts[1];
          const { min, max } = part.bounds;
          length = Math.max(max.x - min.x, max.y - min.y);
        }

        ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
        ctx.beginPath();
        ctx.arc(0, 0, length / 2, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createLinearGradient(0, -length / 2, 0, length / 2);
        grad.addColorStop(0, "#f43f5e");
        grad.addColorStop(0.5, "#9f1239");
        grad.addColorStop(1, "#f43f5e");

        ctx.fillStyle = grad;
        ctx.strokeStyle = "#fda4af";
        ctx.lineWidth = 2;

        ctx.fillRect(-8, -length / 2, 16, length);
        ctx.strokeRect(-8, -length / 2, 16, length);

        ctx.rotate(Math.PI / 2);
        ctx.fillRect(-8, -length / 2, 16, length);
        ctx.strokeRect(-8, -length / 2, 16, length);

        ctx.restore();

        ctx.fillStyle = "#334155";
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(wm.position.x, wm.position.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // 4. Draw Bouncy Bumpers (Obstacles, styled like tire stacks)
      const obstacles = engine.world.bodies.filter(
        (b: Body) => b.label === "obstacle",
      );
      obstacles.forEach((ob: Body) => {
        const radius = ob.circleRadius || 24;

        const borderGlow = ctx.createRadialGradient(
          ob.position.x,
          ob.position.y,
          radius,
          ob.position.x,
          ob.position.y,
          radius + 15,
        );
        borderGlow.addColorStop(0, "rgba(249, 115, 22, 0.2)");
        borderGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
        ctx.fillStyle = borderGlow;
        ctx.beginPath();
        ctx.arc(ob.position.x, ob.position.y, radius + 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#1e293b";
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(ob.position.x, ob.position.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "rgba(249, 115, 22, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ob.position.x, ob.position.y, radius - 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(ob.position.x, ob.position.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4.5 Draw Static Slanted Maze Walls (striped barrier style)
      const walls = engine.world.bodies.filter(
        (b: Body) => b.label === "wall" && b.plugin?.isMazeWall,
      );
      walls.forEach((wall: Body) => {
        const localW = (wall.plugin as { w?: number; h?: number }).w || 180;
        const localH = (wall.plugin as { w?: number; h?: number }).h || 24;

        ctx.save();
        ctx.translate(wall.position.x, wall.position.y);
        ctx.rotate(wall.angle);

        ctx.fillStyle = "#111827";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2.5;

        ctx.fillRect(-localW / 2, -localH / 2, localW, localH);
        ctx.strokeRect(-localW / 2, -localH / 2, localW, localH);

        ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
        ctx.lineWidth = 3.5;
        for (let i = 15; i < localW; i += 20) {
          ctx.beginPath();
          ctx.moveTo(-localW / 2 + i, -localH / 2);
          ctx.lineTo(-localW / 2 + i - localH, localH / 2);
          ctx.stroke();
        }
        ctx.restore();
      });

      // 5. Draw Fading Particle Trails
      marblesRef.current.forEach((m) => {
        if (!isStarted) return;

        m.trail.push({ x: m.body.position.x, y: m.body.position.y });
        if (m.trail.length > 25) {
          m.trail.shift();
        }

        if (m.trail.length > 1) {
          ctx.save();
          ctx.lineWidth = 3.5;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          for (let i = 1; i < m.trail.length; i++) {
            const ratio = i / m.trail.length;
            ctx.strokeStyle = m.color
              .replace(")", `, ${ratio * 0.45})`)
              .replace("hsl", "hsla");
            ctx.beginPath();
            ctx.moveTo(m.trail[i - 1].x, m.trail[i - 1].y);
            ctx.lineTo(m.trail[i].x, m.trail[i].y);
            ctx.stroke();
          }
          ctx.restore();
        }
      });

      // 6. Draw Formula-1 Racing Cars and Labels
      marblesRef.current.forEach((m) => {
        const { x, y } = m.body.position;
        const radius = m.body.circleRadius || 14;

        if (m === lastPlaceObj) {
          ctx.save();
          const auraPulse = Math.sin(Date.now() / 60) * 0.25 + 1.15;
          const auraRadius = radius * auraPulse;

          const auraGlow = ctx.createRadialGradient(
            x,
            y,
            radius,
            x,
            y,
            radius + 22,
          );
          auraGlow.addColorStop(0, "rgba(239, 68, 68, 0.65)");
          auraGlow.addColorStop(0.35, "rgba(244, 63, 94, 0.35)");
          auraGlow.addColorStop(1, "rgba(239, 68, 68, 0)");

          ctx.fillStyle = auraGlow;
          ctx.beginPath();
          ctx.arc(x, y, radius + 22, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(x, y, auraRadius + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        const glow = ctx.createRadialGradient(
          x,
          y,
          radius - 2,
          x,
          y,
          radius + 12,
        );
        glow.addColorStop(
          0,
          m.color.replace(")", ", 0.6)").replace("hsl", "hsla"),
        );
        glow.addColorStop(
          1,
          m.color.replace(")", ", 0").replace("hsl", "hsla"),
        );
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius + 12, 0, Math.PI * 2);
        ctx.fill();

        // DRAW SLEEK F1 RACE CAR SHAPE
        ctx.save();
        ctx.translate(x, y);

        let carAngle = -Math.PI / 2;
        if (
          Math.abs(m.body.velocity.x) > 0.1 ||
          Math.abs(m.body.velocity.y) > 0.1
        ) {
          carAngle = Math.atan2(m.body.velocity.y, m.body.velocity.x);
        }
        ctx.rotate(carAngle + Math.PI / 2); // default face is up

        // Nose Cone (front)
        ctx.fillStyle = m.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -18); // nose tip
        ctx.lineTo(-5, -6); // left front
        ctx.lineTo(5, -6); // right front
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Main chassis
        ctx.fillRect(-6, -6, 12, 18);
        ctx.strokeRect(-6, -6, 12, 18);

        // Cockpit
        ctx.fillStyle = "#020617";
        ctx.beginPath();
        ctx.ellipse(0, -1, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Front wing
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-12, -14, 24, 4);
        ctx.strokeRect(-12, -14, 24, 4);

        // Rear wing
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-14, 12, 28, 5);
        ctx.strokeRect(-14, 12, 28, 5);

        // Left front wheel
        ctx.fillStyle = "#020617";
        ctx.fillRect(-11, -11, 4, 7);
        // Right front wheel
        ctx.fillRect(7, -11, 4, 7);
        // Left rear wheel
        ctx.fillRect(-13, 5, 5, 8);
        // Right rear wheel
        ctx.fillRect(8, 5, 5, 8);

        ctx.restore();

        // Render Ranking overlay and Name tags
        const crossedIndex = crossedListRef.current.indexOf(m.body.id);
        ctx.fillStyle = m === lastPlaceObj ? "#f43f5e" : "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";

        if (crossedIndex !== -1) {
          const rankLabel =
            crossedIndex === 0
              ? "🥇 1st"
              : crossedIndex === 1
                ? "🥈 2nd"
                : crossedIndex === 2
                  ? "🥉 3rd"
                  : `${crossedIndex + 1}th`;
          ctx.fillStyle = "#fbbf24";
          ctx.font = "black 11px sans-serif";
          ctx.fillText(rankLabel, x, y - radius - 24);
          ctx.fillStyle = "#10b981";
          ctx.font = "bold 11px sans-serif";
        }

        //불꽃이름
        const tagLabel =
          m === lastPlaceObj && crossedIndex === -1 ? `${m.name}` : m.name;
        // m === lastPlaceObj && crossedIndex === -1 ? `🔥 ${m.name}` : m.name;
        ctx.fillText(tagLabel, x, y - radius - 8);
      });

      // 7. Draw Checkered Finish Flag Strip
      const finishRowHeight = 15;
      const checkWidth = 15;
      for (let row = 0; row < 3; row++) {
        const fy = finishLineY - 15 + row * finishRowHeight;
        for (let fx = 15; fx < trackWidth - 15; fx += checkWidth) {
          const isBlack = (Math.floor(fx / checkWidth) + row) % 2 === 0;
          ctx.fillStyle = isBlack ? "#000000" : "#ffffff";
          ctx.fillRect(fx, fy, checkWidth, finishRowHeight);
        }
      }

      // Border bounds on the finish area
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(15, finishLineY - 15);
      ctx.lineTo(trackWidth - 15, finishLineY - 15);
      ctx.moveTo(15, finishLineY + 30);
      ctx.lineTo(trackWidth - 15, finishLineY + 30);
      ctx.stroke();

      // Finish text
      ctx.font = "black 32px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.textAlign = "center";
      ctx.fillText("F I N I S H", trackWidth / 2, finishLineY - 40);

      // 8. Particle updates
      particlesRef.current.forEach((p) => {
        p.life++;
        p.alpha = 1 - p.life / p.maxLife;
        p.x += p.vx;
        p.y += p.vy;

        ctx.fillStyle = p.color.includes("hsl")
          ? p.color.replace(")", `, ${p.alpha})`).replace("hsl", "hsla")
          : p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      particlesRef.current = particlesRef.current.filter(
        (p) => p.life < p.maxLife,
      );

      // 9. Win condition checks
      if (isStarted && !gameEnded) {
        let crossedUpdated = false;
        marblesRef.current.forEach((m) => {
          if (
            m.body.position.y <= finishLineY &&
            !crossedListRef.current.includes(m.body.id)
          ) {
            crossedListRef.current.push(m.body.id);
            crossedUpdated = true;
            spawnParticles(m.body.position.x, finishLineY, m.color, 20, 1.8);
          }
        });

        if (crossedUpdated) {
          setCrossedCount(crossedListRef.current.length);
        }

        if (
          crossedListRef.current.length === participants.length &&
          participants.length > 0
        ) {
          setGameEnded(true);
          marblesRef.current.forEach((m) => {
            Body.setVelocity(m.body, { x: 0, y: 0 });
          });

          const finishedNames = crossedListRef.current.map((id) => {
            const marble = marblesRef.current.find(
              (marb) => marb.body.id === id,
            );
            return marble ? marble.name : "";
          });

          setTimeout(() => {
            onFinished(finishedNames);
          }, 1000);
        }
      }

      ctx.restore();
      requestRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      window.removeEventListener("resize", handleResize);

      // Clean up drag events
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUpOrLeave);
      canvas.removeEventListener("mouseleave", onMouseUpOrLeave);

      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [
    isStarted,
    gameEnded,
    onFinished,
    shuffledParticipants,
    trackWidth,
    participants.length,
  ]);

  // Compile final leaderboard standings and stop game instantly
  const handleInstantEnd = () => {
    if (!isStarted || gameEnded) return;

    setGameEnded(true);

    const crossedIds = [...crossedListRef.current];

    const remainingMarbles = marblesRef.current
      .filter((m) => !crossedIds.includes(m.body.id))
      .sort((a, b) => a.body.position.y - b.body.position.y);

    const finalRankingIds = [
      ...crossedIds,
      ...remainingMarbles.map((m) => m.body.id),
    ];

    const finalRankings = finalRankingIds.map((id) => {
      const marble = marblesRef.current.find((marb) => marb.body.id === id);
      return marble ? marble.name : "";
    });

    marblesRef.current.forEach((m) => {
      Body.setVelocity(m.body, { x: 0, y: 0 });
    });

    onFinished(finalRankings);
  };

  const handleShuffle = () => {
    if (!isStarted || isCountdownActive || raceStarted || gameEnded) return;
    const shuffled = [...shuffledParticipants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledParticipants(shuffled);
  };

  const handleStartRace = () => {
    if (!isStarted || isCountdownActive || raceStarted || gameEnded) return;
    setIsCountdownActive(true);
    setCountdown(3);

    // 1s intervals
    setTimeout(() => {
      setCountdown(2);
    }, 1000);

    setTimeout(() => {
      setCountdown(1);
    }, 2000);

    setTimeout(() => {
      setCountdown(null);
      setIsCountdownActive(false);
      setRaceStarted(true);
      raceStartedRef.current = true;
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md overflow-hidden relative">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <Flag className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white leading-tight">
              🏁 데스 레이스 (Death Race)
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              장애물을 뚫고 가장 빠르게 결승선에 도달하세요!
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isStarted && !gameEnded && (
            <>
              {!raceStarted && (
                <>
                  <button
                    onClick={handleStartRace}
                    disabled={isCountdownActive}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🚀 시작
                  </button>
                  <button
                    onClick={handleShuffle}
                    disabled={isCountdownActive}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-400 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🔀 출발위치섞기
                  </button>
                </>
              )}
              {raceStarted && (
                <button
                  onClick={handleInstantEnd}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-400 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  🏁 즉시 종료
                </button>
              )}
            </>
          )}
          <button
            onClick={onReset}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-slate-600 text-slate-300 transition-all cursor-pointer active:scale-95"
          >
            리셋
          </button>
        </div>
      </div>

      {/* Racetrack HUD Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 relative z-10">
        <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 flex items-center gap-2">
          <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
            ⚡
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              현재 가속 배율
            </p>
            <p className="text-sm font-semibold truncate text-yellow-400">
              {speedScale}x SPEED
            </p>
          </div>
        </div>
        <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              실시간 1등 / 완주
            </p>
            <p
              className="text-sm font-semibold text-slate-200 truncate"
              title={isStarted ? `${leader} (${crossedCount}명 완주)` : "-"}
            >
              {isStarted ? `${leader} (${crossedCount}명 완주)` : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Canvas Zone */}
      <div className="relative flex-1 w-full min-h-[350px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden group select-none">
        <style>{`
          @keyframes neon-countdown {
            0% {
              transform: scale(2.5);
              opacity: 0;
              filter: blur(8px);
            }
            15% {
              opacity: 1;
              filter: blur(0);
            }
            50% {
              transform: scale(1);
              opacity: 1;
            }
            100% {
              transform: scale(0.85);
              opacity: 0;
              filter: blur(4px);
            }
          }
          .animate-neon-countdown {
            animation: neon-countdown 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block touch-none"
        />

        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/10 opacity-30"></div>

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-30 pointer-events-none select-none">
            <div
              key={countdown}
              className="animate-neon-countdown font-extrabold text-7xl sm:text-9xl tracking-wider text-center font-sans"
              style={{
                textShadow:
                  countdown === "START"
                    ? "0 0 10px #22c55e, 0 0 20px #22c55e, 0 0 40px #15803d, 0 0 80px #14532d"
                    : "0 0 10px #f97316, 0 0 20px #f97316, 0 0 40px #c2410c, 0 0 80px #7c2d12",
                color: countdown === "START" ? "#4ade80" : "#fb923c",
              }}
            >
              {countdown}
            </div>
          </div>
        )}

        {/* Speed Toggle Overlay Button */}
        {isStarted && (
          <div className="absolute top-4 right-4 z-40">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setSpeedScale((prev) => {
                  const currentIndex = SPEED_SCALES.indexOf(prev);
                  const nextIndex = (currentIndex + 1) % SPEED_SCALES.length;
                  return SPEED_SCALES[nextIndex];
                });
              }}
              className="py-2 px-3 rounded-xl bg-slate-900/95 hover:bg-slate-850 border border-slate-800 hover:border-yellow-500/50 shadow-lg text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-sm select-none active:scale-95 duration-200"
            >
              <span className="text-yellow-500 animate-pulse">⚡</span>
              <span>속도: {speedScale}x</span>
            </button>
          </div>
        )}

        {/* Floating Recenter Camera Overlay Button */}
        {isStarted && isManualCamera && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-bounce">
            <button
              onClick={() => {
                isManualCameraRef.current = false;
                setIsManualCamera(false);
              }}
              className="py-2.5 px-4 rounded-full bg-slate-900/90 hover:bg-slate-800 text-xs font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/10 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 backdrop-blur-sm"
            >
              🎥 자동 카메라 복원
            </button>
          </div>
        )}

        {!isStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-center z-20 rounded-[10px]">
            <Flag className="w-12 h-12 text-orange-500/60 mb-3 animate-bounce" />
            <h3 className="text-lg font-bold text-white mb-1">
              데스 레이스 준비 완료
            </h3>
            <p className="text-sm text-slate-400 max-w-sm">
              왼쪽 참여자 명단에 이름을 입력한 뒤 아래{" "}
              <strong className="text-orange-400">🚀 추첨 시작</strong> 버튼을
              누르세요!
            </p>
            <div className="mt-4 text-xs font-mono text-slate-500 border border-slate-800 bg-slate-900/40 py-1.5 px-3 rounded-md">
              TIP: 우측 상단의 속도 조절 버튼(1x, 1.5x, 2x)으로 레이스 속도를
              조절할 수 있습니다!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
