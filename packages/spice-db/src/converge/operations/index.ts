import type { SpiceConvergeOperation } from "../types";
import { removeCourseTuplesOperation } from "./010-remove-course-tuples";
import { rewriteOrganizationRoleTuplesOperation } from "./020-rewrite-organization-role-tuples";

export const operations: SpiceConvergeOperation[] = [
	removeCourseTuplesOperation,
	rewriteOrganizationRoleTuplesOperation,
];
