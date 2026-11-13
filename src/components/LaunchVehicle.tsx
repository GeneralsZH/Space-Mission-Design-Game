import { useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, Object3D } from "three";
import type { Group, InstancedMesh } from "three";
import type { Build } from "../types";
import {
  flightVisuals,
  separationProgress,
  visualStageProgress,
} from "../features/playback/missionPlayback";
import type { PlaybackFrame } from "../features/playback/missionPlayback";

export function EnginePlume({
  radius = 0.3,
  height = 2.2,
}: {
  radius?: number;
  height?: number;
}) {
  return (
    <group position={[0, -height / 2, 0]}>
      <mesh rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[radius, height, 20, 1, true]} />
        <meshBasicMaterial
          color="#ff8c38"
          transparent
          opacity={0.65}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, height * 0.14, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[radius * 0.55, height * 0.72, 16]} />
        <meshBasicMaterial
          color="#b9f2ff"
          transparent
          opacity={0.9}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
function Booster({ x }: { x: number }) {
  return (
    <group position={[x, -0.3, 0]}>
      <mesh>
        <cylinderGeometry args={[0.25, 0.26, 2.75, 24]} />
        <meshStandardMaterial
          color="#b8c6ce"
          metalness={0.65}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <coneGeometry args={[0.25, 0.5, 24]} />
        <meshStandardMaterial
          color="#e2e6e8"
          metalness={0.45}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, -1.45, 0]}>
        <cylinderGeometry args={[0.13, 0.23, 0.22, 16, 1, true]} />
        <meshStandardMaterial
          color="#34434f"
          metalness={0.85}
          roughness={0.4}
          side={DoubleSide}
        />
      </mesh>
      {[-0.9, 0.8].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.265, 0.265, 0.14, 24]} />
          <meshStandardMaterial color="#1c394d" metalness={0.7} />
        </mesh>
      ))}
      <group position={[0, -1.57, 0]}>
        <EnginePlume radius={0.2} height={1.7} />
      </group>
    </group>
  );
}
function LaunchPad() {
  return (
    <group>
      <mesh position={[0, -4.2, 0]}>
        <cylinderGeometry args={[5.5, 5.5, 0.12, 64]} />
        <meshStandardMaterial
          color="#142534"
          metalness={0.2}
          roughness={0.95}
        />
      </mesh>
      <mesh position={[0, -4.05, 0]}>
        <cylinderGeometry args={[2.1, 2.25, 0.22, 48]} />
        <meshStandardMaterial
          color="#3d5362"
          metalness={0.75}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[0, -3.93, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.64, 64]} />
        <meshBasicMaterial color="#b9a977" side={DoubleSide} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <mesh position={[1.95, -3.86, 0]}>
            <boxGeometry args={[0.3, 0.1, 0.15]} />
            <meshStandardMaterial
              color="#f2b854"
              emissive="#d9852f"
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      ))}
      <group position={[-2.15, -0.72, -0.65]}>
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <mesh key={`${x}-${z}`} position={[x * 0.24, 0, z * 0.24]}>
              <boxGeometry args={[0.08, 6.5, 0.08]} />
              <meshStandardMaterial
                color="#557180"
                metalness={0.8}
                roughness={0.55}
              />
            </mesh>
          )),
        )}
        {Array.from({ length: 9 }, (_, i) => (
          <group key={i} position={[0, -3.15 + i * 0.77, 0]}>
            <mesh>
              <boxGeometry args={[0.58, 0.07, 0.58]} />
              <meshStandardMaterial color="#405d6b" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.35, 0.24]} rotation={[0, 0, 0.6]}>
              <boxGeometry args={[0.045, 0.8, 0.045]} />
              <meshStandardMaterial color="#4e7080" metalness={0.7} />
            </mesh>
          </group>
        ))}
        {[0.4, 2].map((y) => (
          <mesh key={y} position={[0.7, y, 0]}>
            <boxGeometry args={[1.2, 0.1, 0.16]} />
            <meshStandardMaterial color="#5f7786" metalness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 3.36, 0]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color="#ffad52" />
        </mesh>
      </group>
    </group>
  );
}

