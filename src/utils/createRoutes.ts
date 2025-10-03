import { Router } from "express";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const routes = Router();

const routesFolder = path.join(process.cwd(), "src", "routes");

async function loadRoutesFromFolder(folderPath: string) {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    if (filePath === import.meta.url) continue;

    if (fs.statSync(filePath).isDirectory()) {
      await loadRoutesFromFolder(filePath);
      continue;
    }

    if (!file.endsWith(".ts") || file.endsWith(".d.ts")) continue;

    try {
      const module = await import(pathToFileURL(filePath).href);

      const route = module.default;
      const routePath = route?.path;

      if (!route || !routePath) continue;

      if (typeof route !== "function" || typeof routePath !== "string") continue;

      routes.use(routePath, route);
      console.log(`✅ Rota carregada: [${routePath}] ← ${file}`);
    } catch (error) {
      console.error(`❌ Erro ao carregar ${file}:`, error);
    }
  }
}

export async function createRoutes() {
  await loadRoutesFromFolder(routesFolder);
  return routes;
}
