# Dynamic Customers - Configuration-as-a-Service Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform billing from static/hardcoded to dynamic Configuration-as-a-Service enabling non-developer admins to onboard customers via UI.

**Architecture:** Extend existing models (add fields only, no breaking changes). Use feature flag `DYNAMIC_BILLING_ENABLED` to toggle new behavior. Existing Coway billing continues unchanged.

**Tech Stack:** Next.js, MongoDB, TypeScript, AES-256 for credential encryption

---

## File Structure Overview

```
billing-app/src/
├── types/index.ts                    # ADD: status, billingCycle, defaultFields to Customer
├── domain/models/
│   └── dataSource.ts                 # ADD: fallbackValues, retryPolicy, requestTemplate
├── infrastructure/db/
│   ├── customerRepository.ts         # ADD: findByStatus, findByBillingCycle methods
│   └── dataSourceRepository.ts       # ADD: fallback support methods
├── infrastructure/
│   └── crypto/
│       └── credentialEncryption.ts   # NEW: AES-256 encryption service
├── services/
│   └── configCache.ts                # NEW: In-memory config cache
├── domain/services/
│   ├── configurationService.ts       # NEW: Central config loader
│   ├── billingService.ts             # MODIFY: Add status filtering, backward compat
│   └── productTranslationService.ts # NEW: Source-to-target mapping
├── app/api/customers/[id]/
│   ├── route.ts                      # MODIFY: Add status, billingCycle to response
│   ├── status/route.ts               # NEW: GET/PUT customer status
│   └── billing-cycle/route.ts        # NEW: GET/PUT billing cycle
└── app/admin/customers/wizard/
    └── components/                   # EXTEND: Add new tabs for config UI
```

---

## Phase 1: Core Schema & Cache (Week 1)

### Task 1.1: Extend Customer Type with Status & Billing Cycle

**Files:**
- Modify: `billing-app/src/types/index.ts:29-77`

- [ ] **Step 1: Add new fields to Customer interface**

Edit the Customer interface (around line 29) to add these new fields AFTER existing fields (maintain backward compatibility):

```typescript
// ADD these new fields to Customer interface (after line 76)
export type CustomerStatus = 'ACTIVE' | 'SUSPENDED' | 'MAINTENANCE';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface Customer {
  // ... existing fields (lines 29-76) ...

  // NEW: Status-based billing
  status?: CustomerStatus;
  billingCycle?: BillingCycle;

  // NEW: Default field values (fallback)
  defaultFields?: {
    creditTerm?: number;
    salesLocation?: string;
    taxCode?: string;
    description?: string;
  };

  // NEW: Enhanced schedule (extends existing)
  schedule?: BillingSchedule & {
    timezone?: string;
    retryPolicy?: {
      maxRetries: number;
      retryDelayMinutes: number;
    };
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/types/index.ts
git commit -m "feat: add status, billingCycle, defaultFields to Customer type"
```

---

### Task 1.2: Extend DataSource Model with Fallback & Retry

**Files:**
- Modify: `billing-app/src/domain/models/dataSource.ts`

- [ ] **Step 1: Add new fields to DataSource interface**

Edit `billing-app/src/domain/models/dataSource.ts` to add fallbackValues, retryPolicy, requestTemplate:

```typescript
// ADD after line 36 (before closing brace)
export interface DataSource {
  // ... existing fields (lines 19-36) ...

  // NEW: Fallback values for missing data
  fallbackValues?: {
    usageCount?: number;
    sentCount?: number;
    failedCount?: number;
    useDefaultOnMissing: boolean;
  };

  // NEW: Retry and timeout policy
  retryPolicy?: {
    maxRetries: number;
    retryDelaySeconds: number;
    timeoutSeconds: number;
  };

  // NEW: Request template (for templated endpoints)
  requestTemplate?: {
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    bodyTemplate?: string;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/domain/models/dataSource.ts
git commit -m "feat: add fallbackValues, retryPolicy to DataSource model"
```

---

### Task 1.3: Create ConfigCache Service

**Files:**
- Create: `billing-app/src/infrastructure/configCache.ts`

- [ ] **Step 1: Write the ConfigCache service**

