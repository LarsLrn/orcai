import * as Redacted from "effect/Redacted";

type PostgresConnectionConfig = Readonly<{
	user: string;
	password: Redacted.Redacted<string>;
	host: string;
	port: number;
	db: string;
}>;

export const makePgConnectionString = ({
	user,
	password,
	host,
	port,
	db,
}: PostgresConnectionConfig): Redacted.Redacted<string> =>
	Redacted.make(
		`postgres://${encodeURIComponent(user)}:${encodeURIComponent(Redacted.value(password))}@${host}:${port}/${encodeURIComponent(db)}`,
	);
