"use client";

import { useState, useEffect } from "react";
import { authService } from "@/services/authService";
import { branchService, Branch } from "@/services/branchService";
import { workSessionService, WorkSession } from "@/services/workSessionService";
import { Timestamp } from "firebase/firestore";
import AdminTopBar from "../components/AdminTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import UserIcon from "@/components/icons/UserIcon";

interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  roleAssignments: Array<{ branchId: string; role: "manager" | "worker" }>;
  isAdmin: boolean;
  currentStatus?: "clocked_in" | "clocked_out";
  currentBranchId?: string;
  lastTimeIn?: any;
  lastTimeOut?: any;
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

interface AttendanceModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
}

function AttendanceModal({ 
  user, 
  isOpen, 
  onClose, 
  branches 
}: AttendanceModalProps) {
  const [workSessions, setWorkSessions] = useState<(WorkSession & { id: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    if (isOpen && user) {
      loadWorkSessions();
    }
  }, [isOpen, user, selectedPeriod]);

  const loadWorkSessions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      if (selectedPeriod === "week") {
        startDate.setDate(endDate.getDate() - 7);
      } else {
        startDate.setMonth(endDate.getMonth() - 1);
      }

      const sessions = await workSessionService.getSessionsByDateRange(
        user.id,
        startDate,
        endDate
      );
      
      // Convert to sessions with id for display
      const sessionsWithId = sessions.map((session, index) => ({
        ...session,
        id: `session-${index}` // This would be the actual doc ID in real implementation
      }));
      
      setWorkSessions(sessionsWithId);
    } catch (error) {
      console.error("Error loading work sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : "Unknown Branch";
  };

  const formatDuration = (minutes: number | undefined) => {
    if (!minutes) return "0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTimestamp = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString();
  };

  const calculateTotalHours = () => {
    return workSessions.reduce((total, session) => {
      return total + (session.duration || 0);
    }, 0);
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--secondary)]">
                Attendance History - {user.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{user.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as "week" | "month")}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--secondary)]">{workSessions.length}</p>
              <p className="text-sm text-gray-600">Total Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{formatDuration(calculateTotalHours())}</p>
              <p className="text-sm text-gray-600">Total Hours</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {workSessions.filter(s => !s.timeOutAt).length}
              </p>
              <p className="text-sm text-gray-600">Active Sessions</p>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : workSessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No work sessions found for the selected period.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-gray-900">
                          {getBranchName(session.branchId)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          session.timeOutAt
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {session.timeOutAt ? 'Completed' : 'Active'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Clock In:</span>
                          <br />
                          {formatTimestamp(session.timeInAt)}
                        </div>
                        {session.timeOutAt && (
                          <div>
                            <span className="font-medium">Clock Out:</span>
                            <br />
                            {formatTimestamp(session.timeOutAt)}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Duration:</span>
                          <br />
                          {session.timeOutAt 
                            ? formatDuration(session.duration)
                            : `${formatDuration(workSessionService.calculateSessionDuration(session.timeInAt))} (ongoing)`
                          }
                        </div>
                      </div>
                      
                      {session.notes && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">Notes:</span>
                          <p className="text-sm text-gray-700">{session.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
  onClockIn: (userId: string, branchId: string) => void;
  onClockOut: (userId: string) => void;
  onViewAttendance: (user: User) => void;
}

function UserCard({ 
  user, 
  branches, 
  onAssignRole, 
  onRemoveRole, 
  onPromoteToAdmin,
  onDemoteFromAdmin,
  onClockIn,
  onClockOut,
  onViewAttendance
}: UserCardProps) {
  const [currentDuration, setCurrentDuration] = useState<string>("");

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? `${branch.name} - ${branch.location}` : "Unknown Branch";
  };

  const calculateCurrentDuration = () => {
    if (user.currentStatus === 'clocked_in' && user.lastTimeIn) {
      const timeIn = user.lastTimeIn.toDate ? user.lastTimeIn.toDate() : new Date(user.lastTimeIn);
      const now = new Date();
      const diffMs = now.getTime() - timeIn.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    }
    return "";
  };

  // Update duration every minute for active sessions
  useEffect(() => {
    if (user.currentStatus === 'clocked_in') {
      const updateDuration = () => {
        setCurrentDuration(calculateCurrentDuration());
      };
      
      updateDuration(); // Initial update
      const interval = setInterval(updateDuration, 60000); // Update every minute
      
      return () => clearInterval(interval);
    }
  }, [user.currentStatus, user.lastTimeIn]);

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

      {/* Clock Status - Only for workers and managers */}
      {!user.isAdmin && user.roleAssignments.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-medium text-gray-700">Attendance Status</h5>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                  user.currentStatus === 'clocked_in' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.currentStatus === 'clocked_in' ? '🟢 Clocked In' : '⚫ Clocked Out'}
                </span>
                {user.currentStatus === 'clocked_in' && (
                  <div className="flex flex-col">
                    {user.currentBranchId && (
                      <span className="text-xs text-gray-500">
                        at {getBranchName(user.currentBranchId)}
                      </span>
                    )}
                    {currentDuration && (
                      <span className="text-xs text-blue-600 font-medium">
                        ⏱️ {currentDuration}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-1">
              {user.currentStatus === 'clocked_in' ? (
                <button
                  onClick={() => onClockOut(user.id)}
                  className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                >
                  Clock Out
                </button>
              ) : (
                user.roleAssignments.length > 0 && (
                  <button
                    onClick={() => onClockIn(user.id, user.roleAssignments[0].branchId)}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    Clock In
                  </button>
                )
              )}
              <button
                onClick={() => onViewAttendance(user)}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                History
              </button>
            </div>
          </div>
        </div>
      )}

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
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
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

  const handleClockIn = async (userId: string, branchId: string) => {
    try {
      await workSessionService.timeInWorker(userId, branchId, "Clocked in by admin");
      await loadData(); // Refresh data to update status
    } catch (error) {
      console.error("Error clocking in user:", error);
      alert("Failed to clock in user. Please try again.");
    }
  };

  const handleClockOut = async (userId: string) => {
    try {
      const activeSession = await workSessionService.getActiveWorkSession(userId);
      if (activeSession) {
        await workSessionService.timeOutWorker(userId, activeSession.id, "Clocked out by admin");
        await loadData(); // Refresh data to update status
      } else {
        alert("No active session found for this user.");
      }
    } catch (error) {
      console.error("Error clocking out user:", error);
      alert("Failed to clock out user. Please try again.");
    }
  };

  const handleViewAttendance = (user: User) => {
    setSelectedUser(user);
    setIsAttendanceModalOpen(true);
  };

  const pendingUsers = users.filter(user => !user.isAdmin && user.roleAssignments.length === 0);
  const activeUsers = users.filter(user => !user.isAdmin && user.roleAssignments.length > 0);
  const adminUsers = users.filter(user => user.isAdmin);
  
  // Attendance statistics
  const clockedInUsers = users.filter(user => user.currentStatus === 'clocked_in');
  const workersAndManagers = users.filter(user => !user.isAdmin && user.roleAssignments.length > 0);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <AdminTopBar title="User Management" icon={<UserIcon />} />
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
                <h3 className="text-sm font-medium text-gray-500">Currently Clocked In</h3>
                <p className="text-2xl font-bold text-blue-600">{clockedInUsers.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  of {workersAndManagers.length} staff
                </p>
              </div>
            </div>

            {/* Attendance Overview */}
            {workersAndManagers.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-[var(--secondary)] mb-4">
                  Live Attendance Status
                </h3>
                <div className="space-y-3">
                  {clockedInUsers.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-green-700">Currently Working:</span>
                        <span className="text-green-700">{clockedInUsers.length} users</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {clockedInUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-3 bg-green-50 rounded-md border border-green-200">
                            <div>
                              <p className="font-medium text-sm text-green-800">{user.name}</p>
                              <p className="text-xs text-green-600">
                                {user.currentBranchId ? branches.find(b => b.id === user.currentBranchId)?.name : 'Unknown Branch'}
                              </p>
                            </div>
                            <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                              🟢 Active
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500">No users are currently clocked in</p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                      onClockIn={handleClockIn}
                      onClockOut={handleClockOut}
                      onViewAttendance={handleViewAttendance}
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
                      onClockIn={handleClockIn}
                      onClockOut={handleClockOut}
                      onViewAttendance={handleViewAttendance}
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
                      onClockIn={handleClockIn}
                      onClockOut={handleClockOut}
                      onViewAttendance={handleViewAttendance}
                    />
                  ))}
                </div>
              </div>
            )}

            {users.length === 0 && (
              <div className="text-center py-12">
                <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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

        {/* Attendance Modal */}
        <AttendanceModal
          user={selectedUser}
          isOpen={isAttendanceModalOpen}
          onClose={() => {
            setIsAttendanceModalOpen(false);
            setSelectedUser(null);
          }}
          branches={branches}
        />
      </div>
    );
  }