```typescript
/**
 * ConfigCache - In-memory cache for customer configurations
 *
 * Provides caching with TTL for customer configs, datasources, and mappings.
 * Cache is invalidated on config changes.
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ConfigCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTLMinutes = 5;

  /**
   * Get cached value if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, data: T, ttlMinutes: number = this.defaultTTLMinutes): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    });
  }

  /**
   * Invalidate all cache entries for a customer
   */
  invalidateCustomer(customerId: string): void {
    const prefixes = [
      `customer:${customerId}`,
      `datasources:${customerId}`,
      `mappings:${customerId}`,
    ];
    for (const prefix of prefixes) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let expired = 0;
    const now = Date.now();
    for (const entry of this.cache.values()) {
      if (entry.expiresAt <= now) expired++;
    }
    return {
      total: this.cache.size,
      expired,
      active: this.cache.size - expired,
    };
  }
}

// Singleton instance
export const configCache = new ConfigCache();
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/infrastructure/configCache.ts
git commit -m "feat: add ConfigCache service for in-memory caching"
```

---

### Task 1.4: Create ConfigurationService

**Files:**
- Create: `billing-app/src/domain/services/configurationService.ts`

- [ ] **Step 1: Write ConfigurationService**

```typescript
/**
 * ConfigurationService - Central config loader with caching
 *
 * Loads customer configuration with cache support.
 * Validates customer status before returning config.
 */

import { configCache } from '@/infrastructure/configCache';
import { customerRepository } from '@/infrastructure/db/customerRepository';
import { dataSourceRepository } from '@/infrastructure/db/dataSourceRepository';
import type { Customer, CustomerStatus } from '@/types';

export class ConfigurationService {
  private cacheTTL = {
    customer: 5,      // minutes
    datasources: 5,   // minutes
    mappings: 10,     // minutes
  };

  /**
   * Get customer config (cached)
   */
  async getCustomerConfig(customerId: string): Promise<Customer | null> {
    const cacheKey = `customer:${customerId}`;

    // Check cache first
    const cached = configCache.get<Customer>(cacheKey);
    if (cached) {
      return cached;
    }

    // Load from database
    const customer = await customerRepository.findById(customerId);
    if (customer) {
      configCache.set(cacheKey, customer, this.cacheTTL.customer);
    }

    return customer;
  }

  /**
   * Get customer datasources (cached)
   */
  async getCustomerDataSources(customerId: string) {
    const cacheKey = `datasources:${customerId}`;

    const cached = configCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const dataSources = await dataSourceRepository.findByCustomerId(customerId);
    configCache.set(cacheKey, dataSources, this.cacheTTL.datasources);

    return dataSources;
  }

  /**
   * Check if customer is billable (ACTIVE status)
   */
  async isCustomerBillable(customerId: string): Promise<boolean> {
    const customer = await this.getCustomerConfig(customerId);
    if (!customer) return false;

    // If status field doesn't exist yet, default to ACTIVE (backward compat)
    const status = customer.status || 'ACTIVE';
    return status === 'ACTIVE';
  }

  /**
   * Invalidate customer cache (call after config changes)
   */
  invalidateCache(customerId: string): void {
    configCache.invalidateCustomer(customerId);
  }

  /**
   * Determine if billing should run based on billing cycle
   */
  shouldRunBilling(customer: Customer, billingMonth: string): boolean {
    const billingCycle = customer.billingCycle || 'MONTHLY';

    if (billingCycle === 'MONTHLY') {
      return true; // Run every month
    }

    // Parse billing month (e.g., "2026-03")
    const [year, month] = billingMonth.split('-').map(Number);

    if (billingCycle === 'QUARTERLY') {
      // Run in months 3, 6, 9, 12
      return month % 3 === 0;
    }

    if (billingCycle === 'YEARLY') {
      // Run in December only
      return month === 12;
    }

    return true;
  }
}

export const configurationService = new ConfigurationService();
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/domain/services/configurationService.ts
git commit -m "feat: add ConfigurationService with caching"
```

---

### Task 1.5: Add Repository Methods for Status & Billing Cycle

**Files:**
- Modify: `billing-app/src/infrastructure/db/customerRepository.ts`

- [ ] **Step 1: Find customerRepository methods**

First read the existing customerRepository to understand its structure:

```bash
head -50 billing-app/src/infrastructure/db/customerRepository.ts
```

