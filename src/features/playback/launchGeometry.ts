import type { Build } from "../../types";
import { launchSiteFor } from "../../data/realLaunches";
import { ascentScale, ascentState } from "./ascentProfile";
export type LaunchPoint = [number, number, number];
export const launchEarth = {
  center: [-12, 0, 0] as LaunchPoint,
  radius: 3.1,
  rotationAtEpoch: 0.8,
  modelScale: (3.1 / ascentScale.earthRadiusKm) * ascentScale.modelKm,
  padOffset: (3.1 / ascentScale.earthRadiusKm) * ascentScale.anchorKm,
  payloadReleaseOffset:
    (3.1 / ascentScale.earthRadiusKm) * ascentScale.releaseKm,
};
/** Equirectangular map frame used by Three's sphere and the NASA display map. */
export function siteNormal(
  latitude: number,
  longitude: number,
  rotation: number,
): LaunchPoint {
  const lat = (latitude * Math.PI) / 180,
    lon = (longitude * Math.PI) / 180 + rotation;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  ];
}
export function launchFrame(
  build: Pick<Build, "launcherId" | "launchSiteId">,
  progress = 0,
) {
  const site = launchSiteFor(build);
  if (!site) return undefined;
  const normal = siteNormal(
    site.latitude,
    site.longitude,
    launchEarth.rotationAtEpoch +
      Math.PI * 2 * ((0.15 * Math.max(0, Math.min(1, progress))) / 24),
  );
  const anchor = normal.map(
    (n, i) =>
      launchEarth.center[i] + n * (launchEarth.radius + launchEarth.padOffset),
  ) as LaunchPoint;
  return { site, normal, anchor };
}
export function realLaunchPosition(
  build: Pick<Build, "launcherId" | "launchSiteId">,
  progress: number,
): LaunchPoint | undefined {
  return localToMission(build, ascentState(progress).position, progress);
}
export function launchBasis(
  build: Pick<Build, "launcherId" | "launchSiteId">,
  progress = 0,
) {
  const frame = launchFrame(build, progress);
  if (!frame) return undefined;
  const lon =
    (frame.site.longitude * Math.PI) / 180 +
    launchEarth.rotationAtEpoch +
    Math.PI * 2 * ((0.15 * Math.max(0, Math.min(1, progress))) / 24);
  const east: LaunchPoint = [-Math.sin(lon), 0, -Math.cos(lon)],
    up = frame.normal;
  const south: LaunchPoint = [
    east[1] * up[2] - east[2] * up[1],
    east[2] * up[0] - east[0] * up[2],
    east[0] * up[1] - east[1] * up[0],
  ];
  return { east, up, south };
}
export function localDirectionToMission(
  build: Pick<Build, "launcherId" | "launchSiteId">,
  point: LaunchPoint,
  progress = 0,
): LaunchPoint | undefined {
  const b = launchBasis(build, progress);
  if (!b) return undefined;
  return [0, 1, 2].map(
    (i) => point[0] * b.east[i] + point[1] * b.up[i] + point[2] * b.south[i],
  ) as LaunchPoint;
}
export function localToMission(
  build: Pick<Build, "launcherId" | "launchSiteId">,
  point: LaunchPoint,
  progress = 0,
): LaunchPoint | undefined {
  const b = launchBasis(build, progress);
  if (!b) return undefined;
  const R = ascentScale.earthRadiusKm,
    s = launchEarth.radius / R;
  const direction = localDirectionToMission(
    build,
    [point[0], point[1] + R, point[2]],
    progress,
  )!;
  return direction.map((n, i) => launchEarth.center[i] + n * s) as LaunchPoint;
}
export function orientFromUp(
  vector: LaunchPoint,
  normal: LaunchPoint,
): LaunchPoint {
  // Rodrigues' shortest rotation from local +Y to the surface normal.
  const [nx, ny, nz] = normal,
    axis: [number, number, number] = [nz, 0, -nx],
    d = 1 + ny;
  const cross = (a: LaunchPoint, b: LaunchPoint): LaunchPoint => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  if (d < 1e-8) return [vector[0], -vector[1], -vector[2]];
  const first = cross(axis, vector),
    second = cross(axis, first);
  return vector.map((n, i) => n + first[i] + second[i] / d) as LaunchPoint;
}
