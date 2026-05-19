import React, { useState } from 'react';

// Types
interface Incident {
  id: string;
  type: 'Medical' | 'RTC' | 'Fire' | 'Hazmat';
  location: string;
  timeOccurred: string;
  status: 'Pending Report' | 'Completed';
  victimCount: number;
}

interface Report {
  id: string;
  incidentIds: string[];
  submittedBy: string;
  submittedDate: string;
  status: 'Draft' | 'Submitted' | 'Approved';
  incidentType: string;
  location: string;
}

interface ReportFormData {
  actionsTaken: string;
  remarks: string;
  equipmentUsed: string[];
  finalOutcome: 'Resolved' | 'Transferred to Hospital' | 'On-going' | 'Cleared';
}

// Mock Data
const mockIncidents: Incident[] = [
  {
    id: 'INC-001',
    type: 'Medical',
    location: 'Barangay 1, Main St',
    timeOccurred: '2:30 PM',
    status: 'Pending Report',
    victimCount: 2,
  },
  {
    id: 'INC-002',
    type: 'RTC',
    location: 'Highway 1, Junction',
    timeOccurred: '3:15 PM',
    status: 'Pending Report',
    victimCount: 3,
  },
  {
    id: 'INC-003',
    type: 'Fire',
    location: 'Barangay 3, Warehouse',
    timeOccurred: '1:45 PM',
    status: 'Completed',
    victimCount: 0,
  },
  {
    id: 'INC-004',
    type: 'Hazmat',
    location: 'Industrial Zone',
    timeOccurred: '4:00 PM',
    status: 'Pending Report',
    victimCount: 1,
  },
  {
    id: 'INC-005',
    type: 'Medical',
    location: 'Barangay 2, School',
    timeOccurred: '2:00 PM',
    status: 'Completed',
    victimCount: 1,
  },
];

const mockReports: Report[] = [
  {
    id: 'REP-001',
    incidentIds: ['INC-001'],
    submittedBy: 'John Doe',
    submittedDate: '2024-05-15 04:30 PM',
    status: 'Approved',
    incidentType: 'Medical',
    location: 'Barangay 1, Main St',
  },
  {
    id: 'REP-002',
    incidentIds: ['INC-003', 'INC-005'],
    submittedBy: 'Jane Smith',
    submittedDate: '2024-05-15 03:45 PM',
    status: 'Submitted',
    incidentType: 'Fire, Medical',
    location: 'Multiple Locations',
  },
];

