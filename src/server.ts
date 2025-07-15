import {
	createStartHandler,
	defaultStreamHandler,
	getWebRequest,
} from "@tanstack/react-start/server";
import { overwriteGetLocale } from "./paraglide/runtime.js";
import { paraglideMiddleware } from "./paraglide/server.js";
import { createRouter } from "./router";

export default createStartHandler({
	createRouter: () => createRouter(getWebRequest().url),
})((event) =>
	paraglideMiddleware(getWebRequest(), ({ locale }) => {
		overwriteGetLocale(() => locale);
		return defaultStreamHandler(event);
	}),
);
