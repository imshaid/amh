// The few Deno APIs the functions use, so they type-check with the rest of the repository. The
// Edge Runtime provides the real ones; nothing here is bundled.
declare namespace Deno {
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
  const env: { get(name: string): string | undefined };
}
