import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { UserProvider, useUser } from "../app/auth/UserContext";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
  } as Response);
}

function TestConsumer() {
  const { user, isAuthenticated, setUser } = useUser();
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="user">{user ? user.name : "null"}</span>
      <span data-testid="role">{user ? user.role : "null"}</span>
      <button data-testid="login" onClick={() => setUser({
        id: "user-3", name: "Sipho Nkosi", email: "sipho@hb.co.za",
        passwordHash: "", role: "approver", teamMemberNumber: "HB-10001",
        department: "Marketing", position: "Line Manager", lineManager: null,
      })}>Login</button>
      <button data-testid="logout" onClick={() => setUser(null)}>Logout</button>
    </div>
  );
}

describe("UserContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts unauthenticated with no stored session", () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("sets user and isAuthenticated on login", () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    act(() => { screen.getByTestId("login").click(); });
    expect(screen.getByTestId("auth").textContent).toBe("yes");
    expect(screen.getByTestId("user").textContent).toBe("Sipho Nkosi");
    expect(screen.getByTestId("role").textContent).toBe("approver");
  });

  it("persists user id to localStorage on login", () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    act(() => { screen.getByTestId("login").click(); });
    const stored = localStorage.getItem("ghe.auth.user");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.id).toBe("user-3");
  });

  it("clears user and localStorage on logout", () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    act(() => { screen.getByTestId("login").click(); });
    expect(screen.getByTestId("auth").textContent).toBe("yes");

    act(() => { screen.getByTestId("logout").click(); });
    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(localStorage.getItem("ghe.auth.user")).toBeNull();
  });

  it("restores session from localStorage on mount", async () => {
    mockFetch(200, {
      id: "user-3", name: "Sipho Nkosi", email: "sipho@hb.co.za",
      passwordHash: "", role: "approver", teamMemberNumber: "HB-10001",
      department: "Marketing", position: "Line Manager", lineManager: null,
    });
    localStorage.setItem("ghe.auth.token", "valid-token");
    localStorage.setItem("ghe.auth.user", JSON.stringify({ id: "user-3" }));

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth").textContent).toBe("yes");
    });
    expect(screen.getByTestId("user").textContent).toBe("Sipho Nkosi");
  });

  it("handles corrupted localStorage gracefully", async () => {
    localStorage.setItem("ghe.auth.token", "stale-token");
    localStorage.setItem("ghe.auth.user", "not-json-at-all");
    mockFetch(401, { error: "Unauthorized" });

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth").textContent).toBe("no");
    });
    expect(localStorage.getItem("ghe.auth.user")).toBeNull();
  });

  it("handles stale localStorage (deleted user) gracefully", async () => {
    localStorage.setItem("ghe.auth.token", "stale-token");
    localStorage.setItem("ghe.auth.user", JSON.stringify({ id: "user-99999" }));
    mockFetch(401, { error: "Unauthorized" });

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth").textContent).toBe("no");
    });
  });
});
