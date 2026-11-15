import { memo, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Object3D, Spherical, Vector3 } from "three";
import type { Group, Mesh } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MissionRun } from "../types";
import {
  flightVisuals,
  orbitPosition,
  playbackKey,
  sampleMission,
  separationProgress,
  transferPosition,
  visualStageProgress,
} from "../features/playback/missionPlayback";
import type {
  CameraMode,
  PlaybackFrame,
  Point3,
} from "../features/playback/missionPlayback";
import type { CameraCommand } from "./SpacecraftView";
import { ContextGuard, SpacecraftModel } from "./SpacecraftScene";
import FlightUniverse from "./FlightUniverse";
import LaunchVehicle, { EnginePlume } from "./LaunchVehicle";
import { observationFootprintKm } from "../engine/coverage";
import Planet from "./Planet";
import IncidentEffect from "./IncidentEffect";
import ObservationTrail from "./ObservationTrail";
import { elementsFor, lunar, orbitalParameters } from "../engine/orbital";
import {
  flightSunDirection,
  flightSystemScale,
  flightModelDays,
} from "../features/playback/flightEnvironment";
import type { Language } from "../types";
import { launchFrame, orientFromUp } from "../features/playback/launchGeometry";
import { realVehicle } from "../data/realLaunches";
import AscentScene from "./AscentScene";

