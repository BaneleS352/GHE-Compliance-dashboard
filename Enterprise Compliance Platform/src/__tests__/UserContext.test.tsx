import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { UserProvider, useUser } from "../app/auth/UserContext";
import { activeAccount, initializeIdentity } from "../app/auth/msal";

vi.mock("../app/auth/msal", () => ({
  activeAccount: vi.fn(() => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getApiToken: vi.fn(() => Promise.resolve("msal-test-token")),
  initializeIdentity: vi.fn(() => Promise.resolve()),
}));

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
  } as Response);
}

function TestConsumer() {
  const { user, isAuthenticated, setUser, loading } = useUser();
  return (
    <div>
      <span data-testid="loading">{loading ? "loading" : "ready"}</span>
      <span data-testid="auth">{isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="user">{user ? user.name : "null"}</span>
      <span data-testid="role">{user ? user.role : "null"}</span>
      <button data-testid="login" onClick={() => setUser({
        id: 3, name: "Sipho Nkosi", email: "sipho@hb.co.za",
        role: "approver", teamMemberNumber: "HB-10001",
        department: "Marketing", position: "Line Manager", lineManager: null,
      })}>Login</button>
      <button data-testid="logout" onClick={() => setUser(null)}>Logout</button>
    </div>
  );
}

describe("UserContext", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(initializeIdentity).mockResolvedValue(undefined);
    vi.mocked(activeAccount).mockReturnValue(null);
  });

  it("starts unauthenticated when there is no provider account", async () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("ready"));
    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("resolves the user from the API when a provider account exists", async () => {
    vi.mocked(activeAccount).mockReturnValue({ username: "sipho@hb.co.za" } as never);
    mockFetch(200, {
      id: 3, name: "Sipho Nkosi", email: "sipho@hb.co.za",
      role: "approver", teamMemberNumber: "HB-10001",
      department: "Marketing", position: "Line Manager", lineManager: null,
    });
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    await waitFor(() => expect(screen.getByTestId("auth").textContent).toBe("yes"));
    expect(screen.getByTestId("user").textContent).toBe("Sipho Nkosi");
    expect(screen.getByTestId("role").textContent).toBe("approver");
  });

  it("stays unauthenticated when the API rejects the session", async () => {
    vi.mocked(activeAccount).mockReturnValue({ username: "ghost@x.test" } as never);
    mockFetch(401, { error: "Unauthorized" });
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("ready"));
    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("sets user and isAuthenticated on login", async () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("ready"));

    act(() => { screen.getByTestId("login").click(); });
    expect(screen.getByTestId("auth").textContent).toBe("yes");
    expect(screen.getByTestId("user").textContent).toBe("Sipho Nkosi");
    expect(screen.getByTestId("role").textContent).toBe("approver");
  });

  it("clears user on logout", async () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("ready"));

    act(() => { screen.getByTestId("login").click(); });
    expect(screen.getByTestId("auth").textContent).toBe("yes");

    act(() => { screen.getByTestId("logout").click(); });
    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("shows a loading state while identity initializes", async () => {
    let release!: () => void;
    vi.mocked(initializeIdentity).mockReturnValue(new Promise<void>((resolve) => { release = resolve; }));
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("ready"));
  });
});
