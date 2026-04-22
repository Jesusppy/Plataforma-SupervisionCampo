# Plataforma de Supervisión de Campo

Aplicación full-stack para técnicos de campo que necesitan capturar evidencia multimodal, convertirla en contexto utilizable y producir informes exportables sin romper su flujo operativo diario.

La plataforma resuelve un problema concreto: un mismo técnico puede visitar obra, monte, parcela o infraestructura con un único flujo de captura, mientras la salida final cambia según el cliente, la plantilla y la evidencia disponible.

## Qué demuestra este proyecto

- Frontend en Next.js 15 con middleware para proteger rutas sensibles, sesión por JWT y cliente API con manejo centralizado de `401`.
- Backend FastAPI asíncrono con SQLAlchemy 2, MinIO compatible con S3, Alembic y servicios desacoplados para IA y exportación.
- Flujo multimodal completo: registro, subida de evidencia, generación del borrador con Gemini y exportación en HTML o PDF.
- Exportador que puede incrustar fotografías de visita dentro de las secciones de la plantilla y mantenerlas proporcionales en el PDF final.

## Arquitectura de alto nivel

```text
Next.js 15 UI + Middleware
	|
	v
FastAPI REST API
	|
	+--> PostgreSQL (proyectos, visitas, plantillas, reportes)
	|
	+--> MinIO / S3 (fotos, PDFs, audios, exportaciones)
	|
	+--> Gemini Pro/Flash (análisis multimodal y transcripción)
```

## Arquitectura multimodal

La decisión central es usar Gemini Pro/Flash como motor único multimodal en lugar de dividir la solución en microservicios de OCR, transcripción y visión por separado.

### Por qué Gemini 1.5 Pro/Flash como estrategia de arquitectura

- Permite tratar fotos, PDFs, audios y texto bajo un mismo contrato de inferencia.
- Reduce latencia arquitectónica y complejidad operativa al evitar orquestar OCR, Whisper y clasificadores visuales distintos.
- Simplifica el prompting: la plantilla, las notas de visita y los assets firmados llegan al mismo modelo, con menos puntos de fallo y menos transformación intermedia.
- Mejora trazabilidad funcional: cuando un borrador sale mal, la investigación se concentra en un pipeline y no en una cadena de servicios heterogéneos.

La implementación actual está desacoplada por configuración y hoy puede apuntar a la familia Gemini definida en `.env`. La decisión de producto sigue siendo la misma: una sola capa multimodal con perfiles Pro/Flash según costo, latencia y profundidad analítica.

## Diseño de datos y seguridad con MinIO

El backend no entrega archivos privados de MinIO a la IA como contenido embebido permanente. En su lugar, genera URLs firmadas temporales para cada adjunto relevante.

Esto aporta tres ventajas:

- Minimiza exposición: la IA solo puede leer el objeto durante la ventana temporal necesaria para generar el informe.
- Evita duplicación de binarios en base de datos o payloads gigantes en memoria.
- Mantiene el almacenamiento desacoplado del proveedor: hoy corre sobre MinIO, pero el contrato sigue siendo S3-compatible.

En términos de arquitectura, MinIO opera como la capa segura de evidencia; la base de datos guarda metadatos, no blobs pesados.

## Decisiones de negocio

La pieza de mayor impacto funcional no es solo la IA, sino el uso de plantillas configurables.

- Un técnico forestal puede registrar exactamente la misma visita para un Ayuntamiento o para una Consejería.
- Lo que cambia no es la captura en campo, sino la estructura final del informe, el tono, las secciones exigidas y el tipo de evidencia destacada.
- Eso reduce retrabajo, evita duplicar procesos operativos por cliente y mantiene a la plantilla como un activo reusable del negocio.

En otras palabras: la visita es estable; la entrega se adapta.

## Componentes principales

### Frontend

