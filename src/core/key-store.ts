/**
 * Secure private key storage
 * 
 * Private keys are stored separately from Agent objects to prevent
 * accidental serialization in API responses or log statements.
 * 
 * In production, this should be replaced with proper key management
 * service like AWS KMS, Azure Key Vault, or HashiCorp Vault.
 */

const keyStore = new Map<string, string>();

/**
 * Get an agent's private key by their ID
 * @param agentId The agent's unique identifier
 * @returns The private key or undefined if not found
 */
export function getAgentPrivateKey(agentId: string): string | undefined {
  return keyStore.get(agentId);
}

/**
 * Set an agent's private key
 * @param agentId The agent's unique identifier  
 * @param privateKey The private key to store
 */
export function setAgentPrivateKey(agentId: string, privateKey: string): void {
  if (!agentId || !privateKey) {
    throw new Error('Agent ID and private key are required');
  }
  keyStore.set(agentId, privateKey);
}

/**
 * Remove an agent's private key from storage
 * @param agentId The agent's unique identifier
 */
export function removeAgentPrivateKey(agentId: string): boolean {
  return keyStore.delete(agentId);
}

/**
 * Check if an agent has a private key stored
 * @param agentId The agent's unique identifier
 */
export function hasAgentPrivateKey(agentId: string): boolean {
  return keyStore.has(agentId);
}

/**
 * Get count of stored private keys (for monitoring)
 */
export function getKeyCount(): number {
  return keyStore.size;
}