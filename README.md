# 02 Dockerizando el Backend — Laravel + MySQL

## El escenario

Acabas de incorporarte al equipo de frontend de **BookShelf**, una aplicación para gestionar tu catálogo personal de libros.

El equipo de backend ya tiene lista la API en Laravel **y te la entrega con su `Dockerfile` incluido**: el código fuente está en la carpeta `backend/` y ya hay un `Dockerfile` listo para construir la imagen. Lo que falta es el fichero que **orquesta** todos los servicios juntos.

El equipo de backend te dice: _"El código está listo y ya tiene su Dockerfile. Ahora necesitamos que alguien cree el `docker-compose.yml` para levantar el backend y la base de datos juntos, de una sola vez."_

Tu misión: **entender el `Dockerfile` que te proporcionamos y escribir el `docker-compose.yml`** que levante el backend Laravel y la base de datos MySQL.

---

## Estructura del proyecto

```
02-laboratorio-laravel/
├── 00-enunciado.md
├── backend/              ← API Laravel 11 (ya hecha, con Dockerfile)
│   ├── app/
│   │   ├── Http/Controllers/BookController.php
│   │   └── Models/Book.php
│   ├── bootstrap/
│   ├── config/
│   ├── public/
│   ├── routes/api.php    ← GET /api/books  y  POST /api/books
│   ├── storage/
│   ├── artisan
│   ├── composer.json
│   └── Dockerfile        ← ya proporcionado, solo lo lees
├── db/
│   └── init.sql          ← schema + datos de ejemplo (ya proporcionado)
├── frontend/             ← Next.js 15 (ya hecho, corre en local)
│   ├── next.config.ts    ← proxy /api → localhost:8000
│   └── src/
└── docker-compose.yml    ← ESTO LO ESCRIBES TÚ
```

---

## Objetivos del laboratorio

- Leer y entender la estructura de un `Dockerfile` para una aplicación PHP/Laravel
- Comprender por qué se instalan ciertas extensiones de PHP y cómo funciona Composer dentro de Docker
- Entender la caché de capas de Docker y por qué acelera las builds
- **Crear un `docker-compose.yml`** que construya la imagen del backend en local (`build:`)
- Conectar el backend con MySQL usando variables de entorno y redes Docker
- Verificar que los datos sobreviven a un `docker compose down / up`

---

## Paso 0 — Arranca el frontend en local (sin Docker)

Antes de nada, comprueba que el frontend funciona por sí solo:

```bash
cd frontend
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Verás que la UI carga pero **el catálogo de libros falla** al intentar conectar con la API (`/api/books`). Normal: no hay backend corriendo todavía.

---

## Paso 1 — Lee y entiende el `Dockerfile` del backend

Antes de crear el `docker-compose.yml`, abre `backend/Dockerfile` y léelo. A continuación se explica cada bloque para que entiendas qué hace y por qué.

### Imagen base y dependencias del sistema

Laravel requiere PHP 8.2 o superior. Usamos la imagen oficial de PHP con la variante CLI (no necesitamos un servidor web completo porque usaremos `artisan serve`). Además instalamos `git`, `unzip` y `zip`, que Composer necesita internamente para descargar paquetes:

```dockerfile
FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    && docker-php-ext-install pdo pdo_mysql zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
```

> **`docker-php-ext-install`** es un comando especial que solo existe en las imágenes oficiales de PHP. Compila e instala extensiones nativas como `pdo_mysql` (necesaria para que Laravel hable con MySQL) o `zip` (necesaria para que Composer pueda descomprimir paquetes). Al final limpiamos la caché de `apt` para no engordar la imagen innecesariamente.

### Composer

Composer es el gestor de paquetes de PHP (equivalente a `npm` en Node). En vez de instalarlo manualmente, lo copiamos directamente desde su imagen oficial (patrón `COPY --from`). Así no añadimos pasos extra de descarga:

```dockerfile
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
```

### Directorio de trabajo y dependencias

```dockerfile
WORKDIR /app

