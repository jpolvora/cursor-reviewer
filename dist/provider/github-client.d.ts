import { type GithubPullRequestContextData } from './github-queries.js';
export declare class GithubClient {
    readonly owner: string;
    readonly repository: string;
    readonly token: string;
    constructor(owner: string, repository: string, token: string);
    get baseUrl(): string;
    private headers;
    restGet<T>(path: string): Promise<T>;
    restPost<T>(path: string, body: unknown): Promise<T>;
    restPatch<T>(path: string, body: unknown): Promise<T>;
    graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
    private request;
    /**
     * Carrega threads de review, comentários de thread e comentários da PR com paginação completa.
     */
    fetchPullRequestContextData(pullRequestNumber: number, log?: (msg: string) => void): Promise<GithubPullRequestContextData>;
}
//# sourceMappingURL=github-client.d.ts.map