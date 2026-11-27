import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiToken } from "../services/authToken";
import { ApiClientError } from "../services/httpClient";
import {
  enrollLocalEmployee,
  resetLocalEmployeePassword,
  startLocalEmployeePasswordReset,
  startLocalEmployeeSignIn,
  verifyLocalEmployeeSignIn,
} from "../services/api";

vi.mock("../services/authToken", () => ({
  getApiToken: vi.fn(),
}));

function mockJsonResponse(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as Response);
}

const localAuthCalls = [
  {
    name: "employee sign-in",
    call: () => startLocalEmployeeSignIn("42", "current-password"),
    path: "/api/auth/local/start",
    body: { employeeId: "42", password: "current-password" },
    response: { challengeId: "sign-in-challenge", emailHint: "••••1234" },
  },
  {
    name: "OTP verification",
    call: () => verifyLocalEmployeeSignIn("sign-in-challenge", "123456"),
    path: "/api/auth/local/verify",
    body: { challengeId: "sign-in-challenge", code: "123456" },
    response: { accessToken: "employee-token" },
  },
  {
    name: "password enrollment",
    call: () => enrollLocalEmployee("enrollment-challenge", "new-password-value"),
    path: "/api/auth/local/enroll",
    body: { enrollmentToken: "enrollment-challenge", newPassword: "new-password-value" },
    response: { accessToken: "enrolled-token" },
  },
  {
    name: "password recovery",
    call: () => startLocalEmployeePasswordReset("42"),
    path: "/api/auth/local/forgot-password",
    body: { employeeId: "42" },
    response: { challengeId: "reset-challenge" },
  },
  {
    name: "password reset",
    call: () => resetLocalEmployeePassword("reset-challenge", "123456", "new-password-value"),
    path: "/api/auth/local/forgot-password/verify",
    body: { challengeId: "reset-challenge", code: "123456", newPassword: "new-password-value" },
    response: { accessToken: "reset-token" },
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getApiToken).mockRejectedValue(new Error("No bearer token exists before sign-in"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("local employee authentication API", () => {
  it.each(localAuthCalls)("posts $name without requiring a bearer token", async ({ call, path, body, response }) => {
    const fetchMock = mockJsonResponse(200, response);

    await expect(call()).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestPath, requestInit] = fetchMock.mock.calls[0]!;
    const headers = new Headers(requestInit?.headers);
    expect(requestPath).toBe(path);
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.body).toBe(JSON.stringify(body));
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.has("Authorization")).toBe(false);
    expect(getApiToken).not.toHaveBeenCalled();
  });

  it("preserves backend authentication errors at the shared client boundary", async () => {
    const fetchMock = mockJsonResponse(401, { error: "Invalid employee ID or password" });
    const request = startLocalEmployeeSignIn("42", "wrong-password");
    await expect(request).rejects.toMatchObject({
      name: "Error",
      status: 401,
      message: "Invalid employee ID or password",
    });
    await expect(request).rejects.toBeInstanceOf(ApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getApiToken).not.toHaveBeenCalled();
  });
});