# Copia primero solo composer.json para aprovechar la caché de capas:
# si no cambia, Docker reutiliza la capa del 'composer install' en builds sucesivas
COPY composer.json ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist
```

> **¿Por qué copiar `composer.json` antes que el resto del código?** Docker construye la imagen capa a capa. Si copias todo el código antes del `composer install`, cualquier cambio en cualquier fichero PHP invalida la caché y Docker tiene que volver a descargar todos los paquetes. Copiar solo `composer.json` primero hace que la capa del `composer install` solo se reconstruya cuando cambien las dependencias. Es como si en un `Dockerfile` de Node copiaras `package.json` antes de `npm install` y luego copiaras el código.

### Código fuente y preparación

```dockerfile
# Copia el resto del código fuente
COPY . .

# Regenera el autoloader con todos los ficheros de la aplicación
RUN composer dump-autoload --optimize

# Permisos de escritura en los directorios que Laravel necesita
RUN chmod +x artisan \
    && mkdir -p storage/logs storage/framework/cache/data storage/framework/sessions storage/framework/views bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache
```

> **¿Qué es la `APP_KEY`?** Es una clave de cifrado que Laravel usa internamente para proteger sesiones y datos. En lugar de generarla durante la build, la inyectamos como variable de entorno desde `docker-compose.yml`. Así el Dockerfile queda sin estado y la misma imagen puede reutilizarse en distintos entornos.

### Puerto y arranque

```dockerfile
EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
```

> **`--host=0.0.0.0`:** Imprescindible dentro de un contenedor. Sin él, `artisan serve` escucha solo en `127.0.0.1` (el localhost _del contenedor_) y desde fuera no se puede acceder. Con `0.0.0.0` acepta conexiones de cualquier interfaz, incluida la que usa Docker para comunicarse con tu máquina.

---

## Paso 2 — Crea el `docker-compose.yml`

Aquí está la parte principal del laboratorio. Crea el fichero `docker-compose.yml` en la raíz del proyecto (al mismo nivel que la carpeta `backend/`).

El fichero tiene que definir **dos servicios**: la base de datos MySQL y el backend Laravel.

### Servicio de base de datos

Ya hiciste esto en el laboratorio anterior. Reutiliza lo que aprendiste: misma imagen (`mysql:8.0`), mismas credenciales, mismo puerto.

La única novedad es el segundo volumen: además de persistir los datos, tienes que montar el fichero `./db/init.sql` dentro del contenedor en la ruta `/docker-entrypoint-initdb.d/`. MySQL ejecuta automáticamente cualquier `.sql` que encuentre ahí la **primera vez** que arranca.

> **Pista:** los volúmenes se listan como `- origen:destino`. Añade `:ro` al final para montarlo en modo solo lectura.

### Servicio de backend

Este es el nuevo reto. Necesitas declarar un servicio llamado `backend` con lo siguiente:

**1. Construir desde el Dockerfile local en vez de usar una imagen publicada**

En el laboratorio anterior usabas `image: nombre-imagen`. Aquí el backend no está en Docker Hub: tienes su código fuente y su `Dockerfile`. Hay una directiva que le dice a Compose "construye la imagen desde esta carpeta":

```
build: ./backend
```

**2. Exponer el puerto correcto**

El backend escucha en el `8000`. Mapealo igual que hiciste con MySQL.

**3. Pasarle las variables de entorno a la aplicación**

Laravel necesita tanto la configuración de la base de datos como las variables propias de la aplicación. Pásalas todas como `environment`:

| Variable        | Pista                                                               |
| --------------- | ------------------------------------------------------------------- |
| `APP_NAME`      | El nombre de la app, p.ej. `BookShelf`                              |
| `APP_ENV`       | Entorno local de desarrollo: `local`                                |
| `APP_KEY`       | Ver nota abajo                                                      |
| `APP_DEBUG`     | `false` (no necesitamos stacktraces en el navegador)                |
| `APP_URL`       | La URL pública del backend: `http://localhost:8000`                 |
| `DB_CONNECTION` | El driver de base de datos que usa Laravel: `mysql`                 |
| `DB_HOST`       | Ver nota abajo                                                      |
| `DB_PORT`       | Puerto estándar de MySQL: `3306`                                    |
| `DB_DATABASE`   | El nombre de la base de datos que configuraste en el servicio MySQL |
| `DB_USERNAME`   | El usuario de MySQL que configuraste                                |
| `DB_PASSWORD`   | La contraseña de MySQL que configuraste                             |

