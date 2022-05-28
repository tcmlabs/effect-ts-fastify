import { pipe } from "@effect-ts/core";
import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import { tag } from "@effect-ts/core/Has";
import { FastifyReply, FastifyRequest } from "fastify";
import { inject, get, LiveFastifyApp } from "../src";

describe("fastify", () => {
  test("Should handle GET request", async () => {
    interface MessageService {
      _tag: "@demo/MessageService";
      makeMessage: T.UIO<string>;
    }

    const MessageService = tag<MessageService>();

    const LiveMessageService = L.fromEffect(MessageService)(
      T.succeedWith(() => ({
        _tag: "@demo/MessageService",
        makeMessage: T.succeedWith(() => "OK"),
      }))
    );

    const handler = (_request: FastifyRequest, reply: FastifyReply) =>
      T.gen(function* (_) {
        const messageService = yield* _(MessageService);
        const message = yield* _(messageService.makeMessage);
        reply.send(message);
      });

    const response = await pipe(
      T.gen(function* (_) {
        yield* _(get("/", handler));
        return yield* _(inject({ method: "GET", url: "/" }));
      }),
      T.provideSomeLayer(LiveFastifyApp),
      T.provideSomeLayer(LiveMessageService),
      T.runPromise
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual("OK");
  });
});
