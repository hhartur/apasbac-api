import { Router } from "express";
import type { RouterWithPath } from "../../types";

const route = Router() as RouterWithPath;

route.path = "/auth";

route.get("/", (_, res) => {
  return res.status(200).json({ message: "Auth online 🍃" });
});

export default route;