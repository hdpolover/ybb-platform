# services/file/tests/conftest.py
"""Make WeasyPrint importable on macOS so the LoA PDF tests actually run.

WeasyPrint loads libgobject/pango through cffi at import time, and asks for them
by their Windows-style names ('gobject-2.0-0'). `ctypes.util.find_library` cannot
resolve those on macOS, and the real dylibs live under Homebrew's prefix, which is
not on dyld's default search path on Apple Silicon. So every test in
TestGenerateLoaSyncSmoke dies at import with:

    OSError: cannot load library 'libgobject-2.0-0'

That is indistinguishable from a broken test. The local baseline was recorded for
some time as "95 passed / 5 failed, all five environmental, do not chase them".
FOUR of them were. The fifth was a real bug in the test - it asserted on
WeasyPrint's image cache rather than on the generator - and nothing could tell
the two apart until the suite was finally run on Linux. Losing five tests to a
loader message is exactly how a real failure hides, so this resolves the
libraries instead of letting them fail.

`DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib` also fixes it, but only from
OUTSIDE the process: dyld reads that variable at process start, so setting it in
here is too late. Preloading the dylibs with ctypes.CDLL does not work either,
because cffi issues a fresh dlopen for a filename that does not exist. The one
seam that works in-process is find_library itself, which is what cffi consults.

No-op on Linux and in CI, where the loader finds these unaided.
"""
import ctypes.util
import glob
import platform

_HOMEBREW_LIB_DIRS = ("/opt/homebrew/lib", "/usr/local/lib")


def _install_macos_library_resolver() -> None:
    if platform.system() != "Darwin":
        return
    if ctypes.util.find_library("gobject-2.0-0"):
        return  # already resolvable (e.g. DYLD_FALLBACK_LIBRARY_PATH is set)

    original = ctypes.util.find_library

    def find_library(name: str):
        found = original(name)
        if found:
            return found
        # 'gobject-2.0-0' -> 'gobject-2.0'. WeasyPrint asks by the Windows-style
        # name; the dylib on disk is libgobject-2.0.0.dylib.
        base = name[:-2] if name.endswith("-0") else name
        for lib_dir in _HOMEBREW_LIB_DIRS:
            matches = sorted(glob.glob(f"{lib_dir}/lib{base}*.dylib"))
            if matches:
                return matches[0]
        return None

    ctypes.util.find_library = find_library


_install_macos_library_resolver()
