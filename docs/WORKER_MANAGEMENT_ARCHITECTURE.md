# Worker Management System Architecture

## Overview

This document describes the Worker Management System architecture, which extends the Branch Management System to provide comprehensive user/worker CRUD operations, role assignments, branch access control, and RBAC (Role-Based Access Control) functionality.

---

## 1. System Overview

The Worker Management System allows:

- **Admins**: Full access to create, edit, delete, and list all users across all branches
- **Managers**: Limited access to manage workers within their assigned branches only
- **Workers**: Read-only access to their own profile information

### Key Features:

- Firebase Auth integration for user authentication
- Firestore database for user profile and role management
- Branch-specific worker assignments
- Role-based permissions (Admin, Manager, Worker)
- Time In/Time Out tracking for worker shifts
- Access control to POS systems based on assignments

---

## 2. User Roles & Permissions

### Admin

- **Global Access**: Can manage all users across all branches
- **Full CRUD**: Create, read, update, delete any user
- **Role Assignment**: Can assign/remove any role (including admin privileges)
- **Branch Override**: Can access any branch's worker management
- **System Access**: Full POS system access
- **Time Tracking Exempt**: Admins are not subject to time tracking (no clocked in/out status)

### Manager

- **Branch-Scoped Access**: Can only manage workers in their assigned branches
- **Limited CRUD**: Create, read, update workers in their branches (cannot delete)
- **Role Assignment**: Can assign Worker/Manager roles (cannot assign Admin)
- **Worker Time Tracking**: Can time workers in/out for their shifts (non-admin workers only)
- **Branch POS Access**: Can access POS systems for their assigned branches
- **Status Tracking**: Subject to time tracking (clocked in/out status)

### Worker

- **Self Access**: Can only view their own profile
- **No Admin Access**: Cannot access worker management or admin features
- **POS Access**: Can access POS systems only for assigned branches when clocked in
- **Status Tracking**: Subject to time tracking (clocked in/out status)

---

## 3. Database Schema

### Users Collection (Extended)

```typescript
users: {
  [userId]: {
    // Basic Information
    name: string,
    email: string,
    phoneNumber?: string,
    employeeId?: string,

    // Role & Branch Assignments
    roleAssignments: Array<{
      branchId: string,
      role: "manager" | "worker",
      assignedAt: timestamp,
      assignedBy: string, // userId who made the assignment
      isActive: boolean
    }>,

    // Admin Status
    isAdmin: boolean,
    adminAssignedBy?: string, // userId who granted admin access
    adminAssignedAt?: timestamp,

    // Work Status & Tracking (Not applicable for Admins)
    currentStatus?: "clocked_in" | "clocked_out", // Only for non-admin users
    currentBranchId?: string, // Current branch if clocked in
    lastTimeIn?: timestamp,
    lastTimeOut?: timestamp,

    // Profile Management
    profilePicture?: string,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: string, // userId who created this user
    isActive: boolean, // Account status

    // Security & Access
    lastLoginAt?: timestamp,
    passwordResetRequired?: boolean,
    twoFactorEnabled?: boolean
  }
}
```

### Work Sessions Collection (New)

```typescript
workSessions: {
  [sessionId]: {
    userId: string,
    branchId: string,
    timeInAt: timestamp,
    timeOutAt?: timestamp,
    clockedInBy: string, // Manager who clocked them in
    clockedOutBy?: string, // Manager who clocked them out
    duration?: number, // in minutes
    notes?: string,
    sessionType: "scheduled" | "emergency" | "overtime"
  }
}
```

---

## 4. API Services Architecture

### Worker Service (`services/workerService.ts`)

