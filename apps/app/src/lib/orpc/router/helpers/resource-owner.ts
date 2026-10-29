import { dbSchema } from "@orcai/db";

/** The owner as a find response names them; join `user` on the resource's `userId`. */
export const ownerColumns = {
	id: dbSchema.user.id,
	name: dbSchema.user.name,
	image: dbSchema.user.image,
};
