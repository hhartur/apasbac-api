import express from 'express';

import { createRoutes } from './utils/createRoutes';

const Application = express();

const routes = await createRoutes()
Application.use("/api", routes)

export default Application;