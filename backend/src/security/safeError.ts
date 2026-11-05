export function safeError(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  return {
    errorType:
      typeof value.name === "string" && /^[A-Za-z0-9_]{1,60}$/.test(value.name)
        ? value.name
        : "Error",
    errorCode:
      typeof value.code === "string" && /^[A-Z0-9_]{1,60}$/.test(value.code)
        ? value.code
        : undefined,
  };
}
