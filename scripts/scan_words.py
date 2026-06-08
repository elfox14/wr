import sys
import codecs

if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

words = ['استثمار', 'أرباح', 'عوائد']
with open('scripts/update_articles.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    for w in words:
        if w in line:
            print(f"Line {i+1}: {w} -> {line.strip()}")
