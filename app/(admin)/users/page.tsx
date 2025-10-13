"use client";

import { useState, useEffect } from "react";
import { authService } from "@/services/authService";
import { branchService, Branch } from "@/services/branchService";
import AdminTopBar from "@/app/(admin)/components/AdminTopBar";
import UsersIcon from "@/components/icons/SidebarNav/UsersIcon";
import LoadingSpinner from "@/components/LoadingSpinner";

interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  roleAssignments: Array<{ branchId: string; role: "manager" | "worker" }>;
  isAdmin: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface RoleAssignmentModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (userId: string, branchId: string, role: "manager" | "worker") => void;
  branches: Branch[];
}

function RoleAssignmentModal({ 
  user, 
  isOpen, 
  onClose, 
  onAssign, 
  branches 
}: RoleAssignmentModalProps) {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedRole, setSelectedRole] = useState<"manager" | "worker">("worker");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedBranch("");
      setSelectedRole("worker");
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleAssign = async () => {
    if (!selectedBranch) return;

    setIsAssigning(true);
    try {
      await onAssign(user.id, selectedBranch, selectedRole);
      onClose();
    } catch (error) {
      console.error("Error assigning role:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-[var(--secondary)]">
            Assign Role to {user.name}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{user.email}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Select Branch
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              disabled={isAssigning}
            >
              <option value="">Choose a branch...</option>
              {branches
                .filter(branch => branch.isActive)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} - {branch.location}
                  </option>
                ))}
            </select>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
              Select Role
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="worker"
                  checked={selectedRole === "worker"}
                  onChange={(e) => setSelectedRole(e.target.value as "worker")}
                  disabled={isAssigning}
                  className="mr-2"
                />
                <span className="text-sm">Worker</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="manager"
                  checked={selectedRole === "manager"}
                  onChange={(e) => setSelectedRole(e.target.value as "manager")}
                  disabled={isAssigning}
                  className="mr-2"
                />
                <span className="text-sm">Manager</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isAssigning}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedBranch || isAssigning}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAssigning ? "Assigning..." : "Assign Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface UserCardProps {
  user: User;
  branches: Branch[];
  onAssignRole: (user: User) => void;
  onRemoveRole: (userId: string, branchId: string) => void;
  onPromoteToAdmin: (userId: string) => void;
  onDemoteFromAdmin: (userId: string) => void;
}

function UserCard({ 
  user, 
  branches, 
  onAssignRole, 
  onRemoveRole, 
  onPromoteToAdmin,
  onDemoteFromAdmin 
}: UserCardProps) {
  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? `${branch.name} - ${branch.location}` : "Unknown Branch";
  };

  const getStatusBadge = () => {
    if (user.isAdmin) {
      return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">Admin</span>;
    }
    if (user.roleAssignments.length === 0) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">Pending</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">Active</span>;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-[var(--secondary)]">{user.name}</h3>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-gray-600 mb-1">{user.email}</p>
          {user.username && (
            <p className="text-sm text-gray-500">@{user.username}</p>
          )}
        </div>
      </div>

      {/* Current Assignments */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-[var(--secondary)] mb-2">Current Assignments:</h4>
        {user.roleAssignments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No branch assignments</p>
        ) : (
          <div className="space-y-2">
            {user.roleAssignments.map((assignment, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 rounded-md p-2">
                <div>
                  <p className="text-sm font-medium">{getBranchName(assignment.branchId)}</p>
                  <p className="text-xs text-gray-600 capitalize">{assignment.role}</p>
                </div>
                <button
                  onClick={() => onRemoveRole(user.id, assignment.branchId)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onAssignRole(user)}
          className="px-3 py-1 bg-[var(--accent)] text-white text-sm rounded-md hover:bg-[var(--accent)]/90"
        >
          Assign Role
        </button>
        
        {!user.isAdmin ? (
          <button
            onClick={() => onPromoteToAdmin(user.id)}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
          >
            Make Admin
          </button>
        ) : (
          <button
            onClick={() => onDemoteFromAdmin(user.id)}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
          >
            Remove Admin
          </button>
        )}
      </div>
    </div>
  );
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, branchesData] = await Promise.all([
        authService.getAllUsers(),
        branchService.getAllBranches(),
      ]);
      setUsers(usersData);
      setBranches(branchesData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRole = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleRoleAssignment = async (userId: string, branchId: string, role: "manager" | "worker") => {
    try {
      await authService.adminAssignUserToBranch(userId, branchId, role);
      await loadData(); // Refresh data
    } catch (error) {
      console.error("Error assigning role:", error);
    }
  };

  const handleRemoveRole = async (userId: string, branchId: string) => {
    try {
      await authService.adminRemoveUserFromBranch(userId, branchId);
      await loadData(); // Refresh data
    } catch (error) {
      console.error("Error removing role:", error);
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    try {
      await authService.promoteToAdmin(userId);
      await loadData(); // Refresh data
    } catch (error) {
      console.error("Error promoting to admin:", error);
    }
  };

  const handleDemoteFromAdmin = async (userId: string) => {
    try {
      await authService.demoteFromAdmin(userId);
      await loadData(); // Refresh data
    } catch (error) {
      console.error("Error demoting from admin:", error);
    }
  };

  const pendingUsers = users.filter(user => !user.isAdmin && user.roleAssignments.length === 0);
  const activeUsers = users.filter(user => !user.isAdmin && user.roleAssignments.length > 0);
  const adminUsers = users.filter(user => user.isAdmin);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <AdminTopBar title="User Management" icon={<UsersIcon />} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <AdminTopBar title="User Management"  />
        
      
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-8">            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                <p className="text-2xl font-bold text-[var(--secondary)]">{users.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-500">Pending Approval</h3>
                <p className="text-2xl font-bold text-yellow-600">{pendingUsers.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
                <p className="text-2xl font-bold text-green-600">{activeUsers.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-500">Administrators</h3>
                <p className="text-2xl font-bold text-purple-600">{adminUsers.length}</p>
              </div>
            </div>

            {/* Pending Users */}
            {pendingUsers.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[var(--secondary)] mb-4">
                  Pending Users ({pendingUsers.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingUsers.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      branches={branches}
                      onAssignRole={handleAssignRole}
                      onRemoveRole={handleRemoveRole}
                      onPromoteToAdmin={handlePromoteToAdmin}
                      onDemoteFromAdmin={handleDemoteFromAdmin}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active Users */}
            {activeUsers.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[var(--secondary)] mb-4">
                  Active Users ({activeUsers.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeUsers.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      branches={branches}
                      onAssignRole={handleAssignRole}
                      onRemoveRole={handleRemoveRole}
                      onPromoteToAdmin={handlePromoteToAdmin}
                      onDemoteFromAdmin={handleDemoteFromAdmin}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Admin Users */}
            {adminUsers.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[var(--secondary)] mb-4">
                  Administrators ({adminUsers.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adminUsers.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      branches={branches}
                      onAssignRole={handleAssignRole}
                      onRemoveRole={handleRemoveRole}
                      onPromoteToAdmin={handlePromoteToAdmin}
                      onDemoteFromAdmin={handleDemoteFromAdmin}
                    />
                  ))}
                </div>
              </div>
            )}

            {users.length === 0 && (
              <div className="text-center py-12">
                <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                <p className="text-gray-500">Users will appear here when they register for the system.</p>
              </div>
            )}
          </div>
        </div>

        {/* Role Assignment Modal */}
        <RoleAssignmentModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedUser(null);
          }}
          onAssign={handleRoleAssignment}
          branches={branches}
        />
      </div>
    );
  }