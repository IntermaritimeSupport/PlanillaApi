import { Request, Response } from 'express'

type Middleware = (req: Request, res: Response, next: (result?: unknown) => void) => void

export default function initMiddleware(middleware: Middleware) {
    return (req: Request, res: Response) =>
      new Promise((resolve, reject) => {
        middleware(req, res, (result) => {
          if (result instanceof Error) {
            return reject(result)
          }
          return resolve(result)
        })
      })
  }
  