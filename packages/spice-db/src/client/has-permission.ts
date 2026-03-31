import { v1 } from "@authzed/authzed-node";

export const hasPermission = (result: {
	permissionship: v1.CheckPermissionResponse_Permissionship;
}) =>
	result.permissionship ===
	v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
