import { pipe } from "@effect-ts/core"
import * as T from "@effect-ts/core/Effect"
import * as N from "@effect-ts/node/Runtime"
import { get, listen, FastifyLive } from "../packages/fastify/src"

pipe(
  T.gen(function* (_) {
    yield* _(
      get("/", (_request, _reply) =>
        T.succeedWith(() => {
          return "OK"
        })
      )
    )

    yield* _(listen(3000, "localhost"))
    console.log("listening to localhost:3000!")
    yield* _(T.never)
  }),
  T.provideSomeLayer(FastifyLive),
  N.runMain
)