```typescript
export interface WorkerService {
	// User CRUD Operations
	createWorker: (userData: CreateWorkerRequest) => Promise<string>; // Returns userId
	getWorker: (userId: string) => Promise<Worker | null>;
	updateWorker: (userId: string, updates: Partial<Worker>) => Promise<void>;
	deleteWorker: (userId: string) => Promise<void>;
	listWorkers: (filters?: WorkerFilters) => Promise<Worker[]>;

	// Branch-specific operations
	getWorkersByBranch: (branchId: string) => Promise<Worker[]>;
	assignWorkerToBranch: (
		userId: string,
		branchId: string,
		role: UserRole
	) => Promise<void>;
	removeWorkerFromBranch: (userId: string, branchId: string) => Promise<void>;

	// Role Management
	updateWorkerRole: (
		userId: string,
		branchId: string,
		newRole: UserRole
	) => Promise<void>;
	promoteToAdmin: (userId: string) => Promise<void>;
	demoteFromAdmin: (userId: string) => Promise<void>;

	// Time In/Time Out Management
	timeInWorker: (
		userId: string,
		branchId: string,
		notes?: string
	) => Promise<string>; // Returns sessionId
	timeOutWorker: (
		userId: string,
		sessionId: string,
		notes?: string
	) => Promise<void>;
	getClockedInWorkers: (branchId: string) => Promise<Worker[]>;
	getWorkSession: (sessionId: string) => Promise<WorkSession | null>;

	// Reporting & Analytics
	getWorkerWorkHistory: (
		userId: string,
		dateRange?: DateRange
	) => Promise<WorkSession[]>;
	getBranchWorkSessions: (
		branchId: string,
		dateRange?: DateRange
	) => Promise<WorkSession[]>;
	getWorkerStats: (userId: string) => Promise<WorkerStats>;
}

// Types
interface CreateWorkerRequest {
	name: string;
	email: string;
	password: string;
	phoneNumber?: string;
	employeeId?: string;
	branchAssignments: Array<{
		branchId: string;
		role: "manager" | "worker";
	}>;
	isAdmin?: boolean; // Only available to admin users
	profilePicture?: File;
}

interface WorkerFilters {
	branchId?: string;
	role?: UserRole;
	status?: "active" | "inactive" | "clocked_in" | "clocked_out";
	searchQuery?: string;
	page?: number;
	limit?: number;
}
```

### Firebase Auth Integration (`services/firebaseAuthService.ts`)

```typescript
export interface FirebaseAuthService {
	// User Creation & Management
	createUserAccount: (
		email: string,
		password: string,
		displayName: string
	) => Promise<string>;
	updateUserProfile: (
		userId: string,
		updates: Partial<UserProfile>
	) => Promise<void>;
	deleteUserAccount: (userId: string) => Promise<void>;
	resetUserPassword: (email: string) => Promise<void>;

	// Admin Operations
	setCustomClaims: (
		userId: string,
		claims: Record<string, any>
	) => Promise<void>;
	revokeRefreshTokens: (userId: string) => Promise<void>;
	disableUser: (userId: string) => Promise<void>;
	enableUser: (userId: string) => Promise<void>;

	// Bulk Operations
	createMultipleUsers: (
		users: CreateUserRequest[]
	) => Promise<CreateUserResult[]>;
	importUsers: (userData: UserImportData[]) => Promise<ImportResult>;
}
```

---

