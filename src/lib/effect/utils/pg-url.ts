import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { AppConfigService } from "@/lib/effect/services/config";

export const pgUrl = Effect.map(AppConfigService, ({ config }) => {
	const { user, password, host, port, db } = config.postgres;
	return Redacted.make(
		`postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(db)}`,
	);
});
