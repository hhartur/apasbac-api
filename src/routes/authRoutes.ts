import { Router } from "express";

const route = Router();

route.get("/", (_, res) => {
    return res.json({message: "Online 🍃"}).status(200)
})

export default route;