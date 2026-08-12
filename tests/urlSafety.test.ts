import { describe, expect, it } from "vitest";
import { isPrivateIp } from "../src/security/urlSafety";

describe("URL safety", () => {
  it("blocks localhost and private ranges", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.4")).toBe(true);
    expect(isPrivateIp("192.168.1.10")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
  });

  it("allows public ipv4 addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
});
