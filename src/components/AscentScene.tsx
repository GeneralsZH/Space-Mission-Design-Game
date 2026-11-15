import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  FogExp2,
  Matrix4,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  Spherical,
} from "three";
import type { Group, Texture, DirectionalLight } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MissionRun } from "../types";
import type {
  CameraMode,
  PlaybackFrame,
} from "../features/playback/missionPlayback";
import {
  playbackKey,
  visualStageProgress,
} from "../features/playback/missionPlayback";
import {
  ascentScale,
  ascentState,
  ascentDrift,
  smoothRange,
} from "../features/playback/ascentProfile";
import {
  launchBasis,
  launchEarth,
  localToMission,
} from "../features/playback/launchGeometry";
import { launchSiteFor, realVehicle } from "../data/realLaunches";
import RealLaunchVehicle from "./RealLaunchVehicle";
import { SpacecraftModel } from "./SpacecraftScene";
import IncidentEffect from "./IncidentEffect";
import Starfield from "./Starfield";
import type { CameraCommand } from "./SpacecraftView";
import { publicAsset } from "../features/publicAsset";

export interface AscentProps {
  run: MissionRun;
  clock: RefObject<PlaybackFrame>;
  motionEnabled: boolean;
  cameraMode: CameraMode;
  onCameraInteraction: (active: boolean) => void;
  command: CameraCommand;
  speed: number;
}
function progressOf({ run, clock }: Pick<AscentProps, "run" | "clock">) {
  return (
    run.incident?.triggerProgress ??
    visualStageProgress(
      run,
      clock.current.key === playbackKey(run) ? clock.current.progress : 0,
    )
  );
}
function visualState(props: Pick<AscentProps, "run" | "clock">) {
  const s = ascentState(progressOf(props));
  if (props.run.incident?.kind === "trajectory") {
    const drift = ascentDrift(
      props.run.phase === "failed" ? 1 : props.clock.current.progress,
    );
    s.rocketPosition = s.rocketPosition.map((n, i) => n + drift[i]) as [
      number,
      number,
      number,
    ];
    s.position = s.position.map((n, i) => n + drift[i]) as [
      number,
      number,
      number,
    ];
  }
  return s;
}
function basisMatrix(
  build: Pick<MissionRun["build"], "launcherId" | "launchSiteId">,
  p = 0,
) {
  const b = launchBasis(build, p)!;
  return new Matrix4().makeBasis(
    new Vector3(...b.east),
    new Vector3(...b.up),
    new Vector3(...b.south),
  );
}
function softCloud() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!,
    g = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,.8)");
  g.addColorStop(0.4, "rgba(245,246,244,.6)");
  g.addColorStop(1, "rgba(235,240,242,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const pixels = ctx.getImageData(0, 0, 128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++)
      pixels.data[(y * 128 + x) * 4 + 3] *=
        0.7 +
        0.3 * Math.sin(x * 0.17 + Math.cos(y * 0.14) * 2) * Math.cos(y * 0.21);
  ctx.putImageData(pixels, 0, 0);
  return new CanvasTexture(c);
}
function terrainTexture(terrain: string, westCoast: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const ctx = c.getContext("2d")!,
    steppe = terrain === "steppe";
  ctx.fillStyle = steppe ? "#92856a" : "#40594a";
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2500; i++) {
    const x = (i * 173.73) % 1024,
      y = (i * 93.41) % 1024;
    ctx.fillStyle = (
      steppe
        ? ["#ab9b74", "#8e846a", "#9e906e", "#807e60"]
        : ["#45634c", "#4a6043", "#364f3e", "#59694b"]
    )[i % 4];
    ctx.fillRect(x, y, 4 + (i % 17), 3 + (i % 11));
  }
  ctx.strokeStyle = steppe ? "#ada48b" : "#75836e";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 97);
    ctx.lineTo(1024, i * 97 + 30);
    ctx.stroke();
  }
  if (terrain === "coast") {
    ctx.fillStyle = "#315e73";
    ctx.beginPath();
    ctx.moveTo(westCoast ? 0 : 1024, 0);
    for (let y = 0; y <= 1024; y += 16)
      ctx.lineTo(
        (westCoast ? 390 : 670) +
          Math.sin(y * 0.008) * 45 +
          Math.sin(y * 0.019) * 16,
        y,
      );
    ctx.lineTo(westCoast ? 0 : 1024, 1024);
    ctx.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
function Environment({ run, clock }: Pick<AscentProps, "run" | "clock">) {
  const { camera } = useThree(),
    dome = useRef<Group>(null),
    stars = useRef<Group>(null),
    steam = useRef<Group>(null);
  const [earthMap, setEarthMap] = useState<Texture | null>(null);
  const site = launchSiteFor(run.build)!;
  const build = run.build;
  const resources = useMemo(() => {
    const terrain = terrainTexture(site.terrain, site.id === "vandenberg-4e"),
      cloud = softCloud();
    const ground = new PlaneGeometry(80, 80, 96, 96);
    ground.rotateX(-Math.PI / 2);
    const p = ground.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setY(
        i,
        0.00003 -
          (p.getX(i) ** 2 + p.getZ(i) ** 2) / (2 * ascentScale.earthRadiusKm),
      );
    ground.computeVertexNormals();
    const orientation = new Quaternion()
      .setFromRotationMatrix(
        basisMatrix({ launcherId: build.launcherId, launchSiteId: site.id }),
      )
      .invert()
      .multiply(
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          launchEarth.rotationAtEpoch,
        ),
      );
    return { terrain, cloud, ground, orientation };
  }, [build.launcherId, site.id, site.terrain]);
  const sky = useMemo(
    () => ({
      zenith: { value: new Color() },
      horizon: { value: new Color() },
      up: { value: new Vector3(0, 1, 0) },
    }),
    [],
  );
  const fog = useRef<FogExp2>(null);
  useEffect(() => {
    let active = true;
    const loaded = new TextureLoader().load(
      publicAsset("science/earth-blue-marble-1024.png"),
      (t) => {
        t.colorSpace = SRGBColorSpace;
        if (active) setEarthMap(t);
      },
      undefined,
      () => {},
    );
    return () => {
      active = false;
      loaded.dispose();
    };
  }, []);
  useEffect(
    () => () => {
      resources.terrain.dispose();
      resources.cloud.dispose();
      resources.ground.dispose();
    },
    [resources],
  );
  useFrame(() => {
    const s = ascentState(progressOf({ run, clock })),
      darkness = smoothRange(14, 95, s.altitudeKm);
    sky.zenith.value.set("#337eac").lerp(new Color("#020711"), darkness);
    sky.horizon.value.set("#c1d4da").lerp(new Color("#071426"), darkness);
    sky.up.value.fromArray(s.normal);
    dome.current?.position.copy(camera.position);
    if (stars.current) {
      stars.current.position.copy(camera.position);
      stars.current.visible = s.altitudeKm > 65;
    }
    if (fog.current) fog.current.density = 0.08 * Math.exp(-s.altitudeKm / 3);
    if (steam.current) {
      steam.current.visible = s.progress > 0.07 && s.progress < 0.26;
      steam.current.children.forEach((p, i) => {
        const age = Math.max(0, (s.progress - 0.07) * 50 - i * 0.012),
          a = i * 2.39996,
          r = 0.008 + age * 0.016;
        p.position.set(
          Math.cos(a) * r,
          0.002 + age * 0.002 + (i % 4) * 0.001,
          Math.sin(a) * r,
        );
        p.scale.setScalar(0.012 + age * 0.016);
        p.rotation.z = i * 0.7;
      });
    }
  });
  return (
    <>
      <fogExp2 ref={fog} attach="fog" args={["#bed3db", 0.08]} />
      <group ref={dome}>
        <mesh renderOrder={-100}>
          <sphereGeometry args={[100000, 24, 12]} />
          <shaderMaterial
            side={BackSide}
            depthWrite={false}
            depthTest={false}
            fog={false}
            uniforms={sky}
            vertexShader={
              "varying vec3 vD; void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
            }
            fragmentShader={
              "varying vec3 vD;uniform vec3 zenith;uniform vec3 horizon;uniform vec3 up;void main(){float t=smoothstep(-.05,.65,dot(normalize(vD),up));gl_FragColor=vec4(mix(horizon,zenith,t),1.0);}"
            }
          />
        </mesh>
      </group>
      <group ref={stars}>
        <Starfield radius={60000} size={8} count={1400} />
      </group>
      <mesh
        position={[0, -ascentScale.earthRadiusKm, 0]}
        quaternion={resources.orientation}
        name="ascent-earth-km"
      >
        <sphereGeometry args={[ascentScale.earthRadiusKm, 256, 128]} />
        <meshStandardMaterial
          key={earthMap?.uuid ?? "earth-loading"}
          map={earthMap}
          color={earthMap ? "white" : "#426276"}
          roughness={1}
        />
      </mesh>
      <mesh position={[0, -ascentScale.earthRadiusKm, 0]}>
        <sphereGeometry args={[ascentScale.earthRadiusKm + 50, 128, 80]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={BackSide}
          vertexShader={`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vP; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vP=p.xyz;gl_Position=projectionMatrix*p;
#include <logdepthbuf_vertex>
}`}
          fragmentShader={`#include <logdepthbuf_pars_fragment>
varying vec3 vN; varying vec3 vP; void main(){float rim=pow(1.0-abs(dot(normalize(vN),normalize(-vP))),3.2);gl_FragColor=vec4(0.18,0.49,0.82,rim*0.5);
#include <logdepthbuf_fragment>
}`}
        />
      </mesh>
      <mesh geometry={resources.ground} receiveShadow>
        <meshStandardMaterial map={resources.terrain} roughness={1} />
      </mesh>
      <mesh
        position={[0, 0.00012, 0]}
        rotation={[-Math.PI / 2, 0, 0.08]}
        receiveShadow
      >
        <planeGeometry args={[0.016, 0.65]} />
        <meshStandardMaterial color="#8b8d85" roughness={1} />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => (
        <mesh
          key={i}
          position={[
            ((i % 6) - 2.5) * 2.7,
            2.5 + (i % 3) * 0.35,
            (Math.floor(i / 6) - 1.5) * 3.4,
          ]}
          rotation={[-Math.PI / 2, 0, i * 0.7]}
        >
          <planeGeometry args={[2.2 + (i % 3), 1.6]} />
          <meshBasicMaterial
            map={resources.cloud}
            color="#e5edf0"
            transparent
            opacity={0.75}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
      <group ref={steam}>
        {Array.from({ length: 28 }, (_, i) => (
          <sprite key={i}>
            <spriteMaterial
              map={resources.cloud}
              transparent
              opacity={0.48}
              depthWrite={false}
              color={i % 3 === 0 ? "#dfd8c8" : "#f0f2f1"}
            />
          </sprite>
        ))}
      </group>
    </>
  );
}
function TrackingCamera(props: AscentProps) {
  const { camera, gl, invalidate, size } = useThree(),
    controls = useRef<OrbitControls | null>(null),
    initialized = useRef(false);
  const onCameraInteraction = props.onCameraInteraction;
  const vectors = useMemo(
    () => ({
      target: new Vector3(),
      eye: new Vector3(),
      last: new Vector3(),
      offset: new Vector3(),
      up: new Vector3(),
    }),
    [],
  );
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    controls.current = c;
    c.enablePan = false;
    c.enableDamping = false;
    c.minDistance = 0.025;
    c.maxDistance = 50000;
    c.maxPolarAngle = Math.PI - 0.02;
    const change = () => invalidate(),
      start = () => onCameraInteraction(true),
      end = () => onCameraInteraction(false);
    c.addEventListener("change", change);
    c.addEventListener("start", start);
    c.addEventListener("end", end);
    return () => {
      c.removeEventListener("change", change);
      c.removeEventListener("start", start);
      c.removeEventListener("end", end);
      c.dispose();
      controls.current = null;
    };
  }, [camera, gl, invalidate, onCameraInteraction]);
  useEffect(() => {
    const c = controls.current;
    if (!c || props.command.action === "reset" || !props.command.id) return;
    const a = props.command.action,
      s = new Spherical().setFromVector3(camera.position.clone().sub(c.target));
    if (a === "left") s.theta -= Math.PI / 8;
    if (a === "right") s.theta += Math.PI / 8;
    if (a === "up") s.phi = Math.max(0.1, s.phi - Math.PI / 12);
    if (a === "down") s.phi = Math.min(Math.PI - 0.1, s.phi + Math.PI / 12);
    if (a === "zoomIn") s.radius = Math.max(0.025, s.radius * 0.8);
    if (a === "zoomOut") s.radius = Math.min(50000, s.radius / 0.8);
    camera.position.copy(new Vector3().setFromSpherical(s).add(c.target));
    c.update();
    invalidate();
  }, [props.command, camera, invalidate]);
  useFrame((state, delta) => {
    const c = controls.current;
    if (!c) return;
    const s = visualState(props);
    state.gl.domElement.dataset.cameraMode = props.cameraMode;
    state.gl.domElement.dataset.cameraPosition = camera.position
      .toArray()
      .map((n) => n.toFixed(6))
      .join(",");
    if (props.cameraMode === "free") return;
    const vehicle = realVehicle(props.run.build.launcherId)!,
      height = vehicle.heightM / 10;
    const coreTop =
        -3.5 +
        height *
          (vehicle.id === "soyuz2" || vehicle.id === "ariane64" ? 0.52 : 0.62),
      fairingBottom = -3.75 + height - (vehicle.id === "ariane64" ? 1.65 : 1.3);
    const fullCentre = (vehicle.heightM / 2 - 37.5) / 1000,
      upperCentre =
        ((coreTop + fairingBottom) / 2 + 0.45) * ascentScale.modelKm;
    const centre = fullCentre + (upperCentre - fullCentre) * s.staging;
    vectors.target
      .fromArray(s.rocketPosition)
      .addScaledVector(new Vector3(...s.direction), centre * (1 - s.released));
    vectors.target.lerp(new Vector3(...s.position), s.released);
    const portrait = Math.max(
      1,
      Math.min(1.5, 0.9 / (size.width / size.height)),
    );
    vectors.offset
      .set(0.11, 0.012, 0.17)
      .multiplyScalar(portrait)
      .multiplyScalar(1 - 0.45 * smoothRange(0.45, 0.62, s.progress))
      .applyAxisAngle(
        new Vector3(0, 0, 1),
        -s.downrangeKm / ascentScale.earthRadiusKm,
      );
    const bridge = smoothRange(0.96, 1, s.progress);
    const b = basisMatrix(props.run.build, s.progress).invert();
    const missionOffset = new Vector3(2.5, 1.6, 4.2)
      .applyMatrix4(b)
      .multiplyScalar(ascentScale.earthRadiusKm / launchEarth.radius);
    if (bridge > 0) {
      const d = Math.exp(
        Math.log(vectors.offset.length()) * (1 - bridge) +
          Math.log(missionOffset.length()) * bridge,
      );
      vectors.offset
        .normalize()
        .lerp(missionOffset.normalize(), bridge)
        .normalize()
        .multiplyScalar(d);
    }
    vectors.eye.copy(vectors.target).add(vectors.offset);
    vectors.up
      .fromArray(s.normal)
      .lerp(new Vector3(0, 1, 0).applyMatrix4(b), bridge)
      .normalize();
    camera.up.copy(vectors.up);
    if (initialized.current)
      camera.position.add(vectors.target.clone().sub(c.target));
    const mix =
      initialized.current && props.motionEnabled && bridge === 0
        ? 1 - Math.exp(-Math.min(delta, 0.1) * 10 * Math.sqrt(props.speed))
        : 1;
    camera.position.lerp(vectors.eye, mix);
    c.target.copy(vectors.target);
    c.update();
    const settled = camera.position.distanceTo(vectors.eye) < 0.00005;
    state.gl.domElement.dataset.cameraSettled = String(settled);
    if (!settled) invalidate();
    initialized.current = true;
  });
  return null;
}
export default function AscentScene(props: AscentProps) {
  const { camera } = useThree();
  const lastProgress = useRef(0);
  const launchBuild = useRef(props.run.build);
  const panelDeployment = useRef(0),
    light = useRef<DirectionalLight>(null),
    target = useMemo(() => new Object3D(), []);
  useEffect(
    () => () => {
      // Preserve the same view when leaving km-scale launch space, including a
      // user's free camera. The mission overview uses a smaller coordinate unit.
      const p = lastProgress.current;
      camera.position.fromArray(
        localToMission(
          launchBuild.current,
          camera.position.toArray() as [number, number, number],
          p,
        )!,
      );
      const q = new Quaternion().setFromRotationMatrix(
        basisMatrix(launchBuild.current, p),
      );
      camera.quaternion.premultiply(q);
      camera.up.applyQuaternion(q);
    },
    [camera],
  );
  useFrame(({ gl }) => {
    const s = visualState(props);
    lastProgress.current = s.progress;
    panelDeployment.current = s.panels;
    target.position.fromArray(s.rocketPosition);
    light.current?.position.copy(target.position).add(new Vector3(-2, 4, 3));
    const canvas = gl.domElement,
      b = launchSiteFor(props.run.build)!;
    canvas.dataset.launchView = "surface";
    canvas.dataset.ascentStage = s.stage.id;
    canvas.dataset.ascentAltitudeKm = s.altitudeKm.toFixed(4);
    canvas.dataset.ascentPitchDeg = s.pitchDeg.toFixed(4);
    canvas.dataset.panelDeployment = s.panels.toFixed(4);
    canvas.dataset.launchCoordinates = `${b.latitude},${b.longitude}`;
    canvas.dataset.flightPhase = props.run.phase;
    canvas.dataset.flightProgress = (
      props.clock.current.key === playbackKey(props.run)
        ? props.clock.current.progress
        : 0
    ).toFixed(4);
    canvas.dataset.playbackPaused = String(props.run.paused);
    canvas.dataset.motionEnabled = String(props.motionEnabled);
    canvas.dataset.spacecraftPosition = localToMission(
      props.run.build,
      s.position,
      s.progress,
    )!
      .map((n) => n.toFixed(6))
      .join(",");
    canvas.dataset.localSpacecraftPosition = s.position
      .map((n) => n.toFixed(6))
      .join(",");
    canvas.dataset.earthRadiusKm = String(ascentScale.earthRadiusKm);
    canvas.dataset.rocketHeightM = String(
      realVehicle(props.run.build.launcherId)!.heightM,
    );
    canvas.dataset.incident = props.run.incident?.kind ?? "none";
    canvas.dataset.coreBurning = String(s.coreBurn);
    canvas.dataset.upperBurning = String(s.upperBurn);
  });
  const effectPosition = () => visualState(props).position;
  return (
    <>
      <ambientLight intensity={0.4} />
      <hemisphereLight args={["#c9e4f3", "#465548", 1.2]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={3.1}
        color="#fff3de"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-0.2}
        shadow-camera-right={0.2}
        shadow-camera-top={0.2}
        shadow-camera-bottom={-0.2}
        shadow-camera-near={0.01}
        shadow-camera-far={12}
        shadow-bias={-0.000005}
      />
      <Environment run={props.run} clock={props.clock} />
      <group
        position={[0, ascentScale.anchorKm, 0]}
        scale={ascentScale.modelKm}
        name="surface-launch-scale-km"
      >
        <RealLaunchVehicle
          build={props.run.build}
          animate={false}
          clock={props.clock}
          mission={props.run}
          cinematic
          localAscent
          payload={
            <SpacecraftModel
              build={props.run.build}
              exploded={false}
              selectedId={null}
              onSelect={() => {}}
              panelDeployment={panelDeployment}
            />
          }
        />
      </group>
      <IncidentEffect
        run={props.run}
        clock={props.clock}
        motionEnabled={props.motionEnabled}
        positionFor={effectPosition}
        effectScale={0.04}
      />
      <TrackingCamera {...props} />
    </>
  );
}
