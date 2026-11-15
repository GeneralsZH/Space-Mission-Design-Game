import { useEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, PlaneGeometry, Vector3 } from "three";
import type { Group } from "three";
import { realVehicle, launchSiteFor } from "../data/realLaunches";
import type { Build, MissionRun } from "../types";
import {
  separationProgress,
  visualStageProgress,
} from "../features/playback/missionPlayback";
import type { PlaybackFrame } from "../features/playback/missionPlayback";
import { EnginePlume } from "./RocketEffects";
import { launchEarth } from "../features/playback/launchGeometry";
import { localToMission } from "../features/playback/launchGeometry";
import {
  ascentScale,
  ascentState,
  ascentDrift,
} from "../features/playback/ascentProfile";

function Barrel({
  y,
  height,
  radius,
  color = "#eeeae2",
  top = radius,
}: {
  y: number;
  height: number;
  radius: number;
  color?: string;
  top?: number;
}) {
  return (
    <mesh position={[0, y, 0]}>
      <cylinderGeometry args={[top, radius, height, 32]} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.18} />
    </mesh>
  );
}
function Bells({
  radius,
  y,
  count = 1,
}: {
  radius: number;
  y: number;
  count?: number;
}) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const a = i === 0 ? 0 : ((i - 1) * Math.PI * 2) / (count - 1),
          r = i === 0 ? 0 : radius * 0.66;
        return (
          <mesh key={i} position={[Math.cos(a) * r, y, Math.sin(a) * r]}>
            <cylinderGeometry
              args={[
                radius * (count === 1 ? 0.4 : 0.12),
                radius * (count === 1 ? 0.7 : 0.2),
                radius * 0.7,
                12,
                1,
                true,
              ]}
            />
            <meshStandardMaterial
              color="#29343c"
              roughness={0.7}
              metalness={0.55}
              side={DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}
function RealPad({ build, local = false }: { build: Build; local?: boolean }) {
  const site = launchSiteFor(build)!;
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(13, 13, 24, 24);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const d = p.getX(i) ** 2 + p.getZ(i) ** 2;
      p.setY(
        i,
        -4.19 -
          (local
            ? d / ((2 * ascentScale.earthRadiusKm) / ascentScale.modelKm)
            : 31 - Math.sqrt(31 * 31 - d)),
      );
    }
    g.computeVertexNormals();
    return g;
  }, [local]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mask = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 24, 64, 64, 64);
    gradient.addColorStop(0, "white");
    gradient.addColorStop(1, "black");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => mask.dispose(), [mask]);
  // Ground patch conforms to the display Earth's curvature. Terrain is illustrative.
  const ground =
    site.terrain === "steppe"
      ? "#a29b77"
      : site.terrain === "forest"
        ? "#36594b"
        : "#49685a";
  return (
    <group name={`pad-${site.id}`}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={ground}
          roughness={1}
          alphaMap={mask}
          transparent
          alphaTest={0.02}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -4.16, 0]} receiveShadow>
        <boxGeometry args={[2.3, 0.09, 2.8]} />
        <meshStandardMaterial color="#6f7477" roughness={1} />
      </mesh>
      <mesh position={[0, -4.1, 0]} receiveShadow>
        <boxGeometry args={[0.65, 0.03, 2.4]} />
        <meshStandardMaterial color="#222a30" roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.85, -4.0, 0]}>
          <mesh>
            <boxGeometry args={[0.3, 0.35, 0.45]} />
            <meshStandardMaterial color="#9c9c93" roughness={1} />
          </mesh>
        </group>
      ))}
      <group position={[-1.1, -0.9, -0.55]}>
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <mesh key={`${x}${z}`} position={[x * 0.17, 0, z * 0.17]}>
              <boxGeometry args={[0.055, 6.4, 0.055]} />
              <meshStandardMaterial color="#8d9a9d" metalness={0.45} />
            </mesh>
          )),
        )}
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[0, -3.1 + i * 0.54, 0]}>
            <boxGeometry args={[0.4, 0.045, 0.4]} />
            <meshStandardMaterial color="#6b858c" />
          </mesh>
        ))}
        {[0, 1.5].map((y) => (
          <mesh key={y} position={[0.5, y, 0]}>
            <boxGeometry args={[0.8, 0.06, 0.12]} />
            <meshStandardMaterial color="#a4b3b8" />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 3, -3.9, -2.5]}>
          <boxGeometry args={[1.8, 0.4, 1]} />
          <meshStandardMaterial color="#9d9e91" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
export default function RealLaunchVehicle({
  build,
  animate,
  clock,
  cinematic = false,
  payload,
  mission,
  localAscent = false,
}: {
  build: Build;
  animate: boolean;
  clock?: RefObject<PlaybackFrame>;
  cinematic?: boolean;
  payload?: ReactNode;
  mission?: MissionRun;
  localAscent?: boolean;
}) {
  const spec = realVehicle(build.launcherId)!,
    soyuz = spec.id === "soyuz2",
    ariane = spec.id === "ariane64",
    falcon = !soyuz && !ariane;
  const height = spec.heightM / 10,
    bottom = -3.75,
    radius = soyuz ? 0.15 : ariane ? 0.27 : 0.183,
    top = bottom + height,
    fairingBottom = top - (ariane ? 1.65 : 1.3);
  const mainColor = soyuz ? "#777f75" : "#e4e5e0";
  const rocket = useRef<Group>(null),
    core = useRef<Group>(null),
    upper = useRef<Group>(null),
    nose = useRef<Group>(null),
    fairing = useRef<Group>(null),
    payloadRef = useRef<Group>(null),
    flame = useRef<Group>(null),
    upperFlame = useRef<Group>(null),
    boosterRefs = useRef<Group[]>([]),
    timeRef = useRef(0);
  const payloadWorld = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const direction = useMemo(() => new Vector3(), []);
  useEffect(() => {
    if (localAscent)
      rocket.current?.traverse((object) => {
        if ("isMesh" in object) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
  }, [localAscent]);
  useFrame((state, delta) => {
    if (animate) timeRef.current += Math.min(delta, 0.1);
    const time = clock?.current.seconds ?? timeRef.current,
      raw = clock?.current.progress ?? Math.min(1, time / 8),
      p = mission?.incident
        ? mission.incident.triggerProgress
        : mission
          ? visualStageProgress(mission, raw)
          : raw;
    const ascent = localAscent ? ascentState(p) : null;
    const released =
        ascent?.released ?? (cinematic ? separationProgress(p) : 0),
      staging =
        ascent?.staging ??
        (cinematic ? Math.max(0, Math.min(1, (p - 0.55) / 0.13)) : 0),
      sideRelease =
        ascent?.sideRelease ??
        (cinematic ? Math.max(0, Math.min(1, (p - 0.35) / 0.2)) : 0),
      fairingRelease = ascent?.fairing ?? released;
    if (rocket.current) {
      rocket.current.visible = mission?.incident?.kind !== "explosion";
      rocket.current.position.y = -0.45 + (cinematic ? 25 : 1.3) * p * p;
      if (ascent) {
        rocket.current.position
          .fromArray(ascent.rocketPosition)
          .divideScalar(ascentScale.modelKm);
        rocket.current.position.y -= ascentScale.anchorKm / ascentScale.modelKm;
        if (mission?.incident?.kind === "trajectory")
          rocket.current.position.add(
            new Vector3(
              ...ascentDrift(mission.phase === "failed" ? 1 : raw),
            ).divideScalar(ascentScale.modelKm),
          );
        rocket.current.quaternion.setFromUnitVectors(
          up,
          direction.fromArray(ascent.direction),
        );
      }
      rocket.current.rotation.z =
        mission?.incident?.kind === "trajectory"
          ? (mission.phase === "failed" ? 1 : raw) * 1.7
          : ascent
            ? rocket.current.rotation.z
            : 0;
    }
    if (core.current) {
      core.current.position.y = -staging * (localAscent ? 120 : 2.2);
      core.current.rotation.z = staging * 0.15;
      core.current.visible = !localAscent || p < 0.57;
    }
    if (upper.current) upper.current.position.y = staging * 0.45;
    if (nose.current) nose.current.visible = fairingRelease <= 0;
    if (fairing.current) {
      fairing.current.visible = fairingRelease > 0 && (!ascent || p < 0.68);
      fairing.current.children.forEach((half, i) => {
        half.position.x =
          (i === 0 ? -1 : 1) * fairingRelease * (localAscent ? 16 : 0.8);
        half.position.y = -fairingRelease * (localAscent ? 20 : 0.35);
        half.rotation.z = (i === 0 ? -1 : 1) * fairingRelease * 0.7;
      });
    }
    if (payloadRef.current) {
      payloadRef.current.visible = fairingRelease > 0.02;
      // All reference vehicles hand off to the same computed transfer endpoint,
      // even though their fairings begin at different heights.
      payloadRef.current.position.y =
        (fairingBottom + 0.28) * (1 - released) +
        released *
          (launchEarth.payloadReleaseOffset / launchEarth.modelScale -
            staging * 0.45);
      payloadRef.current.scale.setScalar(0.12 + released * 0.14);
    }
    boosterRefs.current.forEach((group, i) => {
      const angle = (i * Math.PI * 2) / spec.boosters,
        offset = spec.boosters === 2 ? 0.4 : ariane ? 0.48 : 0.31;
      group.position.set(
        Math.cos(angle) * offset * (1 + sideRelease * (localAscent ? 24 : 2)),
        -sideRelease * (localAscent ? 80 : 2.4),
        Math.sin(angle) * offset * (1 + sideRelease * (localAscent ? 24 : 2)),
      );
      group.visible = !localAscent || p < 0.46;
      group.rotation.z = -Math.cos(angle) * sideRelease * 0.45;
      const exhaust = group.getObjectByName("booster-exhaust");
      if (exhaust)
        exhaust.visible = sideRelease === 0 && (!ascent || ascent.coreBurn);
    });
    if (flame.current) {
      flame.current.visible = ascent
        ? ascent.coreBurn && !mission?.result
        : staging === 0;
      flame.current.scale.y = 1 + Math.sin(time * 37) * 0.05;
      if (ascent) {
        const expansion = 1 + Math.min(1.5, ascent.altitudeKm / 80);
        flame.current.scale.set(
          expansion,
          1 + expansion * 0.35 + Math.sin(time * 37) * 0.05,
          expansion,
        );
      }
    }
    if (upperFlame.current)
      upperFlame.current.visible = ascent
        ? ascent.upperBurn && !mission?.result
        : staging > 0 && released < 1;
    state.gl.domElement.dataset.realVehicle = spec.id;
    state.gl.domElement.dataset.launchSite = launchSiteFor(build)!.id;
    state.gl.domElement.dataset.launchProgress = p.toFixed(4);
    state.gl.domElement.dataset.launchTime = time.toFixed(4);
    state.gl.domElement.dataset.boosterCount = String(spec.boosters);
    state.gl.domElement.dataset.stageSeparated = String(staging > 0);
    if (cinematic && payloadRef.current && released > 0.02) {
      const actual = payloadRef.current
        .getWorldPosition(payloadWorld)
        .toArray() as [number, number, number];
      state.gl.domElement.dataset.deployedPayloadPosition = (
        localAscent ? localToMission(build, actual, p)! : actual
      )
        .map((n) => n.toFixed(6))
        .join(",");
    }
  });
  const coreHeight = height * (falcon ? 0.62 : 0.52),
    coreTop = bottom + 0.25 + coreHeight;
  return (
    <group name={`launch-${spec.id}`}>
      <RealPad build={build} local={localAscent} />
      <group ref={rocket} position={[0, -0.45, 0]}>
        <group ref={core}>
          <Barrel
            y={bottom + 0.25 + coreHeight / 2}
            height={coreHeight}
            radius={radius}
            color={mainColor}
          />
          <Barrel
            y={coreTop - 0.08}
            height={0.2}
            radius={radius * 1.02}
            color={falcon ? "#151c23" : soyuz ? "#dd8939" : "#bac3c6"}
          />
          <Bells radius={radius} y={bottom + 0.13} count={falcon ? 9 : 1} />
          <group ref={flame} position={[0, bottom - 0.05, 0]}>
            <EnginePlume radius={radius * 0.8} height={soyuz ? 1.6 : 2.1} />
          </group>
          {falcon &&
            [-1, 1].map((s) => (
              <mesh
                key={s}
                position={[s * radius, coreTop - 0.22, 0]}
                rotation={[0, 0, s * 0.35]}
              >
                <boxGeometry args={[0.1, 0.2, 0.03]} />
                <meshStandardMaterial color="#343d44" />
              </mesh>
            ))}
        </group>
        {Array.from({ length: spec.boosters }, (_, i) => {
          const br = falcon ? radius : soyuz ? 0.134 : 0.16,
            bh = falcon ? coreHeight : soyuz ? height * 0.54 : height * 0.48;
          return (
            <group
              key={i}
              ref={(v) => {
                if (v) boosterRefs.current[i] = v;
              }}
            >
              <Barrel
                y={bottom + 0.25 + bh / 2}
                height={bh}
                radius={br}
                top={soyuz ? br * 0.55 : br}
                color={mainColor}
              />
              <mesh position={[0, bottom + 0.25 + bh + 0.28, 0]}>
                <coneGeometry args={[soyuz ? br * 0.55 : br, 0.56, 24]} />
                <meshStandardMaterial color={mainColor} />
              </mesh>
              <Barrel
                y={bottom + 0.35}
                height={0.12}
                radius={br * 1.03}
                color={soyuz ? "#d88d42" : "#303b45"}
              />
              <Bells radius={br} y={bottom + 0.12} count={falcon ? 9 : 1} />
              <group name="booster-exhaust" position={[0, bottom - 0.05, 0]}>
                <EnginePlume radius={br * 0.8} height={1.7} />
              </group>
            </group>
          );
        })}
        <group ref={upper}>
          <Barrel
            y={(coreTop + fairingBottom) / 2}
            height={Math.max(0.2, fairingBottom - coreTop)}
            radius={radius * 0.98}
            color={mainColor}
          />
          <Barrel
            y={coreTop + 0.12}
            height={0.24}
            radius={radius * 1.02}
            color={falcon ? "#121c26" : soyuz ? "#df8a3e" : "#b9c6ca"}
          />
          <group ref={upperFlame} position={[0, coreTop - 0.12, 0]}>
            <EnginePlume radius={radius * 0.5} height={0.9} />
          </group>
          <group ref={nose}>
            <Barrel
              y={fairingBottom + 0.42}
              height={0.84}
              radius={radius * 1.4}
              color="#eeeae2"
            />
            <mesh position={[0, fairingBottom + 0.82, 0]} scale={[1, 1.7, 1]}>
              <sphereGeometry
                args={[radius * 1.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial color="#eeeae2" roughness={0.7} />
            </mesh>
          </group>
          <group ref={fairing} position={[0, fairingBottom, 0]} visible={false}>
            {[0, Math.PI].map((a) => (
              <group key={a}>
                <mesh position={[0, 0.42, 0]}>
                  <cylinderGeometry
                    args={[
                      radius * 1.4,
                      radius * 1.4,
                      0.84,
                      24,
                      1,
                      true,
                      a,
                      Math.PI,
                    ]}
                  />
                  <meshStandardMaterial color="#eeeae2" side={DoubleSide} />
                </mesh>
                <mesh position={[0, 1, 0]}>
                  <coneGeometry
                    args={[radius * 1.4, 0.6, 24, 1, true, a, Math.PI]}
                  />
                  <meshStandardMaterial color="#eeeae2" side={DoubleSide} />
                </mesh>
              </group>
            ))}
          </group>
          <group ref={payloadRef} visible={false}>
            {payload}
          </group>
        </group>
      </group>
    </group>
  );
}
