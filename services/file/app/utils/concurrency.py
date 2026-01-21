import asyncio
import functools
from typing import Any, Callable, TypeVar

T = TypeVar("T")

async def run_in_threadpool(func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """
    Run a synchronous function in a separate thread to avoid blocking the event loop.
    """
    loop = asyncio.get_running_loop()
    func_call = functools.partial(func, *args, **kwargs)
    return await loop.run_in_executor(None, func_call)
