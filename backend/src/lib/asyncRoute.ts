import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not await route handlers, so a promise that rejects inside one
 * never reaches the error middleware. It surfaces as an unhandledRejection and
 * the request is simply left open until the client gives up.
 *
 * That was the worst kind of failure here. If Postgres went down, GET
 * /api/projects never responded at all, so the frontend's fetch never settled,
 * its .catch() never ran, and the work section sat on loading skeletons
 * indefinitely - a failure it could not even report, let alone recover from.
 *
 * Wrapping a handler forwards the rejection to next(), where the error
 * middleware turns it into a 500 the client can actually act on.
 */
export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
