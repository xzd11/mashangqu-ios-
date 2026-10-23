#!/usr/bin/env python3
from pathlib import Path
import shutil,zipfile,os
from PIL import Image
root=Path(__file__).resolve().parent
app=root/'build/Payload/Mashangqu.app';app.mkdir(parents=True,exist_ok=True)
shutil.copyfile(root/'Info.plist',app/'Info.plist')
shutil.copyfile(root/'build/Mashangqu',app/'Mashangqu');os.chmod(app/'Mashangqu',0o755)
shutil.copytree(root/'web',app/'web',dirs_exist_ok=True)
shutil.copyfile(root/'LICENSE',app/'LICENSE.txt')
icon=Image.open(root/'assets/icon.png').convert('RGB')
for name,size in [('AppIcon60x60@2x',120),('AppIcon60x60@3x',180),('AppIcon76x76',76),('AppIcon76x76@2x',152),('AppIcon83.5x83.5@2x',167)]:
 icon.resize((size,size),Image.Resampling.LANCZOS).save(app/(name+'.png'))
out=root.parent/'deliverables';out.mkdir(exist_ok=True)
ipa=out/'Mashangqu-iOS-1.0.3-self-sign.ipa'
with zipfile.ZipFile(ipa,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((root/'build/Payload').rglob('*')):
  if p.is_file():z.write(p,p.relative_to(root/'build'))
print(ipa)
