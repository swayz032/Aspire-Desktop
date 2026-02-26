// Type stubs for @aws-sdk/client-secrets-manager
// The package is only installed in production (Railway). In local dev, secrets.ts
// uses dynamic import() and falls back gracefully to .env.local when unavailable.

declare module '@aws-sdk/client-secrets-manager' {
  export class SecretsManagerClient {
    constructor(config: { region?: string });
    send(command: any): Promise<any>;
    destroy(): void;
  }

  export class GetSecretValueCommand {
    constructor(input: { SecretId: string; VersionId?: string; VersionStage?: string });
  }
}
