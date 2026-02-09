# Fredelicacies POS — Architecture & Migration Reference

> **Purpose**: Compressed context document for agent-assisted migration from Firebase to Supabase.  
> **Generated**: 2026-02-09  
> **Stack**: Next.js 15 (App Router, Turbopack) · React 19 · Firebase 12 · TypeScript 5 · Tailwind CSS 4 · face-api.js

---

## 1. Project Overview

A **multi-branch bakery POS system** ("Fredelicacies") with role-based access, time tracking, inventory management, order processing, discount management, face-recognition clock-in, and Bluetooth receipt printing.

### Key Concepts
- **Multi-branch**: Every data entity is branch-scoped (inventory, orders, discounts). Categories are global.
- **Role hierarchy**: `owner > manager > worker`. Owners have global access; managers/workers are branch-assigned.
- **Real-time**: Uses Firestore `onSnapshot` listeners via a singleton `DataStore` for live UI updates.
- **PWA-ready**: Has `manifest.json`, targets mobile-first (Philippine locale, `Asia/Manila` timezone).

---

## 2. Tech Stack & Dependencies

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15.5 (App Router) | `next dev --turbopack`, path alias `@/*` → `./*` |
| UI | React 19, Tailwind CSS 4, Motion (Framer) | `postcss.config.mjs` with `@tailwindcss/postcss` |
| Auth | Firebase Auth (client SDK) | `signInWithEmailAndPassword`, `browserLocalPersistence` |
| Database | Cloud Firestore | Client SDK (`firebase/firestore`) + Admin SDK (`firebase-admin`) |
| Images | Cloudinary | Upload preset via env vars, remote patterns in `next.config.ts` |
| Face Recognition | face-api.js | TinyFaceDetector + FaceLandmark68 + FaceRecognition models in `/public/models/` |
| Charts | Recharts | Sales analytics |
| Printing | Web Bluetooth API → ESC/POS | Custom `esc_formatter.ts` + `logo_processor.ts` |
| Currency | Philippine Peso (₱) | `lib/currency_formatter.ts` — `formatCurrency()`, `formatPercentage()`, `formatNumber()` |

### Environment Variables (all `NEXT_PUBLIC_` prefixed for client, plus server-side)

**Firebase (Client)**:
```
NEXT_PUBLIC_API_KEY
NEXT_PUBLIC_AUTH_DOMAIN
NEXT_PUBLIC_DATABASE_URL
NEXT_PUBLIC_PROJECT_ID
NEXT_PUBLIC_STORAGE_BUCKET
NEXT_PUBLIC_MESSAGING_SENDER_ID
NEXT_PUBLIC_APP_ID
NEXT_PUBLIC_MEASUREMENT_ID
```

**Firebase Admin (Server)**:
```
GOOGLE_APPLICATION_CREDENTIALS  # Service account JSON path
NEXT_PUBLIC_PROJECT_ID           # Shared with client
```

