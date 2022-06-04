// tracing: off
import { pipe } from "@effect-ts/core"
import * as T from "@effect-ts/core/Effect"
import * as L from "@effect-ts/core/Effect/Layer"
import type { Has } from "@effect-ts/core/Has"
import { tag } from "@effect-ts/core/Has"
import type { _A, _R } from "@effect-ts/core/Utils"
import { Tagged } from "@effect-ts/system/Case"
import type {
  ContextConfigDefault,
  FastifyInstance,
  FastifyLoggerInstance,
  FastifyPluginOptions,
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

export class FastifyListenError extends Tagged("FastifyListenError")<{
  readonly error: Error | null
}> {}

export class FastifyInjectError extends Tagged("FastofyInjectError")<{
  readonly error: Error | null
}> {}

export class FastifyPluginError extends Tagged("FastifyPluginError")<{
  readonly error: Error | null
}> {}

const FastifySymbol = Symbol.for("@tcmlabs/effect-ts-fastify")

export const makeLiveFastify = T.succeedWith(() => ({
  _tag: FastifySymbol,
  instance: fastify()
}))

export const Fastify = tag<Fastify>(FastifySymbol)
export interface Fastify extends _A<typeof makeLiveFastify> {}
export const LiveFastify = L.fromEffect(Fastify)(makeLiveFastify)

export const accessInstance = T.accessService(Fastify)((_) => _.instance)

export function listen(
  port: number | string,
  address: string
): T.Effect<Has<Fastify>, FastifyListenError, void> {
  return pipe(
    accessInstance,
    T.chain((instance) =>
      T.effectAsync<unknown, FastifyListenError, void>((resume) => {
        instance.listen(port, address, (error) => {
          if (error) {
            resume(T.fail(new FastifyListenError({ error })))
          } else {
            resume(T.unit)
          }
        })
      })
    )
  )
}

export function close(): T.Effect<Has<Fastify>, never, void> {
  return pipe(
    accessInstance,
    T.chain((instance) =>
      T.effectAsync<Has<Fastify>, never, void>((resume) => {
        instance.close(() => resume(T.unit))
      })
    )
  )
}

export function inject(opts: InjectOptions | string) {
  return pipe(
    accessInstance,
    T.chain((instance) =>
      T.effectAsync<unknown, FastifyInjectError, LightMyRequestResponse>((resume) => {
        instance.inject(
          opts,
          function (error: Error, response: LightMyRequestResponse) {
            if (error) {
              resume(T.fail(new FastifyInjectError({ error })))
            } else {
              resume(T.succeed(response))
            }
          }
        )
      })
    )
  )
}

export type EffectHandler<
  R,
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface,
  ContextConfig = ContextConfigDefault,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance
> = (
  request: FastifyRequest<RouteGeneric, RawServer, RawRequest, ContextConfig, Logger>,
  reply: FastifyReply<RawServer, RawRequest, RawReply, RouteGeneric, ContextConfig>
) => T.Effect<R, never, void | Promise<RouteGeneric["Reply"] | void>>

function runHandler<Handler extends EffectHandler<any, any, any, any, any, any, any>>(
  handler: Handler
) {
  return pipe(
    accessInstance,
    T.chain((instance) =>
      T.map_(
        T.runtime<
          _R<
            [Handler] extends [EffectHandler<infer R, any, any, any, any, any, any>]
              ? T.RIO<R, void>
              : never
          >
        >(),
        (r) => {
          return (request: FastifyRequest, reply: FastifyReply) => {
            r.runFiber(handler.call(instance, request, reply))
          }
        }
      )
    )
  )
}

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
    const _opts = (handler ? {} : handler) as any

    return runHandler(_handler)["|>"](
      T.chain((handler) =>
        accessInstance["|>"](
          T.map((instance) => instance.route({ ..._opts, ...{ method, url, handler } }))
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

export type EffectPlugin<
  R,
  Options extends FastifyPluginOptions = Record<never, never>,
  Server extends RawServerBase = RawServerDefault
> = (
  instance: FastifyInstance<
    Server,
    RawRequestDefaultExpression<Server>,
    RawReplyDefaultExpression<Server>
  >,
  opts: Options
) => T.Effect<Has<Fastify> & R, FastifyPluginError, void>

export function runPlugin<P extends EffectPlugin<any, any, any>>(plugin: P) {
  return pipe(
    T.map_(
      T.runtime<
        _R<[P] extends [EffectPlugin<infer R, any, any>] ? T.RIO<R, void> : never>
      >(),
      (r) => {
        return (
          instance: [P] extends [EffectPlugin<any, any, infer S>]
            ? FastifyInstance<
                S,
                RawRequestDefaultExpression<S>,
                RawReplyDefaultExpression<S>
              >
            : never,
          options: [P] extends [EffectPlugin<any, infer O, any>] ? O : never,
          done: (err?: Error) => void
        ) => {
          r.runPromise(plugin(instance, options))
            .then(() => done())
            .catch(done)
        }
      }
    )
  )
}

export const register = <R, Options extends FastifyPluginOptions>(
  plugin: EffectPlugin<R, Options>,
  opts?: Options
) =>
  T.gen(function* (_) {
    const server = yield* _(accessInstance)
    const fastifyPlugin = yield* _(runPlugin(plugin))
    server.register(fastifyPlugin, opts)
  })

export const after = () =>
  T.gen(function* (_) {
    const server = yield* _(accessInstance)
    yield* _(
      T.effectAsync<unknown, FastifyPluginError, void>((cb) => {
        server.after().then(
          () => cb(T.unit),
          (error) => cb(T.fail(new FastifyPluginError({ error })))
        )
      })
    )
  })