- [ ] **Step 2: Add new query methods**

Add these methods to customerRepository (find the class and add new methods):

```typescript
/**
 * Find customers by status
 */
async findByStatus(status: 'ACTIVE' | 'SUSPENDED' | 'MAINTENANCE'): Promise<Customer[]> {
  const customers = await this.collection
    .find({ status } as any)
    .toArray();
  return customers;
}

/**
 * Find all active customers for billing
 */
async findActive(): Promise<Customer[]> {
  // Support both new status field and legacy (no status = ACTIVE)
  const customers = await this.collection
    .find({
      $or: [
        { status: 'ACTIVE' },
        { status: { $exists: false } },  // Legacy: no status = active
      ],
    } as any)
    .toArray();
  return customers;
}

/**
 * Find customers by billing cycle
 */
async findByBillingCycle(cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'): Promise<Customer[]> {
  const customers = await this.collection
    .find({ billingCycle: cycle } as any)
    .toArray();
  return customers;
}
```

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/infrastructure/db/customerRepository.ts
git commit -m "feat: add findByStatus, findActive, findByBillingCycle to customerRepository"
```

---

## Phase 2: DataSource UI Enhancements (Week 2)

### Task 2.1: Update DataSource CRUD API for New Fields

**Files:**
- Modify: `billing-app/src/app/api/customers/[id]/datasources/route.ts`
- Modify: `billing-app/src/app/api/customers/[id]/datasources/[dsId]/route.ts`

- [ ] **Step 1: Update POST route to accept fallbackValues**

In `datasources/route.ts`, find the POST handler and add fallbackValues to the validation:

```typescript
// In the POST handler, add fallbackValues to the input validation
const dataSourceInput = {
  // ... existing fields
  fallbackValues: body.fallbackValues || {
    useDefaultOnMissing: false,
  },
  retryPolicy: body.retryPolicy || {
    maxRetries: 3,
    retryDelaySeconds: 60,
    timeoutSeconds: 30,
  },
  requestTemplate: body.requestTemplate,
};
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/app/api/customers/
git commit -m "feat: add fallbackValues, retryPolicy to DataSource CRUD"
```

---

### Task 2.2: Extend Wizard DataSourceStep Component

**Files:**
- Modify: `billing-app/src/app/admin/customers/wizard/components/DataSourceStep.tsx`

- [ ] **Step 1: Add fallback values UI**

Add a collapsible "Fallback & Retry" section in the DataSourceStep component. Find where the form fields are rendered and add:

```tsx
{/* ADD after the Response Mapping section */}
<div className="mt-4 p-4 bg-gray-50 rounded-lg">
  <h4 className="font-medium text-sm text-gray-700 mb-3">Fallback Values</h4>

  <label className="flex items-center gap-2 mb-3">
    <input
      type="checkbox"
      checked={formData.fallbackValues?.useDefaultOnMissing || false}
      onChange={(e) => setFormData({
        ...formData,
        fallbackValues: {
          ...formData.fallbackValues,
          useDefaultOnMissing: e.target.checked,
        },
      })}
      className="rounded"
    />
    <span className="text-sm">Use default values when data is missing</span>
  </label>

  {formData.fallbackValues?.useDefaultOnMissing && (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Default Usage</label>
        <input
          type="number"
          value={formData.fallbackValues?.usageCount || 0}
          onChange={(e) => setFormData({
            ...formData,
            fallbackValues: {
              ...formData.fallbackValues,
              usageCount: parseInt(e.target.value) || 0,
            },
          })}
          className="w-full px-3 py-2 border rounded text-sm"
        />
      </div>
      {/* Similar for sentCount, failedCount */}
    </div>
  )}
</div>

