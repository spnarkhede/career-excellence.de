export interface FeatureFlagContext {
  userId?: string;
  email?: string;
}

export interface FeatureFlagProvider {
  isEnabled(key: string, context?: FeatureFlagContext): Promise<boolean>;
}

/** Static in-memory flag provider for local development. Swap for a managed provider in production. */
export class StaticFeatureFlagProvider implements FeatureFlagProvider {
  constructor(private flags: Record<string, boolean> = {}) {}

  async isEnabled(key: string): Promise<boolean> {
    return this.flags[key] ?? false;
  }
}
