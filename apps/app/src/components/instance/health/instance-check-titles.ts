import type { InstanceCheck, InstanceCheckId } from "@orcai/schema";
import { m } from "@/paraglide/messages";

const titles: Record<InstanceCheckId, () => string> = {
	postgres: m.instance_health_check_postgres_title,
	spicedb: m.instance_health_check_spicedb_title,
	qdrant: m.instance_health_check_qdrant_title,
	s3: m.instance_health_check_s3_title,
	valkey: m.instance_health_check_valkey_title,
	workers: m.instance_health_check_workers_title,
	mail: m.instance_health_check_mail_title,
	config: m.instance_health_check_config_title,
};

export const instanceCheckTitle = (check: InstanceCheck) => titles[check.id]();
