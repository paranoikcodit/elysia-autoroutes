import path from 'node:path'
import type Elysia from 'elysia'
import { transformPathToUrl } from './transformPathToUrl'

const validMethods = ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS'] as const
type ValidMethods = typeof validMethods[number]

export async function autoload(app: Elysia, routesDir: string, routePrefix: string) {
  type RouteHandler = Parameters<Elysia['get']>[1]
  type RouteHooks = Parameters<Elysia['get']>[2]

  const router = new Bun.FileSystemRouter({
    style: 'nextjs',
    dir: getDirPath(routesDir),
  })

  const routeModules: Record<string, any> = {}

  for (const [routeName, file] of Object.entries(router.routes)) {
    const routeModule = await import(file)
    const routeNameWithPrefix = transformPathToUrl(routeName)
    routeModules[routeNameWithPrefix] = routeModule
  }

  app.group(routePrefix, (app) => {
    for (const [routeName, routeModule] of Object.entries(routeModules)) {
      for (const [method, handler] of Object.entries(routeModule)) {
        const normalizedMethod = method.toUpperCase() as ValidMethods
        if (validMethods.includes(normalizedMethod)) {
          if (typeof handler === 'function')
            app[method as unknown as Lowercase<ValidMethods>](routeName, handler as RouteHandler)
          else
            app[method as unknown as Lowercase<ValidMethods>](routeName, (handler as { handler: RouteHandler }).handler, (handler as { hooks: RouteHooks }).hooks)
        }
      }
    }

    return app
  })
}

function getDirPath(dir: string) {
  let dirPath: string

  if (path.isAbsolute(dir))
    dirPath = dir
  else if (path.isAbsolute(process.argv[1]))
    dirPath = path.join(process.argv[1], '..', dir)
  else
    dirPath = path.join(process.cwd(), process.argv[1], '..', dir)

  return dirPath
}
