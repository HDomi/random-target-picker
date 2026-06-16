import React, { useEffect, useRef, useState } from "react";
import { Engine, Bodies, Composite, Body, Events } from "matter-js";
import { Flag, Trophy, ShieldAlert, Zap } from "lucide-react";

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

interface BoosterConfig {
  x: number;
  y: number;
  w: number;
  h: number;
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

  // Track parameters (Expanded to 4800px)
  const trackWidth = 4800;
  const [trackHeight, setTrackHeight] = useState<number>(500);
  const finishLineX = 4500;

  // React state for HUD
  const [leader, setLeader] = useState<string>("N/A");
  const [speedUpActive, setSpeedUpActive] = useState<boolean>(false);
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [isManualCamera, setIsManualCamera] = useState<boolean>(false); // Track manual override
  const [prevIsStarted, setPrevIsStarted] = useState<boolean>(isStarted);
  const [crossedCount, setCrossedCount] = useState<number>(0);

  // Sync state during render when game starts/stops
  if (isStarted !== prevIsStarted) {
    setPrevIsStarted(isStarted);
    if (isStarted) {
      setGameEnded(false);
      setIsManualCamera(false);
      setCrossedCount(0);
    }
  }

  // References for drawing loop & physics
  const particlesRef = useRef<Particle[]>([]);
  const marblesRef = useRef<MarbleInstance[]>([]);
  const cameraXRef = useRef<number>(0);
  const isSpeedUpRef = useRef<boolean>(false);
  const cameraShakeRef = useRef<number>(0); // Screen shake intensity
  const activeShockwavesRef = useRef<Shockwave[]>([]); // Dynamic expanding shockwaves

  // List tracking the crossing order of marbles
  const crossedListRef = useRef<string[]>([]);
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

    const scaleY = trackHeight / 500;

