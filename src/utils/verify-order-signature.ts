export function verifyOrderSignature(signedBlob: any, expectedAddress: string): boolean {
  if (!signedBlob || !signedBlob.signer) return false;
  return signedBlob.signer.toLowerCase() === expectedAddress.toLowerCase(); // SECURITY: Option C
}
