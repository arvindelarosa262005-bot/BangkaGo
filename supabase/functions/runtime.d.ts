// Minimal declarations for portable tsc validation. Deployment runtime remains Deno.
declare namespace Deno {
  const env: { get(name: string): string | undefined };
  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}
