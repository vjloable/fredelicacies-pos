"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { attendanceService, Attendance } from "@/services/attendanceService";
import { Worker } from "@/services/workerService";
import { branchService } from "@/services/branchService";
import LoadingSpinner from "@/components/LoadingSpinner";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";

interface AttendanceData extends Attendance {
	id: string;
	workerName: string;
	clockInTime: Date;
	clockOutTime?: Date;
}

interface AttendanceViewProps {
	branchId: string;
	workers: Worker[];
}

interface TimeSlot {
	hour: number;
	minute: number;
	timestamp: number;
}

export default function AttendanceView({ branchId, workers }: AttendanceViewProps) {
	const [attendances, setAttendances] = useState<AttendanceData[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
	const [timeRange, setTimeRange] = useState<6 | 12 | 24>(24); // Time range filter

	// Generate time slots based on selected range
	const timeSlots = useMemo((): TimeSlot[] => {
		const slots: TimeSlot[] = [];
		const increment = timeRange === 24 ? 60 : timeRange === 12 ? 30 : 15; // Minutes between slots
		
		for (let hour = 0; hour < timeRange; hour++) {
			for (let minute = 0; minute < 60; minute += increment) {
				const date = new Date(selectedDate);
				date.setHours(hour, minute, 0, 0);
				slots.push({
					hour,
					minute,
					timestamp: date.getTime(),
				});
			}
		}
		return slots;
	}, [selectedDate, timeRange]);

	// Get visible time range bounds
	const timeRangeBounds = useMemo(() => {
		const currentHour = new Date().getHours();
		let startHour: number = 0;
		let endHour: number = timeRange;

		// For 12h and 6h ranges, center around current time when viewing today
		if (timeRange < 24) {
			const isToday = new Date().toDateString() === selectedDate.toDateString();
			if (isToday) {
				if (timeRange === 12) {
					startHour = Math.max(0, currentHour - 6);
					endHour = Math.min(24, startHour + 12);
				} else if (timeRange === 6) {
					startHour = Math.max(0, currentHour - 3);
					endHour = Math.min(24, startHour + 6);
				}
			}
		}

		return { startHour, endHour };
	}, [timeRange, selectedDate]);

	// Load attendance data for the selected date
	const loadAttendanceData = useCallback(async () => {
		if (!branchId || workers.length === 0) return;

		setLoading(true);
		try {
			const startDate = new Date(selectedDate);
			startDate.setHours(0, 0, 0, 0);
			
			const endDate = new Date(selectedDate);
			endDate.setHours(23, 59, 59, 999);

			const allAttendances: AttendanceData[] = [];

			// Fetch all attendance for branch and filter by date and workers
			const { records: branchAttendances } = await attendanceService.getAttendancesByBranch(branchId);
			
			for (const worker of workers) {
				const workerAttendances = branchAttendances.filter((att: Attendance) => {
					const clockIn = new Date(att.clock_in);
					return att.worker_id === worker.id && clockIn >= startDate && clockIn <= endDate;
				});

				const processedAttendances = workerAttendances.map((attendance: Attendance, index: number) => ({
					...attendance,
					id: `${worker.id}-${index}`,
					workerName: worker.name || worker.email,
					clockInTime: new Date(attendance.clock_in),
					clockOutTime: attendance.clock_out ? new Date(attendance.clock_out) : undefined,
				}));

					allAttendances.push(...processedAttendances);
			}

			setAttendances(allAttendances);
		} catch (error) {
			console.error("Error loading attendance data:", error);
		} finally {
			setLoading(false);
		}
	}, [branchId, workers, selectedDate]);

	useEffect(() => {
		loadAttendanceData();
	}, [loadAttendanceData]);

	// Initialize selected workers to all workers
	useEffect(() => {
		setSelectedWorkers(workers.map(w => w.id));
	}, [workers]);

	// Filter attendances based on selected workers
	const filteredAttendances = useMemo(() => {
		return attendances.filter(attendance => 
			selectedWorkers.includes(attendance.worker_id)
		);
	}, [attendances, selectedWorkers]);

	// Generate worker colors for the graph
	const workerColors = useMemo(() => {
		const colors = [
			'#3B82F6', // Blue
			'#EF4444', // Red
			'#10B981', // Green
			'#F59E0B', // Yellow
			'#8B5CF6', // Purple
			'#06B6D4', // Cyan
			'#F97316', // Orange
			'#84CC16', // Lime
			'#EC4899', // Pink
			'#6B7280', // Gray
		];
		
		const colorMap: { [workerId: string]: string } = {};
		workers.forEach((worker, index) => {
			colorMap[worker.id] = colors[index % colors.length];
		});
		
		return colorMap;
	}, [workers]);

	// Calculate graph data points for each worker
	const graphData = useMemo(() => {
		const data: { [workerId: string]: { segments: { start: number; end: number; startTime: string; endTime: string }[] } } = {};
		const { startHour, endHour } = timeRangeBounds;
		
		filteredAttendances.forEach(attendance => {
			if (!data[attendance.worker_id]) {
				data[attendance.worker_id] = { segments: [] };
			}
			
			// Calculate start point (clock-in)
			const clockInHour = attendance.clockInTime.getHours();
			const clockInMinute = attendance.clockInTime.getMinutes();
			const startX = clockInHour + (clockInMinute / 60);
			const startTime = `${clockInHour.toString().padStart(2, '0')}:${clockInMinute.toString().padStart(2, '0')}`;
			
			// Calculate end point (clock-out or current time if still working)
			let endX = endHour; // Default to end of visible range if still working
			let endTime = 'Working';
			
			if (attendance.clockOutTime) {
				const clockOutHour = attendance.clockOutTime.getHours();
				const clockOutMinute = attendance.clockOutTime.getMinutes();
				endX = clockOutHour + (clockOutMinute / 60);
				endTime = `${clockOutHour.toString().padStart(2, '0')}:${clockOutMinute.toString().padStart(2, '0')}`;
			} else {
				// If no clock-out, extend to current time (if today) or end of range
				const now = new Date();
				const isToday = now.toDateString() === selectedDate.toDateString();
				if (isToday) {
					const currentHour = now.getHours() + (now.getMinutes() / 60);
					endX = Math.min(currentHour, endHour);
					endTime = 'Now';
				}
			}
			
			// Only include segments that are visible in the current time range
			if (startX < endHour && endX > startHour) {
				// Clip the segment to the visible range
				const clippedStart = Math.max(startX, startHour);
				const clippedEnd = Math.min(endX, endHour);
				
				data[attendance.worker_id].segments.push({
					start: clippedStart,
					end: clippedEnd,
					startTime: startX >= startHour ? startTime : `${startHour.toString().padStart(2, '0')}:00`,
					endTime: endX <= endHour ? endTime : `${endHour.toString().padStart(2, '0')}:00`
				});
			}
		});
		
		return data;
	}, [filteredAttendances, selectedDate, timeRangeBounds]);

	const formatTime = (hour: number) => {
		const period = hour >= 12 ? 'PM' : 'AM';
		const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
		return `${displayHour}${period}`;
	};

	const formatDateTime = (date: Date) => {
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const handleWorkerToggle = (workerId: string) => {
		setSelectedWorkers(prev => 
			prev.includes(workerId) 
				? prev.filter(id => id !== workerId)
				: [...prev, workerId]
		);
	};

	const handleDateChange = (date: string) => {
		setSelectedDate(new Date(date));
	};

	return (
		<div className="space-y-6">
			{/* Header and Controls */}
			<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
				<div>
					<h2 className="text-lg font-semibold text-secondary mb-2">
						Daily Attendance Overview
					</h2>
					<p className="text-xs text-secondary/70">
						{formatDateTime(selectedDate)}
					</p>
				</div>
				
				<div className="flex flex-col sm:flex-row gap-3">
					{/* Time Range Filter */}
					<div className="flex bg-gray-100 rounded-lg p-1">
						{[24, 12, 6].map(range => (
							<button
								key={range}
								onClick={() => setTimeRange(range as 6 | 12 | 24)}
								className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
									timeRange === range
										? "bg-white text-secondary shadow-sm"
										: "text-secondary/60 hover:text-secondary"
								}`}
							>
								{range}h
							</button>
						))}
					</div>
					
					{/* Date Picker */}
					<div className="relative">
						<input
							type="date"
							value={selectedDate.toISOString().split('T')[0]}
							onChange={(e) => handleDateChange(e.target.value)}
							className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
						/>
						<CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
					</div>
					
					{/* Refresh Button */}
					<button
						onClick={loadAttendanceData}
						disabled={loading}
						className="flex items-center gap-2 px-4 py-2 bg-accent text-primary rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
					>
						{loading ? (
							<LoadingSpinner size="sm" />
						) : (
							<ClockIcon className="w-4 h-4" />
						)}
						Refresh
					</button>
				</div>
			</div>

			{/* Worker Selection */}
			<div className="bg-white rounded-lg border border-gray-200 p-4">
				<h3 className="text-xs font-medium text-secondary mb-3">
					Select Workers to Display
				</h3>
				<div className="flex flex-wrap gap-2">
					{workers.map(worker => (
						<label
							key={worker.id}
							className="flex items-center gap-2 cursor-pointer"
						>
							<input
								type="checkbox"
								checked={selectedWorkers.includes(worker.id)}
								onChange={() => handleWorkerToggle(worker.id)}
								className="rounded border-gray-300 text-accent focus:ring-accent"
							/>
							<div 
								className="w-3 h-3 rounded-full"
								style={{ backgroundColor: workerColors[worker.id] }}
							/>
							<span className="text-xs text-secondary">
								{worker.name || worker.email}
							</span>
						</label>
					))}
				</div>
			</div>

			{/* Loading State */}
			{loading && (
				<div className="flex items-center justify-center py-12">
					<LoadingSpinner size="md" />
					<span className="ml-3 text-secondary">
						Loading attendance data...
					</span>
				</div>
			)}

			{/* Graph Container */}
			{!loading && (
				<div className="bg-white rounded-lg border border-gray-200 p-6">
					<div className="relative">
						{/* Graph Title */}
						<div className="mb-6">
							<h3 className="text-base font-medium text-secondary mb-2">
								{timeRange}-Hour Attendance Timeline
							</h3>
							<p className="text-xs text-secondary/70">
								Horizontal lines show working periods for each employee
								{timeRange < 24 && ` (${timeRangeBounds.startHour}:00 - ${timeRangeBounds.endHour}:00)`}
							</p>
						</div>

						{/* Full Width Graph Area */}
						<div className="w-full">
							{/* Graph Container */}
							<div className="relative bg-gray-50 rounded-lg overflow-hidden" style={{ height: `${Math.max(workers.filter(w => selectedWorkers.includes(w.id)).length * 60, 200)}px` }}>
								{/* Worker names overlay on the left */}
								<div className="absolute left-0 top-0 z-10 bg-white/95 backdrop-blur-sm border-r border-gray-200" style={{ width: '180px', height: '100%' }}>
									{workers
										.filter(worker => selectedWorkers.includes(worker.id))
										.map((worker, index) => (
											<div 
												key={worker.id} 
												className="h-15 flex items-center px-3 text-xs text-secondary border-b border-gray-200/50"
												style={{ height: '60px' }}
											>
												<div 
													className="w-3 h-3 rounded-full mr-2 shrink-0"
													style={{ backgroundColor: workerColors[worker.id] }}
												/>
												<span className="truncate font-medium">
													{worker.name || worker.email.split('@')[0]}
												</span>
											</div>
										))}
								</div>
								
								{/* SVG Graph */}
								<svg className="w-full h-full" viewBox={`0 0 1000 ${Math.max(workers.filter(w => selectedWorkers.includes(w.id)).length * 60, 200)}`}>
									{/* Grid Lines (vertical hour lines) */}
									{Array.from({ length: Math.ceil(timeRange) + 1 }).map((_, i) => {
										const hour = timeRangeBounds.startHour + (i * timeRange / Math.ceil(timeRange));
										if (hour <= timeRangeBounds.endHour) {
											return (
												<line
													key={`vline-${i}`}
													x1={i * (1000 / Math.ceil(timeRange))}
													y1={0}
													x2={i * (1000 / Math.ceil(timeRange))}
													y2={Math.max(workers.filter(w => selectedWorkers.includes(w.id)).length * 60, 200)}
													stroke="#E5E7EB"
													strokeWidth="1"
													opacity="0.5"
												/>
											);
										}
										return null;
									})}
									
									{/* Horizontal separator lines between workers */}
									{workers
										.filter(worker => selectedWorkers.includes(worker.id))
										.map((_, index) => (
											<line
												key={`hline-${index}`}
												x1={180} // Start after worker names
												y1={(index + 1) * 60}
												x2={1000}
												y2={(index + 1) * 60}
												stroke="#E5E7EB"
												strokeWidth="1"
												opacity="0.3"
											/>
										))}

									{/* Plot attendance segments for each worker */}
									{workers
										.filter(worker => selectedWorkers.includes(worker.id))
										.map((worker, workerIndex) => {
											const segments = graphData[worker.id]?.segments || [];
											const color = workerColors[worker.id];
											const yPosition = workerIndex * 60 + 30; // Center of each worker's row
											const { startHour, endHour } = timeRangeBounds;
											const rangeWidth = endHour - startHour;
											
											return (
												<g key={worker.id}>
													{segments.map((segment, segmentIndex) => {
														// Convert times to positions within the visible range
														const startX = 180 + ((segment.start - startHour) / rangeWidth) * (1000 - 180);
														const endX = 180 + ((segment.end - startHour) / rangeWidth) * (1000 - 180);
														
														// Only render if within visible bounds
														if (startX < 1000 && endX > 180) {
															return (
																<g key={`${worker.id}-${segmentIndex}`}>
																	{/* Working period line */}
																	<line
																		x1={Math.max(startX, 180)}
																		y1={yPosition}
																		x2={Math.min(endX, 1000)}
																		y2={yPosition}
																		stroke={color}
																		strokeWidth="6"
																		strokeLinecap="round"
																	/>
																	
																	{/* Clock-in marker */}
																	{startX >= 180 && (
																		<circle
																			cx={startX}
																			cy={yPosition}
																			r="8"
																			fill={color}
																			stroke="white"
																			strokeWidth="3"
																		/>
																	)}
																	
																	{/* Clock-out marker (if exists and visible) */}
																	{endX <= 1000 && segment.endTime !== 'Working' && segment.endTime !== 'Now' && (
																		<circle
																			cx={endX}
																			cy={yPosition}
																			r="8"
																			fill={color}
																			stroke="white"
																			strokeWidth="3"
																			fillOpacity="0.7"
																		/>
																	)}
																	
																	{/* Still working indicator */}
																	{endX <= 1000 && (segment.endTime === 'Working' || segment.endTime === 'Now') && (
																		<circle
																			cx={endX}
																			cy={yPosition}
																			r="6"
																			fill={color}
																			className="animate-pulse"
																		/>
																	)}
																	
																	{/* Time labels */}
																	{startX >= 180 && (
																		<text
																			x={startX}
																			y={yPosition - 15}
																			textAnchor="middle"
																			fill={color}
																			fontSize="11"
																			fontWeight="bold"
																		>
																			{segment.startTime}
																		</text>
																	)}
																	
																	{endX <= 1000 && segment.endTime !== 'Working' && (
																		<text
																			x={endX}
																			y={yPosition - 15}
																			textAnchor="middle"
																			fill={color}
																			fontSize="11"
																			fontWeight="bold"
																		>
																			{segment.endTime}
																		</text>
																	)}
																</g>
															);
														}
														return null;
													})}
												</g>
											);
										})}
								</svg>
							</div>

							{/* X-axis Labels */}
							<div className="flex justify-between mt-2 text-xs text-gray-500" style={{ marginLeft: '180px' }}>
								{Array.from({ length: Math.ceil(timeRange / 2) + 1 }).map((_, i) => {
									const hour = timeRangeBounds.startHour + (i * 2);
									if (hour <= timeRangeBounds.endHour) {
										return <span key={i}>{formatTime(hour)}</span>;
									}
									return null;
								})}
							</div>
						</div>

						{/* Legend */}
						<div className="mt-6 flex flex-wrap gap-4 text-xs">
							<div className="flex items-center gap-2">
								<div className="w-6 h-1.5 bg-accent rounded" />
								<span className="text-secondary/70">Working Period</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 bg-accent rounded-full border-2 border-white" />
								<span className="text-secondary/70">Clock In/Out</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-accent rounded-full animate-pulse" />
								<span className="text-secondary/70">Currently Working</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Attendance Summary */}
			{!loading && filteredAttendances.length > 0 && (
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<h3 className="text-xs font-medium text-secondary mb-3">
						Daily Summary
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{workers
							.filter(worker => selectedWorkers.includes(worker.id))
							.map(worker => {
								const workerAttendances = filteredAttendances.filter(a => a.worker_id === worker.id);
								const totalMinutes = workerAttendances.reduce((sum, attendance) => {
									if (attendance.clockOutTime) {
										return sum + Math.floor((attendance.clockOutTime.getTime() - attendance.clockInTime.getTime()) / (1000 * 60));
									}
									return sum;
								}, 0);
								
								const hours = Math.floor(totalMinutes / 60);
								const minutes = totalMinutes % 60;
								
								return (
									<div key={worker.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
										<div 
											className="w-4 h-4 rounded-full"
											style={{ backgroundColor: workerColors[worker.id] }}
										/>
										<div className="flex-1">
											<p className="text-xs font-medium text-secondary">
												{worker.name || worker.email}
											</p> 
											<p className="text-xs text-secondary/70">
												{workerAttendances.length} session{workerAttendances.length !== 1 ? 's' : ''} • {hours}h {minutes}m total
											</p>
										</div>
									</div>
								);
							})}
					</div>
				</div>
			)}

			{/* Empty State */}
			{!loading && filteredAttendances.length === 0 && (
				<div className="text-center py-12">
					<div className="text-3xl text-gray-300 mb-4">📊</div>
					<h3 className="text-base font-semibold text-gray-700 mb-2">
						No Attendance Data
					</h3>
					<p className="text-gray-500">
						No attendance records found for {formatDateTime(selectedDate)}
					</p>
				</div>
			)}
		</div>
	);
}