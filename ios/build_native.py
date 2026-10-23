#!/usr/bin/env python3
"""Build arm64 iOS executable against public system-framework ABI stubs.
Stubs contain symbol names only; implementation comes from iOS at runtime.
Requires: pip install ziglang==0.13.0 (no Apple SDK binary redistribution).
"""
from pathlib import Path
from test_abi import check as check_ivar_abi
import subprocess,struct,json,sys,os,shutil
root=Path(__file__).resolve().parent
build=root/'build'; build.mkdir(exist_ok=True)
cc=[sys.executable,'-m','ziglang','cc','-target','aarch64-ios.15.0']
subprocess.run(cc+['-Oz','-fobjc-arc','-fblocks','-fno-stack-protector','-fno-builtin','-Wall','-Wno-unused-parameter','-c',str(root/'native/main.m'),'-o',str(build/'main.o')],check=True)
b=(build/'main.o').read_bytes()
check_ivar_abi(b)
pos=32; symtab=None
for i in range(struct.unpack_from('<I',b,16)[0]):
    cmd,size=struct.unpack_from('<II',b,pos)
    if cmd==2: symtab=struct.unpack_from('<IIII',b,pos+8)
    pos+=size
so,n,st,ss=symtab
symbols=[]
for i in range(n):
    idx,typ,sect,desc,value=struct.unpack_from('<IBBHQ',b,so+16*i)
    if typ & 0x0e==0 and idx:
        symbols.append(b[st+idx:b.index(b'\0',st+idx)].decode())
groups={'System':['dyld_stub_binder']}
for sym in symbols:
    if sym.startswith('_objc_') or sym.startswith('__objc_'): lib='objc'
    elif sym.startswith('__NSConcrete') or sym in ['_CC_MD5','_CCCrypt'] or sym in ['_memcpy','_memset','___stack_chk_fail','___stack_chk_guard']: lib='System'
    elif sym.startswith('_Sec') or sym.startswith('_kSec'): lib='Security'
    elif sym.startswith('_CG'): lib='CoreGraphics'
    elif sym.startswith('_CF') or sym=='___CFConstantStringClassReference': lib='CoreFoundation'
    elif sym.startswith('_UI'): lib='UIKit'
    elif '_$_' in sym:
        cls=sym.split('_$_')[1]
        lib='UIKit' if cls.startswith('UI') else 'WebKit' if cls.startswith('WK') else 'CoreImage' if cls.startswith('CI') else 'Foundation'
    elif sym in ['_NSStringFromClass','___NSDictionary0__','___NSArray0__']: lib='Foundation'
    else: raise SystemExit('Unmapped symbol '+sym)
    groups.setdefault(lib,[]).append(sym)
stubs=build/'stubs';stubs.mkdir(exist_ok=True)
paths=[]
for lib,syms in groups.items():
    install='/usr/lib/libSystem.B.dylib' if lib=='System' else '/usr/lib/libobjc.A.dylib' if lib=='objc' else f'/System/Library/Frameworks/{lib}.framework/{lib}'
    p=stubs/('libSystem.tbd' if lib=='System' else lib+'.tbd')
    p.write_text('--- !tapi-tbd\ntbd-version: 4\ntargets: [ arm64-ios ]\ninstall-name: '+json.dumps(install)+'\ncurrent-version: 1.0.0\ncompatibility-version: 1.0.0\nexports:\n  - targets: [ arm64-ios ]\n    symbols: '+json.dumps(syms)+'\n...\n')
    paths.append(str(p))
linker=os.environ.get('MSQ_LD64') or shutil.which('ld64.lld')
if not linker:
    local=root.parent/'toolchain/root/usr/lib/llvm-18/bin/ld64.lld'
    if local.exists(): linker=str(local)
if not linker: raise SystemExit('Install LLVM ld64.lld or set MSQ_LD64')
env=os.environ.copy()
local_lib=root.parent/'toolchain/llvm-full/usr/lib/x86_64-linux-gnu'
if local_lib.exists(): env['LD_LIBRARY_PATH']=str(local_lib)+':'+env.get('LD_LIBRARY_PATH','')
subprocess.run([linker,'-arch','arm64','-platform_version','ios','15.0','18.0','-e','_main','-dead_strip','-adhoc_codesign',str(build/'main.o'),*paths,'-o',str(build/'Mashangqu')],env=env,check=True)
print(build/'Mashangqu')
