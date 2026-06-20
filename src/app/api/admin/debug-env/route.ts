import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';
  
  return NextResponse.json({
    hasKey: !!key,
    length: key.length,
    startsWithQuote: key.startsWith("'") || key.startsWith('"'),
    endsWithQuote: key.endsWith("'") || key.endsWith('"'),
    first50: key.substring(0, 50),
    last50: key.substring(key.length - 50),
    typeof: typeof key,
    tryParse: (() => {
      try {
        let raw = key.trim();
        if (raw.startsWith("'") && raw.endsWith("'")) {
          raw = raw.slice(1, -1);
        }
        const obj = JSON.parse(raw);
        return 'Success';
      } catch (e: any) {
        return 'Fail: ' + e.message;
      }
    })()
  });
}
