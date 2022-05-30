// tracing: off
import * as T from "@effect-ts/core/Effect"
import * as L from "@effect-ts/core/Effect/Layer"
import type { Has } from "@effect-ts/core/Has"
import { tag } from "@effect-ts/core/Has"
import type { _A, _R } from "@effect-ts/core/Utils"
import type {
  ContextConfigDefault,
  FastifyInstance,
  FastifyLoggerInstance,
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  InjectOptions,
  LightMyRequestResponse,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
  RouteShorthandOptions
} from "fastify"
import fastify from "fastify"
import type { RouteGenericInterface } from "fastify/types/route"

const FastifyAppSymbol = Symbol.for("@tcmlabs/effect-ts-fastify")
export const FastifyApp = tag<FastifyApp>(FastifyAppSymbol)

const makeFastifyApp = T.gen(function* (_) {
  const app = yield* _(T.succeedWith(() => fastify()))

  const listen = () =>
    T.effectAsync<unknown, Error, void>((resume) => {
      app.listen(3000, "localhost", (error, address) => {
        if (error) {
          resume(T.fail(new Error("TODO")))
        } else {
          console.log("fastify listening at", address, "!")
          resume(T.unit)
        }
      })
    })

  const inject = (opts: InjectOptions | string) =>
    T.effectAsync<unknown, Error, LightMyRequestResponse>((resume) => {
      app.inject(opts, function (error: Error, response: LightMyRequestResponse) {
        if (error) {
          resume(T.fail(new Error("TODO")))
        } else {
          resume(T.succeed(response))
        }
      })
    })

  const runtime = <
    RouteHandler extends EffectHandler<any, any, any, any, any, any, any>
  >(
    handler: RouteHandler
  ) => {
    return T.map_(
      T.runtime<
        _R<
          RouteHandler extends EffectHandler<infer R, any, any, any, any, any, any>
            ? T.RIO<R, void>
            : never
        >
      >(),
      (r) => {
        return (request: FastifyRequest, reply: FastifyReply) => {
          r.runFiber(handler.call(app, request, reply))
        }
      }
    )
  }

  return {
    _tag: FastifyAppSymbol,
    app,
    inject,
    listen,
    runtime
  }
})

function withFastifyRuntime<
  Handler extends EffectHandler<any, any, any, any, any, any, any>
>(handler: Handler) {
  return T.accessServiceM(FastifyApp)((_) => _.runtime(handler))
}

const withFastifyInstance = T.accessService(FastifyApp)((_) => _.app)

export type EffectHandler<
  R,
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface,
  ContextConfig = ContextConfigDefault,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance
> = (
  this: FastifyInstance<RawServer, RawRequest, RawReply, Logger>,
  request: FastifyRequest<RouteGeneric, RawServer, RawRequest, ContextConfig, Logger>,
  reply: FastifyReply<RawServer, RawRequest, RawReply, RouteGeneric, ContextConfig>
) => T.Effect<R, never, void | Promise<RouteGeneric["Reply"] | void>>

function routeOptions<RouteHandler>(
  opts: RouteShorthandOptions | RouteHandler,
  handler?: RouteHandler
): [handler: any, opts: any] {
  if (handler) {
    return [handler as any, opts as any]
  }
  return [opts as any, {} as any]
}

const match =
  (method: HTTPMethods) =>
  <RouteHandler extends EffectHandler<any, any, any, any, any, any, any>>(
    url: string,
    opts: RouteShorthandOptions | RouteHandler,
    handler?: RouteHandler
  ): T.RIO<
    Has<FastifyApp> &
      _R<
        RouteHandler extends EffectHandler<infer R, any, any, any, any, any, any>
          ? T.RIO<R, void>
          : never
      >,
    void
  > => {
    const [_handler, _opts] = routeOptions<RouteHandler>(opts, handler)
    return withFastifyRuntime(_handler)["|>"](
      T.chain((handler) =>
        withFastifyInstance["|>"](
          T.chain((app) =>
            T.succeedWith(() => {
              app.route({ ..._opts, ...{ method, url, handler } })
            })
          )
        )
      )
    )
  }

export interface FastifyApp extends _A<typeof makeFastifyApp> {}
export const LiveFastifyApp = L.fromEffect(FastifyApp)(makeFastifyApp)

export const { inject, listen } = T.deriveLifted(FastifyApp)(
  ["listen", "inject"],
  [],
  []
)

export const get = match("GET")
export const post = match("POST")
const delete_ = match("DELETE")
export { delete_ as delete }
export const put = match("PUT")
export const patch = match("PATCH")
export const options = match("OPTIONS")
export const head = match("HEAD")
