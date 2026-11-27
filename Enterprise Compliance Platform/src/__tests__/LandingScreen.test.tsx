import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LandingScreen } from "../app/pages/LandingScreen";
import { authenticate } from "../app/auth/authService";
import { setLocalEmployeeToken } from "../app/auth/msal";
import {
  enrollLocalEmployee,
  resetLocalEmployeePassword,
  startLocalEmployeePasswordReset,
  startLocalEmployeeSignIn,
  verifyLocalEmployeeSignIn,
} from "../services/api";

vi.mock("../app/auth/authService", () => ({
  authenticate: vi.fn(),
}));

vi.mock("../app/auth/msal", () => ({
  dockerStubAuthEnabled: false,
  localEmployeeAuthEnabled: true,
  localTestProviderEnabled: false,
  setLocalEmployeeToken: vi.fn(),
  testAuthEnabled: false,
}));

vi.mock("../services/api", () => ({
  enrollLocalEmployee: vi.fn(),
  resetLocalEmployeePassword: vi.fn(),
  startLocalEmployeePasswordReset: vi.fn(),
  startLocalEmployeeSignIn: vi.fn(),
  verifyLocalEmployeeSignIn: vi.fn(),
}));

function renderEmployeeAuth() {
  render(<LandingScreen />);
  fireEvent.click(screen.getByRole("button", { name: /Or sign in with your employee ID/ }));
}

async function startOtpFlow() {
  renderEmployeeAuth();
  fireEvent.change(screen.getByLabelText("Employee ID"), { target: { value: "42" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "current-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Enter the code sent to ••••1234.");
}

async function startRecoveryFlow() {
  renderEmployeeAuth();
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.change(screen.getByLabelText("Recovery employee ID"), { target: { value: "42" } });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  await screen.findByLabelText("Recovery code");
}

function fillPasswordReset(code = "123456", password = "new-password-value") {
  fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: code } });
  fireEvent.change(screen.getByLabelText("Reset password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: password } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authenticate).mockResolvedValue(undefined);
  vi.mocked(startLocalEmployeeSignIn).mockResolvedValue({
    challengeId: "sign-in-challenge",
    emailHint: "••••1234",
  });
  vi.mocked(verifyLocalEmployeeSignIn).mockResolvedValue({ accessToken: "employee-token" });
  vi.mocked(enrollLocalEmployee).mockResolvedValue({ accessToken: "enrolled-token" });
  vi.mocked(startLocalEmployeePasswordReset).mockResolvedValue({ challengeId: "reset-challenge" });
  vi.mocked(resetLocalEmployeePassword).mockResolvedValue({ accessToken: "reset-token" });
});

// The auth entry point defaults to Entra. Quick login appears only when the
// local test provider or explicit Docker test-login flag is enabled.
describe("LandingScreen", () => {
  it("renders the provider sign-in call to action", () => {
    render(<LandingScreen />);
    expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Microsoft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quick login" })).not.toBeInTheDocument();
  });

  it("starts provider sign-in on submit", async () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Microsoft" }));
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
  });

  it("shows a generic error when sign-in cannot start", async () => {
    vi.mocked(authenticate).mockRejectedValue(new Error("misconfigured"));
    render(<LandingScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Microsoft" }));
    await waitFor(() => {
      expect(screen.getByText("Sign-in could not be started. Please contact support.")).toBeInTheDocument();
    });
    // No provider detail leaks into the message.
    expect(screen.queryByText(/misconfigured/)).toBeNull();
  });

  it("starts employee sign-in through the shared API and advances to OTP", async () => {
    await startOtpFlow();

    expect(startLocalEmployeeSignIn).toHaveBeenCalledWith("42", "current-password");
    expect(screen.getByText("Enter the code sent to ••••1234.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("shows employee sign-in API errors without advancing", async () => {
    vi.mocked(startLocalEmployeeSignIn).mockRejectedValue(new Error("Invalid employee ID or password"));
    renderEmployeeAuth();
    fireEvent.change(screen.getByLabelText("Employee ID"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid employee ID or password");
    expect(screen.getByLabelText("Employee ID")).toBeInTheDocument();
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  });

  it("uses the fallback error when employee sign-in returns no challenge", async () => {
    vi.mocked(startLocalEmployeeSignIn).mockResolvedValue({} as Awaited<ReturnType<typeof startLocalEmployeeSignIn>>);
    renderEmployeeAuth();
    fireEvent.change(screen.getByLabelText("Employee ID"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "current-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Employee sign-in could not be started.");
  });

  it("verifies the OTP through the shared API and stores the returned session", async () => {
    await startOtpFlow();
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    await waitFor(() => expect(verifyLocalEmployeeSignIn).toHaveBeenCalledWith("sign-in-challenge", "123456"));
    await waitFor(() => expect(setLocalEmployeeToken).toHaveBeenCalledWith("employee-token"));
  });

  it("keeps enrollment available when password setup fails", async () => {
    vi.mocked(verifyLocalEmployeeSignIn).mockResolvedValue({
      enrollmentRequired: true,
      enrollmentToken: "enrollment-challenge",
    });
    vi.mocked(enrollLocalEmployee).mockRejectedValue(new Error("Password must be between 12 and 128 characters"));
    await startOtpFlow();
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password and sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Password must be between 12 and 128 characters");
    expect(enrollLocalEmployee).toHaveBeenCalledWith("enrollment-challenge", "short");
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("starts password recovery through the shared API", async () => {
    await startRecoveryFlow();

    expect(startLocalEmployeePasswordReset).toHaveBeenCalledWith("42");
    expect(screen.getByLabelText("Recovery code")).toBeInTheDocument();
    expect(screen.getByLabelText("Reset password")).toBeInTheDocument();
  });

  it("rejects mismatched reset passwords before opening confirmation", async () => {
    await startRecoveryFlow();
    fillPasswordReset("123456", "new-password-value");
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The passwords do not match.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(resetLocalEmployeePassword).not.toHaveBeenCalled();
  });

  it("requires accessible confirmation before resetting the password", async () => {
    vi.mocked(resetLocalEmployeePassword).mockRejectedValue(new Error("Invalid or expired verification code"));
    await startRecoveryFlow();
    fillPasswordReset();
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    const dialog = screen.getByRole("dialog", { name: "Reset your password?" });
    expect(dialog).toHaveTextContent("Your previous password will stop working.");
    expect(resetLocalEmployeePassword).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(resetLocalEmployeePassword).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    const confirmation = screen.getByRole("dialog", { name: "Reset your password?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Reset password" }));

    await waitFor(() => expect(resetLocalEmployeePassword).toHaveBeenCalledWith(
      "reset-challenge",
      "123456",
      "new-password-value",
    ));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired verification code");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
