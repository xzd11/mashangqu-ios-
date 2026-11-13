"""Fail if a build omits its extension or mismatches metadata/resources."""
from pathlib import Path
import plistlib, sys
app = Path(sys.argv[1])
main = plistlib.loads((app / 'Info.plist').read_bytes())
extension = app / 'PlugIns/MashangquWidgets.appex'
widget = plistlib.loads((extension / 'Info.plist').read_bytes())
assert main['NSSupportsLiveActivities'] is True
assert main['CFBundleShortVersionString'] == widget['CFBundleShortVersionString'] == '1.2.1'
assert main['CFBundleVersion'] == widget['CFBundleVersion'] == '15'
assert widget['CFBundleIdentifier'].startswith(main['CFBundleIdentifier'] + '.')
assert main['MSQAppGroup'] == widget['MSQAppGroup']
assert '$(' not in main['MSQAppGroup']
assert widget['NSExtension']['NSExtensionPointIdentifier'] == 'com.apple.widgetkit-extension'
for bundle, info in [(app, main), (extension, widget)]:
    binary = (bundle / info['CFBundleExecutable']).read_bytes()
    assert binary[:4] in (b'\xcf\xfa\xed\xfe', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca'), 'Expected device Mach-O'
root = Path(__file__).resolve().parent
for f in (root / 'web').iterdir():
    if f.is_file(): assert (app / 'web' / f.name).read_bytes() == f.read_bytes(), f.name
assert (app/'web/widgets.js').is_file()
print('Validated app, embedded Widget extension, versions, shared group, and web resources')
