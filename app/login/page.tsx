'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await signIn('credentials', { redirect: false, email, password });
    if (res?.error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    } else {
      router.push('/');
      router.refresh();
    }
  };

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <div className="bg-[#1A1A1A] border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">تسجيل الدخول</h1>
          <p className="text-gray-400">مرحباً بك في MC PRIME World Cup</p>
        </div>
        {error && <div className="bg-red-500/20 text-red-500 border border-red-500/50 p-3 rounded-lg mb-6 text-center text-sm">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">البريد الإلكتروني</label>
            <input type="email" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">كلمة المرور</label>
            <input type="password" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="text-left mt-2"><Link href="/forgot-password" className="text-[#0FF0FC] text-sm hover:underline">نسيت كلمة المرور؟</Link></div>
          <button type="submit" className="w-full bg-[#0FF0FC] text-black font-bold py-3 rounded-lg hover:bg-[#0FF0FC]/80 transition-colors mt-4">دخول</button>
        </form>
        <div className="my-6 flex items-center gap-4"><div className="flex-1 h-px bg-white/10" /><span className="text-gray-500 text-sm">أو</span><div className="flex-1 h-px bg-white/10" /></div>
        <button onClick={handleGoogleLogin} className="w-full bg-white text-black font-bold py-3 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors">
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          المتابعة باستخدام Google
        </button>
        <p className="text-gray-500 text-center mt-6 text-sm">ليس لديك حساب؟ <Link href="/register" className="text-[#0FF0FC] hover:underline">إنشاء حساب جديد</Link></p>
      </div>
    </div>
  );
}
