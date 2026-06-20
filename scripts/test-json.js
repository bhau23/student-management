const str1 = '{"key":"a\\nb"}';
try {
  console.log('Parse 1:', JSON.parse(str1));
} catch(e) { console.log('Err 1:', e.message); }

const str2 = '{"key":"a\\\\nb"}';
try {
  console.log('Parse 2:', JSON.parse(str2));
} catch(e) { console.log('Err 2:', e.message); }
