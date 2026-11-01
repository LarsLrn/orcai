import { createListResponseSchema, statusResponseSchema } from "../shared";
import {
	contentReceiverSchema,
	handedOverSchema,
	ownedContentSchema,
} from "./schema";

export const listOwnedContentResponseSchema =
	createListResponseSchema(ownedContentSchema);

export const listContentReceiversResponseSchema = createListResponseSchema(
	contentReceiverSchema,
);

/** A membership change that may have handed content over. */
export const handOverActionResponseSchema = statusResponseSchema.extend({
	handedOver: handedOverSchema.nullable(),
});

export const resourceHandOverResponseSchema = statusResponseSchema;
