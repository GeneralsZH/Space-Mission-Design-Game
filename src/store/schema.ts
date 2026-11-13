import { z } from "zod";
import {
  catalog,
  categories,
  launchers,
  orbits,
  physics,
} from "../data/missionConfig";
import { createRun, transition } from "../engine/simulation";
import type { Build, MissionRun } from "../types";
import { cash, legacyEconomy, syncBuild } from "../engine/economy";

export const buildSchema = z
  .object({
    moduleIds: z
      .array(z.string().refine((id) => catalog.some((c) => c.id === id)))
      .max(catalog.length),
    orbitId: z.string().refine((id) => orbits.some((o) => o.id === id)),
    launcherId: z
      .string()
      .refine((id) => id === "none" || launchers.some((l) => l.id === id)),
    propellantKg: z.number().finite().min(0).max(physics.maxPropellantKg),
    testingBudgetMUsd: z.number().finite().min(0).max(physics.maxTestingMUsd),
    overheadMUsd: z.number().finite().min(0).max(500).optional(),
  })
  .strict()
  .refine(
    (build) =>
      new Set(build.moduleIds).size === build.moduleIds.length &&
      categories.every(
        (category) =>
          category === "instrument" ||
          build.moduleIds.filter(
            (id) => catalog.find((c) => c.id === id)?.category === category,
          ).length <= 1,
      ),
    "Duplicate or incompatible slots",
  );
export const settingsSchema = z
  .object({
    language: z.enum(["ru", "en"]),
    mode: z.enum(["learning", "engineer"]),
    reducedMotion: z.boolean(),
    motionPreference: z.enum(["system", "on", "off"]).default("system"),
    sound: z.boolean(),
    graphics: z.enum(["3d", "schematic", "minimal"]),
    playback: z.enum(["live", "step"]).default("live"),
    playbackSpeed: z
      .union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)])
      .default(1),
  })
  .strict();
const seedSchema = z.number().int().min(0).max(4294967295);
const commandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("SetOperations"),
      operations: z
        .object({
          disabledInstrumentIds: z
            .array(
              z
                .string()
                .refine((id) =>
                  catalog.some(
                    (c) => c.id === id && c.category === "instrument",
                  ),
                ),
            )
            .max(4),
          target: z.enum(["pole", "equator"]),
          antenna: z.enum(["earth", "stowed"]),
          downlinkFraction: z.union([
            z.literal(0.25),
            z.literal(0.5),
            z.literal(1),
          ]),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal("Launch"), seed: seedSchema }).strict(),
  z.object({ type: z.literal("Validate") }).strict(),
  z.object({ type: z.literal("Advance") }).strict(),
  z
    .object({
      type: z.literal("ChooseDecision"),
      choice: z.enum(["safe", "continue"]),
    })
    .strict(),
  z.object({ type: z.literal("Pause") }).strict(),
  z.object({ type: z.literal("Resume") }).strict(),
  z.object({ type: z.literal("Restart") }).strict(),
]);
const economySchema = z
  .object({
    legacyOverdraftMUsd: z.number().finite().min(0).max(200).optional(),
    ownedIds: z
      .array(z.string().refine((id) => catalog.some((c) => c.id === id)))
      .max(catalog.length)
      .refine((ids) => new Set(ids).size === ids.length),
    fuelKg: z.number().finite().min(0).max(physics.maxPropellantKg),
    launcherId: z
      .string()
      .refine((id) => launchers.some((l) => l.id === id))
      .nullable(),
    tests: z
      .array(
        z
          .object({
            kind: z.enum([
              "power",
              "thermal",
              "communications",
              "vibration",
              "legacy",
            ]),
            fingerprint: z.string().max(3000),
            costMUsd: z
              .number()
              .finite()
              .positive()
              .max(physics.maxTestingMUsd),
            passed: z.boolean(),
            measurements: z.array(z.string().max(300)).max(5),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const saveSchema = z
  .object({
    schemaVersion: z.literal(2),
    economy: economySchema,
    build: buildSchema,
    settings: settingsSchema,
    seed: seedSchema,
    commands: z.array(commandSchema).max(500),
  })
  .strict();
export type SaveData = z.infer<typeof saveSchema>;
export function replay(
  build: Build,
  seed: number,
  commands: SaveData["commands"],
): MissionRun {
  let run = createRun(build, seed);
  for (const command of commands) {
    const next = transition(run, command);
    if (next === run) throw new Error("Invalid command sequence");
    run = next;
  }
  return run;
}
export function parseSave(input: string): SaveData {
  if (input.length > 200_000) throw new Error("Save exceeds 200 KB");
  const raw = JSON.parse(input);
  if (raw.schemaVersion === 1) {
    const old = saveSchema
      .omit({ economy: true })
      .extend({ schemaVersion: z.literal(1) })
      .parse(raw);
    raw.schemaVersion = 2;
    raw.economy = legacyEconomy(old.build);
  }
  const data = saveSchema.parse(raw);
  const canonical = syncBuild(data.build, data.economy);
  if (
    cash(data.economy) < -(data.economy.legacyOverdraftMUsd ?? 0) - 0.000001 ||
    data.build.moduleIds.join() !== canonical.moduleIds.join() ||
    data.build.launcherId !== canonical.launcherId ||
    ["propellantKg", "testingBudgetMUsd", "overheadMUsd"].some(
      (k) =>
        Math.abs(
          ((data.build[k as keyof Build] as number) ?? 0) -
            ((canonical[k as keyof Build] as number) ?? 0),
        ) > 0.000001,
    )
  )
    throw new Error("Inconsistent purchases or budget");
  replay(data.build, data.seed, data.commands);
  return data;
}
