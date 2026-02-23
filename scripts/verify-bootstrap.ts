import { fileSize, resolveRepoPath, assertFileExists, runStep } from "./lib/io";

function main(): void {
  const packageJson = resolveRepoPath("package.json");
  const tsconfig = resolveRepoPath("tsconfig.json");
  const srcIndex = resolveRepoPath("src", "index.ts");
  const readme = resolveRepoPath("README.md");

  const checks = [
    runStep("package.json exists", () => assertFileExists(packageJson)),
    runStep("tsconfig.json exists", () => assertFileExists(tsconfig)),
    runStep("src/index.ts exists", () => assertFileExists(srcIndex)),
    runStep("README.md exists", () => assertFileExists(readme)),
    runStep("README.md non-trivial size", () => {
      const size = fileSize(readme);
      if (size < 500) {
        throw new Error("README.md too small: " + String(size) + " bytes");
      }
    }),
  ];

  for (const c of checks) {
    if (c.ok) {
      console.log("PASS:", c.name, "(" + c.durationMs + " ms)");
    } else {
      console.error("FAIL:", c.name, "(" + c.durationMs + " ms)", "-", c.error ?? "Unknown error");
    }
  }

  const failed = checks.filter((c) => !c.ok).length;
  if (failed > 0) {
    throw new Error("Bootstrap verification failed (" + String(failed) + " checks)");
  }

  console.log("Bootstrap verification PASS");
}

main();