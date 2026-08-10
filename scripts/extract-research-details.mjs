import fs from "node:fs";
import path from "node:path";
import { parse } from "acorn";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Usage: node scripts/extract-research-details.mjs <research-site-bundle.js>");
}

const source = fs.readFileSync(sourcePath, "utf8");
const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
const declarations = new Map();

for (const statement of ast.body) {
  if (statement.type !== "VariableDeclaration") continue;
  for (const declaration of statement.declarations) {
    if (declaration.id.type === "Identifier" && declaration.init) {
      declarations.set(declaration.id.name, declaration.init);
    }
  }
}

const cache = new Map();

function evaluate(node) {
  if (!node) return null;
  if (node.type === "Literal") return node.value;
  if (node.type === "ArrayExpression") return node.elements.map(evaluate);
  if (node.type === "ObjectExpression") {
    return Object.fromEntries(
      node.properties
        .filter((property) => property.type === "Property")
        .map((property) => {
          const key = property.computed
            ? evaluate(property.key)
            : property.key.type === "Identifier"
              ? property.key.name
              : property.key.value;
          return [key, evaluate(property.value)];
        })
    );
  }
  if (node.type === "Identifier") {
    if (cache.has(node.name)) return cache.get(node.name);
    const declaration = declarations.get(node.name);
    if (!declaration) return null;
    const value = evaluate(declaration);
    cache.set(node.name, value);
    return value;
  }
  if (node.type === "UnaryExpression") {
    const value = evaluate(node.argument);
    if (node.operator === "-") return -value;
    if (node.operator === "+") return +value;
    if (node.operator === "!") return !value;
  }
  return null;
}

const audiences = evaluate(declarations.get("et"));
const stages = evaluate(declarations.get("ya"));
const focusNotes = evaluate(declarations.get("v4"));
const illustrations = evaluate(declarations.get("dr"));

if (!Array.isArray(audiences) || !Array.isArray(stages) || !illustrations) {
  throw new Error("Research data declarations were not found in the supplied bundle.");
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(projectRoot, "public", "audience-stages");
fs.mkdirSync(outputDir, { recursive: true });

function saveDataImage(dataUri, filename) {
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:image/")) return null;
  const match = dataUri.match(/^data:image\/([^;]+);base64,(.+)$/s);
  if (!match) return null;
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const finalName = `${filename}.${extension}`;
  fs.writeFileSync(path.join(outputDir, finalName), Buffer.from(match[2], "base64"));
  return `audience-stages/${finalName}`;
}

const output = audiences.map((audience) => ({
  id: audience.id,
  label: audience.label,
  subLabel: audience.subLabel,
  accent: audience.accent,
  stages: Object.fromEntries(
    stages.map((stage) => {
      const detail = audience.stages[stage.key];
      const examples = Array.isArray(detail.exampleImages)
        ? detail.exampleImages
        : detail.exampleImages
          ? [detail.exampleImages]
          : [];
      return [
        stage.key,
        {
          no: stage.no,
          name: stage.name,
          time: stage.time,
          focus: stage.focus,
          phaseDescription: focusNotes[stage.key],
          illustration: saveDataImage(
            illustrations[audience.id]?.[stage.key],
            `${audience.id}-${stage.key}`
          ),
          summary: detail.summary,
          details: detail.details,
          example: detail.example,
          exampleImages: examples
            .map((image, index) =>
              saveDataImage(image, `${audience.id}-${stage.key}-example-${index + 1}`)
            )
            .filter(Boolean),
          sources: detail.sources ?? [],
        },
      ];
    })
  ),
}));

fs.writeFileSync(
  path.join(projectRoot, "app", "data", "audience-stage-details.json"),
  `${JSON.stringify(output, null, 2)}\n`
);

console.log(`Extracted ${output.length * stages.length} audience-stage records.`);
