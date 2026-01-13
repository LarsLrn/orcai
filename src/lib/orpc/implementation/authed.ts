import { requiredAuthMiddleware } from "@/lib/orpc/middlewares/auth";
import { os } from "./os";

export const authed = os.use(requiredAuthMiddleware);
