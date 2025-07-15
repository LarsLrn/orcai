import { registerGlobalMiddleware } from "@tanstack/react-start";
import { localeMiddleware } from "./lib/i18n/locale-middleware";

// Global middlewares do not work yet with the newest version of @tanstack/react-start.
// Import localeMiddleware in each server function instead.
registerGlobalMiddleware({
	middleware: [localeMiddleware],
});
