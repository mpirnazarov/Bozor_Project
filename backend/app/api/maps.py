"""Xaritalar (map layers) endpointlari — /api/maps.

Har bozorda bir nechta xarita (qavat). Admin xarita yaratadi, rasm yuklaydi.
Rasm DB'da base64 saqlanadi (Railway FS ephemeral bo'lgani uchun).
"""
import base64
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import AdminUser, CurrentMarket, CurrentUser
from app.models.map_layer import MapLayer
from app.models.pavilion import Pavilion

router = APIRouter()

MAX_IMAGE_BYTES = 50 * 1024 * 1024  # 50 MB — xarita rasmlari katta bo'lishi mumkin


class MapLayerOut(BaseModel):
    id: int
    market_id: int
    name: str
    view_w: int
    view_h: int
    display_order: int
    is_active: bool
    has_image: bool


class MapLayerCreate(BaseModel):
    name: str
    view_w: int | None = None
    view_h: int | None = None


class MapLayerUpdate(BaseModel):
    name: str | None = None
    view_w: int | None = None
    view_h: int | None = None
    display_order: int | None = None
    is_active: bool | None = None


def _to_out(m: MapLayer) -> MapLayerOut:
    return MapLayerOut(
        id=m.id, market_id=m.market_id, name=m.name,
        view_w=m.view_w, view_h=m.view_h, display_order=m.display_order,
        is_active=m.is_active, has_image=bool(m.image_data),
    )