- `frontend/middleware.ts`: protege `/projects`, `/visits` y `/reports` usando el JWT disponible en cookie.
- `frontend/lib/api-client.ts`: añade `Authorization: Bearer ...` y limpia sesión cuando el backend devuelve `401`.
- `frontend/app/(auth)/login/page.tsx`: login/registro con sesión persistida en cookie para que middleware y cliente compartan contexto.
- `frontend/app/reports/[reportId]/page.tsx`: vista de detalle con botones de exportación HTML/PDF y descarga segura por Blob.

### Backend

- `backend/app/routers/visits.py`: subida de adjuntos a MinIO y registro del metadata en PostgreSQL.
- `backend/app/services/storage_service.py`: abstracción S3-compatible para bucket, upload y URLs firmadas.
- `backend/app/services/gemini_service.py`: composición del prompt multimodal y envío a Gemini.
- `backend/app/services/export_service.py`: render HTML/PDF con inserción proporcional de fotos cuando la plantilla declara secciones visuales.

### Verificación automática

- `backend/scripts/verify_pipeline.py`: happy path integral con logs por fase, emojis y validación real del PDF exportado.

## Flujo operativo

1. El usuario se autentica y obtiene un JWT.
2. Crea un proyecto y una visita con notas de campo.
3. Sube fotos, PDFs o audios a MinIO.
4. La API genera URLs firmadas para que Gemini lea únicamente la evidencia necesaria.
5. La plantilla define estructura, tono y secciones obligatorias.
6. Gemini devuelve un borrador en Markdown.
7. El exportador genera HTML o PDF, incorporando la fotografía de la visita en la sección correcta cuando la plantilla lo exige.

## Inicio rápido

### 1. Levantar infraestructura

Desde la raíz del repositorio:

```bash
docker compose up -d
```

Servicios esperados:

- PostgreSQL en `localhost:5432`
- MinIO API en `http://localhost:9000`
- Consola de MinIO en `http://localhost:9001`

Buckets inicializados automáticamente:

- `field-attachments`
- `report-exports`

### 2. Configurar backend

Ejemplo en PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install fastapi uvicorn sqlalchemy asyncpg alembic pydantic pydantic-settings aioboto3 boto3 httpx markdown xhtml2pdf passlib[bcrypt] python-multipart python-dotenv email-validator
```

Crea `backend/.env` con una configuración similar a esta:

```env
APP_NAME=Plataforma de Supervision de Campo API
ENVIRONMENT=local
DEBUG=true
API_V1_PREFIX=/api/v1
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=supervision_user
POSTGRES_PASSWORD=supervision_password
POSTGRES_DB=supervision_campo

MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_SECURE=false
MINIO_REGION=us-east-1
MINIO_ATTACHMENTS_BUCKET=field-attachments
MINIO_REPORTS_BUCKET=report-exports

GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-2.5-pro
GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com

JWT_SECRET_KEY=change-me-in-production-please
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_TTL_MINUTES=1440
```

### 3. Aplicar migraciones

```bash
cd backend
alembic upgrade head
```

### 4. Levantar la API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Swagger quedará disponible en `http://localhost:8000/docs`.

### 5. Ejecutar la verificación integral

Con la API ya levantada y `GEMINI_API_KEY` configurada:

```bash
cd backend
python scripts/verify_pipeline.py
```

El script cubre:

- `register -> login`
- creación de proyecto
- creación de visita
- subida de una imagen PNG real de 100x100 generada en memoria
- creación de plantilla
- generación del borrador con Gemini
- descarga del PDF y validación de tamaño mayor que `0 KB`

## Estructura del repositorio

```text
.
├── backend/
│   ├── alembic/
│   ├── app/
│   │   ├── core/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── services/
│   └── scripts/
├── frontend/
│   ├── app/
│   ├── components/
│   └── lib/
├── docker-compose.yml
└── README.md
```

## Resultado esperado

Si el pipeline está sano, la plataforma es capaz de:

- proteger navegación sensible desde Next.js antes de llegar al backend;
- mantener evidencia privada fuera de la base de datos y exponerla solo mediante URLs firmadas;
- usar un único motor multimodal para transformar evidencia heterogénea en un informe consistente;
- exportar ese informe con su foto correspondiente en PDF o HTML listo para entrega.
