import { modelIdSchema, organizationFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";
import { m } from "@/paraglide/messages";

const organizationFormSchema = organizationFieldsSchema
	.extend({
		assistantModelId: modelIdSchema.nullable(),
		utilityModelId: modelIdSchema.nullable(),
		/** `off`, `native`, or the id of the search provider. */
		webSearch: z.string(),
		/** Who administers a new organisation; see `initialOrganizationAdminSchema`. */
		initialAdmin: z.enum([
			"me",
			"user",
			"invite",
		]),
		initialAdminUserId: z.string().nullable(),
		initialAdminEmail: z.string(),
	})
	.check((ctx) => {
		const value = ctx.value;
		if (value.initialAdmin === "user" && !value.initialAdminUserId) {
			ctx.issues.push({
				code: "custom",
				input: value.initialAdminUserId,
				path: [
					"initialAdminUserId",
				],
				message: m.orgs_form_initial_admin_user_required(),
			});
		}
		if (
			value.initialAdmin === "invite" &&
			!z.email().safeParse(value.initialAdminEmail).success
		) {
			ctx.issues.push({
				code: "custom",
				input: value.initialAdminEmail,
				path: [
					"initialAdminEmail",
				],
				message: m.orgs_form_initial_admin_email_invalid(),
			});
		}
	});

const defaultValues = (): z.input<typeof organizationFormSchema> => ({
	name: "",
	slug: "",
	metadata: null,
	assistantModelId: null,
	utilityModelId: null,
	webSearch: "off",
	initialAdmin: "me",
	initialAdminUserId: null,
	initialAdminEmail: "",
});

export const organizationFormOptions = formOptions({
	defaultValues: defaultValues(),
	validators: {
		onChange: organizationFormSchema,
	},
});
