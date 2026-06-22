export class AdoClient {
  constructor(
    readonly organization: string,
    readonly project: string,
    readonly repositoryName: string,
    readonly accessToken: string,
  ) {}

  get baseUrl(): string {
    const org = encodeURIComponent(this.organization);
    const project = encodeURIComponent(this.project);
    const repo = encodeURIComponent(this.repositoryName);
    return `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repo}`;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async getConnectionData(): Promise<{ authenticatedUser: { id: string; providerDisplayName: string } }> {
    const org = encodeURIComponent(this.organization);
    const url = `https://dev.azure.com/${org}/_apis/connectionData`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(
        `ADO connectionData failed: ${response.status} ${truncateResponseText(await response.text())}`,
      );
    }
    return response.json() as Promise<{ authenticatedUser: { id: string; providerDisplayName: string } }>;
  }

  private headers(): Record<string, string> {
    const isJwt = this.accessToken.includes('.') || this.accessToken.startsWith('eyJ');
    const authHeader = isJwt
      ? `Bearer ${this.accessToken}`
      : `Basic ${Buffer.from(`:${this.accessToken}`).toString('base64')}`;
    return {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers: this.headers(),
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (networkError) {
        lastError = new Error(`ADO ${method} ${url} network error: ${String(networkError)}`);
        if (attempt === maxRetries) {
          throw lastError;
        }
        await this.backoff(attempt);
        continue;
      }

      if (response.ok) {
        if (response.status === 204) {
          return undefined as T;
        }
        return response.json() as Promise<T>;
      }

      const text = truncateResponseText(await response.text());
      lastError = new Error(`ADO ${method} ${url} failed: ${response.status} ${text}`);

      const isRetryable = response.status === 429 || (response.status >= 500 && response.status < 600);
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'));
      await this.backoff(attempt, retryAfterSeconds);
    }

    throw lastError ?? new Error(`ADO ${method} ${url} failed after ${maxRetries} retries`);
  }

  /** Backoff exponencial com teto de 8s; respeita Retry-After em 429 quando presente. */
  private async backoff(attempt: number, retryAfterSeconds?: number): Promise<void> {
    const backoffMs =
      retryAfterSeconds != null && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, 30_000)
        : Math.min(1000 * 2 ** (attempt - 1), 8000);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }
}

function truncateResponseText(text: string, max = 2000): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
}

function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header?.trim()) {
    return undefined;
  }
  const seconds = Number(header.trim());
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }
  const retryDate = Date.parse(header);
  if (!Number.isNaN(retryDate)) {
    const deltaSeconds = Math.ceil((retryDate - Date.now()) / 1000);
    return deltaSeconds > 0 ? deltaSeconds : undefined;
  }
  return undefined;
}
