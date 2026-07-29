import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { getVerificationStatus, submitVerification } from '../api/verificationApi';

export default function VerificationPage() {
  const { user, profile, refreshProfile } = useContext(AuthContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusRecord, setStatusRecord] = useState(null);
  
  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '',
    temporaryAddress: '',
    permanentAddress: '',
    country: '',
    documentType: 'national_id'
  });
  
  const [sameAsTemporary, setSameAsTemporary] = useState(false);
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getVerificationStatus();
        if (data.status === 'verified') {
          navigate('/profile', { replace: true });
        } else {
          setStatusRecord(data);
          if (data.status === 'unverified') {
             // Pre-fill form if rejected
             setForm({
               fullName: data.fullName || '',
               dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '',
               temporaryAddress: data.temporaryAddress || '',
               permanentAddress: data.permanentAddress || '',
               country: data.country || '',
               documentType: 'national_id'
             });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [navigate]);

  const validateStep1 = () => {
    const newErrors = {};
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!form.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!form.temporaryAddress.trim()) newErrors.temporaryAddress = 'Temporary address is required';
    if (!form.permanentAddress.trim()) newErrors.permanentAddress = 'Permanent address is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!form.country.trim()) newErrors.country = 'Country is required';
    if (!frontImage) newErrors.frontImage = 'Front image of National ID is required';
    if (!backImage) newErrors.backImage = 'Back image of National ID is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleImageChange = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (side === 'front') {
      setFrontImage(file);
      setFrontPreview(URL.createObjectURL(file));
      setErrors(p => ({ ...p, frontImage: null }));
    } else {
      setBackImage(file);
      setBackPreview(URL.createObjectURL(file));
      setErrors(p => ({ ...p, backImage: null }));
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    
    setSubmitting(true);
    const formData = new FormData();
    formData.append('fullName', form.fullName);
    formData.append('dateOfBirth', form.dateOfBirth);
    formData.append('temporaryAddress', form.temporaryAddress);
    formData.append('permanentAddress', form.permanentAddress);
    formData.append('country', form.country);
    formData.append('documentType', form.documentType);
    formData.append('frontImage', frontImage);
    formData.append('backImage', backImage);

    try {
      const res = await submitVerification(formData);
      if (res.ok) {
        setStatusRecord({ status: 'pending' });
        await refreshProfile(); // Update profile so banner disappears
        setStep(3); // Success step
      } else {
        const data = await res.json();
        setErrors({ submit: data.msg || 'Submission failed' });
      }
    } catch (err) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckboxChange = (e) => {
    setSameAsTemporary(e.target.checked);
    if (e.target.checked) {
      setForm(p => ({ ...p, permanentAddress: form.temporaryAddress }));
      setErrors(p => ({ ...p, permanentAddress: null }));
    } else {
      setForm(p => ({ ...p, permanentAddress: '' }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
         <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Already pending
  if (statusRecord?.status === 'pending' && step !== 3) {
    return (
      <div className="min-h-screen bg-surface font-body pt-20">
        <Navbar />
        <div className="max-w-2xl mx-auto mt-20 p-8 text-center bg-white rounded-3xl shadow-sm border border-slate-100">
          <span className="material-symbols-outlined text-6xl text-amber-500 mb-6">hourglass_empty</span>
          <h1 className="text-3xl font-black text-primary mb-4">Under Review</h1>
          <p className="text-slate-600 text-lg mb-8">Your verification request has been submitted successfully and is currently under review by our administration team. This usually takes 1-2 business days.</p>
          <button onClick={() => navigate('/homepage')} className="px-8 py-3 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition-colors">
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body pt-20 pb-20">
      <Navbar />
      
      <div className="max-w-3xl mx-auto px-4 mt-8">
        
        {step !== 3 && (
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black text-primary tracking-tight mb-2">Account Verification</h1>
            <p className="text-slate-500">Become a Trusted Explorer to unlock all features.</p>
            
            {/* Progress Bar */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step === 1 ? 'bg-primary text-white' : 'bg-green-500 text-white'}`}>
                  {step > 1 ? '✓' : '1'}
                </div>
                <span className={`text-xs font-bold uppercase tracking-widest ${step >= 1 ? 'text-primary' : 'text-slate-400'}`}>Personal Info</span>
              </div>
              <div className={`w-20 h-1 rounded-full ${step > 1 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step === 2 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                  2
                </div>
                <span className={`text-xs font-bold uppercase tracking-widest ${step === 2 ? 'text-primary' : 'text-slate-400'}`}>Documents</span>
              </div>
            </div>
          </div>
        )}

        {statusRecord?.status === 'unverified' && step !== 3 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 flex gap-4 items-start">
            <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
            <div>
              <h3 className="font-bold text-red-800 mb-1">Verification Rejected</h3>
              <p className="text-red-700 text-sm mb-2">Your previous verification request was not approved.</p>
              <p className="text-red-900 font-medium bg-red-100 p-3 rounded-xl text-sm">Reason: {statusRecord.rejectionReason}</p>
              <p className="text-red-700 text-sm mt-3">Please correct the information and try submitting again.</p>
            </div>
          </div>
        )}

        {errors.submit && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-6 text-sm font-bold text-center">
            {errors.submit}
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-10">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">Personal Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pre-filled unchangeable data */}
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Registered Email</label>
                  <input type="text" value={profile?.email || user?.email || ''} disabled className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Registered Phone</label>
                  <input type="text" value={profile?.phoneNo || 'Not provided'} disabled className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed" />
                </div>

                {/* Editable data */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Full Legal Name <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={form.fullName}
                    onChange={(e) => { setForm(p => ({ ...p, fullName: e.target.value })); setErrors(p => ({ ...p, fullName: null })); }}
                    className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all ${errors.fullName ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-slate-300 focus:border-primary'}`} 
                    placeholder="As it appears on your ID"
                  />
                  {errors.fullName && <p className="text-red-500 text-xs mt-1 font-bold">{errors.fullName}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Date of Birth <span className="text-red-500">*</span></label>
                  <input 
                    type="date" 
                    value={form.dateOfBirth}
                    onChange={(e) => { setForm(p => ({ ...p, dateOfBirth: e.target.value })); setErrors(p => ({ ...p, dateOfBirth: null })); }}
                    className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all ${errors.dateOfBirth ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-slate-300 focus:border-primary'}`} 
                  />
                  {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1 font-bold">{errors.dateOfBirth}</p>}
                </div>

                <div className="md:col-span-2 mt-4 border-t border-slate-100 pt-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Temporary Address <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={form.temporaryAddress}
                    onChange={(e) => {
                       setForm(p => {
                         const next = { ...p, temporaryAddress: e.target.value };
                         if (sameAsTemporary) next.permanentAddress = e.target.value;
                         return next;
                       });
                       setErrors(p => ({ ...p, temporaryAddress: null }));
                    }}
                    className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all ${errors.temporaryAddress ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-slate-300 focus:border-primary'}`} 
                    placeholder="City, Street, House No."
                  />
                  {errors.temporaryAddress && <p className="text-red-500 text-xs mt-1 font-bold">{errors.temporaryAddress}</p>}
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-700">Permanent Address <span className="text-red-500">*</span></label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 font-medium">
                      <input type="checkbox" checked={sameAsTemporary} onChange={handleCheckboxChange} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
                      Same as Temporary
                    </label>
                  </div>
                  <input 
                    type="text" 
                    disabled={sameAsTemporary}
                    value={form.permanentAddress}
                    onChange={(e) => { setForm(p => ({ ...p, permanentAddress: e.target.value })); setErrors(p => ({ ...p, permanentAddress: null })); }}
                    className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all ${errors.permanentAddress ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-slate-300 focus:border-primary'} ${sameAsTemporary ? 'bg-slate-50 text-slate-500' : ''}`} 
                    placeholder="City, Street, House No."
                  />
                  {errors.permanentAddress && <p className="text-red-500 text-xs mt-1 font-bold">{errors.permanentAddress}</p>}
                </div>
              </div>

              <div className="flex justify-end pt-8 mt-8 border-t border-slate-100">
                <button onClick={nextStep} className="px-8 py-3 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition-colors flex items-center gap-2">
                  Continue to Documents
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4 mb-6">
                 <button onClick={() => setStep(1)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
                   <span className="material-symbols-outlined text-xl leading-none">arrow_back</span>
                 </button>
                 <h2 className="text-xl font-bold text-slate-800">Identity Documents</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Issuing Country <span className="text-red-500">*</span></label>
                  <select 
                    value={form.country}
                    onChange={(e) => { setForm(p => ({ ...p, country: e.target.value })); setErrors(p => ({ ...p, country: null })); }}
                    className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all bg-white ${errors.country ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-slate-300 focus:border-primary'}`}
                  >
                    <option value="">Select a country</option>
                    <option value="Nepal">Nepal</option>
                    <option value="India">India</option>
                    <option value="USA">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="Australia">Australia</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.country && <p className="text-red-500 text-xs mt-1 font-bold">{errors.country}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Document Type</label>
                  <select disabled className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold appearance-none">
                    <option value="national_id">National ID Card</option>
                  </select>
                </div>
              </div>

              <div className="mt-8">
                <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm mb-6 flex gap-3 items-start">
                  <span className="material-symbols-outlined text-blue-600">info</span>
                  <p>Please upload clear, readable images of your National ID. All corners of the document must be visible. Maximum file size: 5MB per image.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Front Image */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Front Side <span className="text-red-500">*</span></label>
                    <div 
                      className={`relative w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group ${errors.frontImage ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-50 hover:border-primary hover:bg-blue-50'}`}
                      onClick={() => document.getElementById('frontImageInput').click()}
                    >
                      {frontPreview ? (
                        <>
                          <img src={frontPreview} alt="Front of ID" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">Change Image</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-4xl text-slate-400 mb-2 group-hover:text-primary transition-colors">add_photo_alternate</span>
                          <span className="text-sm font-medium text-slate-500 group-hover:text-primary transition-colors">Upload Front Image</span>
                        </>
                      )}
                      <input id="frontImageInput" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'front')} />
                    </div>
                    {errors.frontImage && <p className="text-red-500 text-xs mt-2 font-bold text-center">{errors.frontImage}</p>}
                  </div>

                  {/* Back Image */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Back Side <span className="text-red-500">*</span></label>
                    <div 
                      className={`relative w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group ${errors.backImage ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-50 hover:border-primary hover:bg-blue-50'}`}
                      onClick={() => document.getElementById('backImageInput').click()}
                    >
                      {backPreview ? (
                        <>
                          <img src={backPreview} alt="Back of ID" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">Change Image</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-4xl text-slate-400 mb-2 group-hover:text-primary transition-colors">add_photo_alternate</span>
                          <span className="text-sm font-medium text-slate-500 group-hover:text-primary transition-colors">Upload Back Image</span>
                        </>
                      )}
                      <input id="backImageInput" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'back')} />
                    </div>
                    {errors.backImage && <p className="text-red-500 text-xs mt-2 font-bold text-center">{errors.backImage}</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-8 mt-8 border-t border-slate-100">
                <button 
                  onClick={handleSubmit} 
                  disabled={submitting}
                  className="px-10 py-3 bg-secondary text-white font-black rounded-full hover:bg-secondary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-secondary/20"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Verification
                      <span className="material-symbols-outlined text-sm">send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-12 text-center animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-5xl">check_circle</span>
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-4">Submission Successful!</h2>
              <p className="text-slate-600 mb-8 max-w-md mx-auto">Thank you for submitting your verification details. Our administration team is currently reviewing your application.</p>
              <button 
                onClick={() => navigate('/homepage')}
                className="px-8 py-3 bg-slate-900 text-white font-bold rounded-full hover:bg-slate-800 transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
