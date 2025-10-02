import express, { Router } from 'express';
// Rotas
import petRoutes from './routes/petRoutes.ts'
import authRoutes from './routes/authRoutes.ts'

const Application = express();

const api = Router();

api.use("/auth", authRoutes)
api.use("/pets", petRoutes)

Application.use("/api", api)

export default Application;