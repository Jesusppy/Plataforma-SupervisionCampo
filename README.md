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

## Instalación

### Docker local paso a paso

1. Crea el archivo de entorno raíz a partir del ejemplo.

```bash
cp .env.example .env
```

En PowerShell también puedes usar:

```powershell
Copy-Item .env.example .env
```

2. Revisa y cambia como mínimo estos valores antes de compartir el entorno:

- `POSTGRES_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `MINIO_SECRET_KEY`
- `JWT_SECRET_KEY`
- `GEMINI_API_KEY` si vas a usar Gemini real

3. Crea también la configuración del backend a partir del ejemplo.

```bash
cp backend/.env.example backend/.env
```

En PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

4. En `backend/.env`, configura la integración de IA según tu caso.

Para Gemini real en desarrollo local:

```dotenv
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
USE_MOCK_LLM=false
```

Para validar el flujo sin consumir cuota:

```dotenv
USE_MOCK_LLM=true
```

Notas importantes:

- Cada desarrollador debe usar su propia `GEMINI_API_KEY` en `backend/.env`.
- La cuota depende del proyecto asociado a esa key, no solo del correo con el que se creó.
- `gemini-2.5-flash` es el modelo recomendado para esta prueba técnica.
- Si cambias `backend/.env`, debes recrear el servicio backend para que Docker relea la configuración.

5. Levanta toda la plataforma desde la raíz del repositorio.

```bash
docker compose up --build
```

Si ya estaba levantada y solo cambiaste `backend/.env`:

```bash
docker compose up -d --force-recreate backend
```

6. Ejecuta el seed idempotente cuando el backend esté sano.

```bash
docker compose exec backend python scripts/seed_data.py
```

7. Abre los servicios.

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

Buckets inicializados automáticamente:

- `field-attachments`
- `report-exports`

### Validación rápida para otra persona de la prueba técnica

1. Iniciar sesión con el usuario demo o admin sembrado.
2. Confirmar que cargan proyectos, visitas y plantillas.
3. Crear o abrir una visita con adjuntos.
4. Generar un borrador desde reportes.
5. Exportar el informe en HTML o PDF.

Si la generación con IA devuelve `429`, la configuración puede estar correcta y el problema ser la cuota de la `GEMINI_API_KEY`. En ese caso, usar otra key con cuota disponible o activar `USE_MOCK_LLM=true` para seguir validando el flujo funcional.

### Credenciales sembradas por defecto

El seed crea o actualiza estos usuarios, controlados por variables `SEED_*`:

- Admin: `admin@example.com` / `Admin123!`
- Demo: `demo@example.com` / `Demo123!`

También deja disponibles las plantillas:

- `Cliente A - Informe claro de supervisión`
- `Cliente B - Informe técnico de supervisión`

### Desarrollo local sin Docker

1. Crea el archivo [backend/.env.example](backend/.env.example) como base para `backend/.env`.
2. Prepara un entorno virtual e instala dependencias.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Aplica migraciones.

```bash
cd backend
alembic upgrade head
```

4. Levanta la API.

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

5. Si necesitas el seed fuera de Docker:

```bash
cd backend
python scripts/seed_data.py
```

### Verificación automatizada

Regresión de seguridad y aislamiento:

```bash
cd backend
pytest tests/test_security.py -q
```

Validación integral del pipeline:

```bash
cd backend
python scripts/verify_pipeline.py
```

Con `USE_MOCK_LLM=true`, el backend no consume cuota de Gemini y sigue permitiendo validar generación y exportación.

## Production Checklist

- Configurar SSL/TLS delante de Next.js y FastAPI con un reverse proxy real y certificados válidos.
- Sustituir MinIO local por un bucket S3 real o equivalente compatible, con credenciales rotadas y políticas privadas.
- Definir `GEMINI_API_KEY` de producción y separar proyecto/cuota respecto al entorno de desarrollo.
- Rotar `JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` y `MINIO_SECRET_KEY` antes del despliegue.
- Cambiar las credenciales seed por valores propios del cliente si el entorno no es de demo.
- Ejecutar `pytest tests/test_security.py -q` y la pasada manual de exportación antes de cada release.
- Monitorizar logs del backend, expiración de URLs firmadas y backups de PostgreSQL/S3.

## Validaciones funcionales recientes

- La ruta dinámica de detalle de visita `/visits/[id]` permite entrar desde el listado y revisar notas, contexto y adjuntos.
- Las imágenes privadas almacenadas en MinIO se muestran en frontend mediante URLs firmadas generadas por el backend, evitando `403 AccessDenied` al abrir visitas o reportes.
- El exportador PDF incrusta las fotos en la sección marcada por la plantilla cuando `includes_photo=true`, manteniendo proporciones y continuidad visual con el informe.

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
