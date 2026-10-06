import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Injectable, NestMiddleware } from "@nestjs/common";

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use = (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header("x-request-id");
    req.requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
    res.setHeader("x-request-id", req.requestId);
    next();
  };
}
