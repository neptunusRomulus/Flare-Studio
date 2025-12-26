const fs = require('fs');
const p = 'src/App.tsx';
const s = fs.readFileSync(p,'utf8').split(/\r?\n/);
let depth=0, min=1e9, minLine=0;
for(let i=0;i<s.length;i++){
  const line=s[i];
  for(const ch of line){
    if(ch==='{') depth++;
    else if(ch==='}') depth--;
  }
  if(depth<min){min=depth; minLine=i+1}
}
console.log('Final depth',depth);
console.log('Min depth',min,'at line',minLine);
const start=Math.max(1,minLine-5), end=Math.min(s.length, minLine+5);
console.log('--- context ---');
for(let i=start;i<=end;i++) console.log(i, s[i-1]);
