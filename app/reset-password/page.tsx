'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      setError('الرابط غير صالح أو مفقود');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      return setError('كلمات المرور غير متطابقة');
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'حدث خطأ');
      } else {
        setMessage('تم إعادة تعيين كلمة المرور بنجاح. جاري تحويلك...');
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="bg-[#1A1A1A] p-8 rounded-2xl text-center text-white">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/login" className="text-[#0FF0FC] underline">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <div className="bg-[#1A1A1A] border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إعادة تعيين كلمة المرور</h1>
          <p className="text-gray-400">أدخل كلمة المرور الجديدة الخاصة بك</p>
        </div>

        {error && <div className="bg-red-500/20 text-red-500 border border-red-500/50 p-3 rounded-lg mb-6 text-center text-sm">{error}</div>}
        {message && <div className="bg-green-500/20 text-green-500 border border-green-500/50 p-3 rounded-lg mb-6 text-center text-sm">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">كلمة المرور الجديدة</label>
            <input 
              type="password" 
              required 
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">تأكيد كلمة المرور</label>
            <input 
              type="password" 
              required 
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
            />
          </div>

          <button disabled={loading || !!message} type="submit" className="w-full bg-[#0FF0FC] text-black font-bold py-3 rounded-lg hover:bg-[#0FF0FC]/80 transition-colors mt-6 disabled:opacity-50">
            {loading ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#121212] flex items-center justify-center p-4"><p className="text-white">جاري التحميل...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
