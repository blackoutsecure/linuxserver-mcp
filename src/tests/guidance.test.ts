/**
 * LinuxServer.io MCP Server
 * Module: Guidance and skillset catalog unit tests
 * Standards basis: LSIO references and workflow skillset guidance
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getBestPractices, getGuidanceLinks, getOptimizationIdeas, getSkillsets } from "../guidance.js";

test("getGuidanceLinks returns expected focused topic payload", () => {
  const links = getGuidanceLinks("permissions");

  assert.ok(typeof links.nonRoot === "string");
  assert.ok(typeof links.puidPgid === "string");
  assert.equal(links.readOnly, undefined);
});

test("getBestPractices includes skillsets profile", () => {
  const payload = getBestPractices("skillsets");

  assert.ok(Array.isArray(payload.skillsets));
  assert.ok(payload.skillsets.some((item) => item.includes("Image discovery")));
});

test("getSkillsets returns filtered profile", () => {
  const payload = getSkillsets("review");

  assert.equal(payload.skillsets.length, 1);
  assert.equal(payload.skillsets[0]?.id, "review");
  assert.ok(payload.skillsets[0]?.checks.length);
});

test("getOptimizationIdeas returns requested scoped ideas", () => {
  const payload = getOptimizationIdeas("release");

  assert.ok(Array.isArray(payload.release));
  assert.ok(payload.release.some((item) => item.includes("release")));
});
