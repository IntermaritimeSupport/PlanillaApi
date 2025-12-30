import cors from 'cors'
import { CorsConfig } from '../config/corsConfig.js'

const origins = (CorsConfig.ORIGINS ?? '').split(',').filter(origin => origin)

const corsMiddleware = cors({
  allowedHeaders: ['Content-Type', 'Authorization'],
  origin: origins,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true
})

export { corsMiddleware }