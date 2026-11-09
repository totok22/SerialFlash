import test from "node:test";
import assert from "node:assert/strict";
import { releaseChannel } from "../.github/scripts/release-channel.mjs";

test("branch and PR builds cannot select a publishing channel", () => {
  assert.equal(releaseChannel("0.2.2", "branch", "main"), "build");
  assert.equal(releaseChannel("0.2.2", "branch", "v0.2.2-pre.1"), "build");
});

test("only exact numeric version tags select stable releases", () => {
  assert.equal(releaseChannel("0.2.2", "tag", "v0.2.2"), "release");
});

test("prerelease tags always select the prerelease channel", () => {
  assert.equal(releaseChannel("0.2.2", "tag", "v0.2.2-pre.1"), "pre-release");
  assert.equal(releaseChannel("0.2.2", "tag", "v0.2.2-pre.12"), "pre-release");
});

test("mismatched or malformed release tags fail instead of publishing stable", () => {
  for (const tag of ["v0.2.1", "v0.2.3-pre.1", "v0.2.2-pre.0", "v0.2.2-pre.01", "v0.2.2-pre.x", "v0.2.2-rc.1", "v0.2.2-pre.1-extra", "v0.2.2-pre.1\n"]) {
    assert.throws(() => releaseChannel("0.2.2", "tag", tag), /does not match/);
  }
});

test("manifest prerelease suffixes are rejected for Marketplace", () => {
  assert.throws(() => releaseChannel("0.2.2-pre.1", "tag", "v0.2.2-pre.1"), /numeric manifest version/);
});
