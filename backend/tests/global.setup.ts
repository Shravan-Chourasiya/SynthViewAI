/**
 * tests/global.setup.ts
 * Global setup for container lifecycle management.
 * For now, keeping simple to avoid issues with unit tests that don't need containers.
 * Container setup is handled per integration test file.
 */

// Export empty setup/teardown to satisfy the globalSetup configuration
// Container lifecycle is managed per integration test file instead
export default async function globalSetup() {
  // No global containers initialization for now to avoid issues with unit tests
  console.log("Global setup initialized (no containers)");
  
  return async () => {
    console.log("Global setup cleanup (no containers to clean)");
  };
}