import path from "node:path";
import fs from "node:fs";
import type {
	Elysia,
	SingletonBase,
	DefinitionBase,
	MetadataBase,
	RouteBase,
	EphemeralType,
	MergeSchema,
	UnwrapRoute,
} from "elysia";
import { transformPathToUrl } from "./transformPathToUrl";

export async function autoload<
	Path extends string = string,
	Singleton extends SingletonBase = SingletonBase,
	Definitions extends DefinitionBase = DefinitionBase,
	Metadata extends MetadataBase = MetadataBase,
	Routes extends RouteBase = RouteBase,
	Ephemeral extends EphemeralType = EphemeralType,
	Volatile extends EphemeralType = EphemeralType,
>(
	app: Elysia<
		Path,
		Singleton,
		Definitions,
		Metadata,
		Routes,
		Ephemeral,
		Volatile
	>,
	routesDir: string,
	generateTags: boolean,
): Promise<
	Elysia<Path, Singleton, Definitions, Metadata, Routes, Ephemeral, Volatile>
> {
	const dirPath = getDirPath(routesDir);

	if (!fs.existsSync(dirPath))
		throw new Error(`Directory "${dirPath}" does not exist`);

	if (!fs.statSync(dirPath).isDirectory())
		throw new Error(`"${dirPath}" is not a directory.`);

	const router = new Bun.FileSystemRouter({
		style: "nextjs",
		dir: dirPath,
	});

	const routeModules: Record<
		string,
		(
			group: Elysia<
				`${Path}`,
				Singleton,
				Definitions,
				{
					schema: MergeSchema<
						// biome-ignore lint/complexity/noBannedTypes: <explanation>
						UnwrapRoute<{}, Definitions["typebox"], `${Path}`>,
						Metadata["schema"],
						""
					>;
					macro: Metadata["macro"];
					macroFn: Metadata["macroFn"];
					parser: Metadata["parser"];
				},
				// biome-ignore lint/complexity/noBannedTypes: <explanation>
				{},
				Ephemeral,
				Volatile
			>,
		) => Elysia<
			`${Path}`,
			Singleton,
			Definitions,
			{
				schema: MergeSchema<
					UnwrapRoute<
						Record<string, unknown>,
						Definitions["typebox"],
						`${Path}`
					>,
					Metadata["schema"],
					""
				>;
				macro: Metadata["macro"];
				macroFn: Metadata["macroFn"];
				parser: Metadata["parser"];
			},
			Record<string, unknown>,
			Ephemeral,
			Volatile
		>
	> = {};
	const importPromises: Promise<void>[] = [];

	for (const [nextRouteName, file] of Object.entries(router.routes)) {
		const routeName = transformPathToUrl(nextRouteName);

		importPromises.push(
			import(file).then((routeModule) => {
				routeModules[routeName] = routeModule.default;
			}),
		);
	}

	await Promise.all(importPromises);

	for (const [routeName, routeModule] of Object.entries(routeModules)) {
		app.group(routeName as "", (groupedApp) => {
			const mappedApp = routeModule(groupedApp);

			if (generateTags) {
				for (const route of mappedApp.routes) {
					if (!route.hooks.detail) {
						Object.assign(route.hooks, { detail: { tags: [routeName] } });
					}
				}
			}
			return mappedApp;
		});
	}

	return app;
}

function getDirPath(dir: string) {
	let dirPath: string;

	if (path.isAbsolute(dir)) dirPath = dir;
	else if (path.isAbsolute(process.argv[1]))
		dirPath = path.join(process.argv[1], "..", dir);
	else dirPath = path.join(process.cwd(), process.argv[1], "..", dir);

	return dirPath;
}
