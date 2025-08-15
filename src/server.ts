import {
	createStartHandler,
	defaultStreamHandler,
	getWebRequest,
} from "@tanstack/react-start/server";
import { overwriteGetLocale } from "./paraglide/runtime.js";
import { paraglideMiddleware } from "./paraglide/server.js";
import { createAppRouter } from "./router";
import { startTelemetry } from "./telemetry";

// Initialize telemetry SYNCHRONOUSLY before any other imports or operations
// This ensures instrumentation captures all operations
startTelemetry();

export default createStartHandler({
	createRouter: () => createAppRouter(getWebRequest().url),
})((event) => {
	return paraglideMiddleware(getWebRequest(), ({ locale }) => {
		overwriteGetLocale(() => locale);
		return defaultStreamHandler(event);
	});
});
