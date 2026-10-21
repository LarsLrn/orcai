import { instanceAdminRouter } from "./instance-admin";
import { memberDirectoryRouter } from "./member-directory";
import { selfServiceRouter } from "./self-service";

export const userRouter = {
	...memberDirectoryRouter,
	...instanceAdminRouter,
	...selfServiceRouter,
};