<div className="mt-4 p-4 bg-gray-50 rounded-lg">
  <h4 className="font-medium text-sm text-gray-700 mb-3">Retry Policy</h4>

  <div className="grid grid-cols-3 gap-3">
    <div>
      <label className="block text-xs text-gray-500 mb-1">Max Retries</label>
      <input
        type="number"
        value={formData.retryPolicy?.maxRetries || 3}
        onChange={(e) => setFormData({
          ...formData,
          retryPolicy: {
            ...formData.retryPolicy,
            maxRetries: parseInt(e.target.value) || 3,
          },
        })}
        className="w-full px-3 py-2 border rounded text-sm"
      />
    </div>
    <div>
      <label className="block text-xs text-gray-500 mb-1">Timeout (sec)</label>
      <input
        type="number"
        value={formData.retryPolicy?.timeoutSeconds || 30}
        onChange={(e) => setFormData({
          ...formData,
          retryPolicy: {
            ...formData.retryPolicy,
            timeoutSeconds: parseInt(e.target.value) || 30,
          },
        })}
        className="w-full px-3 py-2 border rounded text-sm"
      />
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/app/admin/customers/wizard/components/DataSourceStep.tsx
git commit -m "feat: add fallback values and retry policy UI to wizard"
```

---

### Task 2.3: Create Customer Status Management API

**Files:**
- Create: `billing-app/src/app/api/customers/[id]/status/route.ts`

- [ ] **Step 1: Write status GET/PUT route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { customerRepository } from '@/infrastructure/db/customerRepository';
import { configurationService } from '@/domain/services/configurationService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await customerRepository.findById(params.id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: customer.status || 'ACTIVE',  // Default for legacy customers
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!['ACTIVE', 'SUSPENDED', 'MAINTENANCE'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await customerRepository.update(params.id, { status });

    // Invalidate cache after status change
    configurationService.invalidateCache(params.id);

    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/app/api/customers/[id]/status/route.ts
git commit -m "feat: add customer status management API"
```

---

### Task 2.4: Create Billing Cycle Management API

**Files:**
- Create: `billing-app/src/app/api/customers/[id]/billing-cycle/route.ts`

