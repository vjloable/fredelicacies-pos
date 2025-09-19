# Branch Management System Architecture

## Overview

This document describes the architecture for the Branch Management System, focusing on branch-specific inventory views, role-based access, admin capabilities, and security/isolation requirements.

---

## 1. Branch-Specific Inventory Views

- **Inventory Structure:**
  - Each branch has a dedicated inventory view, implemented in `app/(main)/inventory/`.
  - Inventory data is scoped per branch, ensuring separation and isolation.
- **Access Control:**
  - Only users assigned to a branch (workers/managers) can access its inventory.
  - Access logic is enforced via context providers (see `contexts/AuthContext.tsx`) and route guards (e.g., `components/AuthGuard.tsx`).

---

## 2. Role-Based Access

- **Roles Supported:**
  - **Manager:** Elevated permissions (e.g., manage inventory, approve changes).
  - **Worker:** Limited permissions (e.g., view inventory, perform basic operations).
- **Role Assignment:**
  - Roles are assigned per branch, restricting access to branch-specific data.
  - Role checks are performed in UI components and backend service calls.
- **Implementation:**
  - Role and branch assignments are stored in user profiles (Firebase Auth, custom claims, or database).
  - Access logic is centralized in authentication context (`AuthContext.tsx`).

---

## 3. Admin Access

- **Admin Privileges:**
  - Admins have unrestricted access to all branch inventories.
  - Admins view inventories via a tabbed interface, each tab representing a branch (`app/(main)/branches/`).
- **No Role Restriction:**
  - Admins bypass branch-specific role checks.

---

## 4. Security and Isolation

- **Data Isolation:**
  - Workers/managers cannot access inventories of unassigned branches.
  - Inventory data is fetched and displayed only for the user's assigned branch.
- **Integrity Enforcement:**
  - All data operations are validated against user roles and branch assignments.
  - Context and service layers enforce isolation (see `contexts/AuthContext.tsx`, `services/inventoryService.ts`).

---

## 5. Key Files & Components

- `contexts/AuthContext.tsx`: Manages authentication state and provides auth methods to components.
- `services/authService.ts`: Handles authentication business logic, user data fetching, and role management.
- `components/AuthGuard.tsx`: Protects routes based on user role and branch.
- `app/(main)/branches/`: UI for branch management and admin tabbed view.
- `app/(main)/inventory/`: Inventory views scoped per branch.
- `services/inventoryService.ts`: Handles inventory data operations, enforcing branch isolation.

---

---

## 7. Firebase Document Structure

### Branches Collection

```json
branches: {
  [branchId]: {
    name: string,
    location: string,
    createdAt: timestamp,
    updatedAt: timestamp,
    isActive: boolean
  }
}
```

### Inventory Collection (Scoped by Branch)

```json
inventories: {
  [branchId]: {
    items: [
      {
        itemId: string,
        name: string,
        quantity: number,
        price: number,
        category: string,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]
  }
}
```

### Users Collection & Role Assignments

```json
users: {
  [userId]: {
    name: string,
    email: string,
    roleAssignments: [
      {
        branchId: string,
        role: "manager" | "worker"
      }
    ],
    isAdmin: boolean,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}
```

#### Security Rules (Example)

```js
// Only allow access to inventories for assigned branches
match /inventories/{branchId} {
  allow read, write: if request.auth != null &&
    (isAdmin(request.auth.uid) || isAssignedToBranch(request.auth.uid, branchId));
}

// Helper functions
function isAdmin(userId) {
  return get(/databases/$(database)/documents/users/$(userId)).data.isAdmin == true;
}

function isAssignedToBranch(userId, branchId) {
  let user = get(/databases/$(database)/documents/users/$(userId)).data;
  return user.roleAssignments.hasAny([{branchId: branchId}]);
}
```

---

## 8. Implementation Instructions

### Phase 1: Database Setup

1. **Create Firestore Collections:**

   ```bash
   # Create collections in Firebase Console:
   # - branches
   # - inventories
   # - users
   ```

2. **Set up Security Rules:**
   ```js
   // Add the security rules from section 7 to firestore.rules
   ```

### Phase 2: Authentication Enhancement

1. **Update AuthContext (`contexts/AuthContext.tsx`):**

   ```typescript
   // Simplified AuthContext that delegates to authService
   interface User extends FirebaseUser {
   	roleAssignments: Array<{ branchId: string; role: "manager" | "worker" }>;
   	isAdmin: boolean;
   }

   interface AuthContextType {
   	user: User | null;
   	loading: boolean;
   	login: (email: string, password: string) => Promise<void>;
   	logout: () => Promise<void>;
   	isAuthenticated: boolean;

   	// Role checking methods
   	getUserRoleForBranch: (branchId: string) => "manager" | "worker" | null;
   	getAssignedBranches: () => string[];
   	isUserAdmin: () => boolean;
   	canAccessBranch: (branchId: string) => boolean;
   	refreshUserData: () => Promise<void>;
   }

   // Implementation calculates roles from user.roleAssignments
   const AuthProvider = ({ children }) => {
   	const getUserRoleForBranch = (branchId: string) => {
   		if (!user) return null;
   		const assignment = user.roleAssignments.find(
   			(a) => a.branchId === branchId
   		);
   		return assignment?.role || null;
   	};

   	const getAssignedBranches = () => {
   		if (!user) return [];
   		return user.roleAssignments.map((assignment) => assignment.branchId);
   	};

   	const canAccessBranch = (branchId: string) => {
   		if (!user) return false;
   		if (user.isAdmin) return true;
   		return user.roleAssignments.some(
   			(assignment) => assignment.branchId === branchId
   		);
   	};
   };
   ```