## 5. Security Rules & Access Control

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection - RBAC enforcement
    match /users/{userId} {
      // Users can read their own data
      allow read: if request.auth != null && request.auth.uid == userId;

      // Admins can read/write all users
      allow read, write: if request.auth != null && isAdmin(request.auth.uid);

      // Managers can read/write workers in their branches
      allow read, write: if request.auth != null &&
        isManager(request.auth.uid) &&
        canManageUser(request.auth.uid, userId);

      // Creation rules
      allow create: if request.auth != null &&
        (isAdmin(request.auth.uid) ||
         (isManager(request.auth.uid) &&
          !resource.data.isAdmin &&
          hasValidBranchAssignments(request.auth.uid, request.resource.data.roleAssignments)));
    }

    // Work sessions - Branch-scoped access
    match /workSessions/{sessionId} {
      allow read, write: if request.auth != null &&
        (isAdmin(request.auth.uid) ||
         canAccessBranch(request.auth.uid, resource.data.branchId));
    }



    // Helper functions
    function isAdmin(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data.isAdmin == true;
    }

    function isManager(userId) {
      let user = get(/databases/$(database)/documents/users/$(userId)).data;
      return user.roleAssignments.hasAny([{"role": "manager"}]);
    }

    function canManageUser(managerId, targetUserId) {
      let manager = get(/databases/$(database)/documents/users/$(managerId)).data;
      let target = get(/databases/$(database)/documents/users/$(targetUserId)).data;

      // Manager can only manage users in their branches
      let managerBranches = manager.roleAssignments.map(a => a.branchId);
      let targetBranches = target.roleAssignments.map(a => a.branchId);

      return managerBranches.hasAny(targetBranches) && !target.isAdmin;
    }

    function canAccessBranch(userId, branchId) {
      let user = get(/databases/$(database)/documents/users/$(userId)).data;
      return user.isAdmin ||
        user.roleAssignments.hasAny([{"branchId": branchId}]);
    }
  }
}
```

---

## 6. UI Components Architecture

### Worker Management Pages

```
app/(admin)/workers/
├── page.tsx                    # Main worker table/dashboard
├── create/
│   └── page.tsx               # Create new worker form
├── [userId]/
│   ├── page.tsx               # Worker detail/edit page
│   └── sessions/
│       └── page.tsx           # Worker work sessions history
└── components/
    ├── WorkersTable.tsx       # Main workers data table
    ├── WorkerRow.tsx          # Individual table row component
    ├── WorkerFilters.tsx      # Search and filter components
    ├── TableHeader.tsx        # Sortable table header
    ├── TablePagination.tsx    # Pagination controls
    ├── CreateWorkerModal.tsx  # Quick create modal
    ├── EditWorkerModal.tsx    # Edit worker modal
    ├── DeleteWorkerModal.tsx  # Delete confirmation
    ├── TimeInOutModal.tsx     # Time in/out workers
    ├── AssignBranchModal.tsx  # Branch assignment
    └── WorkSessionTracker.tsx # Active shift tracking
```

### Key Components Implementation

#### WorkersTable Component

```typescript
interface WorkersTableProps {
	workers: Worker[];
	currentUser: User;
	loading?: boolean;
	onEdit?: (worker: Worker) => void;
	onDelete?: (userId: string) => void;
	onTimeIn?: (userId: string) => void;
	onTimeOut?: (userId: string) => void;
	onAssignBranch?: (userId: string) => void;
	sortConfig?: SortConfig;
	onSort?: (column: string) => void;
}

interface SortConfig {
	column: string;
	direction: "asc" | "desc";
}

