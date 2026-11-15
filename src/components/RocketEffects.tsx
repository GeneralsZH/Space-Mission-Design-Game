import { AdditiveBlending, DoubleSide } from "three";
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
