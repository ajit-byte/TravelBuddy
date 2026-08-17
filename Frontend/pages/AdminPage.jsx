import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAdminStats, getVerificationRequests, approveVerification, rejectVerification } from '../api/adminApi';

const STATUS_TABS = ['pending', 'verified', 'unverified'];

export default function AdminPage() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [rejectModal, setRejectModal] = useState(null); // userId
  const [rejectReason, setRejectReason] = useState('');

  const token = JSON.parse(localStorage.getItem('authTokens'))?.token;

  // Guard: non-admin users get bounced
  useEffect(() => {
    if (user && !user.isAdmin) navigate('/homepage', { replace: true });
  }, [user]);

  const fetchStats = async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (_) {}
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getVerificationRequests(activeTab);
      setRequests(data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchRequests(); }, [activeTab]);

  const handleApprove = async (userId) => {
    setActionLoading(p => ({ ...p, [userId]: true }));
    try {
      await approveVerification(userId);
      fetchRequests(); 
      fetchStats();
    } catch (_) {}
    finally { setActionLoading(p => ({ ...p, [userId]: false })); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
       alert("Rejection reason is required.");
       return;
    }
    setActionLoading(p => ({ ...p, [rejectModal]: true }));
    try {
      await rejectVerification(rejectModal, rejectReason);
      fetchRequests(); 
      fetchStats(); 
      setRejectModal(null); 
      setRejectReason('');
    } catch (_) {}
    finally { setActionLoading(p => ({ ...p, [rejectModal]: false })); }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-gray-900 text-white px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-black text-sm">A</div>
          <span className="text-lg font-bold">TravelBuddy Admin</span>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-white transition-colors">
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Users', value: stats.totalUsers, color: 'bg-blue-50 text-blue-700' },
              { label: 'Pending KYC', value: stats.pendingKyc, color: 'bg-yellow-50 text-yellow-700' },
              { label: 'Approved KYC', value: stats.approvedKyc, color: 'bg-green-50 text-green-700' },
              { label: 'Rejected KYC', value: stats.rejectedKyc, color: 'bg-red-50 text-red-700' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-5 ${s.color} shadow-sm`}>
                <p className="text-3xl font-black">{s.value}</p>
                <p className="text-sm font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* KYC Requests */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-black text-gray-900">KYC Verification Requests</h2>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-colors ${
                    activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium">No {activeTab} KYC requests</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requests.map(u => (
                <div key={u._id} className="px-6 py-6 flex items-start gap-5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-accent text-accent-text flex items-center justify-center font-black text-xl shrink-0 overflow-hidden shadow-sm">
                    {u.user?.profileIconUrl
                      ? <img src={u.user.profileIconUrl} alt="" className="w-full h-full object-cover" />
                      : (u.user?.nickname || u.user?.username)?.charAt(0)?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-gray-900">{u.user?.nickname || u.user?.username}</p>
                      <span className="text-xs text-gray-400">@{u.user?.username}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{u.user?.email}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div><span className="font-semibold">Full Legal Name:</span> {u.fullName}</div>
                      <div><span className="font-semibold">DOB:</span> {u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString() : '—'}</div>
                      <div><span className="font-semibold">Temp Address:</span> {u.temporaryAddress}</div>
                      <div><span className="font-semibold">Perm Address:</span> {u.permanentAddress}</div>
                      <div><span className="font-semibold">Country:</span> {u.country}</div>
                      <div><span className="font-semibold">Document:</span> {u.documentType}</div>
                      {u.submittedAt && (
                        <div className="col-span-1 sm:col-span-2 text-xs text-gray-400 mt-1">
                          Submitted: {new Date(u.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 flex gap-4">
                      {u.frontImageUrl && (
                        <a href={u.frontImageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                          <span className="material-symbols-outlined text-base">front_hand</span> View Front ID
                        </a>
                      )}
                      {u.backImageUrl && (
                        <a href={u.backImageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                          <span className="material-symbols-outlined text-base">back_hand</span> View Back ID
                        </a>
                      )}
                    </div>
                    
                    {u.rejectionReason && (
                      <div className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                         <span className="font-bold block mb-1">Rejection Reason:</span>
                         {u.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {activeTab === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(u.user._id)}
                        disabled={actionLoading[u.user._id]}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading[u.user._id] ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => { setRejectModal(u.user._id); setRejectReason(''); }}
                        disabled={actionLoading[u.user._id]}
                        className="px-4 py-2 bg-red-100 text-red-600 text-sm font-bold rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {activeTab === 'verified' && (
                    <span className="shrink-0 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">✓ Verified</span>
                  )}
                  {activeTab === 'unverified' && (
                    <span className="shrink-0 text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">✗ Rejected</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Reject reason modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-black text-gray-900 mb-4">Reject KYC Request</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection (optional)..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 outline-none resize-none text-sm mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setRejectModal(null)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading[rejectModal]}
                className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition text-sm disabled:opacity-50"
              >
                {actionLoading[rejectModal] ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
