#!/usr/bin/env python3
"""Regression guard for the real-device startup crash in build 1.
Read compiled ivar offsets, not source spelling: no own property may overlap isa.
"""
from pathlib import Path
import struct,sys,zipfile

def check(data):
    assert struct.unpack_from('<I',data)[0]==0xfeedfacf,'Expected 64-bit Mach-O'
    sections=[];symtab=None;pos=32
    for _ in range(struct.unpack_from('<I',data,16)[0]):
        cmd,size=struct.unpack_from('<II',data,pos)
        if cmd==0x19:
            nsects=struct.unpack_from('<I',data,pos+64)[0]
            for j in range(nsects):
                s=pos+72+j*80
                addr,length,fileoff=struct.unpack_from('<QQI',data,s+32)
                sections.append((addr,length,fileoff))
        if cmd==2:symtab=struct.unpack_from('<IIII',data,pos+8)
        pos+=size
    assert symtab is not None,'Missing symbol table'
    so,n,st,ss=symtab;offsets={}
    for i in range(n):
        idx,typ,sect,desc,value=struct.unpack_from('<IBBHQ',data,so+16*i)
        if not idx or not sect or typ&0x0e!=0x0e:continue
        name=data[st+idx:data.index(b'\0',st+idx)].decode()
        if not name.startswith('_OBJC_IVAR_$_MSQ'):continue
        addr,length,off=sections[sect-1]
        assert addr<=value<addr+length
        offset=struct.unpack_from('<i',data,off+value-addr)[0]
        assert offset>=8,f'{name}: offset {offset} overlaps the Objective-C isa header'
        assert offset%8==0,f'{name}: misaligned pointer offset {offset}'
        offsets[name]=offset
    assert offsets.get('_OBJC_IVAR_$_MSQDelegate._window')==8,'Delegate window offset must be 8'
    assert len(offsets)==10,'Missing expected controller property offsets'
    return offsets

if __name__=='__main__':
    path=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent/'build/main.o'
    if path.suffix=='.ipa':
        with zipfile.ZipFile(path) as z:data=z.read('Payload/Mashangqu.app/Mashangqu')
    else:data=path.read_bytes()
    print(check(data))
