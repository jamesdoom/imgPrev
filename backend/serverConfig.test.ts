import { describe, expect, test } from "vitest";
import { getServerBinding } from "./serverConfig";

describe("getServerBinding", () => {
  test("binds to all interfaces so Render can detect the service", () => {
    expect(getServerBinding({ PORT: "10000" })).toEqual({
      host: "0.0.0.0",
      port: 10000,
    });
  });

  test("allows an explicit host and rejects invalid ports", () => {
    expect(
      getServerBinding({
        HOST: "127.0.0.1",
        PORT: "not-a-port",
      })
    ).toEqual({
      host: "127.0.0.1",
      port: 4000,
    });
  });
});
