import * as Cause from "effect/Cause";
import * as HashMap from "effect/HashMap";
import * as List from "effect/List";
import * as Logger from "effect/Logger";
import type * as LogLevel from "effect/LogLevel";
import * as LogSpan from "effect/LogSpan";
import { logger } from "@/lib/observability/logger";

const toPinoLevel = (logLevel: LogLevel.LogLevel) => {
	switch (logLevel._tag) {
		case "Fatal":
			return "fatal";
		case "Error":
			return "error";
		case "Warning":
			return "warn";
		case "Info":
			return "info";
		case "Debug":
			return "debug";
		case "Trace":
			return "trace";
		default:
			return null;
	}
};

// Replace Effect's default logger so `Effect.log` goes through pino.
const PinoEffectLogger = Logger.make(
	({ logLevel, message, cause, annotations, spans, date }) => {
		const level = toPinoLevel(logLevel);
		if (!level) return;

		const annotationFields = HashMap.reduce(
			annotations,
			{} as Record<string, unknown>,
			(acc, value, key) => {
				acc[key] = value;
				return acc;
			},
		);

		const spanStrings = List.toArray(spans).map(LogSpan.render(date.getTime()));

		const payload: Record<string, unknown> = {
			annotations: annotationFields,
			spans: spanStrings.length ? spanStrings : undefined,
			cause: Cause.isEmpty(cause) ? undefined : Cause.pretty(cause),
		};

		logger[level](payload, `${message}`);
	},
);

export const LoggerLive = Logger.replace(
	Logger.defaultLogger,
	PinoEffectLogger,
);
