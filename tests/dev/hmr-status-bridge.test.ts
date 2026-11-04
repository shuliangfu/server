/**
 * HMR status bridge (__DREAMER_HMR__) — claimUi hides standalone capsule.
 */
import { describe, expect, it } from "@dreamer/test";
import { generateHMRClientScript } from "../../src/dev/hmr-client.ts";

describe("HMR status bridge (devtools takeover)", () => {
  it("compiled client publishes __DREAMER_HMR__ with claimUi / subscribe", async () => {
    const script = await generateHMRClientScript("/__hmr", 3000, "localhost");
    expect(script).toContain("__DREAMER_HMR__");
    expect(script).toContain("claimUi");
    expect(script).toContain("isUiClaimed");
    expect(script).toContain("getSnapshot");
    expect(script).toContain("subscribe");
    // Capsule host marks claimed vs visible
    expect(script).toContain("data-hmr-ui");
  });
});
