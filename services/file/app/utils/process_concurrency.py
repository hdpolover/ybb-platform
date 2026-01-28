import asyncio
import functools
from concurrent.futures import ProcessPoolExecutor
from typing import Any, Callable, TypeVar, Optional

T = TypeVar("T")

_process_pool: Optional[ProcessPoolExecutor] = None

def get_process_pool() -> ProcessPoolExecutor:
    global _process_pool
    if _process_pool is None:
        # Limit workers to avoid consuming all memory with heavy PDF generation
        _process_pool = ProcessPoolExecutor(max_workers=4)
    return _process_pool

def shutdown_process_pool():
    global _process_pool
    if _process_pool:
        _process_pool.shutdown()

async def run_in_processpool(func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """
    Run a synchronous function in a separate process to avoid blocking the GIL.
    Ideal for CPU-intensive tasks like PDF or Image generation.
    """
    loop = asyncio.get_running_loop()
    pool = get_process_pool()
    func_call = functools.partial(func, *args, **kwargs)
    return await loop.run_in_executor(pool, func_call)