export default function LaunchVehicle({
  build,
  animate,
  clock,
  motionEnabled = true,
  cinematic = false,
  payload,
  mission,
}: {
  build: Build;
  animate: boolean;
  clock?: RefObject<PlaybackFrame>;
  motionEnabled?: boolean;
  cinematic?: boolean;
  payload?: ReactNode;
  mission?: import("../types").MissionRun;
}) {
  const rocket = useRef<Group>(null);
  const flame = useRef<Group>(null);
  const smoke = useRef<InstancedMesh>(null);
  const nose = useRef<Group>(null);
  const fairing = useRef<Group>(null);
  const payloadRef = useRef<Group>(null);
  const boosters = useRef<Group[]>([]);
  const elapsed = useRef(0);
  const transform = useMemo(() => new Object3D(), []);
  const heavy = build.launcherId === "heavy";
  const light = build.launcherId === "light";
  const radius = light ? 0.34 : heavy ? 0.57 : 0.46;
  const height = light ? 3.2 : heavy ? 4 : 3.6;
  useFrame((state, delta) => {
    if (animate) elapsed.current += Math.min(delta, 0.1);
    const time = clock
      ? motionEnabled
        ? clock.current.seconds
        : 0
      : elapsed.current;
    const rawProgress = clock
      ? motionEnabled
        ? clock.current.progress
        : 0
      : Math.min(1, time / 8);
    const progress = mission?.incident
      ? mission.incident.triggerProgress
      : mission
        ? visualStageProgress(mission, rawProgress)
        : rawProgress;
    const separated = cinematic ? separationProgress(progress) : 0;
    if (rocket.current) {
      rocket.current.visible = mission?.incident?.kind !== "explosion";
      rocket.current.rotation.z =
        mission?.incident?.kind === "trajectory" ? rawProgress * 1.7 : 0;
      rocket.current.position.y =
        -0.45 +
        (cinematic ? flightVisuals.launchRise : 1.3) * progress * progress;
    }
    if (nose.current) nose.current.visible = separated <= 0;
    if (fairing.current) {
      fairing.current.visible = separated > 0;
      fairing.current.children.forEach((half, i) => {
        const side = i === 0 ? -1 : 1;
        half.position.set(side * separated * 1.8, -separated * 0.7, 0);
        half.rotation.z = side * separated * 0.8;
      });
    }
    if (payloadRef.current) {
      payloadRef.current.visible = separated > 0.02;
      payloadRef.current.position.y = height / 2 + 0.35 + separated * 2.3;
      payloadRef.current.scale.setScalar(0.12 + separated * 0.14);
    }
    if (cinematic)
      boosters.current.forEach((booster, i) => {
        const released = Math.max(0, Math.min(1, (progress - 0.48) / 0.25));
        const side = i === 0 ? -1 : 1;
        booster.position.set(side * released * 2, -released * 4, 0);
        booster.rotation.z = -side * released * 0.35;
      });
    if (flame.current)
      flame.current.scale.set(
        1 + Math.sin(time * 29) * 0.035,
        1 + Math.sin(time * 37) * 0.065,
        1,
      );
    if (flame.current) flame.current.visible = !cinematic || progress < 0.9;
    state.gl.domElement.dataset.launchProgress = progress.toFixed(4);
    state.gl.domElement.dataset.launchTime = time.toFixed(4);
    if (smoke.current) {
      smoke.current.visible = !cinematic || progress < 0.55;
      for (let i = 0; i < 14; i++) {
        const life = (time * 0.18 + i / 14) % 1;
        const angle = i * 2.39996;
        transform.position.set(
          Math.cos(angle) * (0.7 + life * 2.1),
          -3.7 + life * 0.5,
          Math.sin(angle) * (0.7 + life * 2.1),
        );
        transform.scale.setScalar(0.2 + life * 0.5);
        transform.updateMatrix();
        smoke.current.setMatrixAt(i, transform.matrix);
      }
      smoke.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group name={`launch-${build.launcherId}`}>
      <LaunchPad />
      <group ref={rocket} position={[0, -0.45, 0]}>
        <mesh>
          <cylinderGeometry args={[radius, radius, height, 40]} />
          <meshStandardMaterial
            color="#e0e6e9"
            metalness={0.55}
            roughness={0.3}
          />
        </mesh>
        <group ref={nose}>
          <mesh position={[0, height / 2 + 0.55, 0]}>
            <coneGeometry args={[radius, 1.1, 40]} />
            <meshStandardMaterial
              color="#f1f3f3"
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
        </group>
        {cinematic && (
          <>
            <group
              ref={fairing}
              position={[0, height / 2 + 0.55, 0]}
              visible={false}
            >
              {[0, Math.PI].map((angle) => (
                <group key={angle}>
                  <mesh>
                    <coneGeometry
                      args={[radius, 1.1, 32, 1, true, angle, Math.PI]}
                    />
                    <meshStandardMaterial
                      color="#e5e9eb"
                      metalness={0.5}
                      roughness={0.35}
                      side={DoubleSide}
                    />
                  </mesh>
                </group>
              ))}
            </group>
            <group ref={payloadRef} visible={false}>
              {payload}
            </group>
          </>
        )}
        <mesh position={[0, height * 0.28, 0]}>
          <cylinderGeometry args={[radius + 0.008, radius + 0.008, 0.4, 40]} />
          <meshStandardMaterial
            color="#17394e"
            metalness={0.65}
            roughness={0.35}
          />
        </mesh>
        {[-height * 0.34, height * 0.43].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry
              args={[radius + 0.015, radius + 0.015, 0.07, 40]}
            />
            <meshStandardMaterial
              color="#8ba0ad"
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
        ))}
        <mesh position={[0, -height / 2 - 0.17, 0]}>
          <cylinderGeometry
            args={[radius * 0.6, radius * 0.85, 0.34, 28, 1, true]}
          />
          <meshStandardMaterial
            color="#43515e"
            metalness={0.9}
            roughness={0.25}
            side={DoubleSide}
          />
        </mesh>
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => (
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh
              position={[radius + 0.1, -height * 0.37, 0]}
              rotation={[0, 0, -0.22]}
            >
              <boxGeometry args={[0.32, 0.65, 0.055]} />
              <meshStandardMaterial color="#253e50" metalness={0.7} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.1, radius + 0.008]}>
          <boxGeometry args={[0.1, 0.8, 0.018]} />
          <meshStandardMaterial
            color="#258eaa"
            emissive="#0f4c63"
            emissiveIntensity={0.2}
          />
        </mesh>
        {heavy &&
          [-1, 1].map((side, i) => (
            <group
              key={side}
              ref={(value) => {
                if (value) boosters.current[i] = value;
              }}
            >
              <Booster x={side * 0.88} />
            </group>
          ))}
        <group ref={flame} position={[0, -height / 2 - 0.34, 0]}>
          <EnginePlume
            radius={radius * 0.76}
            height={heavy ? 2.5 : light ? 1.8 : 2.2}
          />
        </group>
        <pointLight
          position={[0, -height / 2 - 0.4, 0]}
          color="#ffc165"
          intensity={18}
          distance={5}
        />
      </group>
      <instancedMesh
        ref={smoke}
        args={[undefined, undefined, 14]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial
          color="#aec3ce"
          transparent
          opacity={0.12}
          depthWrite={false}
          roughness={1}
        />
      </instancedMesh>
    </group>
  );
}
