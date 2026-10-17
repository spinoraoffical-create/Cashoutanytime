import path from "node:path";
import { pathToFileURL } from "node:url";

const sourceRoot = pathToFileURL(`${path.resolve("src")}${path.sep}`).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    const file = /\.[cm]?[jt]s$/.test(relative) ? relative : `${relative}.ts`;
    return nextResolve(new URL(file, sourceRoot).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
