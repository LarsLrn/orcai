import type { ConfigEntry } from "@orcai/schema";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

/** Flattens resolved config into dotted keys; secrets only say whether they are set. */
export const summarizeConfig = (
	value: unknown,
	key = "",
): readonly ConfigEntry[] => {
	if (Redacted.isRedacted(value)) {
		return [
			{
				kind: "secret",
				key,
				set: String(Redacted.value(value)).length > 0,
			},
		];
	}
	if (Option.isOption(value)) {
		return Option.match(value, {
			onNone: () => summarizeConfig(undefined, key),
			onSome: (inner) => summarizeConfig(inner, key),
		});
	}
	if (value === undefined || value === null || value === "") {
		return [
			{
				kind: "unset",
				key,
			},
		];
	}
	if (typeof value === "object" && !Array.isArray(value)) {
		return Object.entries(value).flatMap(([name, inner]) =>
			summarizeConfig(inner, key ? `${key}.${name}` : name),
		);
	}
	return [
		{
			kind: "value",
			key,
			value: Array.isArray(value) ? value.join(", ") : String(value),
		},
	];
};
