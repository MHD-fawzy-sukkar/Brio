'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="ar" dir="rtl"><body style={{margin:0,fontFamily:'Cairo,Tahoma,Arial,sans-serif',background:'#f7f8fc',color:'#172033'}}><main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}><section style={{maxWidth:520,textAlign:'center',background:'#fff',border:'1px solid #e6e9f0',borderRadius:24,padding:40}}><div style={{fontSize:48}}>🛟</div><h1>حدث خطأ غير متوقع</h1><p style={{color:'#68748a'}}>يمكنك إعادة تشغيل الواجهة بأمان. إذا انتهت جلستك فسيتم تحويلك إلى تسجيل الدخول.</p><button onClick={reset} style={{border:0,borderRadius:14,background:'#6547e8',color:'#fff',padding:'12px 20px',fontWeight:800,cursor:'pointer'}}>إعادة المحاولة</button></section></main></body></html>;
}
