import {
	createStartHandler,
	defaultStreamHandler,
	getWebRequest,
} from "@tanstack/react-start/server";
import { overwriteGetLocale } from "./paraglide/runtime.js";
import { paraglideMiddleware } from "./paraglide/server.js";
import { createRouter } from "./router";
import { ensureTelemetryStarted } from "./telemetry";

// Kick off telemetry startup (non-blocking)
void ensureTelemetryStarted();

export default createStartHandler({
	createRouter: () => createRouter(getWebRequest().url),
})((event) => {
	return paraglideMiddleware(getWebRequest(), ({ locale }) => {
		overwriteGetLocale(() => locale);
		return defaultStreamHandler(event);
	});
});
