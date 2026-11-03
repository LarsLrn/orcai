import { user } from "./schema/auth";

/** The owner as a find response names them; join `user` on the resource's `userId`. */
export const ownerColumns = {
	id: user.id,
	name: user.name,
	image: user.image,
};
