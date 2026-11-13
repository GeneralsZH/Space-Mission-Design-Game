import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from "three";
import type { Group, Sprite, SpriteMaterial } from "three";
import type { RefObject } from "react";
import type { MissionRun } from "../types";
import type { PlaybackFrame } from "../features/playback/missionPlayback";
import { sampleMission } from "../features/playback/missionPlayback";

function cloudTexture(fire: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (fire) {
    gradient.addColorStop(0, "rgba(255,255,224,1)");
    gradient.addColorStop(0.23, "rgba(255,210,90,.95)");
    gradient.addColorStop(0.5, "rgba(255,102,24,.7)");
    gradient.addColorStop(0.8, "rgba(150,41,12,.2)");
  } else {
    gradient.addColorStop(0, "rgba(182,169,150,.7)");
    gradient.addColorStop(0.45, "rgba(94,94,94,.55)");
    gradient.addColorStop(0.8, "rgba(45,49,54,.2)");
  }
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const data = ctx.getImageData(0, 0, 128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const n =
        0.72 +
        0.28 *
          Math.sin(x * 0.17 + Math.sin(y * 0.19) * 2) *
          Math.cos(y * 0.12 + Math.sin(x * 0.09));
      data.data[(y * 128 + x) * 4 + 3] *= n;
    }
  ctx.putImageData(data, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export default function IncidentEffect({
  run,
  clock,
  motionEnabled,
}: {
  run: MissionRun;
  clock: RefObject<PlaybackFrame>;
  motionEnabled: boolean;
}) {
  const group = useRef<Group>(null),
    core = useRef<Sprite>(null),
    shock = useRef<Sprite>(null),
    debris = useRef<Group>(null),
    smoke = useRef<Group>(null);
  const textures = useMemo(
    () => ({ fire: cloudTexture(true), smoke: cloudTexture(false) }),
    [],
  );
  useEffect(
    () => () => {
      textures.fire.dispose();
      textures.smoke.dispose();
    },
    [textures],
  );
  const rays = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => {
        const a = i * 2.39996,
          y = 1 - (2 * (i + 0.5)) / 32,
          r = Math.sqrt(1 - y * y);
        return [Math.cos(a) * r, y, Math.sin(a) * r];
      }),
    [],
  );
  useFrame(() => {
    if (!group.current) return;
    const active = !!run.incident && run.incident.kind === "explosion";
    group.current.visible = active;
    if (!active) return;
    const p =
      run.phase === "failed"
        ? 1
        : motionEnabled
          ? Math.min(1, clock.current.progress)
          : 0.18;
    group.current.position.fromArray(sampleMission(run, 0).position);
    if (core.current) {
      core.current.scale.setScalar(
        0.12 + Math.sin((Math.min(1, p * 1.8) * Math.PI) / 2) * 1.2,
      );
      core.current.material.opacity = Math.max(0, 1 - p * 1.5);
    }
    if (shock.current) {
      shock.current.scale.setScalar(0.16 + p * 2.1);
      shock.current.material.opacity = Math.max(0, 0.45 - p);
    }
    debris.current?.children.forEach((object, i) => {
      const ray = rays[i];
      object.position.set(
        ray[0] * p * (1 + (i % 4)),
        ray[1] * p * 1.6 - p * p * 1.2,
        ray[2] * p * (1 + (i % 3)),
      );
      object.rotation.set(i + p * 8, p * 9, i - p * 5);
    });
    smoke.current?.children.forEach((object, i) => {
      const ray = rays[i * 2];
      object.position.set(
        ray[0] * p * 0.65,
        ray[1] * p * 0.55 + p * 0.3,
        ray[2] * p * 0.65,
      );
      object.scale.setScalar(0.12 + p * (0.7 + (i % 3) * 0.14));
      ((object as Sprite).material as SpriteMaterial).opacity = Math.max(
        0,
        0.4 - p * 0.22,
      );
    });
  });
  return (
    <group ref={group} visible={false} name="flight-breakup-effect">
      <sprite ref={core}>
        <spriteMaterial
          map={textures.fire}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite ref={shock}>
        <spriteMaterial
          map={textures.fire}
          color="#ff842b"
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <group ref={smoke}>
        {rays.slice(0, 16).map((_, i) => (
          <sprite key={i}>
            <spriteMaterial
              map={textures.smoke}
              color={i % 3 === 0 ? "#d2a582" : "#929ba9"}
              transparent
              depthWrite={false}
            />
          </sprite>
        ))}
      </group>
      <group ref={debris}>
        {rays.map((_, i) => (
          <mesh key={i}>
            <boxGeometry
              args={[
                i % 4 === 0 ? 0.14 : 0.04,
                0.025,
                i % 4 === 0 ? 0.06 : 0.025,
              ]}
            />
            <meshStandardMaterial
              color={i % 3 === 0 ? "#d7dce0" : "#807b70"}
              emissive="#ff5b16"
              emissiveIntensity={i % 5 === 0 ? 1 : 0}
              metalness={0.6}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
