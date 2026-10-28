import type { ProbeResult } from "@orcai/core";
import * as Effect from "effect/Effect";
import { readCurrentSchema } from "./converge/lib";

export const probeSpiceDb = readCurrentSchema.pipe(
	Effect.map(
		(schema): ProbeResult =>
			schema.length > 0
				? {
						ok: true,
					}
				: {
						ok: false,
						detail: "No schema is written.",
					},
	),
);
