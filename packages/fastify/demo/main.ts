import { pipe } from "@effect-ts/core"
import * as T from "@effect-ts/core/Effect"
import * as N from "@effect-ts/node/Runtime"
import type { FastifyReply, FastifyRequest } from "fastify"

import * as Fastify from "../src"

const handler = (_request: FastifyRequest, reply: FastifyReply) =>
  T.gen(function* (_) {
    const message = yield* _(T.succeed("OK"))
    reply.send(message)
  })

const program = T.gen(function* (_) {
  yield* _(Fastify.get("/", handler))
  yield* _(Fastify.listen(3000, "localhost"))
})

pipe(program, T.provideSomeLayer(Fastify.LiveFastify), N.runMain)