> **`APP_KEY`:** Laravel la necesita para cifrar sesiones y otros datos internos. Genera un valor con `openssl rand -base64 32` y prefijaló con `base64:`. Por ejemplo:
>
> ```
> base64:GdyfN3aV2MMto3pURnEBS6bbwDPumawD1pOJ/KLu4+4=
> ```
>
> Al inyectarla como variable de entorno en Compose, el Dockerfile queda sin estado y la misma imagen sirve para cualquier entorno.

> **`DB_HOST` — punto crítico:** No es `localhost`. Cada contenedor es una máquina independiente, así que `localhost` dentro del backend se refiere al propio contenedor, no a MySQL.
> Docker Compose crea una red privada y registra cada servicio con su nombre. Usa el **nombre del servicio de MySQL** como host y Docker lo resolverá automáticamente.

**4. Indicar que depende de la base de datos**

Usa `depends_on` para que Compose arranque MySQL antes que el backend.

> **Nota:** `depends_on` garantiza el orden de arranque de los _contenedores_, no que MySQL esté listo para aceptar conexiones (tarda unos segundos en inicializarse). Si al arrancar ves un error de conexión en los logs, espera 10-15 segundos y ejecuta:
>
> ```bash
> docker compose restart backend
> ```

### Red personalizada

Añade al final del fichero:

```yaml
networks:
  default:
    name: bookshelf-network
```

Esto le da un nombre fijo a la red que Compose crea. No es imprescindible para que funcione, pero hace más limpio el output de `docker network ls`.

---

## Paso 3 — Construye y levanta el stack

Con el `docker-compose.yml` listo, construye y levanta todo con un solo comando:

```bash
docker compose up --build -d
```

> **`--build`:** Fuerza la construcción de la imagen desde el `Dockerfile`. La primera vez tardará un par de minutos (descarga de la imagen PHP + instalación de paquetes de Composer). Las siguientes builds son mucho más rápidas gracias a la caché de capas.
>
> **`-d`:** Lanza los contenedores en segundo plano (_detached_). Sin este flag, los logs aparecerían en la terminal y no podrías seguir usándola.

Comprueba que los dos contenedores están en marcha:

```bash
docker compose ps
```

Deberías ver algo así:

```
NAME                               STATUS
laboratorio-laravel-backend-1      Up
laboratorio-laravel-bookshelf-db-1 Up
```

Si quieres ver los logs del backend (muy útil para depurar errores de conexión con la base de datos):

```bash
docker compose logs backend
```

> **Truco:** Si ves un error de conexión a la base de datos justo al arrancar, es casi siempre porque MySQL todavía no terminó de inicializarse. Espera 10-15 segundos y ejecuta `docker compose restart backend`.

---

## Paso 4 — Conecta el frontend al stack

Ahora que el backend está corriendo en el puerto `8000`, el frontend en local puede hablar con él a través del proxy de Next.js (configurado en `next.config.ts` para redirigir `/api/*` → `http://localhost:8000/api/*`).

Arranca el frontend si no lo tienes ya en marcha:

```bash
cd frontend
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Ahora sí: el catálogo muestra los 4 libros de ejemplo cargados desde MySQL, y el formulario (botón **+ Añadir libro**) guarda nuevas entradas que persisten en la base de datos.

---

## Paso 5 — Verifica la persistencia

**1. Añade un par de libros desde la UI.**

**2. Para los contenedores:**

```bash
docker compose down
```

**3. Vuelve a levantarlos** (ya no hace falta `--build` si no cambió el código):

```bash
docker compose up -d
```

**4.** Recarga [http://localhost:3000](http://localhost:3000).

¿Siguen estando los libros que añadiste? Eso es la persistencia gracias al bind mount de `./bookshelf-db-data`.

> **Prueba también esto:** ejecuta `docker compose down`, borra manualmente la carpeta `bookshelf-db-data/` y vuelve a hacer `docker compose up -d`. ¿Qué ocurre? ¿Por qué aparecen solo los 4 libros de ejemplo?

---

## Cómo restaurar la base de datos desde cero

```bash
# 1. Para los contenedores
docker compose down

# 2. Borra la carpeta de datos (se perderán todos los cambios)
rm -rf bookshelf-db-data/

# 3. Vuelve a arrancar — el init.sql se ejecuta de nuevo automáticamente
docker compose up -d
```

---

## Parar y limpiar

```bash
docker compose down
```

---
