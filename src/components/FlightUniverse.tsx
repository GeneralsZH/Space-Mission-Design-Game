import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Quaternion,
  Vector3,
} from "three";
import type { Group, Mesh, Points, Sprite } from "three";
import { solarBodies, solarBody, solarPosition } from "../data/solarSystem";
import {
  flightModelDays,
  flightSunDirection,
  flightSystemScale,
} from "../features/playback/flightEnvironment";
import {
  flightVisuals,
  playbackKey,
  sampleMission,
} from "../features/playback/missionPlayback";
import type { PlaybackFrame } from "../features/playback/missionPlayback";
import type { MissionRun, Language } from "../types";
import { SolarLabel, SolarMaterial } from "./SolarSystemScene";
import Starfield from "./Starfield";

const worlds = solarBodies.filter((b) => b.id !== "earth" && b.id !== "moon");
/** Astronomical context: exaggerated bodies in panorama; point markers nearby. */
export default function FlightUniverse({
  run,
  clock,
  language,
}: {
  run: MissionRun;
  clock: RefObject<PlaybackFrame>;
  language: Language;
}) {
  const bodies = useRef<Group>(null),
    sky = useRef<Group>(null),
    sun = useRef<Mesh>(null),
    dots = useRef<Points>(null),
    names = useRef<Group>(null);
  const paths = useRef<Group>(null),
    craft = useRef<Sprite>(null),
    glow = useRef<Sprite>(null);
  const graphics = useMemo(() => {
    const make = (marker: boolean) => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const ctx = c.getContext("2d")!;
      if (marker) {
        ctx.strokeStyle = "#78fff2";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(64, 64, 40, 0, Math.PI * 2);
        ctx.moveTo(6, 64);
        ctx.lineTo(40, 64);
        ctx.moveTo(88, 64);
        ctx.lineTo(122, 64);
        ctx.moveTo(64, 6);
        ctx.lineTo(64, 40);
        ctx.moveTo(64, 88);
        ctx.lineTo(64, 122);
        ctx.stroke();
      } else {
        const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        g.addColorStop(0, "rgba(255,244,205,.6)");
        g.addColorStop(0.25, "rgba(255,219,152,.2)");
        g.addColorStop(1, "rgba(255,203,109,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
      }
      return new CanvasTexture(c);
    };
    return { marker: make(true), glow: make(false) };
  }, []);
  useEffect(
    () => () => {
      graphics.marker.dispose();
      graphics.glow.dispose();
    },
    [graphics],
  );
  const orbital = useMemo(
    () =>
      solarBodies
        .filter((b) => b.kind === "planet")
        .map((body) => ({
          body,
          data: new Float32Array(
            Array.from({ length: 129 }, (_, i) =>
              solarPosition(body, (i / 128) * body.periodYears! * 365.25),
            ).flat(),
          ),
        })),
    [],
  );
  const vectors = useMemo(
    () => ({
      earth: new Vector3(),
      direction: new Vector3(...flightSunDirection(run)),
      q: new Quaternion(),
      position: new Vector3(),
      anchor: new Vector3(...flightVisuals.earth),
    }),
    [run],
  );
  const points = useMemo(() => new Float32Array(7 * 3), []);
  useFrame((state) => {
    const frame = clock.current,
      p = frame.key === playbackKey(run) ? frame.progress : 0,
      days = flightModelDays(run, p);
    vectors.earth.fromArray(solarPosition(solarBody("earth"), days));
    const scale = flightSystemScale.sunDistance / vectors.earth.length();
    vectors.q.setFromUnitVectors(
      vectors.earth.clone().normalize().negate(),
      vectors.direction,
    );
    const distance = state.camera.position.distanceTo(vectors.anchor),
      blend = Math.max(0, Math.min(1, (distance - 90) / 450)),
      panorama = blend > 0.2;
    sky.current?.position.copy(state.camera.position);
    if (sun.current) {
      sun.current.position
        .copy(vectors.anchor)
        .addScaledVector(vectors.direction, flightSystemScale.sunDistance);
      sun.current.scale.setScalar(3.04 + blend * 95);
      glow.current?.position.copy(sun.current.position);
      glow.current?.scale.setScalar((3.04 + blend * 95) * 5);
    }
    bodies.current?.children.forEach((object, i) => {
      const body = worlds[i];
      if (body.kind === "star") return;
      vectors.position
        .fromArray(solarPosition(body, days))
        .sub(vectors.earth)
        .applyQuaternion(vectors.q)
        .multiplyScalar(scale)
        .add(vectors.anchor);
      object.position.copy(vectors.position);
      object.visible = panorama;
      points.set(vectors.position.toArray(), (i - 1) * 3);
    });
    if (dots.current) {
      dots.current.visible = !panorama;
      dots.current.geometry.attributes.position.needsUpdate = true;
    }
    if (names.current) names.current.visible = panorama;
    if (paths.current) {
      paths.current.visible = panorama;
      paths.current.quaternion.copy(vectors.q);
      paths.current.scale.setScalar(scale);
      paths.current.position
        .copy(vectors.earth)
        .negate()
        .applyQuaternion(vectors.q)
        .multiplyScalar(scale)
        .add(vectors.anchor);
    }
    if (craft.current) {
      craft.current.visible = panorama;
      craft.current.position.fromArray(sampleMission(run, p).position);
    }
    state.gl.domElement.dataset.environmentDays = days.toFixed(8);
    state.gl.domElement.dataset.environmentView = panorama ? "solar" : "local";
    state.gl.domElement.dataset.environmentSun = String(!!sun.current);
    state.gl.domElement.dataset.environmentPlanets = String(
      (bodies.current?.children.filter((o) => o.name !== "flight-world-sun")
        .length ?? 0) + (state.scene.getObjectByName("mission-earth") ? 1 : 0),
    );
    state.gl.domElement.dataset.environmentSunDirection = vectors.direction
      .toArray()
      .map((n) => n.toFixed(6))
      .join(",");
  });
  return (
    <>
      <group ref={sky}>
        <Starfield radius={11000} count={2200} size={3} />
      </group>
      <mesh ref={sun} name="flight-sun">
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#fff4cf" toneMapped={false} />
      </mesh>
      <sprite ref={glow}>
        <spriteMaterial
          map={graphics.glow}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite
        ref={craft}
        scale={[0.055, 0.055, 1]}
        name="live-spacecraft-marker"
      >
        <spriteMaterial
          map={graphics.marker}
          transparent
          sizeAttenuation={false}
          depthWrite={false}
        />
      </sprite>
      <group ref={paths}>
        {orbital.map(({ body, data }) => (
          <lineLoop key={body.id}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[data, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={body.color} transparent opacity={0.18} />
          </lineLoop>
        ))}
      </group>
      <points ref={dots} frustumCulled={false} name="distant-planets">
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#e4d9bd"
          size={2}
          sizeAttenuation={false}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </points>
      <group ref={bodies} name="flight-solar-system">
        {worlds.map((body) => (
          <group key={body.id} name={`flight-world-${body.id}`}>
            {body.kind !== "star" && (
              <>
                <mesh>
                  <sphereGeometry args={[body.visualRadius * 40, 40, 28]} />
                  <SolarMaterial body={body} />
                </mesh>
                {body.id === "saturn" && (
                  <mesh rotation={[-Math.PI / 2, 0, 0.47]}>
                    <ringGeometry
                      args={[
                        body.visualRadius * 54,
                        body.visualRadius * 90,
                        96,
                      ]}
                    />
                    <meshStandardMaterial
                      color="#c6af86"
                      side={DoubleSide}
                      transparent
                      opacity={0.7}
                    />
                  </mesh>
                )}
                <SolarLabel
                  body={{ ...body, visualRadius: body.visualRadius * 40 + 28 }}
                  language={language}
                />
              </>
            )}
          </group>
        ))}
      </group>
      <group ref={names} position={flightVisuals.earth}>
        <SolarLabel
          body={{
            ...solarBody("earth"),
            visualRadius: 30,
            name: { ru: "ЗЕМЛЯ · LIM-01 В ЭФИРЕ", en: "EARTH · LIM-01 LIVE" },
          }}
          language={language}
        />
      </group>
    </>
  );
}
