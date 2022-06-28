import { pipe } from "@effect-ts/core"
import * as T from "@effect-ts/core/Effect"
import * as L from "@effect-ts/core/Effect/Layer"
import { tag } from "@effect-ts/core/Has"
import type { FastifyReply, FastifyRequest } from "fastify"

import * as Fastify from "../src"

describe("fastify", () => {
  test("Should infer handler environment", async () => {
    interface MessageService {
      _tag: "@demo/MessageService"
      makeMessage: T.UIO<string>
    }

    const MessageService = tag<MessageService>()

    const LiveMessageService = L.fromEffect(MessageService)(
      T.succeedWith(() => ({
        _tag: "@demo/MessageService",
        makeMessage: T.succeedWith(() => "OK")
      }))
    )

    const handler = (_request: FastifyRequest, reply: FastifyReply) =>
      T.gen(function* (_) {
        const messageService = yield* _(MessageService)
        const message = yield* _(messageService.makeMessage)
        reply.send(message)
      })

    const response = await pipe(
      T.gen(function* (_) {
        yield* _(Fastify.get("/", handler))
        return yield* _(Fastify.inject({ method: "GET", url: "/" }))
      }),
      T.provideSomeLayer(Fastify.FastifyLive),
      T.provideSomeLayer(LiveMessageService),
      T.runPromise
    )
    expect(response.statusCode).toEqual(200)
    expect(response.body).toEqual("OK")
  })

  test("Should listen", async () => {
    const host = "127.0.0.1"
    const port = 3115

    const response = await pipe(
      T.gen(function* (_) {
        yield* _(
          Fastify.get("/", (_request, reply) =>
            T.gen(function* (_) {
              return yield* _(
                T.succeedWith(() => {
                  reply.send("OK")
                })
              )
            })
          )
        )

        yield* _(Fastify.listen(port, host))
        const response = yield* _(
          T.tryPromise(() => fetch(`http://${host}:${port}/`).then((x) => x.text()))
        )
        yield* _(Fastify.close())

        return response
      }),
      T.provideSomeLayer(Fastify.FastifyLive),
      T.runPromise
    )

    expect(response).toEqual("OK")
  })
})
