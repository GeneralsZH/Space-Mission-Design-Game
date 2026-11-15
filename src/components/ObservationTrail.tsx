import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  DoubleSide,
  Vector3,
} from "three";
import type { Group } from "three";
import type { MissionRun } from "../types";
import type { PlaybackFrame } from "../features/playback/missionPlayback";
import {
  flightVisuals,
  visualStageProgress,
} from "../features/playback/missionPlayback";
import { resolveOrbit } from "../data/missionConfig";
import { groundPoint, footprintHalfAngle } from "../engine/groundTrack";
import {
  observationFootprintKm,
  observationEndProgress,
} from "../engine/coverage";
import { calculate } from "../engine/calculations";
type Pass = NonNullable<MissionRun["scanPasses"]>[number];
const segments = 160;
function Band({
  run,
  pass,
  clock,
  current = false,
}: {
  run: MissionRun;
  pass: Pass;
  clock: RefObject<PlaybackFrame>;
  current?: boolean;
}) {
  const duty =
    resolveOrbit(run.build).operatingHours /
    (resolveOrbit(run.build).sunHours + resolveOrbit(run.build).shadowHours);
  const { geometry, centerline } = useMemo(() => {
    const points: number[] = [],
      linePoints: number[] = [],
      radius = flightVisuals.moonRadius + 0.005;
    const edge = (phase: number) => {
      const c = new Vector3(
        ...groundPoint(run.build, pass.orbit, phase, pass.target),
      );
      const tangent = new Vector3(
        ...groundPoint(run.build, pass.orbit, phase + 0.0001, pass.target),
      ).sub(c);
      const side = new Vector3().crossVectors(c, tangent).normalize(),
        angle = footprintHalfAngle(run.build, phase, pass.fovDeg);
      return [
        c
          .clone()
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(side, Math.sin(angle))
          .multiplyScalar(radius),
        c
          .clone()
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(side, -Math.sin(angle))
          .multiplyScalar(radius),
      ];
    };
    for (let i = 0; i < segments; i++) {
      const a = edge(0.5 + (duty * i) / segments),
        b = edge(0.5 + (duty * (i + 1)) / segments);
      [a[0], a[1], b[0], a[1], b[1], b[0]].forEach((p) =>
        points.push(p.x, p.y, p.z),
      );
      for (const phase of [
        0.5 + (duty * i) / segments,
        0.5 + (duty * (i + 1)) / segments,
      ]) {
        const p = new Vector3(
          ...groundPoint(run.build, pass.orbit, phase, pass.target),
        ).multiplyScalar(radius + 0.002);
        linePoints.push(p.x, p.y, p.z);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(points, 3));
    g.setDrawRange(0, 0);
    const line = new BufferGeometry();
    line.setAttribute("position", new Float32BufferAttribute(linePoints, 3));
    line.setDrawRange(0, 0);
    return { geometry: g, centerline: line };
  }, [run.build, pass.orbit, pass.fovDeg, pass.target, duty]);
  useEffect(
    () => () => {
      geometry.dispose();
      centerline.dispose();
    },
    [geometry, centerline],
  );
  useFrame(() => {
    const progress = current
      ? Math.min(
          pass.progress,
          visualStageProgress(run, clock.current.progress),
        )
      : pass.progress;
    const count = Math.floor(
      Math.max(0, Math.min(1, (progress - 0.5) / duty)) * segments,
    );
    geometry.setDrawRange(0, count * 6);
    centerline.setDrawRange(0, count * 2);
  });
  return (
    <group>
      <mesh geometry={geometry} renderOrder={2}>
        <meshBasicMaterial
          color={current ? "#65ffe2" : "#20c6e3"}
          transparent
          opacity={current ? 0.48 : 0.36}
          side={DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <lineSegments geometry={centerline} renderOrder={3}>
        <lineBasicMaterial
          color={current ? "#a0ffee" : "#38dcff"}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
export default function ObservationTrail({
  run,
  clock,
  spin,
}: {
  run: MissionRun;
  clock: RefObject<PlaybackFrame>;
  spin: RefObject<number>;
}) {
  const group = useRef<Group>(null),
    fov = observationFootprintKm(run).fovDeg;
  const active =
    run.build.modelVersion === 2 &&
    run.phase === "scienceOperations" &&
    run.orbit < 4 &&
    fov > 0 &&
    !run.crisis &&
    run.storedGbit < calculateMemory(run);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = spin.current;
    state.gl.domElement.dataset.coveragePasses = String(
      run.scanPasses?.length ?? 0,
    );
    let vertices = 0;
    group.current?.traverse((child) => {
      if ("geometry" in child)
        vertices += (child.geometry as BufferGeometry).drawRange.count || 0;
    });
    state.gl.domElement.dataset.observationVertices = String(vertices);
  });
  if (run.build.modelVersion !== 2) return null;
  return (
    <group
      ref={group}
      position={flightVisuals.moon}
      name="simulated-observation-trail"
    >
      {(run.scanPasses ?? []).map((pass, i) => (
        <Band key={i} run={run} pass={pass} clock={clock} />
      ))}
      {active && (
        <Band
          run={run}
          pass={{
            orbit: run.orbit,
            progress: run.build.advancedFlight
              ? observationEndProgress(run)
              : 1,
            fovDeg: fov,
            target: run.operations.target,
          }}
          clock={clock}
          current
        />
      )}
    </group>
  );
}
function calculateMemory(run: MissionRun) {
  return calculate(run.build).memoryGbit;
}
