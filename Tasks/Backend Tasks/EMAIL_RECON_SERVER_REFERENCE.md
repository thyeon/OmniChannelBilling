# Email Reconciliation Server — API Reference

## 1. Overview

| Item | Value |
|---|---|
| **Server** | Email Recon Server (Coway) |
| **Base URL** | `http://128.199.165.110:8080` |
| **Auth** | Token-based via `x-token` header |
| **Protocol** | HTTP (not HTTPS) |

---

## 2. API: Get Sent Count

Returns the total number of emails sent for a given billing month.

### Endpoint

```
POST /invoice/findSentCount
```

### Headers

| Header | Value | Required |
|---|---|---|
| `Content-Type` | `application/json` | Yes |
| `x-token` | `fGxqeS9pzR7duRBV7xpXSkFBPtQFKn` | Yes |

### Request Body

| Field | Type | Description | Example |
|---|---|---|---|
| `month` | number | Billing month (1=Jan, 2=Feb, ..., 12=Dec) | `1` |
| `year` | number | Billing year | `2026` |

```json
{
  "month": 1,
  "year": 2026
}
```

### Response — Success

```json
{
  "count": 158107
}
```

| Field | Type | Description |
|---|---|---|
| `count` | number | Total emails sent in the billing month. Returns `0` for months with no data. |

### Response — Auth Error (Invalid Token)

```json
{
  "message": "x-token invalid",
  "data": {}
}
```

---

## 3. Verified Test Results

| Billing Month | Request | Response |
|---|---|---|
| Dec 2025 | `{"month": 12, "year": 2025}` | `{"count": 128985}` |
| Jan 2026 | `{"month": 1, "year": 2026}` | `{"count": 158107}` |
| Feb 2026 | `{"month": 2, "year": 2026}` | `{"count": 132109}` |
| Jun 2026 (future) | `{"month": 6, "year": 2026}` | `{"count": 0}` |

---

## 4. Key Differences from SMS Recon Server (Ali SMS2)

| Aspect | SMS Recon (Ali SMS2) | Email Recon |
|---|---|---|
| **Endpoint** | `POST https://sms2.g-i.com.my/api/summary` | `POST http://128.199.165.110:8080/invoice/findSentCount` |
| **Auth** | `user` + `secret` in request body | `x-token` header |
| **Date params** | `dtFrom` / `dtTo` (datetime range) | `month` / `year` (integer) |
| **Response fields** | `total`, `successCount`, `failed`, `notReqToServiceProvider` | `count` only |
| **Granularity** | Sent / Failed / Withheld breakdown | Total sent count only |
| **Protocol** | HTTPS | HTTP |

---

## 5. Implementation Notes

### 5.1 Mapping to Billing App

| Email Recon Field | Billing App Field | Notes |
|---|---|---|
| `count` | `reconTotal` | Total sent count |
| `count` | `reconDetails.sent` | Same as total (no breakdown available) |
| — | `reconDetails.failed` | `0` (not provided by this API) |
| — | `reconDetails.withheld` | `0` (not provided by this API) |

### 5.2 ReconClient Adapter Needed

The current `reconClient.ts` is built for the SMS Recon API format (`dtFrom`/`dtTo` + `user`/`secret` in body). The Email Recon Server uses a different format:

- **Auth**: `x-token` header instead of body params
- **Date format**: `month`/`year` integers instead of datetime range strings
- **Response shape**: `{ count }` instead of `{ success, total, successCount, failed, notReqToServiceProvider }`

**Approach**: Create a new adapter or extend `reconClient.ts` to detect the API type and format requests accordingly. The `ReconServer` type may need new fields:

```typescript
interface ReconServer {
  id: string;
  name: string;
  type: ServiceType;          // "EMAIL"
  userId: string;             // not used for Email recon
  apiKey: string;             // maps to x-token value
  apiEndpoint: string;        // "http://128.199.165.110:8080/invoice/findSentCount"
  apiFormat?: "SMS_RECON" | "EMAIL_RECON";  // NEW — to select the right adapter
}
```

### 5.3 Customer Config (Coway)

To add this as a recon server for Coway's EMAIL service:

```json
{
  "name": "Email Recon Server",
  "type": "EMAIL",
  "userId": "",
  "apiKey": "fGxqeS9pzR7duRBV7xpXSkFBPtQFKn",
  "apiEndpoint": "http://128.199.165.110:8080/invoice/findSentCount",
  "apiFormat": "EMAIL_RECON"
}
```
