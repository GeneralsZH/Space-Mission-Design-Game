import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { flightVisuals } from "../features/playback/missionPlayback";

function planetTexture(moon: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Planet texture canvas unavailable");
  ctx.fillStyle = moon ? "#9b9c99" : "#1f6899";
  ctx.fillRect(0, 0, 1024, 512);
  if (moon) {
    for (let i = 0; i < 160; i++) {
      const x = (i * 173.37) % 1024;
      const y = (i * 91.79) % 512;
      const radius = 4 + ((i * 7.3) % 29);
      const gradient = ctx.createRadialGradient(
        x - radius * 0.2,
        y - radius * 0.2,
        1,
        x,
        y,
        radius,
      );
      gradient.addColorStop(0, "#555c61");
      gradient.addColorStop(0.8, "#868b8b");
      gradient.addColorStop(1, "#babdb6");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const continents = [
      [
        [-165, 65],
        [-140, 71],
        [-125, 55],
        [-110, 51],
        [-80, 54],
        [-53, 45],
        [-80, 26],
        [-98, 16],
        [-118, 30],
        [-130, 50],
      ],
      [
        [-82, 13],
        [-63, 9],
        [-35, -6],
        [-44, -24],
        [-67, -55],
        [-77, -27],
        [-81, -3],
      ],
      [
        [-13, 36],
        [7, 57],
        [36, 70],
        [73, 61],
        [105, 75],
        [160, 63],
        [145, 38],
        [122, 18],
        [98, 6],
        [72, 24],
        [48, 34],
        [35, 12],
        [9, 5],
        [-16, 14],
      ],
      [
        [-17, 33],
        [12, 37],
        [42, 12],
        [51, -3],
        [32, -33],
        [18, -35],
        [4, -14],
        [-16, 10],
      ],
      [
        [112, -11],
        [137, -11],
        [153, -26],
        [138, -39],
        [113, -32],
      ],
      [
        [-51, 83],
        [-22, 77],
        [-40, 59],
        [-60, 66],
      ],
    ];
    continents.forEach((points, index) => {
      ctx.beginPath();
      points.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * 1024;
        const y = ((90 - lat) / 180) * 512;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle =
        index === 5
          ? "#d8e2de"
          : ["#668d71", "#67855c", "#829168", "#a5a07a", "#a4976f"][index % 5];
      ctx.fill();
    });
    ctx.fillStyle = "#dce9e7";
    ctx.fillRect(0, 0, 1024, 15);
    ctx.fillRect(0, 486, 1024, 26);
    ctx.strokeStyle = "#d3e6e81c";
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64, 512);
      ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 64);
      ctx.lineTo(1024, i * 64);
      ctx.stroke();
    }
    for (let i = 0; i < 20; i++) {
      ctx.strokeStyle = "#edf7f047";
      ctx.lineWidth = 6 + (i % 4);
      ctx.beginPath();
      ctx.ellipse(
        (i * 169) % 1024,
        60 + ((i * 97) % 390),
        30 + (i % 20),
        5 + (i % 9),
        i * 0.4,
        0,
        Math.PI * 1.3,
      );
      ctx.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
export default function Planet({ moon = false }: { moon?: boolean }) {
  const texture = useMemo(() => planetTexture(moon), [moon]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={moon ? flightVisuals.moon : flightVisuals.earth}>
      <mesh rotation={[0, moon ? -0.4 : 0.8, 0]}>
        <sphereGeometry
          args={[
            moon ? flightVisuals.moonRadius : flightVisuals.earthRadius,
            64,
            40,
          ]}
        />
        <meshStandardMaterial
          map={texture}
          roughness={moon ? 1 : 0.76}
          metalness={0}
          emissive={moon ? "#0d1014" : "#071c30"}
          emissiveIntensity={0.25}
        />
      </mesh>
      {!moon && (
        <mesh>
          <sphereGeometry args={[flightVisuals.earthRadius * 1.025, 48, 32]} />
          <meshBasicMaterial
            color="#63cfff"
            transparent
            opacity={0.06}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