interface Props {
  run: MissionRun;
  clock: RefObject<PlaybackFrame>;
  motionEnabled: boolean;
  cameraMode: CameraMode;
  onCameraInteraction: (active: boolean) => void;
  command: CameraCommand;
  onReady: (ready: boolean) => void;
  onContextLost: () => void;
  speed: number;
  language: Language;
  launchView?: boolean;
}
const noop = () => {};
function PathLine({
  points,
  color,
  opacity = 0.6,
}: {
  points: Point3[];
  color: string;
  opacity?: number;
}) {
  const data = useMemo(
    () =>
      new Float32Array(points.slice(1).flatMap((p, i) => [...points[i], ...p])),
    [points],
  );
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}
function FlightObjects({
  run,
  clock,
  motionEnabled,
  cameraMode,
}: Pick<Props, "run" | "clock" | "motionEnabled" | "cameraMode">) {
  const launchEvent =
    run.incident?.sourcePhase === "launched" &&
    run.incident.triggerProgress < 0.68;
  const ship = useRef<Group>(null);
  const moonSpin = useRef(0);
  const earthSpin = useRef(0);
  useEffect(() => {
    ship.current?.traverse((object) => {
      if ("isMesh" in object) object.receiveShadow = true;
    });
  }, [run.build]);
  const beam = useRef<Mesh>(null);
  const footprint = useRef<Mesh>(null);
  const radio = useRef<Mesh>(null);
  const marker = useRef<Mesh>(null);
  const thruster = useRef<Group>(null);
  const packets = useRef<Group>(null);
  const launchHolder = useRef<Group>(null);
  const vectors = useMemo(
    () => ({
      a: new Vector3(),
      b: new Vector3(),
      delta: new Vector3(),
      normal: new Vector3(),
      up: new Vector3(0, 1, 0),
      front: new Vector3(0, 0, 1),
      center: new Vector3(...flightVisuals.moon),
      earth: new Vector3(-8.82, 0.15, 0),
    }),
    [],
  );
  const route = useMemo(
    () => Array.from({ length: 80 }, (_, i) => transferPosition(run, i / 79)),
    [run],
  );
  const orbital = useMemo(
    () => Array.from({ length: 129 }, (_, i) => orbitPosition(run, i / 128)),
    [run],
  );
  useFrame((state) => {
    const frame = clock.current;
    const p = frame.key === playbackKey(run) ? frame.progress : 0;
    const pose = sampleMission(run, p);
    earthSpin.current = flightModelDays(run, p) * Math.PI * 2;
    const time = run.phase === "failed" && run.incident ? 8 : frame.seconds;
    const a = vectors.a.fromArray(pose.position);
    state.gl.domElement.dataset.flightPhase = run.phase;
    state.gl.domElement.dataset.launchView = "mission";
    state.gl.domElement.dataset.playbackPaused = String(run.paused);
    state.gl.domElement.dataset.motionEnabled = String(motionEnabled);
    state.gl.domElement.dataset.flightProgress = p.toFixed(4);
    state.gl.domElement.dataset.spacecraftPosition = pose.position
      .map((n) => n.toFixed(3))
      .join(",");
    state.gl.domElement.dataset.scanning = String(pose.scan);
    state.gl.domElement.dataset.downlink = String(pose.link);
    state.gl.domElement.dataset.incident = run.incident?.kind ?? "none";
    state.gl.domElement.dataset.solarEfficiency = String(
      run.solarEfficiency ?? 1,
    );
    const lunarPhase =
      run.incident?.sourcePhase === "scienceOperations"
        ? run.incident.triggerProgress
        : run.phase === "scienceOperations"
          ? p
          : 0;
    moonSpin.current =
      (-2 *
        Math.PI *
        (run.orbit + lunarPhase) *
        orbitalParameters(elementsFor(run.build)).periodSeconds) /
      (lunar.siderealHours * 3600);
    if (launchHolder.current) {
      const site = launchFrame(
        run.build,
        run.incident?.sourcePhase === "launched"
          ? run.incident.triggerProgress
          : visualStageProgress(run, p),
      );
      launchHolder.current.position.fromArray(
        site?.anchor ?? flightVisuals.launchAnchor,
      );
      launchHolder.current.quaternion.setFromUnitVectors(
        vectors.up,
        new Vector3(...(site?.normal ?? [0, 1, 0])),
      );
      if (site) {
        state.gl.domElement.dataset.launchCoordinates = `${site.site.latitude},${site.site.longitude}`;
        state.gl.domElement.dataset.launchSurfaceNormal = site.normal
          .map((n) => n.toFixed(6))
          .join(",");
      }
      if (
        run.incident?.sourcePhase === "launched" &&
        run.incident.kind === "trajectory"
      ) {
        const base = sampleMission(run, 0).position;
        launchHolder.current.position.add(
          new Vector3(...pose.position).sub(new Vector3(...base)),
        );
      }
    }
    if (ship.current) {
      ship.current.position.copy(a);
      if (run.incident)
        ship.current.quaternion.setFromUnitVectors(
          vectors.up,
          vectors.normal.fromArray(pose.direction).normalize(),
        );
      else if (run.phase === "scienceOperations")
        ship.current.lookAt(vectors.center);
      else if (run.phase === "downlink" || run.phase === "completed")
        ship.current.lookAt(vectors.earth);
      else
        ship.current.quaternion.setFromUnitVectors(
          vectors.up,
          vectors.normal.fromArray(pose.direction).normalize(),
        );
      if (
        run.incident &&
        ["trajectory", "power", "radiation"].includes(run.incident.kind)
      ) {
        ship.current.rotateX(time * 0.85);
        ship.current.rotateZ(time * 1.1);
      }
    }
    if (thruster.current) thruster.current.visible = pose.burn && !run.crisis;
    if (marker.current) {
      marker.current.visible =
        (!!realVehicle(run.build.launcherId) && run.phase === "launched") ||
        cameraMode === "overview" ||
        cameraMode === "solar" ||
        !!run.crisis ||
        (run.phase === "failed" && !run.incident);
      marker.current.position.copy(a);
      marker.current.quaternion.copy(state.camera.quaternion);
    }
    const surface = vectors.b.copy(a).sub(vectors.center).normalize();
    if (run.operations.target === "equator")
      surface.set(surface.x, 0, surface.z).normalize();
    surface
      .multiplyScalar(flightVisuals.moonRadius + 0.015)
      .add(vectors.center);
    if (beam.current) {
      beam.current.visible = pose.scan;
      vectors.delta.copy(a).sub(surface);
      beam.current.position.copy(a).add(surface).multiplyScalar(0.5);
      beam.current.quaternion.setFromUnitVectors(
        vectors.up,
        vectors.normal.copy(vectors.delta).normalize(),
      );
      const width =
        run.build.modelVersion === 2
          ? vectors.delta.length() *
            Math.tan((observationFootprintKm(run).fovDeg * Math.PI) / 360)
          : 0.2 + Math.sin(time * 3) * 0.025;
      beam.current.scale.set(width, vectors.delta.length(), width);
    }
    if (footprint.current) {
      footprint.current.visible = pose.scan;
      footprint.current.position.copy(surface);
      footprint.current.quaternion.setFromUnitVectors(
        vectors.front,
        vectors.normal.copy(surface).sub(vectors.center).normalize(),
      );
      footprint.current.scale.setScalar(
        run.build.modelVersion === 2
          ? (vectors.delta.copy(a).sub(surface).length() *
              Math.tan((observationFootprintKm(run).fovDeg * Math.PI) / 360)) /
              0.16
          : 1 + Math.sin(time * 3) * 0.12,
      );
    }
    if (radio.current) {
      radio.current.visible = pose.link;
      vectors.delta.copy(vectors.earth).sub(a);
      radio.current.position.copy(a).add(vectors.earth).multiplyScalar(0.5);
      radio.current.quaternion.setFromUnitVectors(
        vectors.up,
        vectors.normal.copy(vectors.delta).normalize(),
      );
      radio.current.scale.set(1, vectors.delta.length(), 1);
    }
    if (packets.current) {
      packets.current.visible = pose.link && !run.result;
      packets.current.children.forEach((packet, i) =>
        packet.position.copy(a).lerp(vectors.earth, (time * 0.35 + i / 4) % 1),
      );
    }
  });
  const model = (
    <SpacecraftModel
      build={run.build}
      exploded={false}
      selectedId={null}
      onSelect={noop}
      solarDamaged={(run.solarEfficiency ?? 1) < 1}
    />
  );
  return (
    <>
      <Planet spin={earthSpin} />
      <Planet moon spin={moonSpin} />
      <ObservationTrail run={run} clock={clock} spin={moonSpin} />
      <PathLine points={route} color="#37bacb" opacity={0.55} />
      <PathLine points={orbital} color="#afa1e9" opacity={0.5} />
      {(run.phase === "launched" || launchEvent) &&
        !realVehicle(run.build.launcherId) && (
          <group
            ref={launchHolder}
            position={flightVisuals.launchAnchor}
            scale={flightVisuals.launchScale}
          >
            <LaunchVehicle
              build={run.build}
              animate={false}
              clock={clock}
              cinematic
              payload={model}
              mission={run}
            />
          </group>
        )}
      <group
        ref={ship}
        visible={
          run.phase !== "launched" &&
          !launchEvent &&
          run.incident?.kind !== "explosion"
        }
        scale={
          run.build.modelVersion === 2
            ? Math.min(
                0.035,
                run.phase === "cruise"
                  ? 0.035
                  : (0.035 * elementsFor(run.build).periapsisKm) / 100,
              )
            : 0.18
        }
      >
        {model}
        <group ref={thruster} position={[0, -1.7, 0]} visible={false}>
          <EnginePlume radius={0.25} height={1.4} />
        </group>
      </group>
      <IncidentEffect run={run} clock={clock} motionEnabled={motionEnabled} />
      <mesh ref={marker}>
        <torusGeometry args={[0.19, 0.007, 5, 32]} />
        <meshBasicMaterial
          color={
            run.crisis
              ? "#ffbe55"
              : run.phase === "failed"
                ? "#ff6877"
                : "#67e9e7"
          }
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={beam}>
        <coneGeometry args={[1, 1, 24, 1, true]} />
        <meshBasicMaterial
          color={
            run.build.moduleIds.includes("radar") && !run.radarDisabled
              ? "#ba92fa"
              : "#51e3e7"
          }
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={footprint}>
        <ringGeometry args={[0.08, 0.16, 32]} />
        <meshBasicMaterial
          color="#8bf4e4"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={radio}>
        <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
        <meshBasicMaterial
          color="#6ee8a9"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
      <group ref={packets}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshBasicMaterial color="#aeffd0" />
          </mesh>
        ))}
      </group>
      <mesh position={[-8.85, 0.15, 0]}>
        <sphereGeometry args={[0.065, 12, 8]} />
        <meshBasicMaterial color="#8ff4b8" />
      </mesh>
    </>
  );
}
function FlightCamera({
  run,
  clock,
  motionEnabled,
  cameraMode,
  onCameraInteraction,
  command,
  speed,
}: Omit<Props, "onReady" | "onContextLost">) {
  const { camera, gl, invalidate, size } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialized = useRef(false);
  const initialTarget = useRef(
    sampleMission(
      run,
      clock.current.key === playbackKey(run) ? clock.current.progress : 0,
    ).position,
  );
  const vectors = useMemo(
    () => ({
      target: new Vector3(),
      eye: new Vector3(),
      offset: new Vector3(),
    }),
    [],
  );
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.fromArray(initialTarget.current);
    controls.update();
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minDistance = 0.2;
    controls.maxDistance = 16000;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI - 0.08;
    const changed = () => invalidate();
    const interacted = () => onCameraInteraction(true);
    const ended = () => onCameraInteraction(false);
    controls.addEventListener("change", changed);
    controls.addEventListener("start", interacted);
    controls.addEventListener("end", ended);
    controlsRef.current = controls;
    return () => {
      controls.removeEventListener("change", changed);
      controls.removeEventListener("start", interacted);
      controls.removeEventListener("end", ended);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, invalidate, onCameraInteraction]);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || command.action === "reset" || command.id === 0) return;
    const spherical = new Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    if (command.action === "left") spherical.theta -= Math.PI / 8;
    if (command.action === "right") spherical.theta += Math.PI / 8;
    if (command.action === "up")
      spherical.phi = Math.max(0.1, spherical.phi - Math.PI / 12);
    if (command.action === "down")
      spherical.phi = Math.min(Math.PI - 0.1, spherical.phi + Math.PI / 12);
    if (command.action === "zoomIn")
      spherical.radius = Math.max(0.2, spherical.radius * 0.8);
    if (command.action === "zoomOut")
      spherical.radius = Math.min(16000, spherical.radius / 0.8);
    camera.position.copy(
      new Vector3().setFromSpherical(spherical).add(controls.target),
    );
    controls.update();
    invalidate();
  }, [command, camera, invalidate]);
  useFrame((state, delta) => {
    const controls = controlsRef.current;
    state.gl.domElement.dataset.cameraMode = cameraMode;
    state.gl.domElement.dataset.cameraPosition = camera.position
      .toArray()
      .map((n) => n.toFixed(6))
      .join(",");
    if (!controls || cameraMode === "free") return;
    const frame = clock.current;
    const p = frame.key === playbackKey(run) ? frame.progress : 0;
    const pose = sampleMission(run, p);
    camera.up.set(0, 1, 0);
    if (cameraMode === "solar") {
      const sunDirection = new Vector3(...flightSunDirection(run));
      vectors.target
        .fromArray(flightVisuals.earth)
        .addScaledVector(sunDirection, flightSystemScale.sunDistance);
      vectors.target.add(new Vector3(0, -250, 0));
      const distance =
        flightSystemScale.overviewDistance /
        Math.min(1, Math.max(0.4, size.width / size.height));
      vectors.eye
        .copy(vectors.target)
        .add(new Vector3(0, distance * 0.68, distance));
    } else if (cameraMode === "overview") {
      vectors.target.set(0, 1.7, 0);
      vectors.eye.set(
        0,
        12,
        Math.max(38, 46 / Math.max(0.5, size.width / size.height)),
      );
    } else if (cameraMode === "moon") {
      vectors.target.fromArray(flightVisuals.moon);
      vectors.eye.copy(vectors.target).add(new Vector3(4, -3, 4.5));
    } else {
      vectors.target.fromArray(pose.position);
      if (run.phase === "launched" || run.incident?.sourcePhase === "launched")
        vectors.offset
          .set(0.75 + p * 0.8, 0.45 + p * 0.5, 1.35 + p * 1.5)
          .lerp(new Vector3(0.25, 0.16, 0.6), separationProgress(p));
      else if (run.phase === "cruise") vectors.offset.set(2.5, 1.6, 4.2);
      else
        vectors.offset
          .copy(vectors.target)
          .sub(new Vector3(...flightVisuals.moon))
          .normalize()
          .multiplyScalar(run.build.modelVersion === 2 ? 0.35 : 1.8)
          .add(
            new Vector3(
              0,
              run.build.modelVersion === 2 ? 0.22 : 0.65,
              run.build.modelVersion === 2 ? 0.7 : 2.6,
            ),
          )
          .multiplyScalar(
            run.build.modelVersion === 2
              ? Math.max(
                  0.25,
                  Math.min(1, elementsFor(run.build).periapsisKm / 100),
                )
              : 1,
          );
      vectors.eye.copy(vectors.target).add(vectors.offset);
      const site = launchFrame(
        run.build,
        run.incident?.sourcePhase === "launched"
          ? run.incident.triggerProgress
          : visualStageProgress(run, p),
      );
      if (
        site &&
        (run.phase === "launched" || run.incident?.sourcePhase === "launched")
      ) {
        camera.up.fromArray(site.normal);
        vectors.eye
          .copy(vectors.target)
          .add(
            new Vector3(
              ...orientFromUp(vectors.offset.toArray() as Point3, site.normal),
            ),
          );
      }
    }
    const blend =
      initialized.current && motionEnabled
        ? 1 - Math.exp(-Math.min(delta, 0.1) * 6 * Math.sqrt(speed))
        : 1;
    // Translate with the spacecraft before easing the offset, so acceleration
    // cannot move the tracked object outside the camera's view.
    if (cameraMode === "follow") {
      camera.position.add(
        vectors.offset.copy(vectors.target).sub(controls.target),
      );
      controls.target.copy(vectors.target);
    }
    camera.position.lerp(vectors.eye, blend);
    controls.target.lerp(vectors.target, blend);
    const settled =
      camera.position.distanceTo(vectors.eye) < 0.03 &&
      controls.target.distanceTo(vectors.target) < 0.03;
    state.gl.domElement.dataset.cameraSettled = String(settled);
    controls.update();
    // Demand rendering stops the simulation clock on pause, but camera
    // transitions must request their own frames until they reach the target.
    if (!settled) invalidate();
    initialized.current = true;
  });
  return null;
}
export default memo(function MissionScene(props: Props) {
  const surface =
    !!realVehicle(props.run.build.launcherId) &&
    (props.run.phase === "launched" ||
      props.run.incident?.sourcePhase === "launched") &&
    props.launchView !== false &&
    (props.cameraMode === "follow" || props.cameraMode === "free");
  const sunTarget = useMemo(() => {
    const target = new Object3D();
    target.position.fromArray(flightVisuals.moon);
    return target;
  }, []);
  const e = elementsFor(props.run.build),
    beta = (e.betaDeg * Math.PI) / 180,
    inc = (e.inclinationDeg * Math.PI) / 180;
  const sunPosition: [number, number, number] = props.run.build.advancedFlight
    ? [
        12 + 40 * Math.cos(beta),
        1 - 40 * Math.sin(beta) * Math.cos(inc),
        40 * Math.sin(beta) * Math.sin(inc),
      ]
    : [-18, 9, 14];
  const moving =
    props.motionEnabled &&
    !props.run.paused &&
    !props.run.crisis &&
    !props.run.result;
  return (
    <Canvas
      shadows={!!props.run.build.advancedFlight}
      camera={{
        position: [0, 12, 33],
        fov: 42,
        near: 0.0001,
        far: 200000,
      }}
      dpr={[1, 1.25]}
      frameloop={moving ? "always" : "demand"}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        logarithmicDepthBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.domElement.dataset.ready = "true";
        props.onReady(true);
      }}
    >
      {surface ? (
        <AscentScene {...props} />
      ) : (
        <>
          <ambientLight intensity={0.5} />
          <hemisphereLight args={["#c3eaff", "#06101f", 0.9]} />
          <primitive object={sunTarget} />
          <directionalLight
            position={sunPosition}
            target={sunTarget}
            castShadow={!!props.run.build.advancedFlight}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={12}
            shadow-camera-bottom={-12}
            shadow-bias={-0.0002}
            intensity={3.2}
            color="#fff2dc"
          />
          <directionalLight
            position={[18, 4, -7]}
            intensity={0.3}
            color="#5da5d9"
          />
          <FlightUniverse
            run={props.run}
            clock={props.clock}
            language={props.language}
          />
          <FlightObjects
            run={props.run}
            clock={props.clock}
            motionEnabled={props.motionEnabled}
            cameraMode={props.cameraMode}
          />
          <FlightCamera {...props} />
        </>
      )}
      <ContextGuard onContextLost={props.onContextLost} />
    </Canvas>
  );
});
