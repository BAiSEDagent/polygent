import { z, ZodError } from 'zod';
import { ethers } from 'ethers';
import { sanitizeObject, sanitizeText } from '../utils/sanitize';

const addressSchema = z
  .string()
  .min(1, 'Address is required')
  .refine((val) => ethers.utils.isAddress(val.toLowerCase()), 'Must be a valid Ethereum address')
  .transform((val) => ethers.utils.getAddress(val.toLowerCase()));

const booleanStringSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((val) => val === 'true'),
]);

const optionalString = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((val) => sanitizeText(val, max))
    .optional()
    .or(z.literal('').transform(() => undefined));

const requiredString = (max: number) =>
  z
    .string()
    .min(1)
    .max(max * 2)
    .transform((val) => sanitizeText(val, max))
    .refine((val) => !!val, 'Value cannot be empty after sanitization');

const orderSideSchema = z.enum(['BUY', 'SELL']);
const orderOutcomeSchema = z.enum(['YES', 'NO']);
const orderTypeSchema = z.enum(['LIMIT', 'MARKET', 'FOK']);

export const orderRequestSchema = z.object({
  marketId: requiredString(120),
  side: orderSideSchema,
  outcome: orderOutcomeSchema,
  amount: z.coerce.number().positive().max(10000),
  price: z.coerce.number().min(0.01).max(0.99),
  type: orderTypeSchema.optional(),
  maxSlippage: z.coerce.number().min(0).max(0.5).optional(),
});

export const signedOrderSchema = z.object({
  salt: z.string().min(1),
  maker: addressSchema,
  signer: addressSchema,
  taker: addressSchema,
  tokenId: z.string().min(1),
  makerAmount: z.string().regex(/^\d+$/, 'makerAmount must be numeric'),
  takerAmount: z.string().regex(/^\d+$/, 'takerAmount must be numeric'),
  expiration: z.string().regex(/^\d+$/, 'expiration must be numeric'),
  nonce: z.string().regex(/^\d+$/, 'nonce must be numeric'),
  feeRateBps: z.string().regex(/^\d+$/, 'feeRateBps must be numeric'),
  side: z.coerce.number().int().nonnegative(),
  signatureType: z.coerce.number().int().nonnegative(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'signature must be hex'),
});

export const signedOrderPayloadSchema = z.object({
  signedOrder: signedOrderSchema,
});

export const agentRegisterSchema = z.object({
  name: requiredString(100),
  description: optionalString(500),
  strategy: optionalString(100),
  eoaAddress: addressSchema,
  proxyAddress: addressSchema,
});

export const agentCreateSchema = z.object({
  name: requiredString(100),
  description: optionalString(500),
  strategy: optionalString(100),
  deposit: z.coerce.number().nonnegative().optional(),
  config: z.record(z.unknown()).optional(),
});

export const agentPatchSchema = z.object({
  autoRedeem: booleanStringSchema.optional(),
  config: z.record(z.unknown()).optional(),
});

export const agentOnboardSchema = z.object({
  privateKey: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'privateKey must be a 0x-prefixed 32-byte hex'),
  name: optionalString(100),
});

export const builderSignSchema = z.object({
  method: requiredString(20),
  path: requiredString(512),
  body: z.union([z.string(), z.record(z.any())]).optional(),
});

export const copierCreateSchema = z.object({
  copierAddress: addressSchema,
  agentId: requiredString(64),
  fixedUsdc: z.coerce.number().min(0.01).max(1000),
  apiKey: requiredString(200),
  apiSecret: requiredString(200),
  apiPassphrase: requiredString(200),
  l2PrivateKey: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'l2PrivateKey must be 0x-prefixed 32-byte hex'),
});

export const copierTestTriggerSchema = z.object({
  agentId: requiredString(64),
  marketId: optionalString(120).optional(),
  side: orderSideSchema.optional(),
  outcome: orderOutcomeSchema.optional(),
  amount: z.coerce.number().positive().optional(),
  price: z.coerce.number().min(0.01).max(0.99).optional(),
});

export const formatZodError = (error: ZodError) => error.flatten().fieldErrors;

export const sanitizeAndParse = <T>(schema: z.ZodType<T>, payload: unknown) => {
  const cleaned = sanitizeObject(payload as Record<string, unknown>);
  return schema.safeParse(cleaned);
};
