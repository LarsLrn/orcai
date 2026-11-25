import * as Context from "effect/Context";
import type { Auth } from "./auth";

/** The app's Better Auth instance, whose callbacks run effects with the app's services. */
export class BetterAuth extends Context.Service<BetterAuth, Auth>()(
	"BetterAuth",
) {}
