"""Prisma Client instance."""
from prisma import Prisma

# Global Prisma instance
db = Prisma()


async def connect_db():
    """Connect to the database."""
    if not db.is_connected():
        await db.connect()


async def disconnect_db():
    """Disconnect from the database."""
    if db.is_connected():
        await db.disconnect()
