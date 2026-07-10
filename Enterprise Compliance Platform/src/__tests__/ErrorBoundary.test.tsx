import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../app/components/ErrorBoundary";

const ThrowingComponent = ({ shouldThrow }: { shouldThrow?: boolean }) => {
  if (shouldThrow) throw new Error("Test error from child");
  return <div>All good</div>;
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders default fallback on error", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error from child")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("re-renders children after reset when error condition is removed", () => {
    let throwError = true;
    const ToggleThrowing = () => {
      if (throwError) throw new Error("Test error from child");
      return <div>All good</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleThrowing />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    throwError = false;
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders generic message when error has no message", () => {
    const BlankError = () => { throw new Error(); };
    render(
      <ErrorBoundary>
        <BlankError />
      </ErrorBoundary>
    );
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });
});
