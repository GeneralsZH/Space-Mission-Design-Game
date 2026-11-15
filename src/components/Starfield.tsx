import { useMemo } from "react";
import { Color } from "three";
/** Deterministic decorative sky; not a star catalogue or a view from a date. */
export default function Starfield({
  radius = 17,
  count = 1600,
  size = 0.018,
}: {
  radius?: number;
  count?: number;
  size?: number;
}) {
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3),
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = i * 2.39996323,
        y = 1 - (2 * (i + 0.5)) / count,
        r = Math.sqrt(1 - y * y);
      positions.set(
        [
          Math.cos(theta) * r * radius,
          y * radius,
          Math.sin(theta) * r * radius,
        ],
        i * 3,
      );
      const color = new Color(
        i % 11 === 0 ? "#ffcf9c" : i % 3 === 0 ? "#c6e2ff" : "#8daecf",
      ).multiplyScalar(0.45 + 0.55 * ((Math.sin(i * 87.13) + 1) / 2));
      colors.set([color.r, color.g, color.b], i * 3);
    }
    return { positions, colors };
  }, [count, radius]);
  return (
    <points name="decorative-starfield">
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={size}
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
