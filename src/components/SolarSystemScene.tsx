import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { Group, Mesh } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  solarBodies,
  solarBody,
  solarDisplayDistance,
  solarPosition,
} from "../data/solarSystem";
import type { SolarBody } from "../data/solarSystem";
import type { Language } from "../types";
import Starfield from "./Starfield";

export interface SolarSceneProps {
  selected: string;
  onSelect: (id: string) => void;
  playing: boolean;
  speed: number;
  reset: number;
  orbits: boolean;
  labels: boolean;
  language: Language;
  days: RefObject<number>;
  onFailure: () => void;
  onReady: () => void;
  command: { id: number; zoom: number };
}

function surfaceTexture(body: SolarBody) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!,
    image = ctx.createImageData(512, 256),
    base = new Color(body.color);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 512; x++) {
      const u = (x / 512) * Math.PI * 2,
        v = (y / 256) * Math.PI;
      let factor =
        0.85 +
        0.11 * Math.sin(u * 9 + Math.cos(v * 8)) +
        0.06 * Math.sin(u * 31 + v * 47);
      const color = base.clone();
      if (
        ["jupiter", "saturn", "venus", "uranus", "neptune"].includes(body.id)
      ) {
        factor =
          0.82 +
          0.12 * Math.sin(v * 26 + Math.sin(u * 4) * 0.18) +
          0.07 * Math.cos(v * 59 + Math.sin(u * 7) * 0.4);
        if (
          body.id === "jupiter" &&
          ((x - 345) / 42) ** 2 + ((y - 158) / 13) ** 2 < 1
        )
          color.set("#a65a3c");
      }
      if (body.id === "earth") {
        const land =
          Math.sin(u * 2 + 0.7 * Math.cos(v * 3)) +
          0.5 * Math.cos(u * 5 - v * 4) +
          0.3 * Math.sin(u * 11 + v * 6);
        color.set(land > 0.4 ? "#54775a" : "#1b68a3");
        if (y < 16 || y > 240) color.set("#dbe8e9");
        if (Math.sin(u * 13 + v * 17) + Math.cos(u * 6 - v * 23) > 1.5)
          color.lerp(new Color("#e6f1ed"), 0.65);
      }
      if (body.id === "sun")
        factor =
          1 +
          0.18 * Math.sin(u * 23 + Math.cos(v * 35)) +
          0.08 * Math.sin(u * 73 + v * 53);
      color.multiplyScalar(factor).convertLinearToSRGB();
      const k = (y * 512 + x) * 4;
      image.data[k] = Math.min(255, color.r * 255);
      image.data[k + 1] = Math.min(255, color.g * 255);
      image.data[k + 2] = Math.min(255, color.b * 255);
      image.data[k + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  if (["mercury", "mars", "moon"].includes(body.id)) {
    for (let i = 0; i < 95; i++) {
      const x = (Math.sin(i * 78.23) * 0.5 + 0.5) * 512,
        y = (Math.cos(i * 47.19) * 0.5 + 0.5) * 256,
        r = 1 + (i % 8);
      ctx.fillStyle = "rgba(35,25,22,.16)";
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(230,217,198,.23)";
      ctx.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
export function SolarLabel({
  body,
  language,
}: {
  body: SolarBody;
  language: Language;
}) {
  const label = body.name[language].toUpperCase();
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "500 38px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#d7e5f2";
    ctx.fillText(label, 256, 57);
    return new CanvasTexture(canvas);
  }, [label]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite
      position={[0, body.visualRadius + 0.4, 0]}
      scale={[0.22, 0.04125, 1]}
    >
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        sizeAttenuation={false}
      />
    </sprite>
  );
}
export function SolarMaterial({ body }: { body: SolarBody }) {
  const texture = useMemo(() => surfaceTexture(body), [body]);
  useEffect(() => () => texture.dispose(), [texture]);
  return body.kind === "star" ? (
    <meshBasicMaterial map={texture} toneMapped={false} />
  ) : (
    <meshStandardMaterial map={texture} roughness={0.9} metalness={0} />
  );
}
function World({ body, props }: { body: SolarBody; props: SolarSceneProps }) {
  const group = useRef<Group>(null),
    sphere = useRef<Mesh>(null);
  useFrame(() => {
    group.current?.position.fromArray(solarPosition(body, props.days.current));
    if (sphere.current) sphere.current.rotation.y = props.days.current * 0.025;
  });
  const sun = body.kind === "star",
    selected = props.selected === body.id,
    visible =
      props.selected === "overview" ||
      selected ||
      (props.selected === "earth" && body.id === "moon");
  return (
    <group ref={group} name={`solar-${body.id}`} visible={visible}>
      <group
        rotation={[
          0,
          0,
          body.id === "uranus" ? 1.71 : body.id === "saturn" ? 0.47 : 0.1,
        ]}
      >
        <mesh
          ref={sphere}
          onClick={(event) => {
            if (!visible) return;
            event.stopPropagation();
            props.onSelect(body.id);
          }}
        >
          <sphereGeometry args={[body.visualRadius, 48, 32]} />
          <SolarMaterial body={body} />
        </mesh>
        {(body.id === "saturn" || body.id === "uranus") && (
          <group rotation={[-Math.PI / 2, 0, 0]} name={`${body.id}-rings`}>
            {[0, 1, 2].map((n) => (
              <mesh key={n}>
                <ringGeometry
                  args={[
                    body.visualRadius * (1.35 + n * 0.33),
                    body.visualRadius * (1.63 + n * 0.33),
                    96,
                  ]}
                />
                <meshStandardMaterial
                  side={DoubleSide}
                  color={body.id === "saturn" ? "#bba782" : "#a5c4cb"}
                  transparent
                  opacity={body.id === "saturn" ? 0.7 - n * 0.12 : 0.2}
                  roughness={1}
                />
              </mesh>
            ))}
          </group>
        )}
        {["earth", "venus", "neptune", "sun"].includes(body.id) && (
          <mesh>
            <sphereGeometry
              args={[body.visualRadius * (sun ? 1.2 : 1.04), 48, 32]}
            />
            <meshBasicMaterial
              color={body.color}
              transparent
              opacity={sun ? 0.055 : 0.065}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
      {props.labels &&
        ((props.selected === "overview" && body.id !== "moon") ||
          selected ||
          (props.selected === "earth" && body.id === "moon")) && (
          <SolarLabel body={body} language={props.language} />
        )}
    </group>
  );
}
function OrbitPath({ body }: { body: SolarBody }) {
  const points = useMemo(
    () =>
      new Float32Array(
        Array.from({ length: 257 }, (_, i) =>
          solarPosition(body, (i / 256) * body.periodYears! * 365.25),
        ).flat(),
      ),
    [body],
  );
  return (
    <lineLoop>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={body.color} transparent opacity={0.22} />
    </lineLoop>
  );
}
function Belt() {
  const points = useMemo(
    () =>
      new Float32Array(
        Array.from({ length: 900 }, (_, i) => {
          const angle = i * 2.39996323,
            r = solarDisplayDistance(
              2.1 + ((Math.sin(i * 19.27) + 1) / 2) * 1.2,
            );
          return [
            Math.cos(angle) * r,
            Math.sin(i * 77.2) * 0.18,
            Math.sin(angle) * r,
          ];
        }).flat(),
      ),
    [],
  );
  return (
    <points name="illustrative-asteroid-belt">
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#9f9490"
        size={0.035}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  );
}
function Rig({ days: daysRef, onFailure, ...props }: SolarSceneProps) {
  const { camera, gl, invalidate, size } = useThree(),
    controls = useRef<OrbitControls | null>(null),
    focused = useRef(""),
    userView = useRef(false),
    lastTarget = useRef(new Vector3());
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = false;
    orbit.enablePan = true;
    orbit.minDistance = 0.65;
    orbit.maxDistance = 130;
    controls.current = orbit;
    const change = () => invalidate(),
      start = () => {
        userView.current = true;
      };
    orbit.addEventListener("change", change);
    orbit.addEventListener("start", start);
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      orbit.dispose();
      controls.current = null;
      gl.domElement.removeEventListener("webglcontextlost", lost);
    };
  }, [camera, gl, invalidate, onFailure]);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || props.command.id === 0) return;
    camera.position
      .sub(orbit.target)
      .multiplyScalar(props.command.zoom)
      .add(orbit.target);
    orbit.update();
    userView.current = true;
    invalidate();
  }, [props.command, camera, invalidate]);
  useFrame((state, delta) => {
    if (props.playing && document.visibilityState !== "hidden")
      daysRef.current += Math.min(delta, 0.1) * props.speed;
    const orbit = controls.current;
    if (!orbit) return;
    const overview = props.selected === "overview",
      body = solarBody(props.selected),
      target = overview
        ? new Vector3()
        : new Vector3(...solarPosition(body, daysRef.current));
    const key = `${props.selected}:${props.reset}`;
    if (focused.current !== key) {
      focused.current = key;
      userView.current = false;
      lastTarget.current.copy(orbit.target);
    }
    if (!overview) {
      const movement = target.clone().sub(lastTarget.current);
      camera.position.add(movement);
      orbit.target.add(movement);
    }
    lastTarget.current.copy(target);
    if (!userView.current) {
      const distance = overview
        ? Math.max(59, 38 / Math.max(0.4, size.width / size.height))
        : Math.max(body.visualRadius * 5, body.id === "moon" ? 1.1 : 2) *
          Math.max(1, 0.85 / (size.width / size.height));
      const eye = overview
        ? new Vector3(0, distance * 0.72, distance)
        : target
            .clone()
            .add(new Vector3(0.4, 1, 1.4).normalize().multiplyScalar(distance));
      const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 5);
      camera.position.lerp(eye, blend);
      orbit.target.lerp(target, blend);
      const settled =
        camera.position.distanceTo(eye) < 0.025 &&
        orbit.target.distanceTo(target) < 0.025;
      state.gl.domElement.dataset.cameraSettled = String(settled);
      if (!settled) invalidate();
    }
    orbit.update();
    state.gl.domElement.dataset.solarDays = daysRef.current.toFixed(5);
    state.gl.domElement.dataset.selectedBody = props.selected;
    state.gl.domElement.dataset.solarPlaying = String(props.playing);
    state.gl.domElement.dataset.earthPosition = solarPosition(
      solarBody("earth"),
      daysRef.current,
    )
      .map((n) => n.toFixed(5))
      .join(",");
    state.gl.domElement.dataset.cameraDistance = camera.position
      .distanceTo(orbit.target)
      .toFixed(5);
    state.gl.domElement.dataset.saturnRings = String(
      !!state.scene.getObjectByName("saturn-rings"),
    );
    state.gl.domElement.dataset.planetCount = String(
      solarBodies.filter(
        (b) =>
          b.kind === "planet" && !!state.scene.getObjectByName(`solar-${b.id}`),
      ).length,
    );
    state.gl.domElement.dataset.orbitsVisible = String(props.orbits);
    state.gl.domElement.dataset.labelsVisible = String(props.labels);
    state.gl.domElement.dataset.starCount = "2400";
  }, -1);
  return null;
}
export default function SolarSystemScene(props: SolarSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 42, 59], fov: 45, near: 0.02, far: 600 }}
      dpr={[1, 1.25]}
      frameloop={props.playing ? "always" : "demand"}
      gl={{ antialias: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.domElement.dataset.ready = "true";
        props.onReady();
      }}
    >
      <color attach="background" args={["#020914"]} />
      <ambientLight intensity={0.65} />
      <pointLight
        position={[0, 0, 0]}
        intensity={100}
        decay={1}
        color="#fff0da"
      />
      <Starfield radius={220} count={2400} size={0.16} />
      {props.selected === "overview" && <Belt />}
      {props.orbits &&
        solarBodies
          .filter((b) => b.kind === "planet")
          .map((body) => <OrbitPath key={body.id} body={body} />)}
      {solarBodies.map((body) => (
        <World key={body.id} body={body} props={props} />
      ))}
      <Rig {...props} />
    </Canvas>
  );
}