- [ ] **Step 1: Write billing-cycle GET/PUT route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { customerRepository } from '@/infrastructure/db/customerRepository';
import { configurationService } from '@/domain/services/configurationService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await customerRepository.findById(params.id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      billingCycle: customer.billingCycle || 'MONTHLY',  // Default for legacy
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get billing cycle' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { billingCycle } = body;

    if (!['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(billingCycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    await customerRepository.update(params.id, { billingCycle });

    // Invalidate cache
    configurationService.invalidateCache(params.id);

    return NextResponse.json({ billingCycle });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update billing cycle' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/app/api/customers/[id]/billing-cycle/route.ts
git commit -m "feat: add customer billing cycle management API"
```

---

### Task 2.5: Create ProductTranslationService

**Files:**
- Create: `billing-app/src/domain/services/productTranslationService.ts`

- [ ] **Step 1: Write ProductTranslationService**

```typescript
/**
 * ProductTranslationService - Source-to-target product mapping with fallbacks
 *
 * Maps external API product names/codes to AutoCount product codes.
 * Supports fallback products when primary mapping fails.
 */

import { serviceProductMappingRepository } from '@/infrastructure/db/serviceProductMappingRepository';
import type { ServiceType } from '@/types';

export interface ProductTranslation {
  accountBookId: string;
  serviceType: ServiceType;
  sourceProductName?: string;
  sourceProductCode?: string;
  targetProductCode: string;
  targetDescription: string;
  targetTaxCode: string;
  fallbackProductCode?: string;
  billingMode?: 'ITEMIZED' | 'LUMP_SUM';
}

export class ProductTranslationService {
  /**
   * Get product translation for a service type
   */
  async getTranslation(
    accountBookId: string,
    serviceType: ServiceType,
    sourceProductName?: string
  ): Promise<ProductTranslation | null> {
    // Try exact match by source product name
    const mappings = await serviceProductMappingRepository.findByAccountBook(accountBookId);

    // First: exact source product match
    if (sourceProductName) {
      const exactMatch = mappings.find(
        m => m.serviceType === serviceType && m.sourceProductName === sourceProductName
      );
      if (exactMatch) return exactMatch;
    }

    // Second: any source (wildcard) match
    const wildcardMatch = mappings.find(
      m => m.serviceType === serviceType && !m.sourceProductName
    );
    if (wildcardMatch) return wildcardMatch;

    return null;
  }

  /**
   * Get fallback product code if primary fails
   */
  getFallbackProduct(translation: ProductTranslation | null): string {
    if (!translation) {
      // Default fallback codes per service type
      return 'DEFAULT-SERVICE';
    }
    return translation.fallbackProductCode || translation.targetProductCode;
  }
}

export const productTranslationService = new ProductTranslationService();
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/domain/services/productTranslationService.ts
git commit -m "feat: add ProductTranslationService for product mapping"
```

---

## Phase 3: Credential Encryption (Week 3)

### Task 3.1: Create CredentialEncryptionService

**Files:**
- Create: `billing-app/src/infrastructure/crypto/credentialEncryption.ts`

- [ ] **Step 1: Write encryption service**

```typescript
/**
 * CredentialEncryptionService - AES-256 encryption for API credentials
 *
 * Encrypts credentials before storing, decrypts when needed.
 * Uses AES-256-GCM for authenticated encryption.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is not set');
  }
  // Derive a proper 32-byte key from the environment variable
  // Use unique salt per installation
  const salt = process.env.CREDENTIAL_ENCRYPTION_SALT || 'default-salt-change-in-production';
  return crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt a credential value
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return IV + AuthTag + Ciphertext as hex
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a credential value
 */
export function decryptCredential(encryptedText: string): string {
  const key = getEncryptionKey();

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a credential is already encrypted
 */
export function isEncrypted(credential: string): boolean {
  const parts = credential.split(':');
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
}

/**
 * Encrypt all credentials in authCredentials object
 */
export function encryptAuthCredentials(credentials: {
  key?: string;
  token?: string;
  username?: string;
  password?: string;
}): {
  key?: string;
  token?: string;
  username?: string;
  password?: string;
  _encrypted?: boolean;  // Flag to indicate credentials are encrypted
} {
  const encrypted = { ...credentials };

  if (encrypted.key && !isEncrypted(encrypted.key)) {
    encrypted.key = encryptCredential(encrypted.key);
  }
  if (encrypted.token && !isEncrypted(encrypted.token)) {
    encrypted.token = encryptCredential(encrypted.token);
  }
  if (encrypted.password && !isEncrypted(encrypted.password)) {
    encrypted.password = encryptCredential(encrypted.password);
  }

  // Mark as encrypted
  (encrypted as any)._encrypted = true;

  return encrypted;
}

/**
 * Decrypt all credentials in authCredentials object
 */
export function decryptAuthCredentials(credentials: {
  key?: string;
  token?: string;
  username?: string;
  password?: string;
  _encrypted?: boolean;
}): {
  key?: string;
  token?: string;
  username?: string;
  password?: string;
} {
  // If not marked as encrypted, return as-is (legacy data)
  if (!(credentials as any)._encrypted) {
    return credentials;
  }

  const decrypted = { ...credentials };

  try {
    if (decrypted.key && isEncrypted(decrypted.key)) {
      decrypted.key = decryptCredential(decrypted.key);
    }
    if (decrypted.token && isEncrypted(decrypted.token)) {
      decrypted.token = decryptCredential(decrypted.token);
    }
    if (decrypted.password && isEncrypted(decrypted.password)) {
      decrypted.password = decryptCredential(decrypted.password);
    }
  } catch (error) {
    console.error('Failed to decrypt credentials:', error);
  }

  // Remove the encryption flag
  delete (decrypted as any)._encrypted;

  return decrypted;
}
```

- [ ] **Step 2: Add environment variable to .env.local example**

Add to `.env.local`:

```
# Credential encryption key (generate a secure random string)
CREDENTIAL_ENCRYPTION_KEY=your-secure-256-bit-key-here-min-32-chars

# Unique salt per installation (change in production)
CREDENTIAL_ENCRYPTION_SALT=unique-salt-per-environment
```

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/infrastructure/crypto/credentialEncryption.ts
git commit -m "feat: add CredentialEncryptionService with AES-256-GCM"
```

---

### Task 3.2: Integrate Encryption into DataSource Repository

**Files:**
- Modify: `billing-app/src/infrastructure/db/dataSourceRepository.ts`

- [ ] **Step 1: Import encryption and update create/update methods**

Add import at top:
```typescript
import { encryptAuthCredentials, decryptAuthCredentials } from '@/infrastructure/crypto/credentialEncryption';
```

- [ ] **Step 2: Update create method to encrypt credentials**

In the create method, encrypt credentials before saving:

```typescript
async create(input: CreateDataSourceInput): Promise<DataSource> {
  // Encrypt credentials before saving
  const encryptedInput = {
    ...input,
    authCredentials: input.authCredentials
      ? encryptAuthCredentials(input.authCredentials)
      : undefined,
  };

  const result = await this.collection.insertOne({
    ...encryptedInput,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { ...encryptedInput, id: result.insertedId.toString() };
}
```

- [ ] **Step 3: Update findByCustomerId to decrypt credentials**

Add a method to decrypt when fetching:

```typescript
/**
 * Find by customer ID and decrypt credentials
 */
async findByCustomerId(customerId: string): Promise<DataSource[]> {
  const dataSources = await this.collection
    .find({ customerId } as any)
    .toArray();

  // Decrypt credentials for each data source
  return dataSources.map(ds => ({
    ...ds,
    authCredentials: ds.authCredentials
      ? decryptAuthCredentials(ds.authCredentials)
      : undefined,
  }));
}
```

- [ ] **Step 4: Commit**

```bash
git add billing-app/src/infrastructure/db/dataSourceRepository.ts
git commit -m "feat: integrate credential encryption into DataSourceRepository"
```

---

### Task 3.4: Create Credential Migration Script

**Files:**
- Create: `billing-app/src/scripts/migrateCredentials.ts`

- [ ] **Step 1: Write migration script**

```typescript
/**
 * Migration script: Encrypt existing credentials in database
 *
 * Run: npx tsx src/scripts/migrateCredentials.ts
 *
 * This script encrypts all existing authCredentials that are not yet encrypted.
 * Safe to run multiple times - will skip already encrypted credentials.
 */

import { dataSourceRepository } from '@/infrastructure/db/dataSourceRepository';
import { isEncrypted, encryptAuthCredentials } from '@/infrastructure/crypto/credentialEncryption';

async function migrate() {
  console.log('Starting credential encryption migration...');

  // Get all data sources
  const dataSources = await dataSourceRepository.findAll();
  console.log(`Found ${dataSources.length} data sources`);

  let migrated = 0;
  let skipped = 0;

  for (const ds of dataSources) {
    if (!ds.authCredentials) {
      skipped++;
      continue;
    }

    const creds = ds.authCredentials as any;
    let needsMigration = false;

    // Check if any credential needs encryption
    if (creds.key && !isEncrypted(creds.key)) needsMigration = true;
    if (creds.token && !isEncrypted(creds.token)) needsMigration = true;
    if (creds.password && !isEncrypted(creds.password)) needsMigration = true;

    if (needsMigration) {
      const encrypted = encryptAuthCredentials(creds);
      await dataSourceRepository.update(ds.id!, { authCredentials: encrypted });
      migrated++;
    } else {
      skipped++;
    }
  }

  console.log(`Migrated: ${migrated}, Skipped: ${skipped}`);
  console.log('Migration complete!');
}

migrate().catch(console.error);
```

- [ ] **Step 2: Run migration**

```bash
cd billing-app && npx tsx src/scripts/migrateCredentials.ts
```

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/scripts/migrateCredentials.ts
git commit -m "feat: add credential encryption migration script"
```

---

### Task 3.3: Create UI Tab for Status & Billing Cycle

**Files:**
- Create: `billing-app/src/app/admin/customers/wizard/components/ScheduleStep.tsx`

- [ ] **Step 1: Write ScheduleStep component**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { CustomerStatus, BillingCycle } from '@/types';

interface ScheduleStepProps {
  customerId: string;
  initialData?: {
    status?: CustomerStatus;
    billingCycle?: BillingCycle;
    schedule?: any;
  };
  onNext: (data: any) => void;
  onBack: () => void;
}

export default function ScheduleStep({ customerId, initialData, onNext, onBack }: ScheduleStepProps) {
  const [status, setStatus] = useState<CustomerStatus>(initialData?.status || 'ACTIVE');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialData?.billingCycle || 'MONTHLY');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch existing status and billing cycle
    async function fetchData() {
      try {
        const [statusRes, cycleRes] = await Promise.all([
          fetch(`/api/customers/${customerId}/status`),
          fetch(`/api/customers/${customerId}/billing-cycle`),
        ]);

        if (statusRes.ok) {
          const data = await statusRes.json();
          setStatus(data.status);
        }
        if (cycleRes.ok) {
          const data = await cycleRes.json();
          setBillingCycle(data.billingCycle);
        }
      } catch (error) {
        console.error('Failed to fetch schedule data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [customerId]);

  const handleSave = async () => {
    try {
      await Promise.all([
        fetch(`/api/customers/${customerId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }),
        fetch(`/api/customers/${customerId}/billing-cycle`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billingCycle }),
        }),
      ]);

      onNext({ status, billingCycle });
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Schedule & Status</h2>

      <div className="space-y-6">
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CustomerStatus)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="ACTIVE">ACTIVE - Normal billing</option>
            <option value="SUSPENDED">SUSPENDED - Billing paused</option>
            <option value="MAINTENANCE">MAINTENANCE - Under maintenance</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Only ACTIVE customers will be included in billing runs.
          </p>
        </div>

        {/* Billing Cycle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Billing Cycle
          </label>
          <select
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly (Mar, Jun, Sep, Dec)</option>
            <option value="YEARLY">Yearly (December only)</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-6">
          <button
            onClick={onBack}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/app/admin/customers/wizard/components/ScheduleStep.tsx
git commit -m "feat: add ScheduleStep component for status and billing cycle"
```

---

## Phase 4: Status-Based Billing & Testing (Week 4)

### Task 4.1: Modify BillingService for Status-Based Filtering

**Files:**
- Modify: `billing-app/src/domain/services/billingService.ts`

- [ ] **Step 1: Add status check to billing service**

Find where billing runs (look for functions that iterate over customers) and add status filtering:

```typescript
// ADD near the top imports or constants
const DYNAMIC_BILLING_ENABLED = process.env.DYNAMIC_BILLING_ENABLED === 'true';

// ADD this function
async function isCustomerBillable(customerId: string): Promise<boolean> {
  // If dynamic billing is not enabled, all customers are billable (backward compat)
  if (!DYNAMIC_BILLING_ENABLED) {
    return true;
  }

  // Check customer status
  const customer = await customerRepository.findById(customerId);
  if (!customer) return false;

  // Legacy: if no status field, default to ACTIVE
  const status = customer.status || 'ACTIVE';
  return status === 'ACTIVE';
}

// MODIFY the billing generation function to check status
// Find the function that gets all customers for billing and add:
const allCustomers = await customerRepository.findAll();
const billableCustomers = [];

for (const customer of allCustomers) {
  if (await isCustomerBillable(customer.id)) {
    billableCustomers.push(customer);
  }
}

// Log skipped customers for visibility
const skipped = allCustomers.length - billableCustomers.length;
if (skipped > 0) {
  console.log(`[Billing] Skipped ${skipped} non-billable customers`);
}
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/domain/services/billingService.ts
git commit -m "feat: add status-based filtering to billing service"
```

---

### Task 4.2: Add Billing Cycle Logic

**Files:**
- Modify: `billing-app/src/domain/services/billingService.ts`

- [ ] **Step 1: Add billing cycle check**

```typescript
// ADD function to check if billing should run for a customer this month
function shouldRunBillingForCustomer(customer: Customer, billingMonth: string): boolean {
  // If dynamic billing not enabled, always run (backward compat)
  if (!DYNAMIC_BILLING_ENABLED) {
    return true;
  }

  const cycle = customer.billingCycle || 'MONTHLY';
  const [year, month] = billingMonth.split('-').map(Number);

  switch (cycle) {
    case 'MONTHLY':
      return true; // Run every month

    case 'QUARTERLY':
      return month % 3 === 0; // Mar, Jun, Sep, Dec

    case 'YEARLY':
      return month === 12; // December only

    default:
      return true;
  }
}

// MODIFY the billing generation loop to check cycle
for (const customer of billableCustomers) {
  if (!shouldRunBillingForCustomer(customer, billingMonth)) {
    console.log(`[Billing] Skipping ${customer.name} - not scheduled for ${billingMonth}`);
    continue;
  }

  // ... existing billing logic
}
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/domain/services/billingService.ts
git commit -m "feat: add billing cycle logic to billing service"
```

---

### Task 4.3: Add Fallback Logic to Data Transformation

**Files:**
- Modify: `billing-app/src/domain/services/billingService.ts` or create new transformer

- [ ] **Step 1: Add fallback value handling**

Find where usage data is processed and add fallback handling:

```typescript
// ADD this function
interface UsageResult {
  usageCount: number;
  sentCount?: number;
  failedCount?: number;
}

function applyFallbackValues(
  dataSource: DataSource,
  usageResult: UsageResult
): UsageResult {
  const fallback = dataSource.fallbackValues;

  // If no fallback configured, return as-is
  if (!fallback || !fallback.useDefaultOnMissing) {
    return usageResult;
  }

  // Apply defaults for missing/zero values
  return {
    usageCount: usageResult.usageCount || fallback.usageCount || 0,
    sentCount: usageResult.sentCount ?? fallback.sentCount ?? 0,
    failedCount: usageResult.failedCount ?? fallback.failedCount ?? 0,
  };
}

// UPDATE the data fetching to use fallback
// Find where usage data is fetched from data sources and update:
const usageResult = await fetchUsageFromDataSource(dataSource);
const resultWithFallback = applyFallbackValues(dataSource, usageResult);
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/domain/services/billingService.ts
git commit -m "feat: add fallback value handling to billing service"
```

---

### Task 4.4: End-to-End Testing

**Files:**
- Test existing billing flow

- [ ] **Step 1: Test with existing Coway customer**

Run the billing service with an existing customer:

```bash
# Start the dev server
cd billing-app && npm run dev

# Test the billing preview endpoint
curl -X POST http://localhost:3000/api/billing/preview \
  -H "Content-Type: application/json" \
  -d '{"billingMonth": "2026-03"}'
```

- [ ] **Step 2: Verify Coway still works**

Check that existing Coway billing continues to function without errors.

- [ ] **Step 3: Test new status filtering**

```bash
# Create a test customer with SUSPENDED status
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "status": "SUSPENDED",
    "billingCycle": "MONTHLY"
  }'

# Run billing and verify suspended customer is skipped
```

- [ ] **Step 4: Commit**

```bash
git add -A  # if any test files created
git commit -m "test: add e2e tests for dynamic billing features"
```

---

### Task 4.5: Create Migration Script for Existing Customers

**Files:**
- Create: `billing-app/src/scripts/migrateCustomerStatus.ts`

- [ ] **Step 1: Write migration script**

```typescript
/**
 * Migration script: Add default status and billingCycle to existing customers
 *
 * Run: npx tsx src/scripts/migrateCustomerStatus.ts
 */

import { customerRepository } from '@/infrastructure/db/customerRepository';

async function migrate() {
  console.log('Starting customer migration...');

  // Get all customers
  const customers = await customerRepository.findAll();
  console.log(`Found ${customers.length} customers`);

  let migrated = 0;

  for (const customer of customers) {
    const updates: any = {};

    // Add status if not exists
    if (!customer.status) {
      updates.status = 'ACTIVE';
    }

    // Add billingCycle if not exists
    if (!customer.billingCycle) {
      updates.billingCycle = 'MONTHLY';
    }

    if (Object.keys(updates).length > 0) {
      await customerRepository.update(customer.id, updates);
      migrated++;
    }
  }

  console.log(`Migrated ${migrated} customers`);
  console.log('Migration complete!');
}

migrate().catch(console.error);
```

- [ ] **Step 2: Run migration**

```bash
cd billing-app && npx tsx src/scripts/migrateCustomerStatus.ts
```

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/scripts/migrateCustomerStatus.ts
git commit -m "feat: add customer migration script for status and billingCycle"
```

---

## Implementation Summary

| Phase | Tasks | Key Files Modified/Created |
|-------|-------|---------------------------|
| Phase 1 | 1.1-1.5 | types/index.ts, dataSource.ts, configCache.ts, configurationService.ts, customerRepository.ts |
| Phase 2 | 2.1-2.4 | DataSource CRUD APIs, DataSourceStep.tsx, status route, billing-cycle route |
| Phase 3 | 3.1-3.4 | credentialEncryption.ts, dataSourceRepository.ts, ScheduleStep.tsx, migrateCredentials.ts |
| Phase 4 | 4.1-4.5 | billingService.ts, migrateCustomerStatus.ts |

**Feature Flag:** Set `DYNAMIC_BILLING_ENABLED=true` in environment to enable new features. Without this flag, system behaves exactly as before (backward compatible).
