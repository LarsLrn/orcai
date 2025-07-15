import type { Organization } from "@/db/schema/auth";
import type { Course } from "@/db/schema/course";
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
	interface TableMeta {
		courseId?: Course["id"];
		organizationId?: Organization["id"];
	}
}
