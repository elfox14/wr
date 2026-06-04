'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'حدث خطأ');
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <div className="bg-[#1A1A1A] border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">استعادة كلمة المرور</h1>
          <p className="text-gray-400">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور</p>
        </div>

        {error && <div className="bg-red-500/20 text-red-500 border border-red-500/50 p-3 rounded-lg mb-6 text-center text-sm">{error}</div>}
        {message && <div className="bg-green-500/20 text-green-500 border border-green-500/50 p-3 rounded-lg mb-6 text-center text-sm">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">البريد الإلكتروني</label>
            <input 
              type="email" 
              required 
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>

          <button disabled={loading} type="submit" className="w-full bg-[#0FF0FC] text-black font-bold py-3 rounded-lg hover:bg-[#0FF0FC]/80 transition-colors mt-6 disabled:opacity-50">
            {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
          </button>
        </form>

        <p className="text-gray-500 text-center mt-6 text-sm">
          تذكرت كلمة المرور؟ <Link href="/login" className="text-[#0FF0FC] hover:underline">العودة لتسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
