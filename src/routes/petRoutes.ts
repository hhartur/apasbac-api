import { Router } from "express";
import type { RouterWithPath } from "../../types";

const route = Router() as RouterWithPath;

route.path = "/pets";

route.get("/", (_, res) => {
  return res.status(200).json({ message: "Pets Online 🍃" });
});

export default route;