2. **Create Auth Service (`services/authService.ts`):**

   ```typescript
   export const authService = {
     // User data management
     getUserData: (userId: string) => Promise<UserData>,
     updateUserRoles: (userId: string, roleAssignments: RoleAssignment[]) => Promise<void>,

     // Role checking utilities
     getUserRoleForBranch: (user: User, branchId: string) => "manager" | "worker" | null,
     getAssignedBranches: (user: User) => string[],
     isUserAdmin: (user: User) => boolean,
     canAccessBranch: (user: User, branchId: string) => boolean,

     // Branch assignment management
     assignUserToBranch: (userId: string, branchId: string, role: "manager" | "worker") => Promise<void>,
     removeUserFromBranch: (userId: string, branchId: string) => Promise<void>,

     // Admin operations
     promoteToAdmin: (userId: string) => Promise<void>,
     demoteFromAdmin: (userId: string) => Promise<void>
   };
   ```

3. **Create Branch Service (`services/branchService.ts`):**
   ```typescript
   export const branchService = {
   	getAllBranches,
   	getBranchById,
   	getUserBranches,
   	createBranch,
   	updateBranch,
   	deleteBranch,
   };
   ```

### Phase 3: Route Protection

1. **Enhance AuthGuard (`components/AuthGuard.tsx`):**

   ```typescript
   interface AuthGuardProps {
   	children: React.ReactNode;
   	requiredRole?: "manager" | "worker";
   	requiredBranch?: string;
   	adminOnly?: boolean;
   }
   ```

2. **Create Branch-Specific Routes:**
   ```
   app/(main)/branches/[branchId]/
   ├── inventory/
   │   ├── page.tsx
   │   └── components/
   ├── sales/
   │   └── page.tsx
   └── settings/
       └── page.tsx
   ```

### Phase 4: Inventory Service Updates

1. **Update Inventory Service (`services/inventoryService.ts`):**
   ```typescript
   // Add branchId parameter to all methods
   export const inventoryService = {
     getInventoryByBranch(branchId: string),
     addItemToBranch(branchId: string, item: InventoryItem),
     updateItemInBranch(branchId: string, itemId: string, updates: Partial<InventoryItem>),
     deleteItemFromBranch(branchId: string, itemId: string)
   };
   ```

### Phase 5: UI Components

1. **Create Branch Selector Component:**

   ```typescript
   // components/BranchSelector.tsx
   export function BranchSelector() {
   	// For admins: dropdown to switch between branches
   	// For workers/managers: show current branch only
   }
   ```

2. **Create Admin Branch Tabs:**

   ```typescript
   // app/(main)/branches/page.tsx
   export default function BranchesPage() {
   	// Tabbed interface for admins
   	// Redirect for non-admins to their assigned branch
   }
   ```

3. **Update Inventory Page:**
   ```typescript
   // app/(main)/inventory/page.tsx
   // Add branch context and filtering
   ```

### Phase 6: Testing & Validation

1. **Create Test Users:**

   ```javascript
   // Test scenarios:
   // - Admin user (access all branches)
   // - Manager user (access specific branch)
   // - Worker user (limited access to specific branch)
   ```

2. **Test Access Controls:**
   ```javascript
   // Verify:
   // - Branch isolation
   // - Role-based permissions
   // - Admin override capabilities
   ```

### Phase 7: Deployment Steps

1. **Update Firebase Configuration:**

   ```bash
   # Deploy security rules
   firebase deploy --only firestore:rules
   ```

2. **Migrate Existing Data:**

   ```typescript
   // Create migration script to:
   // - Add branch assignments to existing users
   // - Scope existing inventory to default branch
   ```

3. **Update Environment Variables:**
   ```env
   # Add any branch-specific configurations
   NEXT_PUBLIC_DEFAULT_BRANCH_ID=main-branch
   ```

---

## 9. Diagram

```
+-------------------+      +-------------------+
|   Admin User      | ---> | Tabbed Branch UI  |
+-------------------+      +-------------------+
         |                        |
         v                        v
+-------------------+      +-------------------+
| Branch Manager    | ---> | Branch Inventory  |
+-------------------+      +-------------------+
         |                        |
         v                        v
+-------------------+      +-------------------+
| Branch Worker     | ---> | Branch Inventory  |
+-------------------+      +-------------------+
```

---

## 10. Future Enhancements

- Worker/Manager permission details to be defined in worker management task.
- Consider using custom claims or Firestore rules for fine-grained access control.
- Implement audit logging for branch operations
- Add branch-specific analytics and reporting
- Consider implementing branch hierarchies (parent/child branches)

---

## 11. Security Notes

- All access checks must be performed both client-side and server-side.
- Data isolation is critical for compliance and operational integrity.
- Implement proper error handling to prevent information leakage.
- Regular security audits should be conducted to ensure access controls are working correctly.

```

```
