import { implement } from "@orpc/server";
import { contracts } from "./contracts";
import { requiredAuthMiddleware } from "./middlewares/auth";

const os = implement(contracts);

export const authed = os.use(requiredAuthMiddleware);
