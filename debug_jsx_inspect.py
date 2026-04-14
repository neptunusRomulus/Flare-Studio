from pathlib import Path
import re

path = Path('src/components/EventDialog.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
start = 1000
end = 1045
for i in range(start, end):
    print(f'{i+1:4}: {lines[i]}
')

block = '\n'.join(lines[start:end])
opens = len(re.findall(r'<div[^>/]*?>', block))
closes = len(re.findall(r'</div>', block))
print('opens', opens, 'closes', closes)
