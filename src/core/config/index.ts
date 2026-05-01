export const config = {
  app: {
    name: 'Finvanta',
    version: '1.0.0',
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    version: 'v1',
    timeout: 30000,
  },
  auth: {
    sessionMaxAge: 3600,
    refreshMaxAge: 604800,
    tokenBufferSeconds: 30,
  },
  security: {
    encryptionAlgorithm: 'aes-256-gcm',
    tenantHeaderName: 'X-Tenant-Id',
    tenantSchemaHeader: 'X-Tenant-Schema',
  },
  features: {
    mfaEnabled: true,
    sessionTimeout: 1800,
    maxLoginAttempts: 5,
  },
};