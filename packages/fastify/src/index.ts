import { pipe } from "@effect-ts/core"
import * as T from "@effect-ts/core/Effect"
import * as L from "@effect-ts/core/Effect/Layer"
import type { Has } from "@effect-ts/core/Has"
import { tag } from "@effect-ts/core/Has"
import type { _A, _R } from "@effect-ts/core/Utils"
import { Tagged } from "@effect-ts/system/Case"
import type {
  ContextConfigDefault,
  FastifyLoggerInstance,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  FastifyTypeProvider,
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
import {
  FastifyRequestType,
  FastifyTypeProviderDefault,
  ResolveFastifyReplyReturnType,
  ResolveFastifyRequestType
} from "fastify/types/type-provider"

export type EffectHandler<
  R,
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface,
  ContextConfig = ContextConfigDefault,
  SchemaCompiler extends FastifySchema = FastifySchema,
  TypeProvider extends FastifyTypeProvider = FastifyTypeProviderDefault,
  RequestType extends FastifyRequestType = ResolveFastifyRequestType<
    TypeProvider,
    SchemaCompiler,
    RouteGeneric
  >,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance
> = (
  request: FastifyRequest<
    RouteGeneric,
    RawServer,
    RawRequest,
    SchemaCompiler,
    TypeProvider,
    ContextConfig,
    RequestType,
    Logger
  >,
  reply: FastifyReply<
    RawServer,
    RawRequest,
    RawReply,
    RouteGeneric,
    ContextConfig,
    SchemaCompiler,
    TypeProvider
  >
) => T.Effect<
  Has<Fastify> & R,
  never,
  ResolveFastifyReplyReturnType<TypeProvider, SchemaCompiler, RouteGeneric>
>

function runHandler<Handler extends EffectHandler<any, any, any, any, any, any, any>>(
  handler: Handler
) {
  return pipe(
    server,
    T.chain((server) =>
      T.map_(
        T.runtime<
          _R<
            [Handler] extends [EffectHandler<infer R, any, any, any, any, any, any>]
              ? T.RIO<R, void>
              : never
          >
        >(),
        (r) => {
          return (request: FastifyRequest, reply: FastifyReply) =>
            r.runPromise(handler.call(server, request, reply))
        }
      )
    )
  )
}

export class FastifyListenError extends Tagged("FastifyListenError")<unknown> {}

export class FastifyInjectError extends Tagged("FastofyInjectError")<{
  readonly error: Error | null
}> {}

export class FastifyPluginError extends Tagged("FastifyPluginError")<{
  readonly error: Error | null
}> {}

const FastifySymbol = Symbol.for("@tcmlabs/effect-ts-fastify")

export const makeFastify = T.succeedWith(() => {
  const server = fastify()

  const listen = (port: number | string, address: string) =>
    T.effectAsync<unknown, FastifyListenError, void>((resume) => {
      server.listen(port, address, (error) => {
        if (error) {
          resume(T.fail(new FastifyListenError(error)))
        } else {
          resume(T.unit)
        }
      })
    })

  const inject = (opts: InjectOptions | string) =>
    T.effectAsync<unknown, FastifyInjectError, LightMyRequestResponse>((resume) => {
      server.inject(opts, function (error: Error, response: LightMyRequestResponse) {
        if (error) {
          resume(T.fail(new FastifyInjectError({ error })))
        } else {
          resume(T.succeed(response))
        }
      })
    })

  const close = () =>
    T.effectAsync<Has<Fastify>, never, void>((resume) => {
      server.close(() => resume(T.unit))
    })

  const after = () =>
    T.effectAsync<unknown, FastifyPluginError, void>((cb) => {
      server.after().then(
        () => cb(T.unit),
        (error) => cb(T.fail(new FastifyPluginError({ error })))
      )
    })

  return {
    _tag: FastifySymbol,
    instance: server,
    server,
    listen,
    close,
    inject,
    after
  }
})
export const Fastify = tag<Fastify>(FastifySymbol)
export interface Fastify extends _A<typeof makeFastify> {}
export const FastifyLive = L.fromEffect(Fastify)(makeFastify)

export const { after, close, inject, listen, server } = T.deriveLifted(Fastify)(
  ["listen", "close", "inject", "after"],
  [],
  ["server"]
)

const match =
  (method: HTTPMethods) =>
  <Handler extends EffectHandler<any, any, any, any, any, any, any>>(
    url: string,
    opts: RouteShorthandOptions | Handler,
    handler?: Handler
  ): T.RIO<
    Has<Fastify> &
      _R<
        [Handler] extends [EffectHandler<infer R, any, any, any, any, any, any>]
          ? T.RIO<R, void>
          : never
      >,
    void
  > => {
    const _handler = (handler ? handler : opts) as any
    const _opts = (handler ? opts : {}) as any

    return runHandler(_handler)["|>"](
      T.chain((handler) =>
        server["|>"](
          T.map((server) => server.route({ ..._opts, ...{ method, url, handler } }))
        )
      )
    )
  }

export const get = match("GET")
export const post = match("POST")
const delete_ = match("DELETE")
export { delete_ as delete }
export const put = match("PUT")
export const patch = match("PATCH")
export const options = match("OPTIONS")
export const head = match("HEAD")
