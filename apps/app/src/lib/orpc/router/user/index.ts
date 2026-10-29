import { instanceAdminRouter } from "./instance-admin";
import { selfServiceRouter } from "./self-service";

export const userRouter = {
	...instanceAdminRouter,
	...selfServiceRouter,
};