export function WorkersTable({
	workers,
	currentUser,
	loading = false,
	sortConfig,
	onSort,
	...actions
}: WorkersTableProps) {
	return (
		<div className='workers-table-container'>
			<table className='workers-table'>
				<TableHeader
					sortConfig={sortConfig}
					onSort={onSort}
					columns={[
						{ key: "name", label: "Name", sortable: true },
						{ key: "email", label: "Email", sortable: true },
						{ key: "role", label: "Role", sortable: true },
						{ key: "branches", label: "Branches", sortable: false },
						{ key: "status", label: "Status", sortable: true },
						{ key: "lastActive", label: "Last Active", sortable: true },
						{ key: "actions", label: "Actions", sortable: false },
					]}
				/>
				<tbody>
					{loading ? (
						<LoadingRows />
					) : (
						workers.map((worker) => (
							<WorkerRow
								key={worker.id}
								worker={worker}
								currentUser={currentUser}
								{...actions}
							/>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
```

#### WorkerRow Component

```typescript
interface WorkerRowProps {
  worker: Worker;
  currentUser: User;
  onEdit?: (worker: Worker) => void;
  onDelete?: (userId: string) => void;
  onTimeIn?: (userId: string) => void;
  onTimeOut?: (userId: string) => void;
  onAssignBranch?: (userId: string) => void;
}

export function WorkerRow({ worker, currentUser, ...actions }: WorkerRowProps) {
  const canEdit = canManageWorker(currentUser, worker);
  const canDelete = isAdmin(currentUser) || (isManager(currentUser) && !worker.isAdmin);
  const canTimeInOut = canManageWorker(currentUser, worker);

  return (
    <tr className={`worker-row ${worker.currentStatus === 'clocked_in' ? 'clocked-in' : ''}`}>
      <td className="worker-name">
        <div className="flex items-center gap-3">
          {worker.profilePicture ? (
            <img src={worker.profilePicture} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              {worker.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-medium">{worker.name}</div>
            {worker.employeeId && (
              <div className="text-sm text-gray-500">ID: {worker.employeeId}</div>
            )}
          </div>
        </div>
      </td>
      <td className="worker-email">{worker.email}</td>
      <td className="worker-role">
        <div className="flex flex-col gap-1">
          {worker.isAdmin && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Admin
            </span>
          )}
          {worker.roleAssignments.map(assignment => (
            <span
              key={assignment.branchId}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                assignment.role === 'manager'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {assignment.role}
            </span>
          ))}
        </div>
      </td>
      <td className="worker-branches">
        <div className="flex flex-wrap gap-1">
          {worker.roleAssignments.map(assignment => (
            <span
              key={assignment.branchId}
              className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800"
            >
              {getBranchName(assignment.branchId)}
            </span>
          ))}
        </div>
      </td>
      <td className="worker-status">
        <StatusBadge status={worker.currentStatus} />
      </td>
      <td className="worker-last-active">
        {worker.lastLoginAt ? formatDate(worker.lastLoginAt) : 'Never'}
      </td>
      <td className="worker-actions">
        <div className="flex items-center gap-2">
          {canTimeInOut && worker.currentStatus === 'clocked_out' && (
            <button
              onClick={() => actions.onTimeIn?.(worker.id)}
              className="text-green-600 hover:text-green-800"
              title="Time In"
            >
              <TimeInIcon />
            </button>
          )}
          {canTimeInOut && worker.currentStatus === 'clocked_in' && (
            <button
              onClick={() => actions.onTimeOut?.(worker.id)}
              className="text-orange-600 hover:text-orange-800"
              title="Time Out"
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => actions.onEdit?.(worker)}
              className="text-blue-600 hover:text-blue-800"
              title="Edit"
            >
              <EditIcon />
            </button>
          )}
          <button
            onClick={() => actions.onAssignBranch?.(worker.id)}
            className="text-purple-600 hover:text-purple-800"
            title="Manage Branches"
          >
            <BranchIcon />
          </button>
          {canDelete && (
            <button
              onClick={() => actions.onDelete?.(worker.id)}
              className="text-red-600 hover:text-red-800"
              title="Delete"
            >
              <DeleteIcon />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
```

#### TableHeader Component

```typescript
interface TableHeaderProps {
	columns: Array<{
		key: string;
		label: string;
		sortable: boolean;
	}>;
	sortConfig?: SortConfig;
	onSort?: (column: string) => void;
}

export function TableHeader({ columns, sortConfig, onSort }: TableHeaderProps) {
	return (
		<thead className='table-header'>
			<tr>
				{columns.map((column) => (
					<th
						key={column.key}
						className={`table-header-cell ${column.sortable ? "sortable" : ""}`}
						onClick={() => column.sortable && onSort?.(column.key)}>
						<div className='flex items-center gap-2'>
							<span>{column.label}</span>
							{column.sortable && (
								<SortIcon
									direction={
										sortConfig?.column === column.key
											? sortConfig.direction
											: undefined
									}
								/>
							)}
						</div>
					</th>
				))}
			</tr>
		</thead>
	);
}
```

#### CreateWorkerModal Component

```typescript
interface CreateWorkerModalProps {
	isOpen: boolean;
	onClose: () => void;
	currentUser: User;
	availableBranches: Branch[];
	onSubmit: (workerData: CreateWorkerRequest) => Promise<void>;
}

export function CreateWorkerModal({
	currentUser,
	availableBranches,
	...props
}: CreateWorkerModalProps) {
	// Form validation and submission logic
	// Branch assignment UI
	// Role selection (filtered by current user permissions)
	// Admin toggle (only for admin users)
}
```

---

## 7. Implementation Phases

### Phase 1: Core Worker Service & Database Setup

1. **Extend Firestore Collections**

   - Update users collection schema
   - Create workSessions collection
   - Deploy updated security rules

2. **Implement Worker Service**

   ```typescript
   // services/workerService.ts - Core CRUD operations
   // services/firebaseAuthService.ts - Firebase Auth integration
   // services/workSessionService.ts - Time tracking management
   ```

3. **Update AuthContext**
   ```typescript
   // Add current user role checking methods
   // Add branch-scoped access methods
   // Add simple branch filtering logic
   ```

### Phase 2: UI Components & Forms

1. **Create Base Table Components**

   ```typescript
   // components/workers/WorkersTable.tsx - Main data table
   // components/workers/WorkerRow.tsx - Table row component
   // components/workers/TableHeader.tsx - Sortable header
   // components/workers/WorkerFilters.tsx - Search and filter
   // components/workers/WorkerStatus.tsx - Status indicators
   ```

2. **Create Modal Components**

   ```typescript
   // components/workers/CreateWorkerModal.tsx
   // components/workers/EditWorkerModal.tsx
   // components/workers/DeleteWorkerModal.tsx
   // components/workers/AssignBranchModal.tsx
   ```

3. **Implement Main Pages**
   ```typescript
   // app/(admin)/workers/page.tsx - Main worker management table
   // app/(admin)/workers/create/page.tsx - Create worker form
   // app/(admin)/workers/[userId]/page.tsx - Worker detail/edit
   ```

### Phase 3: Time Tracking & Advanced Features

1. **Time In/Time Out System**

   ```typescript
   // components/workers/TimeInOutModal.tsx - Time tracking modal
   // components/workers/WorkSessionTracker.tsx - Active shift tracking
   // services/workSessionService.ts - Work session management
   ```

2. **Branch Access Control Implementation**

   ```typescript
   // utils/branchAccess.ts - Branch filtering logic
   // hooks/useAccessibleBranches.ts - Branch access hook
   // components/workers/BranchSelector.tsx - Branch selection component
   ```

3. **Reporting & Analytics**
   ```typescript
   // components/workers/WorkerStats.tsx - Worker statistics
   // app/(admin)/workers/[userId]/sessions/page.tsx - Work history
   // components/reports/WorkSessionReports.tsx - Time tracking reports
   ```

### Phase 4: Integration & Testing

1. **POS System Integration**

   - Update POS access checks based on branch assignments
   - Implement worker session validation (must be clocked in)
   - Add worker tracking to POS operations
   - Integrate time tracking with POS usage

2. **Branch Management Integration**

   - Link worker assignments to branch views
   - Update branch pages to show assigned workers
   - Implement cross-navigation between systems
   - Add branch-specific worker management

3. **Access Control & Security Testing**
   - Test branch-based access filtering for Admins vs Managers
   - Validate security rules for worker data access
   - Test edge cases (worker role changes, branch reassignments)
   - Verify Workers cannot access admin sections
   - Test time tracking and session management

---

## 8. Access Control Matrix

| Action                | Admin           | Manager                | Worker             |
| --------------------- | --------------- | ---------------------- | ------------------ |
| Create Worker         | ✅ All          | ✅ Branch-scoped       | ❌                 |
| Edit Worker           | ✅ All          | ✅ Branch workers only | ❌                 |
| Delete Worker         | ✅ All          | ❌                     | ❌                 |
| View Workers          | ✅ All          | ✅ Branch-scoped       | ❌                 |
| Assign Admin Role     | ✅              | ❌                     | ❌                 |
| Assign Manager/Worker | ✅              | ✅ Branch-scoped       | ❌                 |
| Time In/Out Workers   | ✅              | ✅ Branch-scoped       | ❌                 |
| View Work Sessions    | ✅ All          | ✅ Branch-scoped       | ✅ Own only        |
| Access POS            | ✅ All branches | ✅ Assigned branches   | ✅ When clocked in |
| Time Tracking Status  | ❌ Exempt       | ✅ Required            | ✅ Required        |

---

## 9. Branch Access Control

### Simple Branch-Based Access

The system implements straightforward branch-based access control:

#### Admin Users

- Can select and manage workers from **any branch**
- Full access to all worker management features across the entire system
- Can create, edit, delete workers in any branch
- Can assign workers to any branch

#### Manager Users

- Can only select and manage workers from **their assigned branches**
- Access is automatically filtered to show only workers from branches they manage
- Can create, edit workers only in their assigned branches (cannot delete)
- Can only assign workers to branches they have access to

#### Worker Users

- **Cannot access worker management at all**
- No access to admin sections or worker CRUD operations
- Can only view their own profile information
- POS access limited to assigned branches when clocked in

### Implementation

```typescript
// Simple branch filtering logic
function getAvailableBranches(currentUser: User): Branch[] {
	if (currentUser.isAdmin) {
		return getAllBranches(); // Admin sees all branches
	}

	if (isManager(currentUser)) {
		return currentUser.roleAssignments
			.filter((assignment) => assignment.role === "manager")
			.map((assignment) => getBranch(assignment.branchId)); // Manager sees only assigned branches
	}

	return []; // Workers see no branches (no admin access)
}

// Worker filtering based on branch access
function getAccessibleWorkers(currentUser: User): Worker[] {
	const availableBranches = getAvailableBranches(currentUser);
	const branchIds = availableBranches.map((branch) => branch.id);

	return getAllWorkers().filter((worker) =>
		worker.roleAssignments.some((assignment) =>
			branchIds.includes(assignment.branchId)
		)
	);
}
```

---

## 10. Security Considerations

### Data Protection

- **Encryption**: All sensitive data encrypted at rest and in transit
- **PII Handling**: Personal information handled according to privacy regulations
- **Audit Logging**: All user management actions logged for compliance
- **Data Retention**: Implement data retention policies for inactive users

### Access Control

- **Principle of Least Privilege**: Users have minimal required permissions
- **Session Management**: Proper session handling and timeout policies
- **Multi-Factor Authentication**: Optional 2FA for sensitive accounts
- **Password Policies**: Strong password requirements and regular resets

### Compliance

- **GDPR Compliance**: Right to deletion, data portability, consent management
- **Labor Law Compliance**: Work session tracking for legal requirements
- **Security Standards**: Follow industry standards for user data protection

---

## 10. Performance Considerations

### Database Optimization

- **Indexing**: Proper indexes on frequently queried fields (branchId, role, status)
- **Pagination**: Implement efficient pagination for large user lists
- **Caching**: Cache frequently accessed user permissions and roles
- **Batch Operations**: Use batch writes for bulk user operations

### Real-time Updates

- **Firestore Listeners**: Real-time updates for worker status changes
- **Optimistic Updates**: Update UI immediately, sync with backend
- **Conflict Resolution**: Handle concurrent edits gracefully

---

## 11. Future Enhancements

### Advanced Features

- **Shift Scheduling**: Integration with scheduling systems
- **Time Tracking**: Detailed time tracking and payroll integration
- **Performance Metrics**: Worker performance tracking and analytics
- **Mobile App**: Dedicated mobile app for workers to check schedules/clock in
- **Biometric Authentication**: Fingerprint or facial recognition for time in/out

### Integration Possibilities

- **HR Systems**: Integration with existing HR/payroll systems
- **Communication**: Slack/Teams integration for notifications
- **Analytics**: Advanced reporting and business intelligence
- **Compliance Tools**: Integration with compliance and audit tools

### Scalability

- **Multi-tenant**: Support for multiple organizations
- **Enterprise Features**: Advanced user management for large organizations
- **API Gateway**: RESTful API for third-party integrations
- **Microservices**: Break down into smaller, focused services

---

## 12. Testing Strategy

### Unit Testing

- Service layer functions (workerService, permissionService)
- Utility functions (permission checking, role validation)
- Component logic (forms, validation, state management)

### Integration Testing

- Firebase Auth integration
- Firestore operations and security rules
- Cross-service interactions (worker ↔ branch management)

### Security Testing

- RBAC enforcement testing
- Permission boundary testing
- Authentication and authorization flows
- Data access control validation

### Performance Testing

- Large dataset handling (1000+ workers)
- Concurrent user operations
- Real-time update performance
- Database query optimization

---

This architecture provides a comprehensive foundation for the Worker Management System while maintaining security, scalability, and ease of use. The phased implementation approach ensures that core functionality is delivered first, with advanced features added incrementally.
