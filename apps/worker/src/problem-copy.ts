const exact:Record<string,string>={
  'Authentication required':'يرجى تسجيل الدخول للمتابعة.',
  'Host authentication required':'انتهت جلسة المضيف. سجّل الدخول مجدداً.',
  'Invalid JSON body':'تعذر قراءة البيانات المرسلة. حدّث الصفحة وحاول مجدداً.',
  'Invalid JSON payload':'البيانات المرسلة غير صالحة. راجع الحقول وحاول مجدداً.',
  'Cross-origin mutation denied':'تعذر تنفيذ الطلب من هذا المصدر.',
  'Route not found':'الصفحة أو الخدمة المطلوبة غير موجودة.',
  'Quiz not found or unauthorized':'المسابقة غير موجودة أو لا تملك صلاحية تعديلها.',
  'Question not found in this quiz':'السؤال غير موجود ضمن هذه المسابقة.',
  'Question not found or unauthorized':'السؤال غير موجود أو لا تملك صلاحية تعديله.',
  'Quiz must be published before creating a room':'انشر المسابقة أولاً قبل إنشاء غرفة اللعب.',
  'Cannot publish an empty quiz with 0 questions':'أضف سؤالاً واحداً على الأقل قبل نشر المسابقة.',
  'Room not found or code expired':'الغرفة غير موجودة أو انتهت صلاحية الرمز.',
  'Game not found or no longer accepting players':'اللعبة غير موجودة أو أُغلق باب الانضمام.',
  'Room state snapshot unavailable':'تعذر تحميل حالة الغرفة الآن. حاول مجدداً بعد لحظة.'
};

export function localizeProblemDetail(detail:string):string {
  if(exact[detail])return exact[detail];
  if(/duration must be between/i.test(detail))return 'اختر وقتاً للسؤال بين 10 و120 ثانية.';
  if(/at least 2 options/i.test(detail))return 'أضف خيارين على الأقل لهذا السؤال.';
  if(/exactly 1 correct/i.test(detail))return 'حدّد إجابة صحيحة واحدة فقط.';
  if(/must not have any correct/i.test(detail))return 'أسئلة الاستطلاع لا تحتوي على إجابة صحيحة.';
  if(/accepted alternative/i.test(detail))return 'أضف إجابة مقبولة واحدة على الأقل.';
  if(/capacity reached|quota exceeded/i.test(detail))return 'وصلت المنصة إلى الحد المؤقت للغرف النشطة. أنهِ الغرفة الحالية ثم حاول مجدداً.';
  return detail;
}
