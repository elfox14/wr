'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#04110D', fontFamily: 'Cairo, Tahoma, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 480 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 12 }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.8, marginBottom: 24 }}>
            نعتذر عن هذا الخلل التقني. فريقنا يعمل على إصلاحه.
          </p>
          <button
            onClick={() => reset()}
            style={{ background: '#18E58F', color: '#000', border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
          >
            إعادة المحاولة
          </button>
          <div style={{ marginTop: 16 }}>
            <a href="/" style={{ color: '#18E58F', fontSize: 13, textDecoration: 'none', fontWeight: 700 }}>
              العودة للرئيسية
            </a>
          </div>
          {error.digest ? <p style={{ color: '#475569', fontSize: 11, marginTop: 24 }}>رمز الخطأ: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
