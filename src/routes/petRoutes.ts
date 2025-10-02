import { Router } from "express";

const route = Router();

route.get("/", async (req, res) => {
    const query = req.query;

    const { pet } = query;
    if(!pet) return res.status(400).json({message: "Tipo de animal não fornecido"})
    return res.json({message: `Tipo do animal: ${pet}`});
})

export default route;