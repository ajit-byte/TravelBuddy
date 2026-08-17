import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(email, password);
    setLoading(false);
  };

  return (
    <div className="bg-[#0A0A0B] text-white min-h-screen flex flex-col items-center justify-center p-4 relative overflow-x-hidden selection:bg-red-500/30">
      <div className="absolute top-0 w-full z-20">
        <Navbar showAuth={false} transparent={true} />
      </div>

      <div className="fixed inset-0 -z-20 bg-[#0A0A0B]"></div>
      <div className="fixed inset-0 -z-10 bg-doodle opacity-10 invert"></div>
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-red-900/10 blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-lg relative z-10 pt-16">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-md mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Restricted Area</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
             <span className="text-3xl font-extrabold tracking-tight text-white/90">TravelBuddy <span className="text-red-500">Admin</span></span>
             <h1 className="text-display-lg font-headline text-3xl font-extrabold tracking-tight mt-2 text-white">System Access</h1>
             <p className="text-white/40 font-body text-sm max-w-xs mx-auto">This portal is restricted to authorized personnel. All access attempts are logged and monitored.</p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative border border-white/10">
          <div className="absolute -top-4 right-8">
            <div className="bg-red-500 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
              <span className="material-symbols-outlined text-[18px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>lock_person</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-white">Secure Auth</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/50 ml-1" htmlFor="email">Admin Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-white/30 text-[20px]">admin_panel_settings</span>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@travelbuddy.com"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:ring-2 focus:ring-red-500/20 focus:bg-white/10 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/50" htmlFor="password">Security Token / Password</label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-white/30 text-[20px]">key</span>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="block w-full pl-11 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:ring-2 focus:ring-red-500/20 focus:bg-white/10 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/30 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/20 hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? 'Authenticating...' : 'Establish Connection'}
              {!loading && <span className="material-symbols-outlined text-[20px]">login</span>}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/10 text-center">
             <div className="inline-flex items-center gap-2 text-white/30">
               <span className="material-symbols-outlined text-[14px]">shield</span>
               <span className="text-[10px] font-bold uppercase tracking-widest">RSA 4096-bit Encrypted</span>
             </div>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-x-8 gap-y-4 opacity-30 grayscale grayscale-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-red-500">terminal</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Console Logs Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-blue-500">location_on</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">IP Tracking Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
