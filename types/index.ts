import { Router } from "express";

export type RouterWithPath = Router & { path: string };