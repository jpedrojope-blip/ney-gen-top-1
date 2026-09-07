from pathlib import Path
from html.parser import HTMLParser
import shutil
import re

root = Path(__file__).resolve().parent
class Check(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.stack = []
        self.projects = 0
    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, 'Duplicate ID: ' + attrs['id']
            self.ids.add(attrs['id'])
        if tag not in ('meta','link','img','source','br','hr','input','stop','path','ellipse','circle','rect'):
            self.stack.append(tag)
        if attrs.get('class') == 'project-card': self.projects += 1
        for key in ('src','href','poster'):
            value = attrs.get(key, '')
            if value.startswith('#'): self.links.append(value[1:])
            elif value and not re.match(r'\w+:', value):
                assert (root/value).is_file(), 'Missing file: ' + value
    def handle_endtag(self, tag):
        if tag in ('meta','link','img','source','br','hr','input','path','ellipse','circle','rect','stop'): return
        assert self.stack and self.stack[-1] == tag, f'Unbalanced {tag}: {self.stack[-3:]}'
        self.stack.pop()

check = Check()
check.feed((root/'index.html').read_text(encoding='utf-8'))
assert not check.stack, check.stack
assert all(link in check.ids for link in check.links)
assert check.projects == 6, check.projects
out = root/'dist'
out.mkdir(exist_ok=True)
for name in ('index.html','premium.css','cinematic.css','navigation.js','section-motion.js','video-motion.js','hero3d.mjs'):
    shutil.copy2(root/name, out/name)
shutil.copytree(root/'assets', out/'assets', dirs_exist_ok=True)
print('HTML structure, six projects, local assets and anchor links passed. Static build ready.')
