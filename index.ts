import { Application, Router } from "https://deno.land/x/oak@v17.1.0/mod.ts";
import { ensureDirSync } from "https://deno.land/std/fs/ensure_dir.ts";
import { walk } from "https://deno.land/std/fs/walk.ts";
import { join } from "https://deno.land/std/path/mod.ts";

// Define interfaces
interface BrainData {
  inputLayer: number[];
  hiddenLayer: number[];
  hiddenLayer2: number[];
  outputLayer: number[];
}

interface ModelData {
  name: string;
  score: number;
  data: BrainData | null;
}

// Initialize application
const app = new Application();
const router = new Router();

// Enable CORS
app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  ctx.response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
  
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 200;
    return;
  }
  
  await next();
});

// Ensure data directory exists
ensureDirSync("./data");

// Get list of saved models
async function getSavedModels(): Promise<ModelData[]> {
  const models: ModelData[] = [];
  for await (const entry of walk("./data", { exts: [".json"] })) {
    try {
      const content = await Deno.readTextFile(entry.path);
      const model = JSON.parse(content);
      models.push({
        name: entry.name.replace(".json", ""),
        ...model,
      });
    } catch (err) {
      console.error(`Error reading model ${entry.name}:`, err);
    }
  }
  return models;
}

// Initialize current model
let currentModel: ModelData = {
  name: "default",
  score: 0,
  data: null,
};

// Load initial model
const savedModels = await getSavedModels();
if (savedModels.length > 0) {
  currentModel = savedModels.reduce((prev, current) => 
    (current.score > prev.score) ? current : prev
  );
  console.log(`Loaded model: ${currentModel.name} with score: ${currentModel.score}`);
}

// Routes
router
  .get("/", async (ctx) => {
    try {
      await ctx.send({
        root: Deno.cwd(),
        index: "index.html",
      });
    } catch (err) {
      console.error("Error serving index.html:", err);
      ctx.response.status = 404;
      ctx.response.body = "File not found";
    }
  })
  .get("/api/models", async (ctx) => {
    ctx.response.body = await getSavedModels();
  })
  .get("/api/current-model", (ctx) => {
    ctx.response.body = currentModel;
  })
  .post("/api/save-model", async (ctx) => {
    try {
      const body = await ctx.request.body.json();
      const value = await body.value;
      const { score, data } = value;

      if (score > currentModel.score) {
        currentModel = {
          ...currentModel,
          score,
          data,
        };

        // Save to file
        const fileName = `${currentModel.name}.json`;
        await Deno.writeTextFile(
          join("data", fileName),
          JSON.stringify(currentModel, null, 2)
        );

        ctx.response.body = { success: true, message: "Model saved successfully" };
      } else {
        ctx.response.body = { 
          success: false, 
          message: "New score not higher than current best" 
        };
      }
    } catch (err) {
      console.error("Error saving model:", err);
      ctx.response.status = 500;
      ctx.response.body = { success: false, message: "Error saving model" };
    }
  });

// Middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Serve static files
app.use(async (ctx) => {
  try {
    await ctx.send({
      root: Deno.cwd(),
      index: "index.html",
    });
  } catch {
    ctx.response.status = 404;
    ctx.response.body = "File not found";
  }
});

// Start server
const port = 3000;
console.log(`Server running at http://localhost:${port}`);
await app.listen({ port });