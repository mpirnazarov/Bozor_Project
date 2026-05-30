-- Initial schema va extension'lar
-- Bu fayl PostgreSQL birinchi marta ishga tushganda avtomatik ishlaydi

-- Trigram qidirish uchun (INN/nom bo'yicha fuzzy search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Aniqlash uchun foydali qidiruv
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Alembic migration'lar boshqaradi qolgan jadvallarni
