import { requiredAuthMiddleware } from "../middlewares/auth";
import { os } from "./base";

export const authed = os.use(requiredAuthMiddleware);