    // Helper coordinate checks for Slow Mud Zones
    const isInsideSlowZone = (pos: { x: number; y: number }) => {
      const zones = [
        { xMin: 790, xMax: 1010, yMin: 0, yMax: 150 * scaleY }, // Mud 1
        { xMin: 1540, xMax: 1760, yMin: 175 * scaleY, yMax: 325 * scaleY }, // Mud 2
        { xMin: 2290, xMax: 2510, yMin: 350 * scaleY, yMax: 500 * scaleY }, // Mud 3
        { xMin: 3480, xMax: 3720, yMin: 150 * scaleY, yMax: 350 * scaleY }, // Mud 4
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
      Bodies.rectangle(trackWidth / 2, -10, trackWidth, 20, {
        isStatic: true,
        label: "wall",
        restitution: 0.8,
      }),
      Bodies.rectangle(trackWidth / 2, trackHeight + 10, trackWidth, 20, {
        isStatic: true,
        label: "wall",
        restitution: 0.8,
      }),
      Bodies.rectangle(-10, trackHeight / 2, 20, trackHeight, {
        isStatic: true,
        label: "wall",
      }),
    ];
    Composite.add(engine.world, boundaries);

    // Maze Static Obstacles (Inner Walls - Slanted!)
    const mazeWallsData = [
      { x: 1500, y: 30 * scaleY, w: 24, h: 220 * scaleY, angle: -Math.PI / 4 },
      {
        x: 1800,
        y: trackHeight - 30 * scaleY,
        w: 24,
        h: 220 * scaleY,
        angle: Math.PI / 4,
      },
      { x: 2950, y: 250 * scaleY, w: 24, h: 200 * scaleY, angle: Math.PI / 4 },
      { x: 4000, y: 60 * scaleY, w: 24, h: 220 * scaleY, angle: -Math.PI / 4 },
      {
        x: 4000,
        y: trackHeight - 60 * scaleY,
        w: 24,
        h: 220 * scaleY,
        angle: Math.PI / 4,
      },
    ];

    const staticMazeWalls = mazeWallsData.map((w) => {
      const body = Bodies.rectangle(w.x, w.y, w.w, w.h, {
        isStatic: true,
        label: "wall",
        restitution: 0.95,
        friction: 0.02,
        angle: w.angle,
      });
      body.plugin = { w: w.w, h: w.h };
      return body;
    });
    Composite.add(engine.world, staticMazeWalls);

    // Bouncy Static Obstacles (Bumpers)
    const obstaclesData: ObstacleConfig[] = [
      { x: 450, y: 150 * scaleY, r: 25 },
      { x: 450, y: 350 * scaleY, r: 25 },
      { x: 750, y: 250 * scaleY, r: 35 },

      // Sector 2 Maze Bumpers
      { x: 1350, y: 150 * scaleY, r: 24 },
      { x: 1350, y: 350 * scaleY, r: 24 },
      { x: 1650, y: 100 * scaleY, r: 22 },
      { x: 1650, y: 250 * scaleY, r: 25 },
      { x: 1650, y: 400 * scaleY, r: 22 },
      { x: 1950, y: 150 * scaleY, r: 24 },
      { x: 1950, y: 350 * scaleY, r: 24 },

      // Sector 3 Bumpers
      { x: 2550, y: 250 * scaleY, r: 30 },
      { x: 2800, y: 180 * scaleY, r: 20 },
      { x: 2800, y: 320 * scaleY, r: 20 },
      { x: 3100, y: 100 * scaleY, r: 25 },
      { x: 3100, y: 400 * scaleY, r: 25 },
      { x: 3800, y: 150 * scaleY, r: 28 },
      { x: 3800, y: 350 * scaleY, r: 28 },
      { x: 4150, y: 250 * scaleY, r: 30 },
    ];

    const staticObstacles = obstaclesData.map((data) => {
      return Bodies.circle(data.x, data.y, data.r, {
        isStatic: true,
        label: "obstacle",
        restitution: 1.35,
        friction: 0,
      });
    });
    Composite.add(engine.world, staticObstacles);

    // Booster Sensors (Green arrows)
    const boostersData: BoosterConfig[] = [
      { x: 600, y: 250 * scaleY, w: 60, h: 200 * scaleY },
      { x: 1350, y: 250 * scaleY, w: 60, h: 120 * scaleY },
      { x: 2000, y: 100 * scaleY, w: 60, h: 140 * scaleY },
      { x: 2000, y: 400 * scaleY, w: 60, h: 140 * scaleY },
      { x: 3100, y: 250 * scaleY, w: 65, h: 160 * scaleY },
      { x: 3900, y: 250 * scaleY, w: 60, h: 140 * scaleY },
      { x: 4250, y: 150 * scaleY, w: 60, h: 150 * scaleY },
      { x: 4250, y: 350 * scaleY, w: 60, h: 150 * scaleY },
    ];

    const staticBoosters = boostersData.map((data) => {
      return Bodies.rectangle(data.x, data.y, data.w, data.h, {
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

    const windmill1 = createWindmill(1100, 250 * scaleY, 160 * scaleY);
    const windmill2 = createWindmill(2300, 250 * scaleY, 160 * scaleY);
    const windmill3 = createWindmill(3400, 120 * scaleY, 140 * scaleY);
    const windmill4 = createWindmill(3400, 380 * scaleY, 140 * scaleY);
    const windmills = [windmill1, windmill2, windmill3, windmill4];
    Composite.add(engine.world, windmills);

      // Create Marbles if game started
      if (isStarted && participants.length > 0) {
        crossedListRef.current = [];
        isManualCameraRef.current = false; // Reset camera on start

        const startX = 60;

      const marbles = participants.map((name, index) => {
        const spreadY =
          participants.length > 1
            ? 50 + (index * (trackHeight - 100)) / (participants.length - 1)
            : trackHeight / 2;

        const body = Bodies.circle(startX, spreadY, 14, {
          restitution: 0.85,
          frictionAir: 0.04,
          friction: 0,
          label: "marble",
          density: 0.0015,
        });

        body.plugin = { name, stunTime: 0, stuckFrames: 0 };
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
      if (!isStarted) return;

      // Update windmill rotations
      windmills.forEach((wm, idx) => {
        const rotationDirection = idx % 2 === 0 ? 1 : -1;
        const rotationSpeed = 0.035 * rotationDirection;
        Body.setAngle(wm, wm.angle + rotationSpeed);
        Body.setAngularVelocity(wm, rotationSpeed);
      });

      // Find leading X and lagging X bounds for Rubberbanding
      let maxLeaderX = 60;
      let minLaggingX = Infinity;

      marblesRef.current.forEach((m) => {
        if (m.body.position.x > maxLeaderX) maxLeaderX = m.body.position.x;
        if (m.body.position.x < minLaggingX) minLaggingX = m.body.position.x;
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

        let steerY = 0;

        // 1. Static Obstacles (Bumpers) Avoidance Steering
        const scanRange = 85;
        staticObstacles.forEach((obs) => {
          const dx = obs.position.x - currentPos.x;
          if (dx > 0 && dx < scanRange) {
            const dy = obs.position.y - currentPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const r = obs.circleRadius || 24;
            const safetyDist = r + 28;
            if (dist < safetyDist && dist > 0) {
              const avoidDir = dy >= 0 ? -1 : 1;
              const forceMagnitude = 0.00045 * (1 - dist / safetyDist);
              steerY += avoidDir * forceMagnitude;
            }
          }
        });

        // 2. windmills Avoidance Steering
        windmills.forEach((wm) => {
          const dx = wm.position.x - currentPos.x;
          if (dx > 0 && dx < scanRange + 20) {
            const dy = wm.position.y - currentPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const safetyDist = 95;
            if (dist < safetyDist && dist > 0) {
              const avoidDir = dy >= 0 ? -1 : 1;
              const forceMagnitude = 0.0004 * (1 - dist / safetyDist);
              steerY += avoidDir * forceMagnitude;
            }
          }
        });

        // 3. Ceiling/Floor Boundary Avoidance Steering
        if (currentPos.y < 28) {
          steerY += 0.0003;
        } else if (currentPos.y > trackHeight - 28) {
          steerY -= 0.0003;
        }

        // Anti-Stuck Mechanism: boost marbles that are nearly stationary for too long
        const isFinished = crossedListRef.current.includes(m.name);
        if (!isFinished && m.body.plugin) {
          if (currentSpeed < 0.35) {
            m.body.plugin.stuckFrames = (m.body.plugin.stuckFrames || 0) + 1;
          } else {
            m.body.plugin.stuckFrames = 0;
          }

          if (m.body.plugin.stuckFrames > 50) {
            m.body.plugin.stuckFrames = 0;

            const escapeForceX = 0.004;

            // Diagonal breakout direction calculation
            let escapeForceY = (Math.random() - 0.5) * 0.005;
            if (currentPos.y < trackHeight / 3) {
              escapeForceY = 0.0045; // Steer down
            } else if (currentPos.y > (trackHeight * 2) / 3) {
              escapeForceY = -0.0045; // Steer up
            }

            Body.applyForce(m.body, m.body.position, {
              x: escapeForceX,
              y: escapeForceY,
            });

            // Set diagonal breakout velocity
            Body.setVelocity(m.body, {
              x: Math.max(m.body.velocity.x + 2.0, 3.0),
              y: escapeForceY > 0 ? 3.5 : -3.5,
            });

            // Spawn cyan escape particles
            spawnParticles(currentPos.x, currentPos.y, "#38bdf8", 6, 1.0);
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

        // Check slow mud zones
        const insideSlow = isInsideSlowZone(currentPos);

        if (insideSlow) {
          m.body.frictionAir = 0.14;
          if (m.body.velocity.x > 2.0) {
            Body.setVelocity(m.body, {
              x: m.body.velocity.x * 0.9,
              y: m.body.velocity.y,
            });
          }
        } else {
          m.body.frictionAir = 0.04;
        }

        // Rubberbanding Catch-up forces
        const baseForce = 0.00025;
        let forceX = baseForce;

        const gapDistance = maxLeaderX - currentPos.x;
        if (gapDistance > 0) {
          const catchUpFactor = 1 + Math.min(3.5, gapDistance / 240);
          forceX *= catchUpFactor;
        }

        // Last-place rage aura bonus force
        const isLagger =
          currentPos.x <= minLaggingX && marblesRef.current.length > 1;
        if (isLagger) {
          forceX *= 1.4;
        }

        // Wobble noise
        const randomForceX = (Math.random() - 0.3) * 0.00008;
        const randomForceY = (Math.random() - 0.5) * 0.00012;

        Body.applyForce(m.body, m.body.position, {
          x: forceX + randomForceX,
          y: steerY + randomForceY,
        });

        // Leader drag force scaling
        const isLeader =
          currentPos.x >= maxLeaderX && marblesRef.current.length > 1;
        const speedLimit = isLeader && maxLeaderX > 300 ? 11.5 : 16;

        if (currentSpeed > speedLimit) {
          Body.setVelocity(m.body, {
            x: (m.body.velocity.x / currentSpeed) * speedLimit,
            y: (m.body.velocity.y / currentSpeed) * speedLimit,
          });
        }
      });
    });

    // Handle collision trigger (boosters, windmills, bumpers, and body contact)
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
            } else {
              spawnParticles(impactX, impactY, colorA, 3, 0.8);
              spawnParticles(impactX, impactY, colorB, 3, 0.8);
            }
          }
          return;
        }

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
              x: Math.max(marbleBody.velocity.x + 12, 22),
              y: marbleBody.velocity.y * 0.5,
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
      });
    });

    // Spacebar speed hack controllers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        isSpeedUpRef.current = true;
        setSpeedUpActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        isSpeedUpRef.current = false;
        setSpeedUpActive(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      Engine.clear(engine);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isStarted, participants, trackHeight]);