// Component: Dashboard View
const DashboardView: React.FC<{ onCreateReport: () => void }> = ({ onCreateReport }) => {
  const stats = [
    { label: 'Total Incidents Today', value: '8', icon: '📊', color: 'blue' },
    { label: 'Pending Reports', value: '3', icon: '⏳', color: 'yellow' },
    { label: 'Completed Reports', value: '5', icon: '✓', color: 'green' },
    { label: 'Active Responders', value: '12', icon: '👥', color: 'purple' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with CTA */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Responder Dashboard</h1>
        <button
          onClick={onCreateReport}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <span>+</span>
          Create Accomplishment Report
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500 hover:shadow-lg transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Incidents Preview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Pending Incidents</h2>
        <div className="space-y-3">
          {mockIncidents
            .filter((inc) => inc.status === 'Pending Report')
            .slice(0, 5)
            .map((incident) => (
              <div
                key={incident.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-orange-500 text-xl">⚠</span>
                    <div>
                      <p className="font-semibold text-gray-900">{incident.id}</p>
                      <p className="text-sm text-gray-600">{incident.location}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{incident.type}</p>
                  <p className="text-xs text-gray-600">{incident.timeOccurred}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// Component: Incident List View
interface IncidentListViewProps {
  onSelectIncidents: (incidents: Incident[]) => void;
  onGenerateReport: () => void;
}

const IncidentListView: React.FC<IncidentListViewProps> = ({ onSelectIncidents, onGenerateReport }) => {
  const [incidents] = useState<Incident[]>(mockIncidents);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    dateRange: '',
    search: '',
  });

  const handleSelectAll = () => {
    if (selectedIds.size === filteredIncidents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIncidents.map((inc) => inc.id)));
    }
  };

  const handleToggleIncident = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleGenerateReport = () => {
    const selected = incidents.filter((inc) => selectedIds.has(inc.id));
    onSelectIncidents(selected);
    onGenerateReport();
  };

  const filteredIncidents = incidents.filter((incident) => {
    return (
      (!filters.type || incident.type === filters.type) &&
      (!filters.status || incident.status === filters.status) &&
      (!filters.search || incident.location.toLowerCase().includes(filters.search.toLowerCase()) || incident.id.includes(filters.search))
    );
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Incident List</h1>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by ID or location..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="Medical">Medical</option>
            <option value="RTC">RTC</option>
            <option value="Fire">Fire</option>
            <option value="Hazmat">Hazmat</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="Pending Report">Pending Report</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Incident Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredIncidents.length && filteredIncidents.length > 0}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Incident ID</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Type</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Location</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Time Occurred</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((incident) => (
                <tr key={incident.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(incident.id)}
                      onChange={() => handleToggleIncident(incident.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">{incident.id}</td>
                  <td className="px-6 py-3">
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {incident.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-700">{incident.location}</td>
                  <td className="px-6 py-3 text-gray-700">{incident.timeOccurred}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        incident.status === 'Completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {incident.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Report Button */}
      <button
        onClick={handleGenerateReport}
        disabled={selectedIds.size === 0}
        className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>📋</span>
        Generate Accomplishment Report ({selectedIds.size} selected)
      </button>
    </div>
  );
};

// Component: Report Creation Modal
interface ReportCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIncidents: Incident[];
  onSubmit: (data: ReportFormData) => void;
}

const ReportCreationModal: React.FC<ReportCreationModalProps> = ({ isOpen, onClose, selectedIncidents, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ReportFormData>({
    actionsTaken: '',
    remarks: '',
    equipmentUsed: [],
    finalOutcome: 'Resolved',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [equipmentInput, setEquipmentInput] = useState('');

  if (!isOpen) return null;

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.actionsTaken.trim()) {
      newErrors.actionsTaken = 'Actions Taken is required';
    } else if (formData.actionsTaken.length < 10) {
      newErrors.actionsTaken = 'Minimum 10 characters required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddEquipment = () => {
    if (equipmentInput.trim()) {
      setFormData({
        ...formData,
        equipmentUsed: [...formData.equipmentUsed, equipmentInput],
      });
      setEquipmentInput('');
    }
  };

  const handleRemoveEquipment = (index: number) => {
    setFormData({
      ...formData,
      equipmentUsed: formData.equipmentUsed.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = () => {
    if (validateStep2()) {
      onSubmit(formData);
      setStep(1);
      setFormData({
        actionsTaken: '',
        remarks: '',
        equipmentUsed: [],
        finalOutcome: 'Resolved',
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-50 border-b p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Accomplishment Report</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Step 1: Selected Incidents</h3>
              <div className="space-y-3">
                {selectedIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Incident ID</p>
                        <p className="font-semibold text-gray-900">{incident.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Type</p>
                        <p className="font-semibold text-gray-900">{incident.type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Location</p>
                        <p className="font-semibold text-gray-900">{incident.location}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Time</p>
                        <p className="font-semibold text-gray-900">{incident.timeOccurred}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Victims/Patients</p>
                        <p className="font-semibold text-gray-900">{incident.victimCount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Step 2: Report Details</h3>

              {/* Auto-filled info */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600 mb-2">Incident Information (Auto-filled)</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Type: <span className="font-semibold">{selectedIncidents[0]?.type}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-600">Location: <span className="font-semibold">{selectedIncidents[0]?.location}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-600">Time: <span className="font-semibold">{selectedIncidents[0]?.timeOccurred}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-600">Victims: <span className="font-semibold">{selectedIncidents[0]?.victimCount}</span></p>
                  </div>
                </div>
              </div>

              {/* Manual Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Actions Taken <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={formData.actionsTaken}
                  onChange={(e) => {
                    setFormData({ ...formData, actionsTaken: e.target.value });
                    if (errors.actionsTaken) setErrors({ ...errors, actionsTaken: '' });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                  placeholder="Describe the actions taken..."
                />
                {errors.actionsTaken && (
                  <p className="text-red-600 text-sm mt-1">{errors.actionsTaken}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                  placeholder="Additional remarks..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Equipment Used</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={equipmentInput}
                    onChange={(e) => setEquipmentInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddEquipment()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add equipment..."
                  />
                  <button
                    onClick={handleAddEquipment}
                    className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.equipmentUsed.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                    >
                      {item}
                      <button
                        onClick={() => handleRemoveEquipment(idx)}
                        className="font-bold hover:text-blue-900"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Final Outcome <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.finalOutcome}
                  onChange={(e) => setFormData({ ...formData, finalOutcome: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Resolved">Resolved</option>
                  <option value="Transferred to Hospital">Transferred to Hospital</option>
                  <option value="On-going">On-going</option>
                  <option value="Cleared">Cleared</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-between">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
            >
              Back
            </button>
          )}
          <div className="flex-1"></div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Next
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Submit Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Component: Team Reports View
interface TeamReportsViewProps {
  submittedReports: Report[];
}

const TeamReportsView: React.FC<TeamReportsViewProps> = ({ submittedReports }) => {
  const [reports] = useState<Report[]>(submittedReports);
  const [filters, setFilters] = useState({
    dateRange: '',
    incidentType: '',
    status: '',
  });

  const filteredReports = reports.filter((report) => {
    return (
      (!filters.incidentType || report.incidentType.includes(filters.incidentType)) &&
      (!filters.status || report.status === filters.status)
    );
  });

  const handleDownloadPDF = (reportId: string) => {
    alert(`Downloading PDF for report ${reportId}...`);
  };

  const handleEditReport = (reportId: string) => {
    alert(`Editing report ${reportId}...`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Team Reports</h1>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-md flex gap-4 flex-wrap">
        <select
          value={filters.dateRange}
          onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Dates</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <select
          value={filters.incidentType}
          onChange={(e) => setFilters({ ...filters, incidentType: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="Medical">Medical</option>
          <option value="RTC">RTC</option>
          <option value="Fire">Fire</option>
          <option value="Hazmat">Hazmat</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="Approved">Approved</option>
        </select>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Report ID</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Incidents</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Submitted By</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Date/Time</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-3 font-medium text-gray-900">{report.id}</td>
                  <td className="px-6 py-3 text-gray-700">{report.incidentIds.join(', ')}</td>
                  <td className="px-6 py-3 text-gray-700">{report.submittedBy}</td>
                  <td className="px-6 py-3 text-gray-700">{report.submittedDate}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        report.status === 'Approved'
                          ? 'bg-green-100 text-green-800'
                          : report.status === 'Submitted'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <button
                        className="text-blue-600 hover:text-blue-800 transition text-lg"
                        title="View report"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(report.id)}
                        className="text-green-600 hover:text-green-800 transition text-lg"
                        title="Download PDF"
                      >
                        ⬇️
                      </button>
                      {report.status !== 'Approved' && (
                        <button
                          onClick={() => handleEditReport(report.id)}
                          className="text-orange-600 hover:text-orange-800 transition text-lg"
                          title="Edit report"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More */}
      <div className="flex justify-center">
        <button className="px-6 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition">
          Load More Reports
        </button>
      </div>
    </div>
  );
};

// Main Component: Responder Dashboard Page
const ResponderDashboardPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'incidents' | 'reports'>('dashboard');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedIncidents, setSelectedIncidents] = useState<Incident[]>([]);
  const [submittedReports, setSubmittedReports] = useState<Report[]>(mockReports);

  const handleCreateReport = () => {
    setSelectedIncidents([]);
    setIsReportModalOpen(true);
  };

  const handleSelectIncidents = (incidents: Incident[]) => {
    setSelectedIncidents(incidents);
  };

  const handleSubmitReport = () => {
    const newReport: Report = {
      id: `REP-${String(submittedReports.length + 1).padStart(3, '0')}`,
      incidentIds: selectedIncidents.map((inc) => inc.id),
      submittedBy: 'Current User', // Would be replaced with actual user
      submittedDate: new Date().toLocaleString(),
      status: 'Submitted',
      incidentType: selectedIncidents.map((inc) => inc.type).join(', '),
      location: selectedIncidents[0]?.location || 'Multiple',
    };

    setSubmittedReports([newReport, ...submittedReports]);

    // Show success toast (in real app, use toast library)
    alert('Report submitted successfully!');

    // Update incident statuses to Completed
    // This would be done via API in real app
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Tabs */}
      <div className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-6 border-b">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`pb-2 px-4 font-medium transition border-b-2 ${
                currentView === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('incidents')}
              className={`pb-2 px-4 font-medium transition border-b-2 ${
                currentView === 'incidents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Incidents
            </button>
            <button
              onClick={() => setCurrentView('reports')}
              className={`pb-2 px-4 font-medium transition border-b-2 ${
                currentView === 'reports'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Team Reports
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'dashboard' && <DashboardView onCreateReport={handleCreateReport} />}
        {currentView === 'incidents' && (
          <IncidentListView
            onSelectIncidents={handleSelectIncidents}
            onGenerateReport={handleCreateReport}
          />
        )}
        {currentView === 'reports' && <TeamReportsView submittedReports={submittedReports} />}
      </div>

      {/* Report Creation Modal */}
      <ReportCreationModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedIncidents={selectedIncidents}
        onSubmit={handleSubmitReport}
      />
    </div>
  );
};

export default ResponderDashboardPage;