**Cloudinary**:
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
```

---

## 3. Firebase Configuration

### Client SDK (`firebase-config.js`)
```
Exports: auth (Firebase Auth), db (Firestore), app (Firebase App)
Used by: All services, all contexts
```

### Admin SDK (`lib/firebase-admin.ts`)
```
Exports: adminAuth, adminDb
Used by: Server-side API routes (worker creation/deletion)
Init: Singleton pattern with getApps().length check
```

---

## 4. Firestore Database Schema

### Collection: `users`
```typescript
{
  // Document ID: Firebase Auth UID
  name: string;
  email: string;
  phoneNumber?: string;
  employeeId?: string;
  isOwner: boolean;
  isActive: boolean;
  roleAssignments: Array<{
    branchId: string;
    role: "manager" | "worker";
    assignedAt: Timestamp;
    assignedBy: string;       // UID of assigner
    isActive: boolean;
  }>;
  currentStatus?: "clocked_in" | "clocked_out";  // Only for non-owners
  currentBranchId?: string;                        // Set when clocked in
  lastTimeIn?: Timestamp;
  lastTimeOut?: Timestamp;
  profilePicture?: string;                         // Cloudinary URL
  createdAt: Timestamp;
  createdBy: string;           // UID
  updatedAt: Timestamp;
  passwordResetRequired: boolean;
  twoFactorEnabled: boolean;
  // Optional admin fields
  customClaims?: Record<string, any>;
  tokensRevokedAt?: Timestamp;
  disabledAt?: Timestamp;
}
```

### Collection: `branches`
```typescript
{
  // Document ID: auto-generated
  name: string;
  location: string;
  isActive: boolean;
  imgUrl: string;              // Cloudinary URL
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `inventory`
```typescript
{
  // Document ID: auto-generated
  name: string;
  price: number;
  cost?: number;               // For profit calculation
  categoryId: string;          // References categories collection
  stock: number;
  description: string;
  imgUrl?: string;             // Cloudinary URL
  branchId: string;            // ★ Branch-scoped
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `categories` (GLOBAL — not branch-scoped)
```typescript
{
  // Document ID: auto-generated
  name: string;
  color: string;               // Hex color code
  createdAt: Timestamp;
}
```

### Collection: `orders`
```typescript
{
  // Document ID: auto-generated (also stored as `id` field)
  id: string;
  items: Array<{
    id: string;
    name: string;
    price: number;             // Price at time of sale
    cost: number;              // Cost at time of sale
    quantity: number;
    subtotal: number;          // price × quantity
    profit: number;            // (price - cost) × quantity
    imgUrl: string;
    categoryId: string;
  }>;
  total: number;
  subtotal: number;
  discountAmount: number;
  totalProfit: number;
  discountCode: string;
  orderType: "DINE-IN" | "TAKE OUT" | "DELIVERY";
  workerName: string;
  workerUid: string;
  branchId: string;            // ★ Branch-scoped
  createdAt: Timestamp;
  timestamp: Timestamp;        // Duplicate of createdAt
  itemCount: number;           // Total quantity across items
  uniqueItemCount: number;     // Number of distinct items
}
```

### Collection: `attendance`
```typescript
{
  // Document ID: auto-generated
  userId: string;
  branchId: string;
  timeInAt: Timestamp;
  timeOutAt?: Timestamp;       // null when actively clocked in
  clockedInBy: string;         // UID (currently self)
  clockedOutBy?: string;
  duration?: number;           // Minutes (calculated on clock-out)
  notes?: string;
  attendanceType: "scheduled" | "emergency" | "overtime";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `discounts`
```typescript
{
  // Document ID: discount_code (user-defined string)
  discount_code: string;
  type: "percentage" | "flat";
  value: number;
  applies_to: string | null;  // Category ID or null (all categories)
  branchId: string;
  scope: "all_branches" | "specific_branch";
  created_by: string;          // UID
  created_at: Timestamp;
  modified_at: Timestamp;
}
```

### Collection: `faceEmbeddings`
```typescript
{
  // Document ID: userId (Firebase Auth UID)
  userId: string;
  embeddings: Array<{          // Max 5 embeddings per user
    embedding: number[];       // 128-dimensional float array
    capturedAt: Date;
    imageUrl?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Collection: `settings`
```typescript
{
  // Document ID: "global" (single document)
  hideOutOfStock: boolean;     // Default: false
}
```

---

## 5. Service Layer Architecture

All services are in `services/` and export either a singleton object or standalone functions. Every service imports `db` from `firebase-config.js` and uses Firestore SDK directly.

### `authService.ts`
| Method | Firestore Op | Description |
|--------|-------------|-------------|
| `createUserAccount()` | Auth: `createUserWithEmailAndPassword` | Creates Firebase Auth user |
| `getUserData(userId)` | `getDoc(users/{userId})` | Returns user profile |
| `updateUserRoles(userId, roles)` | `updateDoc(users/{userId})` | Updates roleAssignments array |
| `assignUserToBranch(userId, branchId, role)` | `updateDoc(users/{userId})` | Adds/updates role assignment |
| `removeUserFromBranch(userId, branchId)` | `updateDoc(users/{userId})` | Soft-deactivates assignment (preserves history) |
| `createUserProfile(userId, data)` | `setDoc(users/{userId})` | Full user doc creation |
| `promoteToOwner(userId)` | `updateDoc` | Sets `isOwner: true` |
| `demoteFromOwner(userId)` | `updateDoc` | Sets `isOwner: false` |
| `deleteUserAccount(userId)` | `updateDoc` | Soft delete (`isActive: false`) |
| `resetUserPassword(email)` | Auth: `sendPasswordResetEmail` | Firebase Auth email reset |
| `createMultipleUsers(users[])` | Loop: Auth + Firestore | Bulk user creation |
| `checkEmailExists(email)` | `getDocs(where email ==)` | Pre-signup validation |
| `getAllUsers()` | `getDocs(users, orderBy createdAt)` | Admin: list all users |
| `adminAssignUserToBranch()` | `updateDoc` | Admin branch assignment (replaces) |
| `adminRemoveUserFromBranch()` | `updateDoc` | Admin branch removal (hard delete from array) |

### `branchService.ts`
| Method | Firestore Op | Description |
|--------|-------------|-------------|
| `getAllBranches()` | `getDocs(branches, orderBy name)` | All branches |
| `getBranchById(id)` | `getDoc(branches/{id})` | Single branch |
| `getUserBranches(assignments[])` | Batched `getDocs(where __name__ in [...])` | Branches for user's assignments (batches of 10) |
| `createBranch(data)` | `addDoc(branches)` | New branch |
| `updateBranch(id, updates)` | `updateDoc(branches/{id})` | Update branch |
| `deleteBranch(id)` | `deleteDoc(branches/{id})` | Hard delete |
| `deactivateBranch(id)` | `updateDoc(isActive: false)` | Soft delete |
| `getActiveBranches()` | `getDocs(where isActive == true)` | Active only |
| `subscribeToBranches(callback)` | `onSnapshot(branches)` | Real-time listener, returns unsubscribe fn |

### `inventoryService.ts`
All operations are **branch-scoped** (first parameter is `branchId`).

| Method | Firestore Op | Description |
|--------|-------------|-------------|
| `createInventoryItem(branchId, item)` | `addDoc(inventory)` | New item with branchId |
| `getInventoryItems(branchId)` | `getDocs(where branchId ==)` | All items for branch |
| `subscribeToInventoryItems(branchId, cb)` | `onSnapshot(where branchId ==)` | Real-time listener |
| `updateInventoryItem(branchId, id, updates)` | `updateDoc(inventory/{id})` | Update item |
| `deleteInventoryItem(branchId, id)` | `deleteDoc(inventory/{id})` | Delete item |
| `bulkUpdateStock(branchId, updates[])` | Parallel `updateDoc` | Stock adjustments (used after orders) |
| `searchInventoryItems(branchId, term)` | Client-side filter | Name/description search |
| `getLowStockItems(branchId, threshold)` | Client-side filter | Items ≤ threshold stock |

### `orderService.ts`
| Method | Firestore Op | Description |
|--------|-------------|-------------|
| `createOrder(...)` | `setDoc(orders/{auto})` | Creates order + calls `bulkUpdateStock()` |
| `getAllOrders()` | `getDocs(orders, orderBy createdAt desc)` | All orders |
| `getOrdersByDateRange(start, end)` | `getDocs(where createdAt >= && <=)` | Date-filtered orders |
| `calculateSalesStats(orders)` | Pure function | Revenue, profit, items sold, avg order value |
| `getTopSellingItems(orders, limit)` | Pure function | Aggregated top sellers |

**Note**: Orders are stored flat (not branch-sub-collected) but have `branchId` field. Queries don't filter by branch currently — done client-side.

### `attendanceService.ts`
| Method | Firestore Op | Side Effects |
|--------|-------------|-------------|
| `createAttendance(data)` | `addDoc(attendance)` | — |
| `getAttendance(id)` | `getDoc(attendance/{id})` | — |
| `updateAttendance(id, updates)` | `updateDoc(attendance/{id})` | — |
| `deleteAttendance(id)` | `deleteDoc(attendance/{id})` | — |
| `listAttendances(userId, dateRange?)` | `getDocs(where userId ==, orderBy timeInAt)` | — |
| `getActiveAttendance(userId)` | `getDocs(where userId == && timeOutAt == null)` | — |
| `getRecentAttendances(userId, days)` | `getDocs(where userId == && timeInAt >=)` | — |
| `getBranchAttendances(branchId, dateRange?)` | `getDocs(where branchId ==)` | — |
| `timeInWorker(userId, branchId)` | `addDoc(attendance)` + `updateDoc(users/{userId})` | Updates user status to `clocked_in` |
| `timeOutWorker(userId, attendanceId)` | `updateDoc(attendance/{id})` + `updateDoc(users/{userId})` | Updates user status to `clocked_out`, calculates duration |

### `categoryService.ts`
| Method | Firestore Op | Description |
|--------|-------------|-------------|
| `createCategory(data)` | `addDoc(categories)` | New category |
| `getCategories()` | `getDocs(categories, orderBy name)` | All categories |
| `subscribeToCategories(cb)` | `onSnapshot(categories)` | Real-time listener |
| `deleteCategory(id)` | `deleteDoc(categories/{id})` | Delete category |

### `discountService.ts`
| Method | Firestore Op | Description |
|--------|-------------|-------------|
| `createDiscount(data)` | `setDoc(discounts/{code})` | Uses discount_code as doc ID |
| `getDiscounts(branchId?)` | `getDocs(discounts)` + client filter | Filters by scope + branchId |
| `updateDiscount(code, updates)` | `updateDoc(discounts/{code})` | Update discount |
| `deleteDiscount(code)` | `deleteDoc(discounts/{code})` | Delete discount |
| `getDiscountByCode(code, branchId?)` | Calls `getDiscounts()` + filter | Lookup by code |
| `calculateDiscountAmount(discount, subtotal, categoryIds)` | Pure function | Percentage or flat calculation |

### `settingsService.ts`
| Method | Firestore Op | Description |
|--------|-------------|-------------|
| `loadSettings(forceRefresh?)` | `getDoc(settings/global)` | Cached in localStorage (1hr TTL) |
| `syncSettingsToFirebase(settings)` | `setDoc(settings/global, merge)` | Writes + updates cache |
| `loadSettingsFromLocal()` | localStorage only | Fallback |

### `salesService.ts`
Pure computation module (no Firestore calls). Accepts `Order[]` and produces:
- `generateHourlyData(orders)` → hourly revenue/profit/items
- `generateDailyStats(orders, date)` → daily aggregates with hourly breakdown, top items, order type breakdown
- `generateWeeklyStats(orders, weekStart)` → weekly aggregates with daily breakdown

### `faceRecognitionService.ts`
Singleton class `FaceRecognitionService` (exported as instance).

| Method | Firestore Op | Description |
|--------|-------------|-------------|
| `loadModels()` | None (loads from `/public/models/`) | Loads TinyFaceDetector, FaceLandmark68, FaceRecognition |
| `detectFaceAndGetDescriptor(element)` | None | Returns 128-dim `Float32Array` |
| `getUserFaceEmbedding(userId)` | `getDoc(faceEmbeddings/{userId})` | Backward-compatible (old single / new multi format) |
| `getUserFaceEmbeddings(userId)` | `getDoc(faceEmbeddings/{userId})` | Returns all embeddings |
| `saveFaceEmbedding(userId, descriptor)` | `setDoc` or `updateDoc(faceEmbeddings/{userId})` | Max 5 embeddings, FIFO |
| `deleteFaceEmbedding(userId)` | `deleteDoc(faceEmbeddings/{userId})` | Remove all embeddings |
| `verifyFace(userId, element)` | Read embeddings + compute | Best-match against all embeddings, threshold 0.6 |
| `enrollFace(userId, element)` | Detect + save | Full enrollment flow |
| `hasEnrollment(userId)` | `getDoc` | Boolean check |

### `workerService.ts`
Composite service that delegates to `authService` and `attendanceService`.

| Method | Operation | Description |
|--------|----------|-------------|
| `createWorker(data)` | `fetch("/api/admin/workers", POST)` + `authService.createUserProfile()` | Server-side Firebase Admin for Auth creation |
| `getWorker(userId)` | `getDoc(users/{userId})` | Full worker profile |
| `updateWorker(userId, updates)` | `updateDoc(users/{userId})` | Partial update with Timestamp conversion |
| `deleteWorker(userId)` | `fetch("/api/admin/workers", DELETE)` | Server-side Firebase Admin for Auth deletion |
| `deleteWorkerData(userId)` | `writeBatch` (delete user + attendances) | Firestore cleanup |
| `listWorkers(filters?)` | `getDocs(users)` + client-side filter | Filters: branch, role, status, search, excludeOwners |
| `getWorkerStats(userId)` | Calls `attendanceService.listAttendances()` | Computes stats from attendance history |

**Important**: Worker creation/deletion uses an **API route** (`/api/admin/workers`) that uses Firebase Admin SDK server-side. This route is NOT in the repo file listing — likely deployed separately or needs to be created.

---

## 6. State Management

### DataStore (`stores/dataStore.ts`)
A **singleton class** that manages Firestore `onSnapshot` real-time subscriptions per branch.

**Architecture**:
- Uses an internal `EventEmitter` for pub/sub
- Organizes data by branch: `inventoryItems[branchId]`, `orders[branchId]`, `discounts[branchId]`
- Global data: `categories[]`, `branches[]`
- Individual worker tracking: `workers[userId]`
- Auto-starts global listeners (categories) on instantiation
- Branch-specific listeners are lazily started when subscribed to

**Exported subscribe functions** (used by components):
```typescript
subscribeToInventory(branchId, callback)    → InventoryItem[]
subscribeToCategories(callback)             → Category[]
subscribeToOrders(branchId, callback)       → Order[]
subscribeToDiscounts(branchId, callback)    → Discount[]
subscribeToBranches(callback)               → Branch[]
subscribeToWorker(userId, callback)         → Worker (single doc listener)
```

Each returns an unsubscribe function. Listeners are reference-counted — they start on first subscriber and stop when all unsubscribe.

---

## 7. Context Providers (React)

### Provider Hierarchy (root `layout.tsx`)
```
AuthProvider
  └── TimeTrackingProvider (autoRefresh: true)
        └── BranchProvider
              └── DateTimeProvider
                    └── {children}
```

### Branch-scoped layout (`[branchId]/layout.tsx`)
```
AuthGuard
  └── BluetoothProvider
        └── BranchProvider (initialBranchId from URL)
              └── DrawerProvider
                    └── {children}
```

### Owner layout (`owner/layout.tsx`)
```
AuthGuard (ownerOnly)
  └── DrawerProvider
        └── BluetoothProvider
              └── BranchProvider
                    └── {children}
```

### `AuthContext`
**Source**: `contexts/AuthContext.tsx`  
**Firebase dependency**: `onAuthStateChanged`, `signInWithEmailAndPassword`, `signOut`  
**State**: `user: User | null`, `loading: boolean`

Extends `FirebaseUser` with:
- `roleAssignments: RoleAssignment[]`
- `isOwner: boolean`
- `name?: string`

**Key methods** (all derived from user state + `authService`):
- `login(email, password)`, `logout()`
- `getUserRoleForBranch(branchId)` → `"manager" | "worker" | null`
- `isUserOwner()`, `isManager()`, `isWorker()`
- `canAccessBranch(branchId)` — owners always true
- `canManageWorkers()`, `canCreateWorker()`, `canDeleteWorker()`
- `getUserHierarchyLevel()` → `"owner" | "manager" | "worker" | null`
- `refreshUserData()` — re-fetches from Firestore

**Auth flow**: `onAuthStateChanged` → fetch `users/{uid}` via `authService.getUserData()` → build extended `User` object. If user doc doesn't exist (deleted user), forces logout.

### `BranchContext`
**Source**: `contexts/BranchContext.tsx`  
**Depends on**: `AuthContext`, `branchService`, `workerService`, `branchAccess` utils

**State**: `currentBranch`, `availableBranches`, `allBranches`, `accessibleBranches`, `currentWorker`, `managerBranches`, `workerBranches`, `summary`

**Logic**:
- Owners see all branches, non-owners see assigned branches only
- Loads branches + worker data in parallel (`Promise.allSettled`)
- URL-driven: if `initialBranchId` is in URL, selects that branch
- Non-owners auto-select first available branch

### `TimeTrackingContext`
**Source**: `contexts/TimeTrackingContext.tsx`  
**Depends on**: `AuthContext`, `workerService`, `attendanceService`, `dataStore`

**State**: `worker`, `isWorking`, `currentAttendance`, `workingDuration` (minutes), `loading`, `error`

**Key behaviors**:
- Uses `subscribeToWorker()` from dataStore for real-time user status
- Owners are exempt from time tracking
- `clockIn(branchId)` → `attendanceService.timeInWorker()`
- `clockOut()` → `attendanceService.timeOutWorker()`
- Auto-refresh: updates duration every 60s, syncs attendance data every ~5min

### `BluetoothContext`
**Source**: `contexts/BluetoothContext.tsx`  
**No Firebase dependency** — uses Web Bluetooth API + localStorage for printer persistence.

**State**: `bluetoothDevice`, `bluetoothStatus`, `isConnecting`  
**Methods**: `connectToBluetoothPrinter()`, `disconnectPrinter()`, `testPrint()`, `printReceipt(Uint8Array)`

### `DateTimeContext`
**Source**: `contexts/DateTimeContext.tsx`  
**No Firebase dependency** — singleton `TimeService` syncs with internet time APIs.

**Behaviors**:
- Forces `Asia/Manila` timezone for all displays
- Syncs via WorldTimeAPI/TimeAPI every 2 minutes
- Detects time jumps (system clock changes)
- Falls back to local time if offline
- Uses `en-PH` locale

---

## 8. Route Architecture

```
/                           → Root redirect (owner→/owner/branches, worker→/{branchId}/store)
/login                      → Login page
/signup                     → Signup page
/waiting-room               → Pending approval (no branch assignments)

/(main)/[branchId]/          → Branch-scoped layout (AuthGuard + BluetoothProvider + BranchProvider)
  ├── (worker)/
  │   ├── store/             → POS storefront (product grid, cart, checkout)
  │   └── inventory/         → Inventory view (read-only for workers)
  └── (manager)/
      ├── management/        → Worker management
      ├── sales/             → Sales analytics & reports
      ├── discounts/         → Discount management
      └── settings/          → Branch settings

/(main)/owner/               → Owner layout (AuthGuard ownerOnly)
  ├── branches/              → Branch CRUD management
  ├── users/                 → Global user management
  ├── logs/                  → Activity logs
  └── page.tsx               → Owner dashboard
```

**Route groups** `(worker)` and `(manager)` are Next.js route groups (no URL segment). Access control is handled by components, not middleware.

---

## 9. Auth & Access Control

### AuthGuard Component
**Props**: `requiredRole?`, `requiredBranch?`, `adminOnly?`, `ownerOnly?`

**Flow**:
1. If loading → show spinner
2. If not authenticated → redirect to `/login`
3. If no roleAssignments and not owner → redirect to `/waiting-room`
4. If `ownerOnly` and not owner → redirect to `/login`
5. If `requiredBranch` and can't access → deny
6. If `requiredRole` and doesn't match → deny
7. Otherwise → render children

### POSAccessGuard Component
Wraps POS pages to require clock-in before access.
Uses `usePOSAccessControl(branchId)` from `TimeTrackingContext`.
Shows `QuickTimeWidget` for easy clock-in.

### Branch Access Utils (`utils/branchAccess.ts`)
Pure functions for access logic:
- `getAccessibleBranches(user, worker, allBranches)` → filtered branches
- `canAccessBranch(user, worker, branchId)` → boolean
- `getUserRoleInBranch(worker, branchId)` → role string
- `canManageWorkersInBranch()`, `canManageWorker()`, `filterAccessibleWorkers()`
- `requiresClockInForPOS(worker, branchId)` → boolean (owners exempt)

---

## 10. External Services

### Cloudinary (`lib/cloudinary.ts`)
- `uploadToCloudinary(file: File)` → `{ secure_url, public_id, ... }`
- Used for: branch images, product images, profile pictures
- Unsigned upload via upload preset

### ESC/POS Receipt Printing (`lib/esc_formatter.ts`, `lib/logo_processor.ts`)
- `formatReceiptESC(order, logoUrl?)` → `Uint8Array`
- Formats: store name, branch name, items table, totals, cashier info
- `LogoProcessor` class: converts images to monochrome bitmaps with Floyd-Steinberg dithering
- Output sent via Bluetooth `writeValue()` in chunks

---

## 11. Key Data Flows

### Order Creation
```
User selects items → Cart state → Apply discount → createOrder()
  → setDoc(orders/{id})
  → bulkUpdateStock(branchId, items[])
      → getInventoryItems(branchId)
      → parallel updateDoc(inventory/{id}) for each item
  → formatReceiptESC() → printReceipt() via Bluetooth
```

### Worker Clock-In/Out
```
clockIn(branchId):
  → addDoc(attendance) with timeInAt=now
  → updateDoc(users/{userId}) → currentStatus="clocked_in", currentBranchId=branchId
  → DataStore onSnapshot triggers → TimeTrackingContext updates

clockOut():
  → updateDoc(attendance/{id}) → timeOutAt=now, duration=calculated
  → updateDoc(users/{userId}) → currentStatus="clocked_out", currentBranchId=null
  → DataStore onSnapshot triggers → TimeTrackingContext updates
```

### User Registration
```
Signup page → createUserWithEmailAndPassword()
  → No Firestore doc created yet (or minimal)
  → User redirected to /waiting-room
  → Owner/manager assigns branch via authService.assignUserToBranch()
  → User can now access /{branchId}/store
```

### Worker Creation (Admin)
```
Owner/Manager → workerService.createWorker()
  → POST /api/admin/workers (Firebase Admin creates Auth user)
  → authService.createUserProfile() → setDoc(users/{newUserId})
```

---

## 12. Firestore Security Considerations

Current implementation uses **client-side SDK for most operations**, meaning Firestore Security Rules are critical. Notable patterns:
- User documents use **Firebase Auth UID as document ID**
- Face embeddings use **userId as document ID**
- Discounts use **discount_code as document ID**
- Settings use **hardcoded "global" document ID**
- Branch filtering is partially **client-side** (roleAssignments contain complex objects)
- Worker deletion uses **server-side API route** with Admin SDK
- Soft deletes preferred (`isActive: false`) over hard deletes for users/branches

---

## 13. Migration-Critical Notes (Firebase → Supabase)

### Authentication
- **Firebase Auth** → **Supabase Auth**: email/password auth, `onAuthStateChanged` → `onAuthStateChange`, `browserLocalPersistence` → Supabase handles automatically
- User metadata stored in Firestore `users` collection → will need a `profiles` table in Supabase
- Firebase Admin SDK (server-side user creation) → Supabase Admin client (`supabase.auth.admin`)

### Database
- **Firestore (NoSQL)** → **PostgreSQL (relational)**: requires schema normalization
  - `roleAssignments` array in user docs → separate `role_assignments` junction table
  - `items` array in orders → separate `order_items` table
  - `embeddings` array in faceEmbeddings → separate `face_embeddings` table
- **Real-time listeners** (`onSnapshot`) → **Supabase Realtime** (`channel.on('postgres_changes', ...)`)
- **Timestamps**: `Timestamp` objects → PostgreSQL `timestamptz`
- **Document IDs**: auto-generated → UUID primary keys (or keep using auth UID for profiles)
- **Composite queries**: Firestore's limited query model → full SQL flexibility
- **Batch writes**: `writeBatch` → PostgreSQL transactions

### DataStore Singleton
- Entire `stores/dataStore.ts` needs rewrite for Supabase Realtime channels
- Pattern stays the same (singleton + EventEmitter) but subscription mechanism changes
- Supabase channels are more flexible (can subscribe to specific rows)

### Storage
- Cloudinary is independent of Firebase — **no migration needed**
- Face recognition models in `/public/models/` — **no migration needed**

### API Routes
- Worker creation/deletion API route uses Firebase Admin → needs Supabase Admin client
- No other API routes found

### Settings
- Single `settings/global` document → could be a `settings` table row or env vars

### Key Complexity Areas
1. **Role assignments** (nested array → relational table + RLS policies)
2. **Real-time subscriptions** (rewrite DataStore for Supabase channels)
3. **Branch-scoped queries** (currently some are client-side filtered → can be proper SQL)
4. **Auth state management** (AuthContext provider needs Supabase auth hooks)
5. **Face embeddings** (array field → `pgvector` extension could be beneficial)

### Files That Need Changes (by impact)
| Impact | Files |
|--------|-------|
| **Heavy** | `firebase-config.js`, `lib/firebase-admin.ts`, `stores/dataStore.ts`, `contexts/AuthContext.tsx` |
| **Heavy** | All 9 files in `services/` |
| **Medium** | `contexts/BranchContext.tsx`, `contexts/TimeTrackingContext.tsx` |
| **Medium** | `utils/branchAccess.ts` (Timestamp → Date changes) |
| **Light** | `components/AuthGuard.tsx`, `components/POSAccessGuard.tsx` (just use new context) |
| **None** | `contexts/BluetoothContext.tsx`, `contexts/DateTimeContext.tsx`, `lib/cloudinary.ts`, `lib/esc_formatter.ts`, `lib/logo_processor.ts`, `lib/currency_formatter.ts`, `services/salesService.ts` |

---

## 14. Suggested Supabase Schema (Reference)

```sql
-- Users/profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  employee_id TEXT,
  is_owner BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  current_status TEXT CHECK (current_status IN ('clocked_in', 'clocked_out')),
  current_branch_id UUID REFERENCES branches(id),
  profile_picture TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role assignments (normalized from array)
CREATE TABLE role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('manager', 'worker')),
  assigned_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, branch_id)
);

