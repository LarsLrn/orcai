import { withActiveSpan } from "@orcai/observability";
import { runtime } from "@/lib/effect/runtime";
import { logProcedureError } from "./error-mapping";

/** For `onError` in the client interceptors: logs each failed procedure once, under the active span. */
export const logFailedProcedure = (error: unknown) => {
	runtime.runFork(withActiveSpan(logProcedureError(error)));
};