@router.get("/legacy-map")
async def get_legacy_map(
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Eski /map.jpg URL uchun — shu bozorning birinchi faol layer rasmini qaytaradi."""
    from fastapi.responses import Response as FastAPIResponse
    result = await db.execute(
        select(MapLayer)
        .where(MapLayer.market_id == market.id, MapLayer.image_data.isnot(None))
        .order_by(MapLayer.display_order)
        .limit(1)
    )
    layer = result.scalar_one_or_none()
    if layer is None or not layer.image_data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Xarita topilmadi")
    raw = base64.b64decode(layer.image_data)
    return FastAPIResponse(content=raw, media_type="image/jpeg")


@router.get("", response_model=list[MapLayerOut])
async def list_map_layers(
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MapLayerOut]:
    """Joriy bozorning barcha xaritalari (tartib bo'yicha).

    Agar bozorda hali xarita bo'lmasa — mavjud (eski) `map.jpg` ni
    "1-etaj" sifatida avtomatik birinchi xarita qilib yaratadi. Shunda
    foydalanuvchi darrov region chiza oladi va keyin yangi xarita
    qo'shishi mumkin.
    """
    rows = await db.execute(
        select(MapLayer)
        .where(MapLayer.market_id == market.id, MapLayer.is_active == True)  # noqa: E712
        .order_by(MapLayer.display_order, MapLayer.id)
    )
    layers = list(rows.scalars())

    if not layers:
        # Yangi bozor — xarita yo'q, bo'sh list qaytaramiz.
        # Frontend "Xarita hali yuklanmagan" xabarini ko'rsatadi.
        # O'rikzor uchun eski /map.jpg ga fallback frontend tomonida ham o'chirilgan.
        return []
    else:
        # Migratsiya: agar xaritaga biriktirilmagan eski regionlar bo'lsa,
        # ularni BIRINCHI xaritaga (1-etaj) bog'laymiz. Bu, default 1-etaj
        # avval yaratilib, regionlar NULL qolgan holatni tuzatadi.
        orphan = await db.scalar(
            select(Pavilion.id).where(
                Pavilion.market_id == market.id,
                Pavilion.map_layer_id.is_(None),
            ).limit(1)
        )
        if orphan is not None:
            first_layer = layers[0]
            await db.execute(
                update(Pavilion)
                .where(
                    Pavilion.market_id == market.id,
                    Pavilion.map_layer_id.is_(None),
                )
                .values(map_layer_id=first_layer.id)
            )
            await db.commit()

    # O'rikzor uchun: image_data=None layer (map.jpg, 1-etaj) ni har doim birinchiga
    # DB da display_order noto'g'ri bo'lishi mumkin — backend da ham sort qilamiz
    if market.slug == "orikzor":
        layers.sort(key=lambda m: (0 if m.image_data is None else 1, m.display_order))
    return [_to_out(m) for m in layers]


@router.get("/{layer_id}/image")
async def get_map_image(
    layer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Xarita rasmini qaytaradi (public — autentifikatsiyasiz, faqat o'qish)."""
    layer = await db.get(MapLayer, layer_id)
    if layer is None or not layer.image_data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rasm topilmadi")
    try:
        raw = base64.b64decode(layer.image_data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Rasm buzilgan") from e
    return Response(content=raw, media_type=layer.image_mime or "image/jpeg",
                    headers={"Cache-Control": "no-cache"})


@router.post("", response_model=MapLayerOut, status_code=status.HTTP_201_CREATED)
async def create_map_layer(
    _admin: AdminUser,
    market: CurrentMarket,
    body: MapLayerCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MapLayerOut:
    """Yangi xarita (qavat) qo'shadi."""
    # Tartib raqami: oxirgi + 1
    count = await db.scalar(
        select(MapLayer).where(MapLayer.market_id == market.id).order_by(MapLayer.display_order.desc())
    )
    order = (count.display_order + 1) if count else 0
    layer = MapLayer(
        market_id=market.id, name=body.name.strip() or "Yangi xarita",
        view_w=body.view_w or 1568, view_h=body.view_h or 1109,
        display_order=order,
    )
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    return _to_out(layer)


@router.put("/{layer_id}", response_model=MapLayerOut)
async def update_map_layer(
    layer_id: int,
    _admin: AdminUser,
    market: CurrentMarket,
    body: MapLayerUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MapLayerOut:
    layer = await db.get(MapLayer, layer_id)
    if layer is None or layer.market_id != market.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Xarita topilmadi")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(layer, k, v)
    await db.commit()
    await db.refresh(layer)
    return _to_out(layer)


@router.post("/{layer_id}/image", response_model=MapLayerOut)
async def upload_map_image(
    layer_id: int,
    _admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> MapLayerOut:
    """Xarita rasmini yuklaydi (jpg/png yoki PDF — PDF birinchi sahifasi rasmga aylantiriladi)."""
    layer = await db.get(MapLayer, layer_id)
    if layer is None or layer.market_id != market.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Xarita topilmadi")

    ctype = (file.content_type or "").lower()
    is_pdf = ctype == "application/pdf" or (file.filename or "").lower().endswith(".pdf")
    is_image = ctype.startswith("image/")
    if not (is_image or is_pdf):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat rasm (jpg/png) yoki PDF fayl")

    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (50 MB chegarasi)")

    if is_pdf:
        # PDF birinchi sahifasini yuqori sifatли PNG ga aylantiramiz.
        try:
            import fitz  # PyMuPDF
        except ImportError:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "PDF qo'llab-quvvatlanmaydi. Iltimos PDF ni rasmga (PNG/JPG) aylantirib yuklang.",
            )
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            if doc.page_count == 0:
                raise ValueError("bo'sh PDF")
            page = doc[0]
            # Sifat va hajm balansi: 2x dan boshlab, katta bo'lsa kichraytiramiz
            png_bytes = b""
            pix = None
            for zoom in (2.0, 1.5, 1.0):
                pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
                png_bytes = pix.tobytes("png")
                if len(png_bytes) <= MAX_IMAGE_BYTES:
                    break
            doc.close()
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "PDF o'qib bo'lmadi") from e
        if not png_bytes or len(png_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "PDF dan chiqgan rasm juda katta — kichikroq/oddiyroq PDF yuklang",
            )
        layer.image_data = base64.b64encode(png_bytes).decode("ascii")
        layer.image_mime = "image/png"
        # Eslatma: view_w/view_h o'zgartirilmaydi — rasm standart maydon (1568x1109)
        # ga moslab cho'ziladi, xuddi oddiy rasm yuklanganidek. Shunda regionlar
        # koordinatasi barcha xaritalarda bir xil ishlaydi.
    else:
        layer.image_data = base64.b64encode(content).decode("ascii")
        layer.image_mime = ctype or "image/jpeg"

    await db.commit()
    await db.refresh(layer)
    return _to_out(layer)


@router.delete("/{layer_id}")
async def delete_map_layer(
    layer_id: int,
    _admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    layer = await db.get(MapLayer, layer_id)
    if layer is None or layer.market_id != market.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Xarita topilmadi")
    await db.delete(layer)  # pavilionlar CASCADE bilan o'chadi
    await db.commit()
    return {"ok": True}
