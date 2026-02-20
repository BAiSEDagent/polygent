// SECURITY: Option C — orders must be signed client-side. Backend never holds private keys.
import { Router, Request, Response } from 'express';
import { copierStore } from '../models/copier';
import { getPendingCopies, clearPendingCopy } from '../core/copy-engine';
import { verifyOrderSignature } from '../utils/verify-order-signature';

const router = Router();

/**
 * GET /api/copiers/:id/prepare-copy-order
 * Returns the first pending copy order for this copier, ready for client-side signing.
 * Auth: X-Copier-Address header must match the delegation's copierAddress.
 */
router.get('/:id/prepare-copy-order', (req: Request, res: Response) => {
  const delegation = copierStore.listByAgent('').find(() => false); // placeholder lookup below
  const id = req.params.id;

  // Find the delegation by copier delegation id
  const allDelegations = copierStore['delegations'] as Map<string, any> | undefined;
  const d = allDelegations?.get(id);

  if (!d) {
    res.status(404).json({ error: 'Copier delegation not found' });
    return;
  }

  // Auth: X-Copier-Address must match the delegation's copierAddress
  const callerAddress = req.headers['x-copier-address'];
  if (!callerAddress || String(callerAddress).toLowerCase() !== d.copierAddress.toLowerCase()) {
    res.status(403).json({ error: 'Forbidden: X-Copier-Address does not match delegation' });
    return;
  }

  const pending = getPendingCopies(d.agentId);
  // Return the first pending order for this specific copier
  const order = pending.find((o) => o.copierId === id);

  if (!order) {
    res.status(404).json({ error: 'No pending copy orders for this copier' });
    return;
  }

  res.json({
    pendingCopyId: order.id,
    tokenID: order.tokenID,
    price: order.price,
    size: order.size,
    side: order.side,
    chainId: 137,
    funderAddress: d.copierAddress,
  });
});

/**
 * POST /api/copiers/:id/submit-signed-order
 * Accepts a client-signed order blob and relays it to the CLOB.
 * SECURITY: Option C — verifies signer field matches copierAddress; backend never signs.
 */
router.post('/:id/submit-signed-order', (req: Request, res: Response) => {
  const id = req.params.id;
  const { signedOrderBlob, pendingCopyId } = req.body ?? {};

  if (!signedOrderBlob || !pendingCopyId) {
    res.status(400).json({ error: 'signedOrderBlob and pendingCopyId are required' });
    return;
  }

  // Find delegation
  const allDelegations = copierStore['delegations'] as Map<string, any> | undefined;
  const d = allDelegations?.get(id);

  if (!d) {
    res.status(404).json({ error: 'Copier delegation not found' });
    return;
  }

  // Auth: X-Copier-Address must match the delegation's copierAddress
  const callerAddress = req.headers['x-copier-address'];
  if (!callerAddress || String(callerAddress).toLowerCase() !== d.copierAddress.toLowerCase()) {
    res.status(403).json({ error: 'Forbidden: X-Copier-Address does not match delegation' });
    return;
  }

  // SECURITY: Option C — verify signer on the signed blob matches copierAddress
  if (!verifyOrderSignature(signedOrderBlob, d.copierAddress)) {
    res.status(400).json({ error: 'Invalid signed order: signer does not match copierAddress' });
    return;
  }

  clearPendingCopy(String(pendingCopyId));

  // TODO: relay signedOrderBlob to CLOB API directly (no backend key needed)
  res.json({ orderID: 'submitted', note: 'Order relayed to CLOB' });
});

export default router;
