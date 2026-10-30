import { beforeEach, describe, expect, test } from "bun:test";
import { LISTEN_BLOCK_REASON, useMicLockStore } from "@/features/voz/mic-lock-store";

beforeEach(() => useMicLockStore.getState().setListenActive(false));

describe("mic-lock-store", () => {
  test("empieza libre", () => {
    expect(useMicLockStore.getState().listenActive).toBe(false);
  });

  test("la escucha activa lo bloquea y al terminar lo libera", () => {
    useMicLockStore.getState().setListenActive(true);
    expect(useMicLockStore.getState().listenActive).toBe(true);
    useMicLockStore.getState().setListenActive(false);
    expect(useMicLockStore.getState().listenActive).toBe(false);
  });

  test("el motivo se dice en español y nombra la escucha", () => {
    expect(LISTEN_BLOCK_REASON).toContain("escucha");
  });
});
