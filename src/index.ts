import { Elysia } from "elysia";
import { autoload } from "./utils";

export interface Options {
	routesDir?: string;
	prefix?: string;
	generateTags?: boolean;
}

export async function autoroutes(options?: Options) {
	const { routesDir, prefix, generateTags } = {
		...options,
		routesDir: options?.routesDir ?? "./routes",
		prefix: options?.prefix ?? "",
		generateTags: options?.generateTags ?? true,
	};

	const seed = { routesDir, prefix };
	const autoroutesPlugin = new Elysia({
		prefix,
		name: `autoroutes-${JSON.stringify(seed)}`,
		seed,
	});

	await autoload(autoroutesPlugin, routesDir, generateTags);

	return autoroutesPlugin;
}
