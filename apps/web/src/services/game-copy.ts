const knownErrors:Array<[RegExp,string]>=[
  [/WebSocket connection is not open/i,'انقطع الاتصال مؤقتاً. انتظر لحظة ثم حاول مجدداً.'],
  [/already submitted|already.*answer/i,'تم تسجيل إجابتك مسبقاً لهذا السؤال.'],
  [/outside.*deadline|outside.*question|Current phase/i,'انتهى وقت الإجابة على هذا السؤال.'],
  [/duplicate submission/i,'إجابتك مسجلة بالفعل.'],
  [/maximum length|exceeds/i,'الإجابة طويلة جداً. اختصرها إلى 200 حرف أو أقل.']
];

export function friendlyGameError(message:string):string {
  return knownErrors.find(([pattern])=>pattern.test(message))?.[1] || 'لم نتمكن من تسجيل إجابتك. تحقق من اتصالك وحاول مجدداً.';
}