-- Branches
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  img_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (global)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory (branch-scoped)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) DEFAULT 0,
  category_id UUID REFERENCES categories(id),
  stock INTEGER DEFAULT 0,
  description TEXT,
  img_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  total DECIMAL(10,2),
  subtotal DECIMAL(10,2),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_profit DECIMAL(10,2),
  discount_code TEXT,
  order_type TEXT CHECK (order_type IN ('DINE-IN', 'TAKE OUT', 'DELIVERY')),
  worker_name TEXT,
  worker_uid UUID REFERENCES profiles(id),
  item_count INTEGER,
  unique_item_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items (normalized from array)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory(id),
  name TEXT NOT NULL,
  price DECIMAL(10,2),
  cost DECIMAL(10,2),
  quantity INTEGER,
  subtotal DECIMAL(10,2),
  profit DECIMAL(10,2),
  img_url TEXT,
  category_id UUID REFERENCES categories(id)
);

-- Attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  time_in_at TIMESTAMPTZ NOT NULL,
  time_out_at TIMESTAMPTZ,
  clocked_in_by UUID REFERENCES profiles(id),
  clocked_out_by UUID REFERENCES profiles(id),
  duration INTEGER, -- minutes
  notes TEXT,
  attendance_type TEXT CHECK (attendance_type IN ('scheduled', 'emergency', 'overtime')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discounts
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code TEXT UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('percentage', 'flat')),
  value DECIMAL(10,2),
  applies_to UUID REFERENCES categories(id),
  branch_id UUID REFERENCES branches(id),
  scope TEXT CHECK (scope IN ('all_branches', 'specific_branch')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Face embeddings
CREATE TABLE face_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  embedding FLOAT8[] NOT NULL, -- 128-dimensional vector
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  image_url TEXT
);
-- Max 5 per user enforced at application level

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

*End of architecture document.*
