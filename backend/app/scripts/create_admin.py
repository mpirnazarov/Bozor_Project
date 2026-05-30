"""Boshlang'ich foydalanuvchilarni yaratish skripti.

Ishlatish:
    # .env dagi INITIAL_* qiymatlardan admin va orikzor userlarini yaratadi
    python -m app.scripts.create_admin

    # Yoki qo'lda:
    python -m app.scripts.create_admin --username admin \
        --password '!@#$Orikzor_2026' --role admin
"""
import argparse
import asyncio

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.user import UserRole
from app.services.auth_service import create_user, get_user_by_username


async def _ensure_user(username: str, password: str, role: str) -> None:
    """Foydalanuvchi yo'q bo'lsa yaratadi, bor bo'lsa o'tkazib yuboradi."""
    if not username or not password:
        label = username or "(bo'sh)"
        print(f"⏭  '{label}' — username/parol bo'sh, o'tkazildi")
        return

    async with AsyncSessionLocal() as db:
        existing = await get_user_by_username(db, username)
        if existing is not None:
            print(f"⏭  '{username}' allaqachon mavjud, o'tkazildi")
            return
        user = await create_user(db, username, password, role=role)
        print(f"✅ Yaratildi: {user.username} (role={user.role}, id={user.id})")


async def _run(args: argparse.Namespace) -> None:
    if args.username:
        # Qo'lda berilgan bitta foydalanuvchi
        await _ensure_user(args.username, args.password, args.role)
        return

    # Aks holda .env dagi boshlang'ich foydalanuvchilar
    await _ensure_user(
        settings.INITIAL_ADMIN_USERNAME,
        settings.INITIAL_ADMIN_PASSWORD,
        UserRole.ADMIN.value,
    )
    await _ensure_user(
        settings.INITIAL_USER_USERNAME,
        settings.INITIAL_USER_PASSWORD,
        UserRole.USER.value,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Boshlang'ich foydalanuvchi yaratish")
    parser.add_argument("--username", help="Username (bo'lmasa .env dan o'qiladi)")
    parser.add_argument("--password", help="Parol")
    parser.add_argument(
        "--role",
        default=UserRole.USER.value,
        choices=[UserRole.USER.value, UserRole.ADMIN.value],
        help="Rol (default: user)",
    )
    args = parser.parse_args()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