  // Drawing, Drag-to-Scroll binding, & Physics updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const updateTrackHeight = () => {
      const h = canvas.clientHeight || canvas.offsetHeight || 500;
      setTrackHeight((prev) => (prev !== h ? h : prev));
    };

    // Update height on initial mount
    updateTrackHeight();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;

      // Update height only if game has not started or has ended
      if (!isStarted || gameEnded) {
        updateTrackHeight();
      }
    };
    window.addEventListener("resize", handleResize);

    // Mouse/Touch Drag event handlers for Manual Camera Control
    let isDragging = false;
    let dragStartXVal = 0;
    let dragStartCamXVal = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragStartXVal = e.clientX;
      dragStartCamXVal = cameraXRef.current;
      isManualCameraRef.current = true;
      setIsManualCamera(true);
      canvas.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartXVal;
      // Clamp camera X strictly between 0 and trackWidth - canvas viewport width
      cameraXRef.current = Math.max(
        0,
        Math.min(trackWidth - width, dragStartCamXVal - dx),
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
      dragStartXVal = e.touches[0].clientX;
      dragStartCamXVal = cameraXRef.current;
      isManualCameraRef.current = true;
      setIsManualCamera(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - dragStartXVal;
      cameraXRef.current = Math.max(
        0,
        Math.min(trackWidth - width, dragStartCamXVal - dx),
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

      engine.timing.timeScale = isSpeedUpRef.current ? 3.0 : 1.0;
      Engine.update(engine, 16.666);

      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);

      // Handle viewport camera shift
      let leadingName = "N/A";
      let lastPlaceObj: MarbleInstance | null = null;

      if (isStarted && marblesRef.current.length > 0) {
        let maxSubX = 0;
        let minLagX = Infinity;

        marblesRef.current.forEach((m) => {
          if (m.body.position.x > maxSubX) {
            maxSubX = m.body.position.x;
            leadingName = m.name;
          }
          if (m.body.position.x < minLagX) {
            minLagX = m.body.position.x;
            lastPlaceObj = m;
          }
        });

        setLeader(leadingName);

        // Only update camera if manual override is NOT active
        if (!isManualCameraRef.current) {
          const targetCamX = Math.max(
            0,
            Math.min(trackWidth - width, maxSubX - width / 3),
          );
          cameraXRef.current += (targetCamX - cameraXRef.current) * 0.1;
        }
      } else {
        if (!isStarted) {
          cameraXRef.current = 0;
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
      ctx.translate(-cameraXRef.current + shakeX, shakeY);

      // 1. Draw Grid Lines
      ctx.strokeStyle = "rgba(30, 41, 59, 0.5)";
      ctx.lineWidth = 1;
      for (let x = 0; x < trackWidth; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, trackHeight);
        ctx.stroke();
      }
      for (let y = 0; y < trackHeight; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(trackWidth, y);
        ctx.stroke();
      }

      // 2. Draw Checkpoints/Track Markers
      ctx.fillStyle = "rgba(51, 65, 85, 0.4)";
      ctx.font = "bold 10px monospace";
      for (let x = 400; x < finishLineX; x += 400) {
        ctx.fillRect(x - 1, 0, 2, trackHeight);
        ctx.fillText(`${x}M`, x + 6, 20);
      }

      // 2.5 Draw Slow swamp zones
      const drawSlowZone = (x: number, y: number, w: number, h: number) => {
        ctx.save();
        const pulse = Math.sin(Date.now() / 150) * 0.15 + 0.35;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.12 * pulse})`;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);

        ctx.strokeStyle = "rgba(239, 68, 68, 0.14)";
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

        ctx.fillStyle = `rgba(239, 68, 68, ${0.7 * pulse})`;
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⚠️ DANGER: SLOW ZONE", x, y + 4);
        ctx.restore();
      };

      const drawScaleY = trackHeight / 500;
      drawSlowZone(900, 75 * drawScaleY, 220, 150 * drawScaleY);
      drawSlowZone(1650, 250 * drawScaleY, 220, 150 * drawScaleY);
      drawSlowZone(2400, 425 * drawScaleY, 220, 150 * drawScaleY);
      drawSlowZone(3600, 250 * drawScaleY, 240, 200 * drawScaleY);

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

      // 3. Draw Booster Pads
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

        for (let cy = min.y + chevronOffset; cy < max.y; cy += chevronSpacing) {
          ctx.beginPath();
          ctx.moveTo(booster.position.x - 10, cy - 8);
          ctx.lineTo(booster.position.x + 8, cy);
          ctx.lineTo(booster.position.x - 10, cy + 8);
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

      // 4. Draw Bouncy Bumpers (Obstacles)
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
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ob.position.x, ob.position.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(ob.position.x, ob.position.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4.5 Draw Static Slanted Maze Walls
      const walls = engine.world.bodies.filter(
        (b: Body) => b.label === "wall" && b.bounds.max.x - b.bounds.min.x < 200,
      );
      walls.forEach((wall: Body) => {
        const localW = (wall.plugin as { w?: number; h?: number }).w || 24;
        const localH = (wall.plugin as { w?: number; h?: number }).h || 180;

        ctx.save();
        ctx.translate(wall.position.x, wall.position.y);
        ctx.rotate(wall.angle);

        ctx.fillStyle = "#111827";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2.5;

        ctx.fillRect(-localW / 2, -localH / 2, localW, localH);
        ctx.strokeRect(-localW / 2, -localH / 2, localW, localH);

        ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
        ctx.lineWidth = 3;
        for (let i = 15; i < localH; i += 20) {
          ctx.beginPath();
          ctx.moveTo(-localW / 2, -localH / 2 + i);
          ctx.lineTo(localW / 2, -localH / 2 + i - localW);
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

      // 6. Draw Marbles, Name Tags, and Last-Place Rage Aura
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
          m.color.replace(")", ", 0)").replace("hsl", "hsla"),
        );
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius + 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = m.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.beginPath();
        ctx.arc(x - 4, y - 4, 3, 0, Math.PI * 2);
        ctx.fill();

        const crossedIndex = crossedListRef.current.indexOf(m.name);

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

        const tagLabel =
          m === lastPlaceObj && crossedIndex === -1 ? `🔥 ${m.name}` : m.name;
        ctx.fillText(tagLabel, x, y - radius - 8);
      });

      // 7. Draw Checkered Finish Flag
      ctx.fillStyle = "#ffffff";
      const colWidth = 20;
      const checkSize = 10;

      ctx.fillRect(finishLineX, 0, 3, trackHeight);

      for (let fy = 0; fy < trackHeight; fy += checkSize) {
        for (let fx = 0; fx < colWidth; fx += checkSize) {
          const isBlack =
            (Math.floor(fx / checkSize) + Math.floor(fy / checkSize)) % 2 === 0;
          ctx.fillStyle = isBlack ? "#000000" : "#ffffff";
          ctx.fillRect(finishLineX + 3 + fx, fy, checkSize, checkSize);
        }
      }

      ctx.save();
      ctx.translate(finishLineX + 15, trackHeight / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "black 24px monospace";
      ctx.textAlign = "center";
      ctx.fillText("🏆 FINISH LINE 🏆", 0, 0);
      ctx.restore();

      // 8. Draw and Update Particles
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = 1 - p.life / p.maxLife;

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
            m.body.position.x >= finishLineX &&
            !crossedListRef.current.includes(m.name)
          ) {
            crossedListRef.current.push(m.name);
            crossedUpdated = true;
            spawnParticles(finishLineX, m.body.position.y, m.color, 20, 1.8);
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

          setTimeout(() => {
            onFinished(crossedListRef.current);
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
  }, [isStarted, gameEnded, onFinished, participants, trackHeight]);

  // Compile final leaderboard standings and stop game instantly
  const handleInstantEnd = () => {
    if (!isStarted || gameEnded) return;

    setGameEnded(true);

    const crossedNames = [...crossedListRef.current];

    const remainingMarbles = marblesRef.current
      .filter((m) => !crossedNames.includes(m.name))
      .sort((a, b) => b.body.position.x - a.body.position.x)
      .map((m) => m.name);

    const finalRankings = [...crossedNames, ...remainingMarbles];

    marblesRef.current.forEach((m) => {
      Body.setVelocity(m.body, { x: 0, y: 0 });
    });

    onFinished(finalRankings);
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
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              데스 레이스{" "}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Death Race
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              사선 장애물벽과 회전 풍차를 돌파하고, 랜덤 충격파와 함께 결승선에
              선착하세요!
            </p>
          </div>
        </div>

        {isStarted && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstantEnd}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-red-650 hover:bg-red-500 text-white transition-all shadow-md active:scale-95 flex items-center gap-1.5 border border-red-550/20 cursor-pointer"
            >
              🛑 즉시 종료 및 순위 보기
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 active:scale-95 cursor-pointer"
            >
              초기화
            </button>
          </div>
        )}
      </div>

      {/* Real-time stats HUD */}
      <div className="grid grid-cols-3 gap-4 mb-6 relative z-10">
        <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
          <Zap
            className={`w-5 h-5 ${speedUpActive ? "text-yellow-400 animate-bounce" : "text-slate-500"}`}
          />
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              가속 (Space바)
            </p>
            <p
              className={`text-sm font-semibold ${speedUpActive ? "text-yellow-400" : "text-slate-300"}`}
            >
              {speedUpActive ? "3.0x ACTIVE" : "HOLD SPACE"}
            </p>
          </div>
        </div>
        <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              실시간 1등 / 완주
            </p>
            <p className="text-sm font-semibold text-slate-200 truncate max-w-[120px]">
              {isStarted
                ? `${leader} (${crossedCount}명 완주)`
                : "N/A"}
            </p>
          </div>
        </div>
        <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              남은 트랙
            </p>
            <p className="text-sm font-semibold text-slate-200">
              4500M (EXTRA LONG)
            </p>
          </div>
        </div>
      </div>

      {/* Main Canvas Zone */}
      <div className="relative flex-1 w-full min-h-[350px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden group select-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />

        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/10 opacity-30"></div>

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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-center z-20">
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
              TIP: 레이스 시작 후 [스페이스바]를 길게 누르면 가속(3배속)됩니다!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
