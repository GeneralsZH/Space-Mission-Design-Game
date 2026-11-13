import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { DoubleSide, Spherical, Vector2, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Build } from "../types";
import type { CameraCommand } from "./SpacecraftView";
import LaunchVehicle from "./LaunchVehicle";

type Position = [number, number, number];
interface SceneProps {
  build: Build;
  exploded: boolean;
  autoRotate: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  command: CameraCommand;
  onContextLost: () => void;
  variant?: "spacecraft" | "launch";
  animateLaunch?: boolean;
}
const INITIAL_POSITION: Position = [6, 3.5, 7.5];

function CameraRig({
  command,
  autoRotate,
  variant,
}: Pick<SceneProps, "command" | "autoRotate" | "variant">) {
  const { camera, gl, invalidate } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minDistance = variant === "launch" ? 8 : 5;
    controls.maxDistance = variant === "launch" ? 22 : 16;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.15;
    controls.autoRotateSpeed = 0.7;
    controls.target.set(0, variant === "launch" ? -0.6 : 0.15, 0);
    controls.update();
    controls.saveState();
    const changed = () => invalidate();
    controls.addEventListener("change", changed);
    controlsRef.current = controls;
    return () => {
      controls.removeEventListener("change", changed);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, invalidate, variant]);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (command.action === "reset") {
      controls.reset();
      invalidate();
      return;
    }
    const spherical = new Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    if (command.action === "left") spherical.theta -= Math.PI / 8;
    if (command.action === "right") spherical.theta += Math.PI / 8;
    if (command.action === "up")
      spherical.phi = Math.max(0.15, spherical.phi - Math.PI / 12);
    if (command.action === "down")
      spherical.phi = Math.min(Math.PI - 0.15, spherical.phi + Math.PI / 12);
    if (command.action === "zoomIn")
      spherical.radius = Math.max(
        controls.minDistance,
        spherical.radius * 0.83,
      );
    if (command.action === "zoomOut")
      spherical.radius = Math.min(
        controls.maxDistance,
        spherical.radius / 0.83,
      );
    camera.position.copy(
      new Vector3().setFromSpherical(spherical).add(controls.target),
    );
    controls.update();
    invalidate();
  }, [command, camera, invalidate]);
  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);
  useFrame((_state, delta) => {
    if (autoRotate) controlsRef.current?.update(Math.min(delta, 0.1));
  });
  return null;
}
function Module({
  id,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  onSelect,
  children,
}: {
  id: string;
  position?: Position;
  rotation?: Position;
  onSelect: SceneProps["onSelect"];
  children: ReactNode;
}) {
  return (
    <group
      name={id}
      position={position}
      rotation={rotation}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(id);
      }}
    >
      {children}
    </group>
  );
}
function SolarWing({ width, selected }: { width: number; selected: boolean }) {
  const grid = useMemo(() => {
    const lines: number[] = [];
    for (let i = 0; i <= 9; i++) {
      const x = -width / 2 + (width * i) / 9;
      lines.push(x, -0.74, 0.057, x, 0.74, 0.057);
    }
    for (let i = 0; i <= 5; i++) {
      const y = -0.74 + (1.48 * i) / 5;
      lines.push(-width / 2, y, 0.057, width / 2, y, 0.057);
    }
    return new Float32Array(lines);
  }, [width]);
  return (
    <>
      <mesh>
        <boxGeometry args={[width + 0.08, 1.58, 0.075]} />
        <meshStandardMaterial
          color={selected ? "#43e2ed" : "#a6bac7"}
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0, 0.036]}>
        <boxGeometry args={[width, 1.48, 0.035]} />
        <meshStandardMaterial
          color="#173e77"
          metalness={0.6}
          roughness={0.32}
          emissive="#0b284c"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0, 0, -0.045]}>
        <boxGeometry args={[width, 1.48, 0.02]} />
        <meshStandardMaterial color="#263b52" metalness={0.5} roughness={0.7} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[grid, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={selected ? "#8bf7ed" : "#6a9cc0"}
          transparent
          opacity={0.7}
        />
      </lineSegments>
    </>
  );
}
function Dish({
  highRate,
  selected,
}: {
  highRate: boolean;
  selected: boolean;
}) {
  const radius = highRate ? 0.78 : 0.57;
  const shape = useMemo(
    () =>
      Array.from({ length: 17 }, (_, i) => {
        const r = (radius * i) / 16;
        return new Vector2(r, 0.65 * r * r);
      }),
    [radius],
  );
  return (
    <group rotation={[0.35, 0, -0.3]}>
      <mesh>
        <latheGeometry args={[shape, 40]} />
        <meshStandardMaterial
          color={selected ? "#6be3e7" : "#dbe4e9"}
          side={DoubleSide}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.62, 8]} />
        <meshStandardMaterial color="#8197a7" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshStandardMaterial
          color="#78e0e9"
          emissive="#31d6e5"
          emissiveIntensity={0.7}
        />
      </mesh>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
        <mesh
          key={angle}
          position={[
            Math.cos(angle) * radius * 0.38,
            0.4,
            Math.sin(angle) * radius * 0.38,
          ]}
          rotation={[Math.sin(angle) * 0.65, 0, -Math.cos(angle) * 0.65]}
        >
          <cylinderGeometry args={[0.009, 0.009, 0.68, 6]} />
          <meshStandardMaterial color="#9baebd" />
        </mesh>
      ))}
    </group>
  );
}
export function SpacecraftModel({
  build,
  exploded,
  selectedId,
  onSelect,
}: Pick<SceneProps, "build" | "exploded" | "selectedId" | "onSelect">) {
  const has = (id: string) => build.moduleIds.includes(id);
  const find = (prefix: string) =>
    build.moduleIds.find((id) => id.startsWith(prefix));
  const bus = find("bus-");
  const panel = find("panel-");
  const battery = find("battery-");
  const engine = find("engine-");
  const height =
    bus === "bus-lite" ? 1.35 : bus === "bus-shielded" ? 1.9 : 1.65;
  const spread = exploded ? 0.9 : 0;
  const width = panel === "panel-l" ? 2.8 : panel === "panel-s" ? 1.4 : 2.1;
  const gold = (id: string) => (selectedId === id ? "#65dce0" : "#c4a358");
  return (
    <group rotation={[0, -0.17, 0.06]}>
      {bus && (
        <Module id={bus} onSelect={onSelect}>
          <mesh>
            <boxGeometry args={[1.2, height, 1]} />
            <meshStandardMaterial
              color={gold(bus)}
              metalness={0.68}
              roughness={0.48}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.61, 0, 0]}>
              <boxGeometry args={[0.025, height + 0.03, 1.03]} />
              <meshStandardMaterial
                color="#899daa"
                metalness={0.8}
                roughness={0.45}
              />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, (side * height) / 2, 0]}>
              <boxGeometry args={[1.27, 0.055, 1.06]} />
              <meshStandardMaterial
                color="#b4c1c6"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          ))}
          <mesh position={[0.35, 0.3, 0.52]}>
            <boxGeometry args={[0.28, 0.4, 0.025]} />
            <meshStandardMaterial color="#132837" />
          </mesh>
          {Array.from({ length: 4 }, (_, i) => (
            <mesh
              key={i}
              position={[
                0.26 + (i % 2) * 0.15,
                0.18 + Math.floor(i / 2) * 0.18,
                0.55,
              ]}
            >
              <sphereGeometry args={[0.025, 8, 6]} />
              <meshStandardMaterial
                color="#79e3d9"
                emissive="#31d6e5"
                emissiveIntensity={1}
              />
            </mesh>
          ))}
          {[-0.35, -0.12, 0.11].map((y) => (
            <mesh key={y} position={[-0.3, y, 0.52]}>
              <boxGeometry args={[0.32, 0.055, 0.035]} />
              <meshStandardMaterial color="#4f5b5d" metalness={0.7} />
            </mesh>
          ))}
        </Module>
      )}
      {has("thermal") && (
        <Module
          id="thermal"
          position={[0, 0, -0.54 - spread * 0.8]}
          onSelect={onSelect}
        >
          <mesh>
            <boxGeometry args={[1.16, height - 0.07, 0.055]} />
            <meshStandardMaterial
              color={gold("thermal")}
              metalness={0.75}
              roughness={0.6}
            />
          </mesh>
          {[-0.32, 0, 0.32].map((x) => (
            <mesh key={x} position={[x, 0, -0.035]} rotation={[0, 0, 0.12]}>
              <boxGeometry args={[0.025, height - 0.1, 0.025]} />
              <meshStandardMaterial color="#e3c66f" />
            </mesh>
          ))}
        </Module>
      )}
      {has("radiation") && (
        <Module
          id="radiation"
          position={[0.67 + spread, 0, 0]}
          onSelect={onSelect}
        >
          <mesh>
            <boxGeometry args={[0.09, height * 0.8, 0.9]} />
            <meshStandardMaterial
              color={selectedId === "radiation" ? "#58e2e0" : "#8a9fae"}
              metalness={0.9}
              roughness={0.45}
            />
          </mesh>
        </Module>
      )}
      {panel &&
        [-1, 1].map((side) => (
          <Module
            key={side}
            id={panel}
            position={[side * (0.94 + width / 2 + spread), 0.05, 0]}
            rotation={[0, side * -0.06, 0]}
            onSelect={onSelect}
          >
            <mesh
              position={[-side * (width / 2 + 0.2), 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.035, 0.035, 0.48 + spread * 2, 8]} />
              <meshStandardMaterial color="#bbc8d1" metalness={0.8} />
            </mesh>
            <SolarWing width={width} selected={selectedId === panel} />
          </Module>
        ))}
      {(has("hga-compact") || has("hga-high")) && (
        <Module
          id={has("hga-high") ? "hga-high" : "hga-compact"}
          position={[0, height / 2 + 0.45 + spread, 0]}
          onSelect={onSelect}
        >
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.035, 0.05, 0.5, 10]} />
            <meshStandardMaterial color="#a1b4c2" metalness={0.7} />
          </mesh>
          <Dish
            highRate={has("hga-high")}
            selected={
              selectedId === (has("hga-high") ? "hga-high" : "hga-compact")
            }
          />
        </Module>
      )}
      {has("lga") && (
        <Module
          id="lga"
          position={[0, height / 2 + 0.5 + spread, 0]}
          onSelect={onSelect}
        >
          <mesh>
            <cylinderGeometry args={[0.015, 0.025, 1, 8]} />
            <meshStandardMaterial
              color={selectedId === "lga" ? "#31d6e5" : "#c1cfda"}
              metalness={0.7}
            />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color="#63dce5" />
          </mesh>
        </Module>
      )}
      {has("camera") && (
        <Module
          id="camera"
          position={[-0.35, -0.4, 0.66 + spread]}
          rotation={[Math.PI / 2, 0, 0]}
          onSelect={onSelect}
        >
          <mesh>
            <cylinderGeometry args={[0.18, 0.2, 0.32, 20]} />
            <meshStandardMaterial
              color={selectedId === "camera" ? "#53d9e5" : "#4e667b"}
              metalness={0.8}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.125, 0.125, 0.025, 24]} />
            <meshStandardMaterial
              color="#123c63"
              metalness={0.85}
              roughness={0.12}
              emissive="#1e789c"
              emissiveIntensity={0.2}
            />
          </mesh>
        </Module>
      )}
      {has("spectrometer") && (
        <Module
          id="spectrometer"
          position={[0.35 + spread * 0.3, -0.45 - spread * 0.35, 0.78 + spread]}
          onSelect={onSelect}
        >
          <mesh>
            <boxGeometry args={[0.4, 0.38, 0.55]} />
            <meshStandardMaterial
              color={selectedId === "spectrometer" ? "#5cdde1" : "#c3cdd4"}
              metalness={0.7}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 0, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.15, 0.13, 20]} />
            <meshStandardMaterial
              color="#101f32"
              metalness={0.7}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0, 0.385]}>
            <circleGeometry args={[0.09, 24]} />
            <meshStandardMaterial
              color="#4bc9e9"
              emissive="#166b8f"
              emissiveIntensity={0.5}
              metalness={0.6}
            />
          </mesh>
        </Module>
      )}
      {has("radar") && (
        <Module
          id="radar"
          position={[0.3 + spread * 0.4, 0.15, 0.95 + spread * 1.3]}
          rotation={[0.1, -0.2, 0]}
          onSelect={onSelect}
        >
          <mesh>
            <boxGeometry args={[1.4, 0.55, 0.09]} />
            <meshStandardMaterial
              color={selectedId === "radar" ? "#67e9ec" : "#afc2cc"}
              metalness={0.7}
              roughness={0.45}
            />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[-0.59 + i * 0.17, 0, 0.053]}>
              <boxGeometry args={[0.055, 0.45, 0.025]} />
              <meshStandardMaterial color="#42637a" metalness={0.7} />
            </mesh>
          ))}
        </Module>
      )}
      {has("magnetometer") && (
        <Module
          id="magnetometer"
          position={[-0.7 - spread * 0.3, 0.72, -0.42 - spread * 0.4]}
          rotation={[0, 0, 0.7]}
          onSelect={onSelect}
        >
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 1.3, 6]} />
            <meshStandardMaterial color="#b3c5d2" />
          </mesh>
          <mesh position={[0, 1.32, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshStandardMaterial
              color={selectedId === "magnetometer" ? "#86ede8" : "#5596a6"}
              metalness={0.65}
            />
          </mesh>
        </Module>
      )}
      {battery && (
        <Module
          id={battery}
          position={[-0.2, -0.1 - spread * 0.3, -0.73 - spread * 1.4]}
          onSelect={onSelect}
        >
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.22, 0, 0]}>
              <cylinderGeometry
                args={[
                  battery === "battery-l" ? 0.2 : 0.16,
                  battery === "battery-l" ? 0.2 : 0.16,
                  battery === "battery-s" ? 0.52 : 0.8,
                  16,
                ]}
              />
              <meshStandardMaterial
                color={selectedId === battery ? "#70e7df" : "#5e788c"}
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
          ))}
        </Module>
      )}
      {engine && (
        <Module
          id={engine}
          position={[0, -height / 2 - 0.25 - spread, 0]}
          onSelect={onSelect}
        >
          <mesh>
            <cylinderGeometry
              args={[
                0.14,
                engine === "engine-medium" ? 0.32 : 0.23,
                0.5,
                24,
                1,
                true,
              ]}
            />
            <meshStandardMaterial
              color={selectedId === engine ? "#6ae3e5" : "#667681"}
              side={DoubleSide}
              metalness={0.8}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.2, 0.17, 0.13, 16]} />
            <meshStandardMaterial color="#98abb5" metalness={0.8} />
          </mesh>
        </Module>
      )}
      {build.propellantKg > 0 && (
        <mesh position={[0.18, -height / 2 + 0.22, -0.7 - spread * 0.65]}>
          <sphereGeometry
            args={[0.18 + (build.propellantKg / 300) * 0.1, 20, 14]}
          />
          <meshStandardMaterial
            color="#b7ab83"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
      )}
    </group>
  );
}
export function Starfield() {
  const positions = useMemo(
    () =>
      new Float32Array(
        Array.from({ length: 180 }, (_, i) => {
          const theta = i * 2.39996;
          const y = Math.sin(i * 7.19) * 13;
          return [Math.cos(theta) * 17, y, Math.sin(theta) * 17];
        }).flat(),
      ),
    [],
  );
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#7cabc3"
        size={0.025}
        transparent
        opacity={0.65}
        sizeAttenuation
      />
    </points>
  );
}
export function ContextGuard({
  onContextLost,
}: Pick<SceneProps, "onContextLost">) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onContextLost]);
  return null;
}
export default function SpacecraftScene(props: SceneProps) {
  const launching = props.variant === "launch";
  return (
    <Canvas
      camera={{
        position: launching ? [8, 3.8, 12] : INITIAL_POSITION,
        fov: 38,
        near: 0.1,
        far: 100,
      }}
      dpr={[1, launching ? 1.25 : 1.5]}
      frameloop={props.autoRotate || props.animateLaunch ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onPointerMissed={() => props.onSelect(null)}
      onCreated={({ gl }) => {
        gl.domElement.dataset.ready = "true";
      }}
    >
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#e8f3fc", "#142a44", 1.5]} />
      <directionalLight position={[5, 7, 6]} intensity={3.5} color="#fff0d5" />
      <directionalLight
        position={[-5, 1, -3]}
        intensity={2.2}
        color="#60c8ed"
      />
      <pointLight position={[0, -3, 4]} intensity={12} color="#6a9fff" />
      {launching ? (
        <LaunchVehicle build={props.build} animate={!!props.animateLaunch} />
      ) : (
        <SpacecraftModel {...props} />
      )}
      <Starfield />
      {!launching && (
        <gridHelper
          args={[24, 24, "#28576b", "#153448"]}
          position={[0, -2.3, 0]}
        />
      )}
      {!launching &&
        [2.6, 3.6, 4.8].map((radius) => (
          <mesh
            key={radius}
            position={[0, -2.25, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[radius, 0.006, 3, 96]} />
            <meshBasicMaterial color="#2f647b" transparent opacity={0.38} />
          </mesh>
        ))}
      <CameraRig
        command={props.command}
        autoRotate={props.autoRotate}
        variant={props.variant}
      />
      <ContextGuard onContextLost={props.onContextLost} />
    </Canvas>
  );
}
