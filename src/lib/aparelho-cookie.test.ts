import { describe, expect, it } from "vitest";
import { opcoesCookieAparelho } from "./aparelho-cookie";

describe("identificação de aparelho na prévia incorporada", () => {
  it("permite envio na prévia HTTPS com isolamento e token inacessível ao JavaScript", () => {
    expect(opcoesCookieAparelho("https://app.example/auth")).toEqual({
      httpOnly: true, secure: true, sameSite: "none", partitioned: true,
      path: "/", maxAge: 15552000,
    });
  });
  it("não emite SameSite=None sem Secure no desenvolvimento local", () => {
    expect(opcoesCookieAparelho("http://localhost:8080/auth")).toEqual({
      httpOnly: true, secure: false, sameSite: "lax",
      path: "/", maxAge: 15552000,
    });
  });
});